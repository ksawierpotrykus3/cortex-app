// ================================================================
// NEXUS V2 — Semantic Engine (API Embeddings) (Phase 6.1)
// ================================================================
// Silnik semantyczny RAG oparty o zewnętrzne API Embeddings.
// ONNX Runtime został usunięty — generowanie wektorów odbywa się
// przez asynchroniczny fetch() do dostawcy (OpenAI / Azure / inny).
//
// ARCHITEKTURA:
//   - EmbeddingApiProvider — interface dla dowolnego API embeddingów
//   - OpenAIProvider — domyślna implementacja przez OpenAI API
//   - cosineSimilarity(a, b) → miara podobieństwa (CZĘŚĆ WSPÓLNA)
//   - search(query, documents, topK) → rankowanie semantyczne
//   - cała reszta RAG (BM25, RRF Fusion) NIETKNIĘTA
// ================================================================

// ==============================================================
// Typy
// ==============================================================
export interface EmbeddingResult {
  /** Wektor embeddingu (Float32Array) */
  vector: Float32Array;
  /** Wymiar embeddingu */
  dimensions: number;
  /** Liczba tokenów wejściowych (jeśli API zwraca) */
  tokenCount: number;
}

export interface SemanticSearchResult {
  /** Indeks dokumentu w tablicy wejściowej */
  index: number;
  /** Treść dokumentu */
  content: string;
  /** Wynik cosine similarity */
  score: number;
}

export interface SemanticEngineOptions {
  /** Klucz API do zewnętrznego dostawcy embeddingów */
  apiKey?: string;
  /** URL endpointu API (domyślnie OpenAI) */
  apiUrl?: string;
  /** Nazwa modelu embeddingu u dostawcy (np. text-embedding-3-small) */
  modelName?: string;
  /** Wymiar wektora embeddingu */
  dimensions?: number;
}

/**
 * SemanticEngineError — błąd silnika semantycznego
 */
export class SemanticEngineError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(`[SEMANTIC] ${message}`);
    this.name = 'SemanticEngineError';
    this.code = code;
  }
}

// ==============================================================
// EmbeddingApiProvider — interface dla dostawcy embeddingów
//
// Możesz zaimplementować własnego providera dla dowolnego API
// (OpenAI, Azure OpenAI, Cohere, Voyage, itp.).
// ==============================================================
export interface EmbeddingApiProvider {
  /**
   * embed(text) — generuje wektor embeddingu dla tekstu
   *
   * @param text - tekst do embeddingu
   * @returns EmbeddingResult z wektorem Float32Array
   * @throws SemanticEngineError przy błędzie API
   */
  embed(text: string): Promise<EmbeddingResult>;
}

// ==============================================================
// OpenAIProvider — domyślny provider przez OpenAI API
//
 // Używa fetch() do API OpenAI (lub zgodnego endpointu).
 // Wymaga zmiennej środowiskowej OPENAI_API_KEY lub apiKey w
 // konstruktorze.
//
// Endpoint: POST {apiUrl}/embeddings
// Body: { model, input, dimensions }
// Response: { data: [{ embedding: number[] }] }
// ==============================================================
const DEFAULT_OPENAI_URL = 'https://api.openai.com/v1';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_EMBEDDING_DIMS = 384;

export class OpenAIProvider implements EmbeddingApiProvider {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly model: string;
  private readonly dimensions: number;

  constructor(options?: SemanticEngineOptions) {
    this.apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.apiUrl = options?.apiUrl ?? DEFAULT_OPENAI_URL;
    this.model = options?.modelName ?? DEFAULT_EMBEDDING_MODEL;
    this.dimensions = options?.dimensions ?? DEFAULT_EMBEDDING_DIMS;

    if (!this.apiKey) {
      console.warn(
        '[SEMANTIC] Brak klucza API. Użyj zmiennej środowiskowej OPENAI_API_KEY ' +
        'lub przekaż apiKey w SemanticEngineOptions. Embedding zwróci mock.'
      );
    }
  }

  /**
   * embed(text) — wywołuje API embeddingów
   *
   * 1. Przygotowuje request do API
   * 2. Parsuje odpowiedź
   * 3. Konwertuje number[] → Float32Array
   * 4. Zwraca EmbeddingResult
   *
   * Jeśli brak klucza API — zwraca mock wektora (dla testów / devel).
   */
  async embed(text: string): Promise<EmbeddingResult> {
    // ============================================================
    // Fallback: brak klucza API → zwróć sztuczny wektor
    // (przydatne w testach i trybie development)
    // ============================================================
    if (!this.apiKey) {
      return this._mockEmbedding(text);
    }

    try {
      // ============================================================
      // Request do API
      // ============================================================
      const response = await fetch(`${this.apiUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
          dimensions: this.dimensions,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new SemanticEngineError(
          'API_ERROR',
          `API zwróciło błąd ${response.status}: ${errorBody || response.statusText}`
        );
      }

      const data = await response.json() as {
        data: Array<{ embedding: number[] }>;
        usage?: { total_tokens: number };
      };

      // ============================================================
      // Parsowanie odpowiedzi
      // ============================================================
      if (!data.data?.[0]?.embedding) {
        throw new SemanticEngineError(
          'INVALID_RESPONSE',
          'API nie zwróciło embeddingu w oczekiwanym formacie'
        );
      }

      const rawEmbedding = data.data[0].embedding;
      const vector = new Float32Array(rawEmbedding);

      return {
        vector,
        dimensions: vector.length,
        tokenCount: data.usage?.total_tokens ?? 0,
      };
    } catch (err) {
      // Jeśli to już jest SemanticEngineError — przepuść dalej
      if (err instanceof SemanticEngineError) {
        throw err;
      }

      throw new SemanticEngineError(
        'NETWORK_ERROR',
        `Błąd wywołania API embeddingów: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * _mockEmbedding — generuje sztuczny wektor dla testów / devel
   *
   * Zwdeterminowany wektor oparty na hash tekstu, aby ten sam tekst
   * zawsze dawał ten sam wektor (deterministic mock).
   */
  private _mockEmbedding(text: string): EmbeddingResult {
    const dims = this.dimensions;
    const vector = new Float32Array(dims);

    // Generuj deterministyczny wektor z hash-a tekstu
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }

    // Wypełnij wektor pseudolosowymi wartościami
    const seed = Math.abs(hash);
    for (let i = 0; i < dims; i++) {
      // Deterministyczny "random" oparty na seed + i
      const val = Math.sin(seed * (i + 1)) * 0.5 + 0.5; // [0, 1]
      vector[i] = val;
    }

    return {
      vector,
      dimensions: dims,
      tokenCount: Math.ceil(text.length / 4), // przybliżenie
    };
  }
}

// ==============================================================
// SemanticEngine — silnik wyszukiwania semantycznego
//
// Używa EmbeddingApiProvider do generowania wektorów.
// cosineSimilarity pozostaje po stronie klienta (zero kosztów).
//
// SINGLETON: Provider jest tworzony raz w konstruktorze.
// ==============================================================
export class SemanticEngine {
  private readonly provider: EmbeddingApiProvider;

  constructor(options?: SemanticEngineOptions) {
    this.provider = new OpenAIProvider(options);
  }

  /**
   * embed(text) — generuje embedding semantyczny tekstu
   *
   * Deleguje do EmbeddingApiProvider.embed().
   *
   * @param text - tekst do embeddingu
   * @returns EmbeddingResult z wektorem Float32Array
   */
  async embed(text: string): Promise<EmbeddingResult> {
    return this.provider.embed(text);
  }

  /**
   * cosineSimilarity(a, b) — podobieństwo cosinusowe między wektorami
   *
   * Wynik: 1.0 = identyczne, 0.0 = ortogonalne, -1.0 = przeciwne
   *
   * UWAGA: Ta funkcja JEST CZĘŚCIĄ WSPÓLNĄ i pozostaje nietknięta.
   */
  cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new SemanticEngineError(
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
   * 1. Generuje embedding dla zapytania (przez API)
   * 2. Generuje embedding dla każdego dokumentu (przez API)
   * 3. Liczy cosine similarity
   * 4. Zwraca topK wyników
   *
   * @param query - tekst zapytania
   * @param documents - tablica dokumentów do przeszukania
   * @param topK - liczba wyników (domyślnie 5)
   * @returns SemanticSearchResult[]
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
