// ================================================================
// NEXUS V2 — TDD Verification: RAG Pipeline (Phase 4.3 + 4.4 + 6.1)
// ================================================================
// Test 1 (6.1): SemanticEngine — API embeddings z mockiem
// Test 2 (4.3): LexicalEngine — BM25 + negation tags (wink-nlp)
// Test 3 (4.4): RRF Fusion — Promise.allSettled, awaria silnika
// ================================================================

import { describe, it, expect, beforeAll } from 'vitest';

let SemanticEngine: any, SemanticEngineError: any, OpenAIProvider: any;
let LexicalEngine: any, RRFEngine: any;
let winkModelRaw: any;
let nlpInstance: any;

// ============================================================
// Dynamiczne importy — raz na wszystkie testy
// ============================================================
beforeAll(async () => {
  const sem = await import('./semantic');
  SemanticEngine = sem.SemanticEngine;
  SemanticEngineError = sem.SemanticEngineError;
  OpenAIProvider = sem.OpenAIProvider;

  const lex = await import('./lexical');
  LexicalEngine = lex.LexicalEngine;

  const fus = await import('./fusion');
  RRFEngine = fus.RRFEngine;

  const { createRequire } = await import('module');
  const localRequire = createRequire(import.meta.url);
  winkModelRaw = localRequire('wink-eng-lite-web-model');
  const winkNLP = localRequire('wink-nlp');
  nlpInstance = winkNLP(winkModelRaw); // inicjalizacja NLP z modelem
});

// ============================================================
// 6.1 — SemanticEngine (API Embeddings — mock)
//
// NOWA ARCHITEKTURA: ONNX Runtime usunięty. Embeddingi przez
// zewnętrzne API (OpenAI). Gdy brak klucza API — mock wektora.
//
// cosineSimilarity i search pozostają nietknięte jako część
// wspólna RAG.
// ============================================================
describe('Phase 6.1 — SemanticEngine (API Embeddings, mock gdy brak klucza)', () => {
  it('embed() zwraca wektor mock (deterministyczny) gdy brak klucza API', async () => {
    const engine = new SemanticEngine();
    const result = await engine.embed('test document');

    expect(result.vector).toBeInstanceOf(Float32Array);
    expect(result.dimensions).toBe(384);
    expect(result.vector.length).toBe(384);
    expect(result.tokenCount).toBeGreaterThan(0);

    // Deterministyczność: ten sam tekst → ten sam wektor
    const result2 = await engine.embed('test document');
    expect(result.vector).toEqual(result2.vector);
  });

  it('embed() zwraca różne wektory dla różnych tekstów', async () => {
    const engine = new SemanticEngine();
    const a = await engine.embed('hello world');
    const b = await engine.embed('goodbye world');

    let same = true;
    for (let i = 0; i < a.vector.length; i++) {
      if (a.vector[i] !== b.vector[i]) {
        same = false;
        break;
      }
    }
    expect(same).toBe(false);
  });

  it('cosineSimilarity zwraca 1.0 dla identycznych wektorów', () => {
    const engine = new SemanticEngine();
    const vec = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
    const score = engine.cosineSimilarity(vec, vec);
    expect(score).toBeCloseTo(1.0, 5);
  });

  it('cosineSimilarity zwraca ~0.0 dla ortogonalnych wektorów', () => {
    const engine = new SemanticEngine();
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([0, 1]);
    const score = engine.cosineSimilarity(a, b);
    expect(score).toBeCloseTo(0.0, 5);
  });

  it('cosineSimilarity rzuca błąd przy różnych wymiarach', () => {
    const engine = new SemanticEngine();
    expect(() => {
      engine.cosineSimilarity(new Float32Array(3), new Float32Array(5));
    }).toThrow(SemanticEngineError);
  });

  it('search() zwraca puste wyniki dla pustej tablicy dokumentów', async () => {
    const engine = new SemanticEngine();
    const results = await engine.search('query', [], 5);
    expect(results).toHaveLength(0);
  });

  it('search() zwraca wyniki posortowane po score', async () => {
    const engine = new SemanticEngine();
    const docs = [
      'kot na dywanie',
      'pies w ogrodzie',
      'ryba w wodzie',
    ];

    const results = await engine.search('kot', docs, 3);
    expect(results).toHaveLength(3);
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
  });

  it('OpenAIProvider mock zwraca poprawny EmbeddingResult', async () => {
    const provider = new OpenAIProvider();
    const result = await provider.embed('test');

    expect(result).toHaveProperty('vector');
    expect(result).toHaveProperty('dimensions');
    expect(result).toHaveProperty('tokenCount');
    expect(result.vector).toBeInstanceOf(Float32Array);
    expect(result.dimensions).toBe(384);
  });
});

// ============================================================
// 4.3 — LexicalEngine (BM25 + wink-nlp + Negation Tags)
//
// wink-eng-lite-web-model dostarcza model negacji przez
// pipeline 'negation-detection'. Tokeny w negated context
// mają negationFlag = true.
// ============================================================
describe('Phase 4.3 — LexicalEngine (BM25 + Negation)', () => {
  describe('Negation detection via wink-nlp', () => {
    it('powinien wykryć negację w angielskim zdaniu "no network"', () => {
      const its = nlpInstance.its;
      const doc = nlpInstance.readDoc('no network');
      const tokens = doc.tokens();

      const networkNeg = tokens.itemAt(1).out(its.negationFlag);
      expect(networkNeg).toBe(true);
    });

    it('nie powinien oznaczać normalnych zdań jako negacji', () => {
      const its = nlpInstance.its;
      const doc = nlpInstance.readDoc('working internet connection');
      const tokens = doc.tokens();

      for (let i = 0; i < tokens.length(); i++) {
        expect(tokens.itemAt(i).out(its.negationFlag)).toBe(false);
      }
    });
  });

  describe('LexicalEngine BM25 search', () => {
    it('powinien indeksować i wyszukiwać dokumenty', () => {
      const engine = new LexicalEngine(winkModelRaw);

      const docs = [
        'server is running correctly',
        'no network connection available',
        'application started without errors',
        'problem with network',
        'everything works perfectly',
      ];

      engine.indexDocuments(docs);
      const results = engine.search('running correctly', 3);
      expect(results.length).toBeGreaterThan(0);
    });

    it('analyzeQuery() powinien zwrócić poprawne tokeny', () => {
      const engine = new LexicalEngine(winkModelRaw);
      const analysis = engine.analyzeQuery('brak sieci');
      expect(analysis.original).toBe('brak sieci');
      expect(analysis.positive.length).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================================
// 4.4 — RRF Fusion Engine
// ============================================================
describe('Phase 4.4 — RRF Fusion Engine', () => {
  it('awaria semantycznego nie powinna zablokować leksykalnego', async () => {
    const sem = await import('./semantic');

    // SemanticEngine z providerem który zawsze rzuca błędem
    const throwingProvider = new (class extends sem.OpenAIProvider {
      async embed(_text: string): Promise<any> {
        throw new sem.SemanticEngineError('API_ERROR', 'Symulowana awaria API');
      }
    })();

    const semantic = new sem.SemanticEngine();
    (semantic as any).provider = throwingProvider;

    const lexical = new LexicalEngine(winkModelRaw);
    lexical.indexDocuments(['document A', 'document B']);

    const rrf = new RRFEngine(semantic, lexical);
    const result = await rrf.search('document', ['document A', 'document B'], 5);

    expect(result.engines.semanticOk).toBe(false);
    expect(result.engines.lexicalOk).toBe(true);
    expect(result.engines.semanticError).toBeDefined();
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.isPartial).toBe(true);
  });

  it('gdy oba silniki padną — powinien zwrócić pusty wynik', async () => {
    const sem = await import('./semantic');

    const throwingProvider = new (class extends sem.OpenAIProvider {
      async embed(_text: string): Promise<any> {
        throw new sem.SemanticEngineError('API_ERROR', 'Symulowana awaria');
      }
    })();

    const semantic = new sem.SemanticEngine();
    (semantic as any).provider = throwingProvider;

    const lexical = new LexicalEngine(winkModelRaw);

    const rrf = new RRFEngine(semantic, lexical);
    const result = await rrf.search('test', ['something'], 5);

    expect(result.results.length).toBe(0);
  });
});
