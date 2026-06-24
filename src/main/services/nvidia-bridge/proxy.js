// NVIDIA Key Rotator Proxy v3 — wbudowany w Nexus, zero zależności
// Używa tylko natywnego http + fetch (Node.js 18+)
// Uruchamiany automatycznie przez Electron main/index.ts
// Oraz ręcznie przez run_proxy.bat

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ścieżka do keys.json — najpierw obok proxy.js, potem w data/
function findKeysPath() {
  // Gdy uruchomiony z data/nvidia-keys/ — keys.json obok
  const local = path.join(__dirname, 'keys.json');
  if (fs.existsSync(local)) return local;
  // Fallback: szukaj obok proxy.js w services/
  const services = path.join(import.meta.dirname || __dirname, 'keys.json');
  if (fs.existsSync(services)) return services;
  return local;
}

const KEYS_PATH = findKeysPath();
const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

// Konfiguracja
const RPM_LIMIT = 39;
const WINDOW_MS = 60000;
const MAX_ACTIVE = 8;
const FETCH_TIMEOUT_BASE = 180_000;
const FETCH_TIMEOUT_MIN = 30_000;
const PORT = parseInt(process.env.NVIDIA_PORT || '3456', 10);

// ======================================================================
// Stan
// ======================================================================
let keys = loadKeys();
const keyAttempts = [];
const keyCooldown = [];
let activeRequests = 0;
const pendingQueue = [];
const keyStats = [];
let nextStartIdx = 0;
let consecutiveFails = 0;
const modelTiming = new Map();

// === Hot-reload keys co 5s ===
setInterval(() => {
  const newKeys = loadKeys();
  if (JSON.stringify(newKeys) !== JSON.stringify(keys)) {
    keys = newKeys;
    initKeyState();
    console.log(`[NVIDIA] Hot-reloaded: ${keys.length} keys`);
  }
}, 5000);

function loadKeys() {
  try {
    const data = JSON.parse(fs.readFileSync(KEYS_PATH, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function initKeyState() {
  keyAttempts.length = 0;
  keyCooldown.length = 0;
  keyStats.length = 0;
  keys.forEach(() => {
    keyAttempts.push([]);
    keyCooldown.push(0);
    keyStats.push({ total: 0, success: 0, fail: 0, rateLimited: 0 });
  });
}
initKeyState();

// ======================================================================
// Helpery
// ======================================================================
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  appendFile(path.join(__dirname, 'proxy.log'), line + '\n', 'utf-8').catch(() => {});
}

function getDynamicTimeout(model) {
  const t = modelTiming.get(model);
  if (!t || t.count < 2) return FETCH_TIMEOUT_BASE;
  const mult = model.includes('deepseek') ? 10 : 5;
  return Math.min(Math.max(Math.round(t.avg * mult), FETCH_TIMEOUT_MIN), 300_000);
}

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
  return -1;
}

function measure(model, ms) {
  const t = modelTiming.get(model) || { avg: ms, count: 1 };
  t.avg = ((t.avg * t.count) + ms) / (t.count + 1);
  t.count++;
  modelTiming.set(model, t);
}

async function acquireSlot() {
  if (activeRequests < MAX_ACTIVE) { activeRequests++; return; }
  return new Promise((resolve) => {
    pendingQueue.push(resolve);
  });
}

function releaseSlot() {
  const next = pendingQueue.shift();
  if (next) setTimeout(next, 0);
  else activeRequests--;
}

// ======================================================================
// Obsługa żądań HTTP
// ======================================================================
async function handleRequest(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const startTime = Date.now();

  // === GET /v1/models ===
  if (req.method === 'GET' && url.pathname === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      object: 'list',
      data: [
        { id: 'deepseek-ai/deepseek-v4-pro', object: 'model', created: 1781936000, owned_by: 'system' },
        { id: 'deepseek-ai/deepseek-v4', object: 'model', created: 1781936000, owned_by: 'system' },
        { id: 'moonshotai/kimi-k2.6', object: 'model', created: 1781936000, owned_by: 'system' },
        { id: 'deepseek-ai/deepseek-v3.2', object: 'model', created: 1781936000, owned_by: 'system' },
        { id: 'meta/llama-3.3-70b-instruct', object: 'model', created: 1781936000, owned_by: 'system' },
      ],
    }));
    return;
  }

  // === GET /health ===
  if (req.method === 'GET' && url.pathname === '/health') {
    const distribution = keyStats.map((s, i) => ({
      key: `key${i + 1}`,
      total: s.total,
      success: s.success,
      fail: s.fail,
      rateLimited: s.rateLimited,
      successRate: s.total > 0 ? `${Math.round(s.success / s.total * 100)}%` : '-',
      cooldown: keyCooldown[i] > Date.now() ? keyCooldown[i] - Date.now() : 0,
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      uptime: process.uptime(),
      activeRequests,
      keysLoaded: keys.length,
      totalRequests: keyStats.reduce((a, s) => a + s.total, 0),
      keyDistribution: distribution,
    }));
    return;
  }

  // === POST /v1/chat/completions ===
  if (req.method === 'POST' && (url.pathname === '/v1/chat/completions' || url.pathname === '/chat/completions')) {
    // Zbierz body
    const body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      req.on('error', reject);
    });

    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = null; }
    const model = parsed?.model || 'unknown';

    // Wstaw thinking dla deepseek
    if (parsed && !model.includes('qwen')) {
      if (!parsed.chat_template_kwargs) parsed.chat_template_kwargs = {};
      if (!parsed.chat_template_kwargs.thinking) parsed.chat_template_kwargs.thinking = true;
    }

    log(`Request: model=${model}, size=${body.length}b`);

    if (keys.length === 0) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Brak kluczy NVIDIA API. Dodaj je w Ustawienia Nexusa.', status: 503 } }));
      return;
    }

    await acquireSlot();
    const skipped = new Set();
    let retries = 0;

    for (let attempt = 0; attempt < keys.length; attempt++) {
      const bestIdx = selectBestKey(skipped);

      if (bestIdx === -1) {
        releaseSlot();
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: `Wszystkie ${keys.length} kluczy na limicie ${RPM_LIMIT} RPM.`, status: 429 } }));
        return;
      }

      keyStats[bestIdx].total++;
      const apiKey = keys[bestIdx];
      const keyLabel = `k${bestIdx + 1}`;

      const timeoutMs = Math.max(
        getDynamicTimeout(model),
        30000,
        Math.min(Math.round(body.length / 5000 * 1000), 120000),
      );

      try {
        const ac = new AbortController();
        const tid = setTimeout(() => { ac.abort(); retries++; }, timeoutMs);

        const upstream = await fetch(`${NVIDIA_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: parsed ? JSON.stringify(parsed) : body,
          signal: ac.signal,
        });

        clearTimeout(tid);
        const elapsed = Date.now() - startTime;
        log(`Response: ${upstream.status} in ${elapsed}ms (${keyLabel})`);

        keyStats[bestIdx].success++;
        measure(model, elapsed);

        if (upstream.status === 429) {
          upstream.body?.cancel?.().catch(() => {});
          keyStats[bestIdx].rateLimited++;
          keyCooldown[bestIdx] = Date.now() + 60000 + Math.floor(Math.random() * 20000 - 10000);
          skipped.add(bestIdx);
          continue;
        }

        if (!upstream.ok) {
          const errBody = await upstream.text().catch(() => '(unknown)');
          if (upstream.status >= 500) {
            skipped.add(bestIdx);
            keyCooldown[bestIdx] = Date.now() + Math.min(1000 * Math.pow(2, attempt), 10000);
            retries++;
            continue;
          }
          releaseSlot();
          res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: `NVIDIA error: ${errBody.slice(0, 300)}`, status: upstream.status } }));
          return;
        }

        const data = await upstream.json();
        releaseSlot();
        consecutiveFails = 0;
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'X-Key-Used': keyLabel,
        });
        res.end(JSON.stringify(data));
        return;

      } catch (err) {
        consecutiveFails++;
        keyStats[bestIdx].fail++;
        skipped.add(bestIdx);
        keyCooldown[bestIdx] = Date.now() + Math.min(1000 * Math.pow(2, attempt), 10000);
        log(`Error: ${err.message} (${keyLabel}, attempt ${retries})`);

        if (retries >= keys.length * 2) {
          releaseSlot();
          res.writeHead(504, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: `Upstream failure after ${retries} retries. Model overloaded.`, status: 504 } }));
          return;
        }
      }
    }

    releaseSlot();
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'All keys exhausted.', status: 429 } }));
    return;
  }

  // 404
  res.writeHead(404);
  res.end('Not found');
}

// ======================================================================
// Start
// ======================================================================
const server = http.createServer(handleRequest);

// Pre-warm connections
async function warmup() {
  try {
    await Promise.allSettled(
      Array.from({ length: 2 }, () =>
        fetch(`${NVIDIA_BASE}/models`, { signal: AbortSignal.timeout(5000) })
          .then(r => r.body?.cancel?.().catch(() => {}))
          .catch(() => {})
      )
    );
    log('Warmed 2 NVIDIA connections');
  } catch {}
}

server.listen(PORT, () => {
  log(`NVIDIA Bridge v3 ready on http://localhost:${PORT}`);
  log(`Keys: ${keys.length} (${keys.length * RPM_LIMIT} RPM total)`);
  log(`Models: deepseek-v4-pro, deepseek-v4, kimi-k2.6, qwen3.5-397b`);
  warmup();
});

process.on('SIGTERM', () => { log('Shutdown'); server.close(); process.exit(0); });