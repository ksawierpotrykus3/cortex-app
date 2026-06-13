// ============================================================================
// NEXUS — GeminiAdapter (Phase 2)
// Google Gemini API przez OpenAI-kompatybilne endpointy
// Używa baseUrl: https://generativelanguage.googleapis.com/v1beta/openai/
// ============================================================================

import { OpenAIApiAdapter } from './OpenAIApiAdapter';

/**
 * GeminiAdapter to w zasadzie OpenAIApiAdapter z innym baseUrl.
 * Google udostępnia OpenAI-kompatybilne endpointy od wersji v1beta.
 */
export class GeminiAdapter extends OpenAIApiAdapter {
  constructor(apiKey: string) {
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/';
    super('Google Gemini', baseUrl, apiKey);
    this.defaultModel = 'gemini-2.0-flash'; // Gemini-compatible model for testConnection
  }

  isConfigured(): boolean {
    return !!this.configData.baseUrl && !!this.configData.apiKey;
  }
}
