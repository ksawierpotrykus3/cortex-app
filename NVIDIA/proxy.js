import express from 'express';
import { readFileSync } from 'fs';
import { appendFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Agent, setGlobalDispatcher } from 'undici';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keys = JSON.parse(readFileSync(resolve(__dirname, 'keys.json'), 'utf-8'));

const NVIDIA_BASE = process.env.NVIDIA_BASE || 'https://integrate.api.nvidia.com/v1';
const RPM_LIMIT = 39;
const WINDOW_MS = 60000;
const FETCH_TIMEOUT_MS = 180_000;
const FETCH_TIMEOUT_MIN = 30_000;
const DSML_RE = /<[^>]*DSML[^>]*>[\s\S]*?<\/[^>]*DSML[^>]*>/gi;
const DSML_SELF_CLOSE_RE = /<[^>]*DSML[^>]*\/>/gi;
// Usuwa WSZYSTKIE natywne tagi tool call z contentu
const NATIVE_CLEAN_RE = /<\|tool_calls_section_begin\|>[\s\S]*?<\|tool_calls_section_end\|>/g;
const NESTED_TOOL_CALL_RE = /<\|tool_call_begin\|>\s*\S+?\s*<\|tool_call_argument_begin\|>\s*\{.*?\}\s*<\|tool_call_end\|>/gs;
const TOOL_CALL_TAG_RE = /<\|tool_call_begin\|>\s*(\S+?)\s*<\|tool_call_argument_begin\|>\s*(\{.*?\})\s*<\|tool_call_end\|>/gs;
// Usuwa pojedyncze tagi bez pary (sieroce section_begin/section_end)
const ORPHAN_SECTION_TAG_RE = /<\|tool_calls_section_begin\|>|<\|tool_calls_section_end\|>/g;
// Usuwa uszkodzone/niekompletne bloki tool_call (gdzie ID lub argumenty sa pomieszane)
const BROKEN_TOOL_CALL_RE = /<\|tool_call_begin\|>[\s\S]*?<\|tool_call_end\|>/gs;
// Usuwa samotne sieroce tagi tool_call_end bez tool_call_begin (Kimi czasem zwraca)
const ORPHAN_TOOL_CALL_END_RE = /<\|tool_call_end\|>/g;
// Kompleksowe czyszczenie: pary section, poprawne tool_call, uszkodzone tool_call, sieroce tagi
function cleanNativeTags(text) {
  return text.replace(NATIVE_CLEAN_RE, '').replace(NESTED_TOOL_CALL_RE, '').replace(BROKEN_TOOL_CALL_RE, '').replace(ORPHAN_SECTION_TAG_RE, '').replace(ORPHAN_TOOL_CALL_END_RE, '').trim();
}

const keyAttempts = keys.map(() => []);
const keyCooldown = keys.map(() => 0);
let nextStartIdx = 0;
const MAX_ACTIVE = 8;
let activeRequests = 0;
const pendingQueue = [];

// Per-key stats for monitoring distribution
const keyStats = keys.map(() => ({ total: 0, success: 0, fail: 0, rateLimited: 0 }));

// Model-specific configurations
const MODEL_CONFIG = {
  'deepseek-ai/deepseek-v4-pro': { timeoutMult: 10, retryOnSSE: true },
  'deepseek-ai/deepseek-v4': { timeoutMult: 10, retryOnSSE: true },
  'qwen/qwen3.5-397b-a17b': { timeoutMult: 5, retryOnSSE: true },
  'moonshotai/kimi-k2.6': { timeoutMult: 5, retryOnSSE: true },
};

// Per-model timing: avg TTFT for dynamic timeout
const modelTiming = new Map();
function getDynamicTimeout(model) {
  const t = modelTiming.get(model);
  if (!t || t.count < 2) return FETCH_TIMEOUT_MS;
  // Użyj konfiguracji modelu lub domyślny mnożnik 5x
  const config = MODEL_CONFIG[model] || { timeoutMult: 5 };
  const mult = model.includes('deepseek') ? 10 : config.timeoutMult;
  return Math.min(Math.max(Math.round(t.avg * mult), FETCH_TIMEOUT_MIN), 300_000);
}
function recordModelTiming(model, ms) {
  const t = modelTiming.get(model) || { avg: ms, count: 1 };
  t.avg = ((t.avg * t.count) + ms) / (t.count + 1);
  t.count++;
  modelTiming.set(model, t);
}

function acquireSlot() {
  if (activeRequests < MAX_ACTIVE) {
    activeRequests++;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const tid = setTimeout(() => {
      const idx = pendingQueue.indexOf(resolve);
      if (idx !== -1) pendingQueue.splice(idx, 1);
      reject(new Error('slot_timeout'));
    }, 30000);
    pendingQueue.push(() => {
      clearTimeout(tid);
      resolve();
    });
  });
}

function releaseSlot() {
  if (pendingQueue.length > 0) {
    const next = pendingQueue.shift();
    next();
  } else {
    activeRequests--;
  }
}

// Round-robin key selection: pick the next available key with RPM capacity
function selectBestKey(skipped) {
  const now = Date.now();
  for (let offset = 0; offset < keys.length; offset++) {
    const i = (nextStartIdx + offset) % keys.length;
    if (skipped.has(i)) continue;
    if (keyCooldown[i] > now) continue;
    const arr = keyAttempts[i];
    while (arr.length > 0 && now - arr[0] >= WINDOW_MS) arr.shift();
    if (arr.length < RPM_LIMIT) {
      arr.push(now);
      nextStartIdx = (i + 1) % keys.length;
      return i;
    }
  }
  return null; // all keys at limit
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  appendFile(resolve(__dirname, 'proxy.log'), line + '\n', 'utf-8').catch(() => {});
}

const app = express();
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.post('/v1/chat/completions', express.raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
  const startTime = Date.now();
  let rawBody = req.body.toString('utf-8');
  const isStream = rawBody.includes('"stream":true') || rawBody.includes('"stream": true');
  let parsed;
  try { parsed = JSON.parse(rawBody); } catch (_) { parsed = null; }
  const model = parsed?.model || 'unknown';
  const toolsDefs = parsed?.tools || [];

  if (parsed) {
    // Dodajemy thinking dla modeli innych niz qwen
    if (!model.includes('qwen')) {
      if (!parsed.chat_template_kwargs) parsed.chat_template_kwargs = {};
      if (!parsed.chat_template_kwargs.thinking) parsed.chat_template_kwargs.thinking = true;
    }
    // Kimi na NVIDIA/vLLM: tool_choice "auto" nie dziala w streamingu (vLLM bug)
    // Wysylamy non-stream do NVIDIA, odpowiedz konwertujemy na SSE dla Trae
    // TODO: sprawdzic czy bug vLLM zostal naprawiony - jesli tak, usunac workaround
    if (model.includes('kimi') && isStream) {
      log(`  → Kimi workaround: non-stream + max_tokens boost`);
      parsed.stream = false;
      if ((parsed.max_tokens || 0) < 8192) parsed.max_tokens = 16384;
      if ((parsed.max_completion_tokens || 0) < 8192) parsed.max_completion_tokens = 16384;
    }
    // Trim: usuwamy niepotrzebne pola dla duzych payloadow
    if (rawBody.length > 100000) {
      delete parsed.chat_template_kwargs;
      delete parsed.matched_stop;
      const mSize = JSON.stringify(parsed.messages || '').length;
      const tSize = JSON.stringify(parsed.tools || '').length;
      log(`  Body: ${rawBody.length}b (msgs=${mSize}, tools=${tSize})`);
    }
    rawBody = JSON.stringify(parsed);
  }

  log(`→ Request: model=${model}, isStream=${isStream}, size=${rawBody.length} bytes`);

  // Pre-generate SSE metadata for consistency
  const sseModel = model.includes('kimi') ? 'deepseek-ai/deepseek-v4-pro' : model;
  const cid = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  const sseId = cid;

  let headersSentToClient = false;
  let doneSent = false;
  const sendSseHeaders = () => {
    if (headersSentToClient) return;
    headersSentToClient = true;
    res.socket?.setNoDelay(true);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Transfer-Encoding': 'chunked',
      'X-Proxy-Version': '1.0',
    });
    const firstChunk = `data: ${JSON.stringify({
      id: sseId, object: 'chat.completion.chunk', created,
      model: sseModel,
      choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }]
    })}\n\n`;
    try { res.write(firstChunk); } catch (_) {}
  };

  try {
    await acquireSlot();
  } catch (_) {
    if (isStream && headersSentToClient) {
      try { res.write('data: [DONE]\n\n'); res.end(); } catch (_) {}
    } else {
      res.status(503).json({
        error: { message: 'All server slots are busy. Try again.', type: 'overloaded', status: 503 }
      });
    }
    return;
  }

  const skipped = new Set();
  let consecutiveFails = 0;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const bestIdx = selectBestKey(skipped);

    if (bestIdx === null) {
      releaseSlot();
      log(`✗ 429: all keys at limit`);
      if (isStream && headersSentToClient) {
        try { res.write('data: [DONE]\n\n'); res.end(); } catch (_) {}
      } else {
        res.status(429).json({
          error: {
            message: 'All API keys have reached their 40 RPM limit. Try again later.',
            type: 'rate_limit_error',
            status: 429
          }
        });
      }
      return;
    }

    keyStats[bestIdx].total++;

    const apiKey = keys[bestIdx];
    const keyLabel = `key${bestIdx + 1}`;
    const fetchStart = Date.now();
    const baseTimeout = getDynamicTimeout(model);
    const bodyMinTimeout = Math.max(30000, Math.min(Math.round(rawBody.length / 5000 * 1000), 120000));
    // Dla deepseek nie skracamy timeoutu przy failach - model ma naturalnie dużą wariancję TTFT
    const multiplier = model.includes('deepseek')
      ? 1.0
      : Math.max(0.3, 1 - (consecutiveFails * 0.12));
    const dynamicTimeout = Math.max(Math.round(baseTimeout * multiplier), bodyMinTimeout);
    log(`→ Fetching from NVIDIA (${keyLabel}, timeout=${Math.round(dynamicTimeout/1000)}s)...`);

    try {
      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), dynamicTimeout);
      const onDisconnect = () => { ac.abort(); try { res.end(); } catch (_) {} };
      req.on('close', onDisconnect);
      req.on('destroy', onDisconnect);

      const fetchHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };

      const nvidiaRes = await fetch(`${NVIDIA_BASE}/chat/completions`, {
        method: 'POST',
        headers: fetchHeaders,
        body: rawBody,
        signal: ac.signal
      });

      clearTimeout(timeout);
      req.off('close', onDisconnect);
      req.off('destroy', onDisconnect);

      const fetchTime = Date.now() - fetchStart;
      log(`← NVIDIA response: ${nvidiaRes.status} in ${fetchTime}ms (${keyLabel})`);

      keyStats[bestIdx].success++;
      // Record TTFT for dynamic timeout
      recordModelTiming(model, fetchTime);

      if (nvidiaRes.status === 429) {
        nvidiaRes.body?.cancel()?.catch(() => {});
        keyStats[bestIdx].rateLimited++;
        keyCooldown[bestIdx] = Date.now() + 60000 + Math.floor(Math.random() * 20000) - 10000;
        log(`⚠ Key ${keyLabel} rate limited (cooling 60s), trying next...`);
        skipped.add(bestIdx);
        continue;
      }

      if (!nvidiaRes.ok) {
        const errBody = await nvidiaRes.text();
        // 5xx: server error, retry with backoff on next key
        if (nvidiaRes.status >= 500) {
          const backoff = Math.min(1000 * Math.pow(2, attempt), 10000);
          keyCooldown[bestIdx] = Date.now() + backoff;
          log(`⚠ Key ${keyLabel} 5xx (cooling ${backoff}ms), trying next...`);
          skipped.add(bestIdx);
          continue;
        }
        // 4xx: client error, fail immediately
        releaseSlot();
        log(`✗ NVIDIA error ${nvidiaRes.status}: ${errBody.slice(0, 200)}`);
        if (isStream && headersSentToClient) {
          try { res.write(`data: ${JSON.stringify({error: {message: `NVIDIA API error: ${errBody.slice(0,200)}`, type: 'upstream_error'}})}\n\ndata: [DONE]\n\n`); res.end(); } catch (_) {}
        } else {
          res.status(nvidiaRes.status).json({
            error: {
              message: `NVIDIA API error: ${errBody}`,
              type: 'upstream_error',
              status: nvidiaRes.status
            }
          });
        }
        return;
      }

      if (isStream) {
        log(`→ Streaming response to client...`);
        sendSseHeaders();


          // Kimi: moze byc JSON (non-stream wymuszony) LUB SSE (jesli workaround sie nie wykonal)
        if (model.includes('kimi')) {
          const rawText = await nvidiaRes.text();
          let jsonData;
          try {
            jsonData = JSON.parse(rawText);
          } catch (_) {
            // Nie JSON - to SSE stream, obslugujemy normalnie
            log(`  → Kimi got SSE, not JSON - fallback to normal streaming`);
            const lines = rawText.split('\n');
            let sseBuf = '';
            let lastUsage = null;
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.usage) lastUsage = parsed.usage;
                res.write(line + '\n\n');
                sseBuf += line + '\n\n';
              } catch (_) { break; }
            }
            // Dodaj usage do ostatniego chunka przed [DONE]
            if (lastUsage && !doneSent) {
              try {
                const usageChunk = `data: ${JSON.stringify({ id: sseId, object: 'chat.completion.chunk', created, model: sseModel, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: lastUsage })}\n\n`;
                res.write(usageChunk);
                log(`✓ Added usage to stream: ${lastUsage.total_tokens || 'unknown'} tokens`);
              } catch (_) {}
            }
            if (!doneSent) {
              try { res.write('data: [DONE]\n\n'); } catch (_) {}
            }
            const tail = sseBuf.slice(-2000).replace(/\n/g, '\\n').replace(/\r/g, '\\r');
            log(`[stream tail] ...${tail}`);
            try { res.end(); } catch (_) {}
            log(`✓ Kimi SSE fallback: ${lines.length} lines, ${sseBuf.length} bytes`);
            releaseSlot();
            return;
          }
          const msg = jsonData.choices?.[0]?.message || {};
          const finishReason = jsonData.choices?.[0]?.finish_reason || 'stop';
          let fullContent = msg.content || '';
          let fullReasoning = msg.reasoning_content || msg.reasoning || '';
          // Zawsze czyść reasoning z natywnych tagów
          fullReasoning = cleanNativeTags(fullReasoning);
          let extractedTCs = msg.tool_calls && msg.tool_calls.length > 0 ? [...msg.tool_calls] : [];
          if (msg.tool_calls?.length > 0) log(`⚠ msg.tool_calls: ${JSON.stringify(msg.tool_calls.map(t=>({name:t.function?.name, id:t.id, args:t.function?.arguments?.slice(0,40)})))}`);
          let cleanContent = fullContent;
          // Parsuj natywne tool_call tagi z contentu (Kimi często zwraca je w content zamiast msg.tool_calls)
          if (cleanContent.includes('<|tool_call_begin|>')) {
            log(`⚠ Raw native tool call content: ${fullContent.slice(fullContent.indexOf('<|tool_call_begin|>'), fullContent.indexOf('<|tool_call_end|>') + '<|tool_call_end|>'.length).replace(/\n/g, '\\n').replace(/\r/g, '\\r')}`);
            log(`⚠ toolsDefs (${toolsDefs.length}): ${JSON.stringify(toolsDefs.map(t=>t.function?.name || '?'))}`);
          TOOL_CALL_TAG_RE.lastIndex = 0;
          let m;
            while ((m = TOOL_CALL_TAG_RE.exec(cleanContent)) !== null) {
              let fnName = 'unknown_tool', bestScore = -1;
              try {
                const argObj = JSON.parse(m[2]);
                const argKeys = Object.keys(argObj);
                for (const tool of toolsDefs) {
                  const props = tool.function?.parameters?.properties || {};
                  const propKeys = Object.keys(props);
                  const reqd = tool.function?.parameters?.required || [];
                  const reqdMatch = reqd.length > 0 ? reqd.every(k => argKeys.includes(k)) : true;
                  let matchCount = argKeys.filter(k => propKeys.includes(k)).length;
                  if (reqdMatch && matchCount > bestScore) {
                    bestScore = matchCount;
                    fnName = tool.function?.name || 'unknown_tool';
                  }
                }
                if (bestScore <= 0 && argKeys.includes('command')) fnName = 'RunCommand';
              } catch (_) {}
              extractedTCs.push({ id: m[1], type: 'function', function: { name: fnName, arguments: m[2] } });
            }
          }
          // ZAWSZE czyść content z natywnych tagów - nawet niekompletnych
          cleanContent = cleanNativeTags(cleanContent);
          const write = (data) => { try { res.write(data); } catch (_) {} };
          const mkChunk = (delta, fr = null) => `data: ${JSON.stringify({ id: sseId, object: 'chat.completion.chunk', created, model: sseModel, choices: [{ index: 0, delta, finish_reason: fr }] })}\n\n`;
          // first empty chunk already sent in early flush
          if (fullReasoning) { write(mkChunk({ reasoning: fullReasoning, reasoning_content: fullReasoning })); }
          if (cleanContent) { write(mkChunk({ content: cleanContent })); }
          if (extractedTCs.length > 0 && toolsDefs.length > 0) {
            // Korekta nazw funkcji jesli model je pomylil (Kimi czesto nazywa Write jako Read)
            for (const tc of extractedTCs) {
              const argsStr = tc.function?.arguments;
              if (typeof argsStr === 'string') {
                try {
                  const argObj = JSON.parse(argsStr);
                  const argKeys = Object.keys(argObj);
                  const curTool = toolsDefs.find(t => t.function?.name === tc.function?.name);
                  if (curTool) {
                    const props = curTool.function?.parameters?.properties || {};
                    const ok = argKeys.some(k => k in props);
                    if (!ok && argKeys.length > 0) {
                      // Nazwa nie pasuje - szukaj lepszej
                      for (const tool of toolsDefs) {
                        const tProps = tool.function?.parameters?.properties || {};
                        const reqd = tool.function?.parameters?.required || [];
                        const match = reqd.length > 0 ? reqd.every(k => argKeys.includes(k)) : argKeys.some(k => k in tProps);
                        if (match) { tc.function.name = tool.function?.name || tc.function?.name; break; }
                      }
                    }
                  }
                } catch (_) {}
              }
            }
            let callIdCounter = 0;
            const tcDelta = extractedTCs.map((tc, i) => ({ index: i, id: tc.id || `call_${cid}_${callIdCounter++}`, type: tc.type || 'function', function: { name: tc.function?.name, arguments: tc.function?.arguments } }));
            write(mkChunk({ tool_calls: tcDelta }));
            write(mkChunk({}, 'tool_calls'));
          } else {
            write(mkChunk({}, finishReason));
          }
          write('data: [DONE]\n\n');
          try { res.end(); } catch (_) {}
          const tcDetail = extractedTCs.map(t => `${t.function?.name}(id=${t.id||'null'}, args=${typeof t.function?.arguments}:${String(t.function?.arguments).slice(0,60)})`).join(', ');
          log(`✓ Kimi JSON->SSE: ${extractedTCs.length} tool calls [${tcDetail}], content=${cleanContent.length}, reasoning=${fullReasoning.length}`);
          releaseSlot();
          return;
        }
        const keepalive = setInterval(() => {
          try { if (headersSentToClient) res.write(': keepalive\n\n'); } catch (_) { clearInterval(keepalive); }
        }, 5000);
        const reader = nvidiaRes.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let chunks = 0, bytes = 0;
        const streamStart = Date.now();
        let streamDone = false;
        doneSent = false;
        const onStreamDisconnect = () => { if (!streamDone) { clearInterval(keepalive); reader.cancel().catch(() => {}); streamDone = true; } };
        req.on('close', onStreamDisconnect);
        req.on('destroy', onStreamDisconnect);
        let streamBuf = '';
        let lineBuffer = '';
        const tcNames = new Map();
        let lastUsage = null; // Przechowaj usage z ostatniego chunka
        let totalStreamContent = ''; // Licz znaki do estymacji tokenów
        while (!streamDone) {
          let chunk;
          try { chunk = await reader.read(); } catch (_) { break; }
          if (chunk.done) break;
          const val = chunk.value;
          const text = decoder.decode(val, { stream: true });
          streamBuf += text;
          if (streamBuf.length > 20480) streamBuf = streamBuf.slice(-10240);
          chunks++; bytes += val.length;
          
          // Sprawdź czy NVIDIA zwróciła błąd SSE (event: error)
          if (text.includes('event: error')) {
            log(`⚠ NVIDIA SSE error event detected`);
            clearInterval(keepalive);
            streamDone = true;
            reader.cancel().catch(() => {});
            if (headersSentToClient) {
              log(`✗ Upstream stream failed midway. Aborting.`);
              releaseSlot();
              try { res.write('data: [DONE]\n\n'); res.end(); } catch (_) {}
              return;
            } else {
              keyCooldown[bestIdx] = Date.now() + 30000;
              skipped.add(bestIdx);
              break; // wyjdź z pętli while, for loop spróbuje następnego klucza
            }
          }
          
          lineBuffer += text;
          const lines = lineBuffer.split('\n');
          lineBuffer = lines.pop() || ''; // Zachowaj ostatnią (potencjalnie niepełną) linię w buforze
          
          const cleanParts = [];
          for (let li = 0; li < lines.length; li++) {
            const line = lines[li].replace(/\r$/, ''); // Usuwamy \r na końcu (Windows CRLF)
            if (!line.trim()) continue;
            if (!line.startsWith('data: ')) {
              cleanParts.push(line + '\n');
              continue;
            }
            if (line === 'data: [DONE]') { if (!doneSent) { cleanParts.push(line + '\n\n'); doneSent = true; } continue; }
            if (!line.includes('DSML') && !line.includes('tool_calls') && !line.includes('tool_call')) {
              // Czysty chunk bez tool calls - przepuszczamy bez zmian
              cleanParts.push(line + '\n\n');
            } else {
              try {
                const parsed = JSON.parse(line.slice(6));
                const delta = parsed.choices?.[0]?.delta;
                // Przechowaj usage z ostatniego chunka
                if (parsed.usage) lastUsage = parsed.usage;
                // Licz znaki do estymacji tokenów jeśli brak usage
                if (!lastUsage && delta?.content) totalStreamContent += delta.content;
                if (delta) {
                  // Czyść natywne tagi tool call z contentu (Qwen i inne modele też mogą je zwracać)
                  if (delta.content && typeof delta.content === 'string') {
                    delta.content = cleanNativeTags(delta.content);
                    if (!delta.content) delta.content = ''; // nie usuwaj pola, tylko ustaw puste
                  }
                  if (delta.reasoning_content) delta.reasoning_content = delta.reasoning_content.replace(DSML_RE, '').replace(DSML_SELF_CLOSE_RE, '');
                  if (delta.reasoning) {
                    delta.reasoning = delta.reasoning.replace(DSML_RE, '').replace(DSML_SELF_CLOSE_RE, '');
                    // Czyść też natywne tagi z reasoning
                    delta.reasoning = cleanNativeTags(delta.reasoning);
                  }
                  if (delta.tool_calls) {
                    const valid = delta.tool_calls.filter(tc => {
                      const idx = tc.index;
                      if (tc.function?.name && tc.function.name !== 'null') { tcNames.set(idx, tc.function.name); return true; }
                      return tcNames.has(idx);
                    });
                    if (valid.length === 0) { delta.tool_calls = null; } else { delta.tool_calls = valid; }
                  }
                }
                cleanParts.push(`data: ${JSON.stringify(parsed)}\n\n`);
              } catch (e) {
                log(`⚠ SSE parse error: ${e.message}, line: ${line.slice(0, 120)}`);
                cleanParts.push(line + '\n\n');
              }
            }
          }
          if (cleanParts.length > 0) {
            try { res.write(cleanParts.join('')); } catch (_) { break; }
          }
        }
        streamDone = true;
        clearInterval(keepalive);
        const final = decoder.decode();
        if (final) { 
          streamBuf += final;
          lineBuffer += final;
        }
        
        // Przetwórz pozostałą część z lineBuffer
        if (lineBuffer) {
          const lines = lineBuffer.split('\n');
          const cleanParts = [];
          for (let li = 0; li < lines.length; li++) {
            const line = lines[li].replace(/\r$/, '');
            if (!line.trim()) continue;
            if (!line.startsWith('data: ')) {
              cleanParts.push(line + '\n');
              continue;
            }
            if (line === 'data: [DONE]') { if (!doneSent) { cleanParts.push(line + '\n\n'); doneSent = true; } continue; }
            try {
              const parsed = JSON.parse(line.slice(6));
              const delta = parsed.choices?.[0]?.delta;
              if (parsed.usage) lastUsage = parsed.usage;
              if (!lastUsage && delta?.content) totalStreamContent += delta.content;
              if (delta) {
                if (delta.content && typeof delta.content === 'string') {
                  delta.content = cleanNativeTags(delta.content);
                  if (!delta.content) delta.content = '';
                }
                if (delta.reasoning_content) delta.reasoning_content = delta.reasoning_content.replace(DSML_RE, '').replace(DSML_SELF_CLOSE_RE, '');
                if (delta.reasoning) {
                  delta.reasoning = delta.reasoning.replace(DSML_RE, '').replace(DSML_SELF_CLOSE_RE, '');
                  delta.reasoning = cleanNativeTags(delta.reasoning);
                }
                if (delta.tool_calls) {
                  const valid = delta.tool_calls.filter(tc => {
                    const idx = tc.index;
                    if (tc.function?.name && tc.function.name !== 'null') { tcNames.set(idx, tc.function.name); return true; }
                    return tcNames.has(idx);
                  });
                  if (valid.length === 0) { delta.tool_calls = null; } else { delta.tool_calls = valid; }
                }
              }
              cleanParts.push(`data: ${JSON.stringify(parsed)}\n\n`);
            } catch (e) {
              cleanParts.push(line + '\n\n');
            }
          }
          if (cleanParts.length > 0) {
            try { res.write(cleanParts.join('')); } catch (_) {}
          }
        }
        
        // Sprawdź czy ostatni chunk miał finish_reason - jeśli nie, dodaj sztuczny chunk końcowy
        // Qwen czasem kończy stream bez finish_reason (bug NVIDIA)
        const lastFewLines = streamBuf.slice(-500);
        const hasFinishReason = lastFewLines.includes('"finish_reason":"stop"') || 
                                 lastFewLines.includes('"finish_reason":"tool_calls"') ||
                                 lastFewLines.includes('"finish_reason":null') && lastFewLines.includes('[DONE]');
        if (!hasFinishReason) {
          log(`⚠ Qwen stream missing finish_reason - adding synthetic final chunk`);
          try {
            res.write(`data: ${JSON.stringify({ id: sseId, object: 'chat.completion.chunk', created, model: sseModel, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`);
          } catch (_) {}
        }
        
        if (!doneSent) {
          // Dodaj usage do ostatniego chunka przed [DONE] - CodeBuddy potrzebuje tego do liczenia kontekstu
          let usageToSend = lastUsage;
          // Jeśli NVIDIA nie zwróciło usage, estymuj z długości contentu (1 token ≈ 4 znaki)
          if (!usageToSend && totalStreamContent.length > 0) {
            usageToSend = {
              prompt_tokens: 0, // Nie znamy, CodeBuddy sam policzy z requestu
              completion_tokens: Math.round(totalStreamContent.length / 4),
              total_tokens: Math.round(totalStreamContent.length / 4)
            };
            log(`✓ Estimated usage: ${usageToSend.total_tokens} tokens (from ${totalStreamContent.length} chars)`);
          }
          if (usageToSend) {
            try {
              const usageChunk = `data: ${JSON.stringify({ id: sseId, object: 'chat.completion.chunk', created, model: sseModel, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: usageToSend })}\n\n`;
              res.write(usageChunk);
            } catch (_) {}
          }
          try { res.write('data: [DONE]\n\n'); } catch (_) {}
        }
        const tail = streamBuf.slice(-2000).replace(/\n/g, '\\n').replace(/\r/g, '\\r');
        log(`[stream tail] ...${tail}`);
        try { res.end(); } catch (_) {}
        log(`✓ Stream complete: ${chunks} chunks, ${bytes} bytes in ${Date.now() - streamStart}ms`);
      } else {
        log(`→ Piping non-stream response to client...`);
        const pipeStart = Date.now();
        if (!res.headersSent) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
        }
        const reader = nvidiaRes.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let pipeDone = false;
        const onPipeDisconnect = () => { if (!pipeDone) { reader.cancel().catch(() => {}); pipeDone = true; } };
        req.on('close', onPipeDisconnect);
        req.on('destroy', onPipeDisconnect);
        let buffer = '';
        while (!pipeDone) {
          let chunk;
          try { chunk = await reader.read(); } catch (_) { break; }
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          try { res.write(decoder.decode(chunk.value, { stream: true })); } catch (_) { break; }
        }
        pipeDone = true;
        const final = decoder.decode();
        if (final) { buffer += final; try { res.write(final); } catch (_) {} }
        try { res.end(); } catch (_) {}
        
        // Log usage jeśli dostępne
        try {
          const jsonData = JSON.parse(buffer);
          const usage = jsonData.usage;
          if (usage) {
            log(`✓ Non-stream usage: ${usage.total_tokens || 'unknown'} tokens (prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens})`);
          } else {
            log(`⚠ Non-stream response missing usage field`);
          }
        } catch (_) {}
        
        log(`✓ Pipe complete in ${pipeStart}ms, total=${Date.now() - startTime}ms`);
      }
      releaseSlot();
      return;
    } catch (err) {
      consecutiveFails++;
      keyStats[bestIdx].fail++;
      if (err.name === 'AbortError') {
        log(`✗ Timeout ${consecutiveFails}/${keys.length} after ${Math.round(dynamicTimeout/1000)}s (${keyLabel}, fail=${consecutiveFails})`);
        await new Promise(r => setTimeout(r, 2000));
      } else {
        log(`✗ Fetch error ${consecutiveFails}/${keys.length}: ${err.message} (${keyLabel}, fail=${consecutiveFails})`);
      }
      keyCooldown[bestIdx] = Date.now() + Math.min(1000 * Math.pow(2, attempt), 10000);
      skipped.add(bestIdx);
      if (consecutiveFails >= 5) {
        releaseSlot();
        log(`✗ ${consecutiveFails} consecutive failures, aborting`);
        if (!res.headersSent) {
          res.status(504).json({
            error: {
              message: `${consecutiveFails} consecutive upstream failures. Model ${model} is overloaded. Try again later.`,
              type: 'upstream_error',
              status: 504
            }
          });
        } else {
          try { res.write('data: [DONE]\n\n'); res.end(); } catch (_) {}
        }
        return;
      }
      continue;
    }
  }

  log(`✗ All keys returned 429`);
  releaseSlot();
  if (isStream && res.headersSent) {
    try {
      res.write(`data: ${JSON.stringify({error: {message: 'All API keys returned 429. All accounts rate limited.', type: 'rate_limit_error', status: 429}})}\n\ndata: [DONE]\n\n`);
      res.end();
    } catch (_) {}
  } else {
    res.status(429).json({
      error: {
        message: 'All API keys returned 429. All accounts rate limited.',
        type: 'rate_limit_error',
        status: 429
      }
    });
  }
});

// Connection pool: reuse TCP+TLS connections to NVIDIA, HTTP/1.1 (NVIDIA nie wspiera H2)
const nvidiaAgent = new Agent({
  connections: 16,
  keepAliveTimeout: 60000,
  keepAliveMaxTimeout: 120000,
  connectTimeout: 5000,
});
setGlobalDispatcher(nvidiaAgent);

// Pre-warm TCP+TLS connections without burning RPM (no Authorization header)
async function warmNvidiaConnections() {
  await Promise.allSettled(
    Array.from({ length: 2 }, () =>
      fetch(`${NVIDIA_BASE}/models`, { signal: AbortSignal.timeout(8000) })
        .then(r => r.body?.cancel?.())
        .catch(() => {})
    )
  );
  log('Warmed 2 NVIDIA connections (no auth, no RPM cost)');
}
warmNvidiaConnections();

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3456;

// Graceful shutdown
let server;
process.on('SIGTERM', () => { log('SIGTERM: shutting down...'); server?.close(); nvidiaAgent.close().catch(() => {}); process.exit(0); });
process.on('SIGINT', () => { log('SIGINT: shutting down...'); server?.close(); nvidiaAgent.close().catch(() => {}); process.exit(0); });

// GET /health - monitoring endpoint
app.get('/health', (req, res) => {
  const modelStats = {};
  for (const [model, t] of modelTiming) modelStats[model] = { avgTtft: Math.round(t.avg), samples: t.count };
  const distribution = keyStats.map((s, i) => ({
    key: `key${i + 1}`,
    total: s.total,
    success: s.success,
    fail: s.fail,
    rateLimited: s.rateLimited,
    successRate: s.total > 0 ? `${Math.round(s.success / s.total * 100)}%` : '-',
    cooldown: keyCooldown[i] > Date.now() ? keyCooldown[i] - Date.now() : 0,
  }));
  const totalReqs = keyStats.reduce((a, s) => a + s.total, 0);
  const maxKey = distribution.reduce((a, b) => a.total > b.total ? a : b, distribution[0]);
  const minKey = distribution.reduce((a, b) => a.total < b.total ? a : b, distribution[0]);
  const balanceRatio = totalReqs > 0 && maxKey ? (maxKey.total / (totalReqs / keys.length)).toFixed(1) : '-';
  res.json({
    uptime: process.uptime(),
    activeRequests,
    requestsTotal: totalReqs,
    balanceRatio: `${balanceRatio}x (ideal=1.0, key${distribution.indexOf(maxKey) + 1}=${maxKey.total}, key${distribution.indexOf(minKey) + 1}=${minKey.total})`,
    keyDistribution: distribution,
    modelTiming: modelStats,
    warmed: true,
  });
});

// GET /v1/models - Trae wywoluje przed chat completions zeby sprawdzic model
app.get('/v1/models', (req, res) => {
  res.json({
    object: 'list',
    data: [
      { id: 'deepseek-ai/deepseek-v4-pro', object: 'model', created: 1781936000, owned_by: 'system' },
      { id: 'deepseek-ai/deepseek-v4', object: 'model', created: 1781936000, owned_by: 'system' },
      { id: 'moonshotai/kimi-k2.6', object: 'model', created: 1781936000, owned_by: 'system' },
      { id: 'deepseek-ai/deepseek-v3.2', object: 'model', created: 1781936000, owned_by: 'system' },
      { id: 'meta/llama-3.3-70b-instruct', object: 'model', created: 1781936000, owned_by: 'system' },
    ]
  });
});

app.listen(PORT, () => {
  log(`NVIDIA Key Rotator running on http://localhost:${PORT}`);
  log(`Keys loaded: ${keys.length} (${keys.length * RPM_LIMIT} RPM total)`);
});