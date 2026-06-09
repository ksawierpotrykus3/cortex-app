// ================================================================
// NEXUS V2 — Semantic Engine (all-MiniLM-L6-v2) (Phase 4.3)
// ================================================================
// Silnik semantyczny RAG oparty na kwantyzowanym all-MiniLM-L6-v2
// przez ONNX Runtime. Uruchamiany lokalnie na CPU — zero zależności
// GPU, zero wywołań sieciowych poza pierwszym cache.
//
// ARCHITEKTURA:
//   - OnnxRuntime jako singleton — model ładowany raz
//   - embed(text) → Float32Array embeddingu
//   - cosineSimilarity(a, b) → miara podobieństwa
//   - search(query, documents, topK) → rankowanie semantyczne
// ================================================================

import { OnnxRuntime, OnnxRuntimeError, type EmbeddingResult } from './onnxRuntime';

// ==============================================================
// Typy
// ==============================================================
export interface SemanticSearchResult {
  /** Indeks dokumentu w tablicy wejściowej */
  index: number;
  /** Treść dokumentu */
  content: string;
  /** Wynik cosine similarity */
  score: number;
}

export interface SemanticEngineOptions {
  /** Nazwa modelu ONNX */
  modelName?: string;
  /** Ścieżka do modeli */
  modelsDir?: string;
}

/**
 * SemanticEngine — silnik wyszukiwania semantycznego
 *
 * Używa all-MiniLM-L6-v2 przez ONNX Runtime do generowania
 * embeddingów w trybie offline. Żadne dane nie opuszczają
 * maszyny Windows NT.
 *
 * SINGLETON: Sesja ONNX jest tworzona raz i współdzielona.
 */
export class SemanticEngine {
  private readonly runtime: OnnxRuntime;

  constructor(options?: SemanticEngineOptions) {
    this.runtime = OnnxRuntime.getInstance({
      modelName: options?.modelName,
      modelsDir: options?.modelsDir,
    });
  }

  /**
   * embed(text) — generuje embedding semantyczny tekstu
   *
   @param text - tekst do embeddingu
   @returns EmbeddingResult z wektorem Float32Array
   */
  async embed(text: string): Promise<EmbeddingResult> {
    return this.runtime.embed(text);
  }

  /**
   * cosineSimilarity(a, b) — podobieństwo cosinusowe między wektorami
   *
   * Wynik: 1.0 = identyczne, 0.0 = ortogonalne, -1.0 = przeciwne
   */
  cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new OnnxRuntimeError(
        'DIMENSION_MISMATCH',
        `Wymiary wektorów nie zgadzają się: ${a.length} vs ${b.length}`
      );
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;

    return dotProduct / denom;
  }

  /**
   * search(query, documents, topK) — wyszukiwanie semantyczne
   *
   * 1. Generuje embedding dla zapytania
   * 2. Generuje embedding dla każdego dokumentu
   * 3. Liczy cosine similarity
   * 4. Zwraca topK wyników
   *
   @param query - tekst zapytania
   @param documents - tablica dokumentów do przeszukania
   @param topK - liczba wyników (domyślnie 5)
   @returns SemanticSearchResult[]
   */
  async search(
    query: string,
    documents: string[],
    topK: number = 5,
  ): Promise<SemanticSearchResult[]> {
    if (documents.length === 0) {
      return [];
    }

    // ============================================================
    // Embedding zapytania (raz)
    // ============================================================
    const queryEmbedding = await this.embed(query);

    // ============================================================
    // Embedding dokumentów + cosine similarity
    // ============================================================
    const results: SemanticSearchResult[] = [];

    for (let i = 0; i < documents.length; i++) {
      const docEmbedding = await this.embed(documents[i]);
      const score = this.cosineSimilarity(queryEmbedding.vector, docEmbedding.vector);

      results.push({
        index: i,
        content: documents[i],
        score,
      });
    }

    // ============================================================
    // Sortuj malejąco po score i zwróć topK
    // ============================================================
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
}
