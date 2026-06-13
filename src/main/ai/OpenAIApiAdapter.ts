// ============================================================================
// NEXUS — OpenAIApiAdapter (Phase 2)
// OpenAI-kompatybilny adapter dla OpenRouter, DeepSeek proxy, Ollama, itp.
// Dowolny endpoint który mówi po OpenAI API schema
// ============================================================================

import { IAIProvider, AICompletionRequest, AICompletionResponse, AIStreamChunk } from './IAIProvider';

interface OpenAIConfig {
  baseUrl: string;
  apiKey: string;
  model?: string;
}

export class OpenAIApiAdapter implements IAIProvider {
  readonly name: string;
  private config: OpenAIConfig;
  protected defaultModel: string = 'gpt-3.5-turbo'; // overridable by subclasses

  // Protected accessor for subclasses that need to read config
  protected get configData(): OpenAIConfig {
    return this.config;
  }

  constructor(name: string, baseUrl: string, apiKey: string) {
    this.name = name;
    this.config = { baseUrl, apiKey };
  }

  updateConfig(baseUrl: string, apiKey: string): void {
    this.config = { baseUrl, apiKey };
  }

  isConfigured(): boolean {
    return !!this.config.baseUrl; // subclasses may also check apiKey
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const startTime = Date.now();

    const body = {
      model: request.model.modelName,
      messages: [
        { role: 'system', content: request.systemPrompt || '' },
        { role: 'user', content: request.prompt },
      ],
      temperature: request.model.temperature,
      max_tokens: request.model.maxTokens,
      top_p: request.model.topP,
      stream: false,
    };

    const res = await this.fetchWithTimeout(body);
    const data = await res.json();

    if (!res.ok) {
      const errMsg = data.error?.message || data.error || `HTTP ${res.status}`;
      throw new Error(`[${this.name}] ${errMsg}`);
    }

    const executionMs = Date.now() - startTime;
    const content = data.choices?.[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;

    return { content, tokensUsed, executionMs };
  }

  async *completeStream(request: AICompletionRequest): AsyncGenerator<AIStreamChunk> {
    const body = {
      model: request.model.modelName,
      messages: [
        { role: 'system', content: request.systemPrompt || '' },
        { role: 'user', content: request.prompt },
      ],
      temperature: request.model.temperature,
      max_tokens: request.model.maxTokens,
      top_p: request.model.topP,
      stream: true,
    };

    const res = await this.fetchWithTimeout(body);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      yield { token: '', done: true, error: `[${this.name}] HTTP ${res.status}: ${text}` };
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      yield { token: '', done: true, error: `[${this.name}] Brak body stream` };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta?.content || '';
            if (delta) {
              yield { token: delta, done: false };
            }
          } catch {
            // skip malformed JSON lines
          }
        }
      }

      // Flush buffer
      if (buffer.trim() && buffer.trim().startsWith('data: ')) {
        try {
          const json = JSON.parse(buffer.trim().slice(6));
          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) {
            yield { token: delta, done: false };
          }
        } catch { /* skip */ }
      }
    } finally {
      reader.releaseLock();
    }

    yield { token: '', done: true };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const model = this.config.model || this.defaultModel;
      const res = await this.fetchWithTimeout({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }, 5_000);

      if (res.ok) return { success: true };
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.error?.message || `HTTP ${res.status}` };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async fetchWithTimeout(body: any, timeoutMs = 60_000): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
          ...(this.config.baseUrl.includes('openrouter.ai')
            ? { 'HTTP-Referer': 'https://nexus.app', 'X-Title': 'Nexus AI' }
            : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      return res;
    } finally {
      clearTimeout(timeout);
    }
  }
}
