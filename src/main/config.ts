// ============================================================================
// NEXUS — Config
// Centralized configuration for AI providers and proxies.
// ============================================================================

export const config = {
  deepseekProxy: {
    enabled: true,
    port: 4570,
    baseUrl: 'http://localhost:4570/v1',
    healthUrl: 'http://localhost:4570/health',
    models: ['deepseek-ai/deepseek-v4-flash', 'deepseek-ai/deepseek-v4-pro'],
    startupTimeoutMs: 15000,
  },
} as const;