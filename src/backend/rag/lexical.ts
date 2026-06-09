// ================================================================
// NEXUS V2 — Lexical Engine BM25 + Negation Tags (Phase 4.3)
// ================================================================
// Precyzyjna wyszukiwarka leksykalna oparta na BM25 z wink-nlp
// i wsparciem dla negacji (flagowanie tagów).
//
// ARCHITEKTURA:
//   - wink-nlp do tokenizacji i detekcji negacji
//   - BM25 do rankowania dokumentów
//   - Tokeny z flagą negacji (negationFlag) — obsługa "brak sieci"
//   - Działa w pełni offline, zero zewnętrznych zapytań
// ================================================================

import winkNlp from 'wink-nlp';
import bm25Vectorizer from 'wink-nlp/utilities/bm25-vectorizer';
import similarity from 'wink-nlp/utilities/similarity';
import type { Model, Bow, Document } from 'wink-nlp';

// ==============================================================
// Konfiguracja
// ==============================================================
const DEFAULT_TOP_K = 5;

// ==============================================================
// Typy
// ==============================================================
export interface LexicalSearchResult {
  /** Indeks dokumentu w tablicy wejściowej */
  index: number;
  /** Treść dokumentu */
  content: string;
  /** Wynik BM25 */
  score: number;
  /** Tokeny z flagami negacji */
  tokens: TokenInfo[];
}

export interface TokenInfo {
  /** Tekst tokenu */
  text: string;
  /** Czy token jest negacją */
  isNegation: boolean;
  /** Część mowy (POS tag) */
  pos: string;
}

export interface NegationAwareQuery {
  /** Oryginalne zapytanie */
  original: string;
  /** Tokeny dodatnie (bez negacji) */
  positive: string[];
  /** Tokeny zanegowane */
  negated: string[];
}

/**
 * LexicalEngine — BM25 + wink-nlp z obsługą negacji
 *
 * Używa wink-nlp do analizy językowej i BM25 dla rankowania.
 * Tokeny negacji są oznaczane flagą, co pozwala na precyzyjne
 * wyszukiwanie z obsługą "brak sieci", "nie ma X" itp.
 */
export class LexicalEngine {
  private readonly wink: ReturnType<typeof winkNlp>;
  private readonly bm25: ReturnType<typeof bm25Vectorizer>;
  private readonly its: any;

  private _documents: string[] = [];
  private _isTrained = false;

  constructor(model: Model) {
    // ============================================================
    // Inicjalizacja wink-nlp z modelem językowym
    //
    // Używamy domyślnego pipe (tokenize, SBD, POS, NER, negation)
    // NegationModel jest ładowany raz i cachowany.
    // ============================================================
    this.wink = winkNlp(model, [
      'sbd',       // sentence boundary detection
      'negation',  // negation detection
      'pos',       // part-of-speech tagging
      'ner',       // named entity recognition
      'sentiment', // sentiment analysis
    ]);

    // ============================================================
    // BM25 Vectorizer z domyślną konfiguracją
    //
    // k1=1.2, b=0.75 — standardowe parametry BM25
    // ============================================================
    this.bm25 = bm25Vectorizer({
      k: 100,   // Wpływ rankingu (domyślnie 100)
      k1: 1.2,  // Nasycenie terminów
      b: 0.75,  // Normalizacja długości dokumentu
      norm: 'l2',
    });

    this.its = this.wink.its;
  }

  /**
   * indexDocuments(documents) — indeksuje dokumenty przez BM25
   *
   * @param documents - tablica dokumentów do indeksacji
   */
  indexDocuments(documents: string[]): void {
    this._documents = [...documents];

    // Naucz BM25 na wszystkich dokumentach
    for (const doc of documents) {
      const processed = this.wink.readDoc(doc);
      const tokens = processed.tokens().out(this.its.value) as string[];
      this.bm25.learn(tokens);
    }

    this._isTrained = true;
  }

  /**
   * analyzeQuery(query) — analizuje zapytanie z detekcją negacji
   *
   * Zwraca:
   *   - positive: tokeny do wyszukania
   *   - negated: tokeny które są zanegowane
   *
   * Przykład:
   *   "brak sieci" → positive: ["sieci"], negated: ["brak"]
   *   "nie ma internetu" → positive: ["internetu"], negated: ["nie", "ma"]
   */
  analyzeQuery(query: string): NegationAwareQuery {
    const doc = this.wink.readDoc(query);
    const tokens = doc.tokens();
    const tokenCount = tokens.length();

    const positive: string[] = [];
    const negated: string[] = [];

    for (let i = 0; i < tokenCount; i++) {
      const token = tokens.itemAt(i);
      const value = token.out(this.its.value) as string;
      const isNegation = token.out(this.its.negationFlag) as boolean;
      const pos = token.out(this.its.pos) as string;

      // Pomijamy znaki interpunkcyjne i spacje
      if (pos === 'PUNCT' || pos === 'SPACE') continue;

      if (isNegation) {
        negated.push(value);
      } else {
        positive.push(value);
      }
    }

    return {
      original: query,
      positive,
      negated,
    };
  }

  /**
   * search(query, topK) — wyszukiwanie BM25 z obsługą negacji
   *
   * 1. Analizuje zapytanie (negation-aware)
   * 2. Szuka BM25 na tokenach pozytywnych
   * 3. Odrzuca dokumenty zawierające tokeny zanegowane
   * 4. Zwraca topK wyników z oznaczeniami tokenów
   *
   @param query - tekst zapytania
   @param topK - liczba wyników (domyślnie 5)
   @returns LexicalSearchResult[]
   */
  search(query: string, topK: number = DEFAULT_TOP_K): LexicalSearchResult[] {
    if (!this._isTrained || this._documents.length === 0) {
      return [];
    }

    // ============================================================
    // Analiza zapytania z detekcją negacji
    // ============================================================
    const analysis = this.analyzeQuery(query);

    // Jeśli nie ma pozytywnych tokenów — nie ma wyników
    if (analysis.positive.length === 0) {
      return [];
    }

    // ============================================================
    // BM25 score na tokenach pozytywnych
    // ============================================================
    const queryVector = this.bm25.vectorOf(analysis.positive);

    const results: LexicalSearchResult[] = [];

    for (let i = 0; i < this._documents.length; i++) {
      const docText = this._documents[i];
      const doc = this.wink.readDoc(docText);
      const docTokens = doc.tokens().out(this.its.value) as string[];

      // ============================================================
      // Filtracja negacji: odrzuć dokumenty z tokenami zanegowanymi
      //
      // Jeśli zapytanie zawiera "brak sieci", a dokument mówi
      // o "sieci" w kontekście pozytywnym — odrzucamy go.
      // Jeśli dokument zawiera "brak" i "sieci" — szukamy dalej.
      // ============================================================
      const docLower = docText.toLowerCase();
      const hasNegatedTerm = analysis.negated.some(negTerm =>
        docLower.includes(negTerm.toLowerCase())
      );
      if (hasNegatedTerm) {
        continue; // Odrzuć dokument z zanegowanym terminem
      }

      // BM25 score dla dokumentu
      const docVector = this.bm25.vectorOf(docTokens);
      const score = similarity.vector.cosine(queryVector, docVector);

      // Token info dla dokumentu
      const tokenInfo: TokenInfo[] = [];
      for (let t = 0; t < docTokens.length; t++) {
        const token = doc.tokens().itemAt(t);
        tokenInfo.push({
          text: docTokens[t],
          isNegation: token.out(this.its.negationFlag) as boolean,
          pos: token.out(this.its.pos) as string,
        });
      }

      results.push({
        index: i,
        content: docText,
        score,
        tokens: tokenInfo,
      });
    }

    // ============================================================
    // Sortuj malejąco po score i zwróć topK
    // ============================================================
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * getDocumentCount() — liczba zindeksowanych dokumentów
   */
  getDocumentCount(): number {
    return this._documents.length;
  }

  /**
   * isTrained() — czy BM25 został wytrenowany
   */
  isTrained(): boolean {
    return this._isTrained;
  }
}
