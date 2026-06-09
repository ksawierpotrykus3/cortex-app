// ================================================================
// NEXUS V2 — RAG Barrel Export (Phase 4.3 + 4.4)
// ================================================================

export { ModelCache, ModelNotFoundError } from './modelCache';
export type { ModelFileInfo } from './modelCache';

export { OnnxRuntime, OnnxRuntimeError } from './onnxRuntime';
export type { EmbeddingResult, OnnxRuntimeOptions } from './onnxRuntime';

export { SemanticEngine } from './semantic';
export type { SemanticSearchResult, SemanticEngineOptions } from './semantic';

export { LexicalEngine } from './lexical';
export type { LexicalSearchResult, TokenInfo, NegationAwareQuery } from './lexical';

export { RRFEngine } from './fusion';
export type { RRFSearchResult, EngineStatus, RRFSearchResponse } from './fusion';
