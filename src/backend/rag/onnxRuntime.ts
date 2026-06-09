// ================================================================
// NEXUS V2 — ONNX Runtime Singleton & Tensor Disposal (Phase 4.4)
// ================================================================
// Singleton sesji ONNX: model ładowany z dysku DOKŁADNIE RAZ.
// Każde kolejne zapytanie wektorowe używa tej samej sesji.
//
// ELIMINACJA WYCIEKU C++ TENSORÓW:
// WebAssembly wywołane dla ONNX tworzy tablice wskaźnikowe C++.
// Garbage Collector V8 NIE WIDZI tych obiektów. Jeśli wygenerujesz
// i porównasz 10,000 wektorów, po 20 minutach aplikacja wywali
// Out Of Memory i Windows zabije ją w tle.
//
// ROZWIĄZANIE:
// tensor.dispose() na KAŻDYM obiekcie wektorowym po użyciu.
// ================================================================

import * as ort from 'onnxruntime-node';
import { ModelCache, ModelNotFoundError } from './modelCache';

// ==============================================================
// Konfiguracja
// ==============================================================
const DEFAULT_MODEL_NAME = 'all-MiniLM-L6-v2.onnx';
const DEFAULT_MAX_TOKENS = 256;
const DEFAULT_EMBEDDING_DIMS = 384;

// ==============================================================
// Typy
// ==============================================================
export interface EmbeddingResult {
  /** Wektor embeddingu (Float32Array) */
  vector: Float32Array;
  /** Wymiar embeddingu */
  dimensions: number;
  /** Liczba tokenów wejściowych */
  tokenCount: number;
}

export interface OnnxRuntimeOptions {
  /** Nazwa pliku modelu ONNX w cache */
  modelName?: string;
  /** Ścieżka do katalogu modeli */
  modelsDir?: string;
  /** Maksymalna liczba tokenów */
  maxTokens?: number;
}

/**
 * OnnxRuntimeError — błąd silnika ONNX
 */
export class OnnxRuntimeError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(`[ONNX_RUNTIME] ${message}`);
    this.name = 'OnnxRuntimeError';
    this.code = code;
  }
}

// ==============================================================
// OnnxRuntime — Singleton sesji ONNX
//
// SESJA MODELU ONNX JEST TWORZONA TYLKO RAZ (SINGLETON).
// Ładowanie pliku .onnx z dysku do RAM-u przy każdym zapytaniu
// wyszukiwarki zawiesi komputer przy trzecim kliknięciu.
//
// ZASADY:
// 1. OrtSession.InferenceSession tworzony raz w getOrCreateSession()
// 2. embed(text) używa istniejącej sesji
// 3. tensor.dispose() po każdym wywołaniu — brak wycieku C++
// 4. dispose() do jawnego zwolnienia sesji (przy zamknięciu)
// ==============================================================
export class OnnxRuntime {
  private static _instance: OnnxRuntime | null = null;

  private readonly modelCache: ModelCache;
  private readonly modelName: string;
  private readonly maxTokens: number;

  /** Singleton sesji ONNX — ładowany raz */
  private _session: ort.InferenceSession | null = null;
  private _sessionLoaded = false;

  constructor(options?: OnnxRuntimeOptions) {
    this.modelCache = new ModelCache(options?.modelsDir);
    this.modelName = options?.modelName ?? DEFAULT_MODEL_NAME;
    this.maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  /**
   * getInstance() — zwraca instancję Singletonu
   *
   * Gwarantuje, że model ONNX jest ładowany tylko raz w całej
   * aplikacji. Drugie wywołanie zwraca tę samą sesję.
   */
  static getInstance(options?: OnnxRuntimeOptions): OnnxRuntime {
    if (!OnnxRuntime._instance) {
      OnnxRuntime._instance = new OnnxRuntime(options);
    }
    return OnnxRuntime._instance;
  }

  /**
   * resetInstance() — resetuje singleton (głównie dla testów)
   */
  static resetInstance(): void {
    if (OnnxRuntime._instance) {
      OnnxRuntime._instance._disposeSession();
      OnnxRuntime._instance = null;
    }
  }

  /**
   * getOrCreateSession() — ładuje model ONNX z dysku DOKŁADNIE RAZ
   *
   * Jeśli sesja już istnieje — zwraca ją.
   * Jeśli nie — ładuje plik .onnx z lokalnego cache.
   *
   * @throws {ModelNotFoundError} jeśli model nie istnieje lokalnie
   * @throws {OnnxRuntimeError} jeśli nie uda się załadować modelu
   */
  async getOrCreateSession(): Promise<ort.InferenceSession> {
    if (this._session && this._sessionLoaded) {
      return this._session;
    }

    // ============================================================
    // Lokalny cache modeli — omijamy HuggingFace
    // ============================================================
    const modelInfo = this.modelCache.requireModel(this.modelName);

    try {
      // ============================================================
      // Ładowanie modelu ONNX z lokalnego pliku
      //
      // ExecutionProvider: 'cpu' — zero zależności GPU, działa
      // na każdym Windowsie. Brak wywołań sieciowych.
      // ============================================================
      this._session = await ort.InferenceSession.create(modelInfo.filePath, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
        enableCpuMemArena: true,
      });

      this._sessionLoaded = true;
      return this._session;
    } catch (err) {
      throw new OnnxRuntimeError(
        'SESSION_CREATE_FAILED',
        `Nie można załadować modelu '${this.modelName}' z '${modelInfo.filePath}': ` +
        `${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * embed(text) — generuje embedding dla tekstu
   *
   * 1. Tokenizacja przez session (all-MiniLM-L6-v2)
   * 2. Forward pass przez ONNX
   * 3. Manualne tensor.dispose() na KAŻDYM tensorze — brak wycieku C++
   * 4. Zwraca Float32Array embeddingu
   *
   * @param text - tekst do wygenerowania embeddingu
   * @returns EmbeddingResult
   */
  async embed(text: string): Promise<EmbeddingResult> {
    const session = await this.getOrCreateSession();

    // ============================================================
    // Tokenizacja wejścia
    //
    // all-MiniLM-L6-v2 używa tokenizera WordPiece.
    // Dla prostoty przygotowujemy input_ids i attention_mask.
    // ============================================================
    const tokens = this._tokenize(text);
    const inputIds = new BigInt64Array(this.maxTokens);
    const attentionMask = new BigInt64Array(this.maxTokens);
    const tokenTypeIds = new BigInt64Array(this.maxTokens);

    // Wypełnij input_ids tokenami (pierwsze maxTokens tokenów)
    const clampedLen = Math.min(tokens.length, this.maxTokens);
    for (let i = 0; i < clampedLen; i++) {
      inputIds[i] = BigInt(tokens[i]);
      attentionMask[i] = BigInt(1);
    }
    // Reszta pozostaje 0 (padding)

    // ============================================================
    // Tensory ONNX — muszą być jawnie dispose() po użyciu
    // ============================================================
    const inputTensor = new ort.Tensor('int64', inputIds, [1, this.maxTokens]);
    const maskTensor = new ort.Tensor('int64', attentionMask, [1, this.maxTokens]);
    const typeTensor = new ort.Tensor('int64', tokenTypeIds, [1, this.maxTokens]);

    let lastHiddenState: ort.Tensor | null = null;

    try {
      // ============================================================
      // Forward pass
      // ============================================================
      const feeds: Record<string, ort.Tensor> = {
        input_ids: inputTensor,
        attention_mask: maskTensor,
        token_type_ids: typeTensor,
      };

      const results = await session.run(feeds);

      // ============================================================
      // Wyciągamy last_hidden_state lub embedding output
      //
      // all-MiniLM-L6-v2 zwraca:
      //   - last_hidden_state: [1, seq_len, 384]
      //   - pooler_output: [1, 384] (jeśli model ma pooler)
      // ============================================================
      const outputKey = results.pooler_output ? 'pooler_output' : 'last_hidden_state';
      lastHiddenState = results[outputKey];

      if (!lastHiddenState) {
        // Jeśli żaden znany klucz — weź pierwszy output
        const keys = Object.keys(results);
        if (keys.length === 0) {
          throw new OnnxRuntimeError('NO_OUTPUT', 'Model nie zwrócił żadnego outputu');
        }
        lastHiddenState = results[keys[0]];
      }

      // ============================================================
      // Konwersja tensora na Float32Array
      //
      // lastHiddenState.data może być różnych typów.
      // Normalizujemy do Float32Array.
      // ============================================================
      const rawData = lastHiddenState.data;
      let floatVector: Float32Array;

      if (rawData instanceof Float32Array) {
        // Dla pooler_output: [1, 384] -> weź pierwszy (jedyny) wiersz
        if (lastHiddenState.dims.length === 2 && lastHiddenState.dims[0] === 1) {
          floatVector = new Float32Array(rawData);
        } else if (lastHiddenState.dims.length === 3 && lastHiddenState.dims[0] === 1) {
          // Dla last_hidden_state: [1, seq_len, 384] — mean pooling
          const seqLen = lastHiddenState.dims[1];
          const dims = lastHiddenState.dims[2];
          floatVector = new Float32Array(dims);
          for (let d = 0; d < dims; d++) {
            let sum = 0;
            for (let s = 0; s < seqLen; s++) {
              sum += rawData[s * dims + d];
            }
            floatVector[d] = sum / seqLen;
          }
        } else {
          // Fallback: spłaszcz
          floatVector = new Float32Array(rawData);
        }
      } else if (Array.isArray(rawData)) {
        floatVector = new Float32Array(rawData as number[]);
      } else {
        // BigInt64Array lub inny — konwersja
        const arr = new Float32Array((rawData as ArrayLike<number>).length);
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Number(rawData[i]);
        }
        floatVector = arr;
      }

      return {
        vector: floatVector,
        dimensions: floatVector.length,
        tokenCount: clampedLen,
      };
    } finally {
      // ============================================================
      // KRYTYCZNE: manualne dispose() KAŻDEGO tensora
      //
      // WebAssembly tworzy tablice wskaźnikowe C++, które V8 GC
      // NIE WIDZI. Bez dispose() — po 15k zapytań RAM rośnie
      // niekontrolowanie i Windows zabija proces OOM.
      //
      // ZASADA: każdy tensor = dispose() po użyciu
      // ============================================================
      inputTensor.dispose();
      maskTensor.dispose();
      typeTensor.dispose();

      // Dispose tensorów wyjściowych
      for (const key of Object.keys(results)) {
        const t = results[key];
        if (t && typeof t.dispose === 'function') {
          t.dispose();
        }
      }
    }
  }

  /**
   * isSessionLoaded() — czy sesja ONNX została załadowana
   */
  isSessionLoaded(): boolean {
    return this._sessionLoaded;
  }

  /**
   * getModelName() — zwraca nazwę modelu
   */
  getModelName(): string {
    return this.modelName;
  }

  /**
   * dispose() — jawne zwolnienie sesji ONNX
   *
   * Powinno być wołane przy zamknięciu aplikacji.
   */
  async dispose(): Promise<void> {
    await this._disposeSession();
  }

  private async _disposeSession(): Promise<void> {
    if (this._session) {
      try {
        await this._session.release();
      } catch {
        // Ignoruj błędy release
      }
      this._session = null;
      this._sessionLoaded = false;
    }
  }

  /**
   * _tokenize(text) — prosta tokenizacja dla embeddingu
   *
   * Używamy prostego podziału na wyrazy + mapowanie na ID tokenów.
   * W produkcyjnym użyciu należy zastąpić pełnym tokenizerem
   * (np. tokenizers.js lub transformers.js).
   *
   * Zwraca tablicę ID tokenów (liczba całkowita).
   */
  private _tokenize(text: string): number[] {
    // ============================================================
    // Tokenizer awaryjny na wypadek braku pełnego tokenizera
    //
    // Dla all-MiniLM-L6-v2:
    //   - [CLS] = 101 (id=101, token=1)
    //   - [SEP] = 102 (id=102, token=2)
    //   - [PAD] = 0
    //   - Słowa mapowane wg WordPiece
    //
    // Używamy uproszczonego podejścia: dzielimy na słowa,
    // hashujemy do zakresu [103, 30000] jako przybliżenie.
    // W pełnej implementacji użyj tokenizera z transformers.js.
    // ============================================================
    const tokens: number[] = [101]; // [CLS]

    // Podziel na słowa (prosty tokenizer)
    const words = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);

    for (const word of words) {
      // Hash słowa do zakresu ID tokena
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
      }
      const tokenId = 103 + (Math.abs(hash) % 29000); // Zakres [103, 29103]
      tokens.push(tokenId);
    }

    tokens.push(102); // [SEP]
    return tokens;
  }
}
