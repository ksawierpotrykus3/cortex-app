// ============================================================================
// NEXUS — SandboxWorker (#7 MicroVM)
// Proces potomny wykonujący agenta w izolacji.
// Komunikacja z parentem przez process.on('message') / process.send()
// ============================================================================

import { Agent, AgentOutput, AgentStatus, TriggerType, AIProvider } from '../../shared/types/schema';

// === Minimalny adapter AI dla sandboxa ====================================
// Nie importuje całego ProviderRegistry — tylko surowy fetch do API.
// Dzięki temu worker jest lekki i nie zależy od reszty systemu.

interface WorkerPayload {
  agent: Agent;
  context: string;
  triggerType: TriggerType;
  providerApiKey: string;
  providerBaseUrl: string;
}

// === Główna pętla workera ==================================================
process.on('message', async (msg: any) => {
  if (msg.type === 'config') {
    // Memory limit — handled by parent via execArgv
    return;
  }

  if (msg.type === 'execute') {
    const payload: WorkerPayload = msg.payload;
    try {
      const output = await executeInSandbox(payload);
      process.send!({ type: 'result', success: true, output });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      process.send!({ type: 'result', success: false, error });
    }
  }
});

// === Sandbox Execution =====================================================
async function executeInSandbox(payload: WorkerPayload): Promise<Partial<AgentOutput>> {
  const { agent, context, triggerType, providerApiKey, providerBaseUrl } = payload;
  const startTime = Date.now();

  const startOutput: Partial<AgentOutput> = {
    id: crypto.randomUUID?.() || `${agent.id}_${startTime}`,
    agentId: agent.id,
    agentName: agent.name,
    status: AgentStatus.RUNNING,
    prompt: agent.promptTemplate,
    contextSize: context?.length || 0,
    content: '',
    tokensUsed: 0,
    executionMs: 0,
    triggerType: triggerType || TriggerType.MANUAL,
    modelName: agent.model.modelName,
    rating: 0,
    approved: null,
    createdAt: new Date(startTime).toISOString(),
    tags: agent.tags,
  };

  // === Build final prompt ==================================================
  let finalPrompt = agent.promptTemplate;

  // Replace variables
  if (context) {
    finalPrompt = finalPrompt.replace(/\{\{SCHOWEK\}\}/g, context);
  }
  finalPrompt = finalPrompt.replace(/\{\{DATA\}\}/g, new Date().toISOString().slice(0, 10));
  finalPrompt = finalPrompt.replace(/\{\{CZAS\}\}/g, new Date().toTimeString().slice(0, 5));
  finalPrompt = finalPrompt.replace(/\{\{NOW\}\}/g, new Date().toISOString().replace('T', ' ').slice(0, 19));
  finalPrompt = finalPrompt.replace(/\{\{BRANCH\}\}/g, 'sandbox');
  finalPrompt = finalPrompt.replace(/\{\{AGENT_NAME\}\}/g, agent.name);

  // === AI Call =============================================================
  const content = await callAI(
    agent.model.modelName,
    finalPrompt,
    agent.model.provider,
    providerApiKey,
    providerBaseUrl,
    agent.model.temperature,
    agent.model.maxTokens,
    agent.model.topP,
  );

  const executionMs = Date.now() - startTime;
  const tokensUsed = Math.ceil((finalPrompt.length + content.length) / 4);

  return {
    ...startOutput,
    content,
    tokensUsed,
    executionMs,
    status: AgentStatus.ACTIVE,
    completedAt: new Date().toISOString(),
  };
}

// === Minimal AI HTTP caller ================================================
async function callAI(
  modelName: string,
  prompt: string,
  provider: AIProvider,
  apiKey: string,
  baseUrl: string,
  temperature: number,
  maxTokens: number,
  topP: number,
): Promise<string> {
  switch (provider) {
    case AIProvider.GEMINI:
      return callGemini(modelName, prompt, apiKey, temperature, maxTokens, topP);
    case AIProvider.OPENROUTER:
    case AIProvider.OLLAMA:
      return callOpenAICompatible(modelName, prompt, apiKey, baseUrl, temperature, maxTokens, topP);
    default:
      throw new Error(`Sandbox: Unknown provider ${provider}`);
  }
}

async function callGemini(
  modelName: string,
  prompt: string,
  apiKey: string,
  temperature: number,
  maxTokens: number,
  topP: number,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens, topP },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text;
}

async function callOpenAICompatible(
  modelName: string,
  prompt: string,
  apiKey: string,
  baseUrl: string,
  temperature: number,
  maxTokens: number,
  topP: number,
): Promise<string> {
  const url = `${baseUrl || 'https://openrouter.ai/api/v1'}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return text;
}
