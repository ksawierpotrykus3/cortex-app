// ================================================================
// NEXUS V2 — RAG Barrel Export (Phase 6.1 — API Embeddings)
// ================================================================

export { SemanticEngine, SemanticEngineError, OpenAIProvider } from './semantic';
export type { EmbeddingResult, SemanticSearchResult, SemanticEngineOptions, EmbeddingApiProvider } from './semantic';

export { LexicalEngine } from './lexical';
export type { LexicalSearchResult, TokenInfo, NegationAwareQuery } from './lexical';

export { RRFEngine } from './fusion';
export type { RRFSearchResult, EngineStatus, RRFSearchResponse } from './fusion';
