// ================================================================
// NEXUS V2 — RRF Fusion Engine (Phase 4.4)
// ================================================================
// Połączenie wyników BM25 i MiniLM algorytmem Reciprocal Rank
// Fusion (RRF). Używa Promise.allSettled zamiast Promise.all,
// aby awaria jednego silnika nie zrzutowała całego wyszukiwania.
//
// ARCHITEKTURA:
//   - Promise.allSettled — niezależna obsługa błędów
//   - RRF score = 1 / (k + rank)
//   - Ucięcie najsłabszych ogniw (topK)
//   - Zwrócenie wyników nawet jeśli jeden silnik padł
// ================================================================

import { SemanticEngine, type SemanticSearchResult as SemanticResult } from './semantic';
import { LexicalEngine, type LexicalSearchResult as LexicalResult } from './lexical';

// ==============================================================
// Konfiguracja
// ==============================================================
const RRF_K = 60; // Stała RRF (standardowa wartość 60)
const DEFAULT_TOP_K = 5;

// ==============================================================
// Typy
// ==============================================================
export interface RRFSearchResult {
  /** Indeks dokumentu w oryginalnej tablicy */
  index: number;
  /** Treść dokumentu */
  content: string;
  /** Wynik RRF (znormalizowany) */
  score: number;
  /** Wynik semantyczny (jeśli dostępny) */
  semanticScore: number | null;
  /** Wynik leksykalny (jeśli dostępny) */
  lexicalScore: number | null;
  /** Które silniki zwróciły ten wynik */
  sources: ('semantic' | 'lexical')[];
}

export interface EngineStatus {
  /** Czy silnik semantyczny zadziałał */
  semanticOk: boolean;
  /** Czy silnik leksykalny zadziałał */
  lexicalOk: boolean;
  /** Błąd silnika semantycznego (jeśli wystąpił) */
  semanticError?: string;
  /** Błąd silnika leksykalnego (jeśli wystąpił) */
  lexicalError?: string;
}

export interface RRFSearchResponse {
  /** Wyniki wyszukiwania */
  results: RRFSearchResult[];
  /** Status silników */
  engines: EngineStatus;
  /** Czy któreś wyniki są cząstkowe */
  isPartial: boolean;
}

/**
 * RRFEngine — łączy wyniki BM25 i MiniLM przez RRF
 *
 * ZASADY:
 * 1. Promise.allSettled — awaria jednego nie psuje drugiego
 * 2. RRF score = 1 / (k + rank)
 * 3. Suma score'ów RRF dla dokumentów znalezionych przez oba silniki
 * 4. Dokument znaleziony tylko przez jeden silnik dostaje jego RRF
 * 5. Sortowanie malejąco po RRF score
 */
export class RRFEngine {
  private readonly semantic: SemanticEngine;
  private readonly lexical: LexicalEngine;

  constructor(semantic: SemanticEngine, lexical: LexicalEngine) {
    this.semantic = semantic;
    this.lexical = lexical;
  }

  /**
   * search(query, documents, topK) — wyszukiwanie RRF
   *
   @param query - tekst zapytania
   @param documents - tablica dokumentów do przeszukania
   @param topK - liczba wyników (domyślnie 5)
   @returns RRFSearchResponse z wynikami i statusem silników
   */
  async search(
    query: string,
    documents: string[],
    topK: number = DEFAULT_TOP_K,
  ): Promise<RRFSearchResponse> {
    // ============================================================
    // Promise.allSettled — awaria jednego nie rujnuje drugiego
    // ============================================================
    const [semanticResult, lexicalResult] = await Promise.allSettled([
      this._runSemantic(query, documents),
      this._runLexical(query),
    ]);

    // ============================================================
    // Status silników
    // ============================================================
    const semanticOk = semanticResult.status === 'fulfilled';
    const lexicalOk = lexicalResult.status === 'fulfilled';

    const engines: EngineStatus = {
      semanticOk,
      lexicalOk,
      semanticError: semanticOk ? undefined : this._extractError(semanticResult),
      lexicalError: lexicalOk ? undefined : this._extractError(lexicalResult),
    };

    // ============================================================
    // Sprawdź czy któryś silnik zwrócił wyniki
    // ============================================================
    const semanticResults = semanticOk ? (semanticResult as PromiseFulfilledResult<SemanticResult[]>).value : [];
    const lexicalResults = lexicalOk ? (lexicalResult as PromiseFulfilledResult<LexicalResult[]>).value : [];

    const isPartial = semanticOk !== lexicalOk; // Jeden z silników nie zadziałał

    // Jeśli oba padły — zwróć pusty wynik
    if (!semanticOk && !lexicalOk) {
      return {
        results: [],
        engines,
        isPartial: false,
      };
    }

    // ============================================================
    // RRF Fusion
    //
    // Dla każdego dokumentu:
    //   rankSemantic = pozycja w wynikach semantycznych (1-based)
    //   rankLexical  = pozycja w wynikach leksykalnych (1-based)
    //   rrfScore = 1/(k + rankSemantic) + 1/(k + rankLexical)
    //
    // Jeśli dokument jest tylko w jednym zestawie — dostaje tylko
    // jego RRF score.
    // ============================================================
    const rrfMap = new Map<number, { semanticRank: number | null; lexicalRank: number | null }>();

    // Indeksuj wyniki semantyczne
    for (let i = 0; i < semanticResults.length; i++) {
      const idx = semanticResults[i].index;
      if (!rrfMap.has(idx)) {
        rrfMap.set(idx, { semanticRank: null, lexicalRank: null });
      }
      rrfMap.get(idx)!.semanticRank = i + 1; // 1-based rank
    }

    // Indeksuj wyniki leksykalne
    for (let i = 0; i < lexicalResults.length; i++) {
      const idx = lexicalResults[i].index;
      if (!rrfMap.has(idx)) {
        rrfMap.set(idx, { semanticRank: null, lexicalRank: null });
      }
      rrfMap.get(idx)!.lexicalRank = i + 1; // 1-based rank
    }

    // ============================================================
    // Oblicz RRF score dla każdego dokumentu
    // ============================================================
    const fusedResults: RRFSearchResult[] = [];

    for (const [docIndex, ranks] of rrfMap) {
      let rrfScore = 0;

      const sources: ('semantic' | 'lexical')[] = [];

      if (ranks.semanticRank !== null) {
        rrfScore += 1 / (RRF_K + ranks.semanticRank);
        sources.push('semantic');
      }

      if (ranks.lexicalRank !== null) {
        rrfScore += 1 / (RRF_K + ranks.lexicalRank);
        sources.push('lexical');
      }

      // Znajdź oryginalne score z każdego silnika
      const semResult = semanticResults.find(r => r.index === docIndex);
      const lexResult = lexicalResults.find(r => r.index === docIndex);

      fusedResults.push({
        index: docIndex,
        content: documents[docIndex] ?? '',
        score: rrfScore,
        semanticScore: semResult?.score ?? null,
        lexicalScore: lexResult?.score ?? null,
        sources,
      });
    }

    // ============================================================
    // Sortuj malejąco po RRF score i zwróć topK
    // ============================================================
    fusedResults.sort((a, b) => b.score - a.score);

    return {
      results: fusedResults.slice(0, topK),
      engines,
      isPartial,
    };
  }

  /**
   * _runSemantic — uruchamia wyszukiwanie semantyczne z obsługą błędów
   */
  private async _runSemantic(
    query: string,
    documents: string[],
  ): Promise<SemanticResult[]> {
    try {
      return await this.semantic.search(query, documents, 100);
    } catch (err) {
      throw new Error(
        `Błąd silnika semantycznego: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * _runLexical — uruchamia wyszukiwanie leksykalne z obsługą błędów
   */
  private async _runLexical(query: string): Promise<LexicalResult[]> {
    try {
      return this.lexical.search(query, 100);
    } catch (err) {
      throw new Error(
        `Błąd silnika leksykalnego: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * _extractError — wydobywa komunikat błędu z PromiseSettledResult
   */
  private _extractError(
    result: PromiseSettledResult<any>
  ): string | undefined {
    if (result.status === 'rejected') {
      return result.reason instanceof Error ? result.reason.message : String(result.reason);
    }
    return undefined;
  }
}
