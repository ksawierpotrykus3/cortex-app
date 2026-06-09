// ================================================================
// NEXUS V2 — Workflow Router & DAG Cycle Detection (Phase 4.2)
// ================================================================
// Silnik warunkowego DAG z zabezpieczeniem przed cyklami
// asynchronicznymi. Nakłada limit MAX_STACK_DEPTH = 10 na
// głębokość potoku i tnie stack asertywnym błędem.
//
// ARCHITEKTURA:
//   - PipelineContext z licznikiem hopCount i MAX_STACK_DEPTH
//   - CircularDependencyException przy przekroczeniu limitu 10
//   - Regex/parser routing na stykach węzłów
//   - Twarde przerwanie bez pytania użytkownika o zgodę
// ================================================================

// ==============================================================
// Konfiguracja
// ==============================================================
const MAX_STACK_DEPTH = 10;

// ==============================================================
// Typy
// ==============================================================

/**
 * AgentNode — definicja węzła w grafie DAG
 */
export interface AgentNode {
  id: string;
  name: string;
  /** Regex określający warunek przekazania do tego węzła */
  routePattern?: RegExp | string;
  /** Funkcja wykonawcza agenta */
  execute: (context: PipelineContext, input: any) => Promise<string | null>;
}

/**
 * PipelineContext — kontekst wykonania potoku
 *
 * Zawiera licznik hopCount zwiększany za każdym strzałem
 * do kolejnego Agenta. Po osiągnięciu MAX_STACK_DEPTH (10)
 * następuje twarde przerwanie.
 */
export class PipelineContext {
  /** Maksymalna dopuszczalna głębokość potoku */
  public static readonly MAX_STACK_DEPTH = MAX_STACK_DEPTH;

  /** Licznik przejść między agentami */
  public hopCount = 0;

  /** ID aktualnego węzła */
  public currentNodeId: string | null = null;

  /** ID węzła początkowego */
  public readonly entryNodeId: string;

  /** Korelacja (unikalne ID całego przebiegu) */
  public readonly correlationId: string;

  /** Historia odwiedzonych węzłów (kolejność) */
  public readonly visitedNodes: string[] = [];

  /** Payload przekazywany między agentami */
  public payload: any;

  /** Sygnatura czasowa startu */
  public readonly startedAt: number;

  constructor(entryNodeId: string, initialPayload?: any) {
    this.entryNodeId = entryNodeId;
    this.correlationId = _generateCorrelationId();
    this.payload = initialPayload ?? {};
    this.startedAt = Date.now();
  }

  /**
   * incrementHop() — zwiększa licznik hopów
   *
   * Za każdym strzałem do kolejnego Agenta licznik się zwiększa.
   * Osiągnięcie limitu 10 zrzuca atomowe CircularDependencyException
   * z twardym przerwaniem.
   *
   * @throws {CircularDependencyException} przy hopCount >= MAX_STACK_DEPTH
   */
  incrementHop(): void {
    this.hopCount++;

    if (this.hopCount > MAX_STACK_DEPTH) {
      throw new CircularDependencyException(
        this.correlationId,
        this.hopCount,
        this.visitedNodes,
      );
    }
  }

  /**
   * visitNode(nodeId) — rejestruje odwiedzenie węzła
   */
  visitNode(nodeId: string): void {
    this.currentNodeId = nodeId;
    this.visitedNodes.push(nodeId);
  }
}

/**
 * CircularDependencyException — twarde przerwanie potoku
 *
 * Rzucane gdy licznik hopów przekroczy MAX_STACK_DEPTH (10).
 * Nie pyta użytkownika o zgodę — oszczędza natychmiastowo
 * portfele kluczy w chmurze API OpenAI przed zjedzeniem limitu.
 */
export class CircularDependencyException extends Error {
  public readonly correlationId: string;
  public readonly hopCount: number;
  public readonly visitedNodes: string[];

  constructor(correlationId: string, hopCount: number, visitedNodes: string[]) {
    const cyclePath = visitedNodes.join(' → ');
    super(
      `[DAG_CYCLE] Pipeline Loop Detected (correlationId: ${correlationId}, ` +
      `hops: ${hopCount}/${MAX_STACK_DEPTH}). ` +
      `Path: ${cyclePath}. ` +
      `Osiągnięto limit ${MAX_STACK_DEPTH} przejść między agentami. ` +
      `Aplikacja przerwała wykonanie aby chronić portfel API OpenAI przed zjedzeniem limitu.`
    );
    this.name = 'CircularDependencyException';
    this.correlationId = correlationId;
    this.hopCount = hopCount;
    this.visitedNodes = [...visitedNodes];
  }
}

/**
 * WorkflowRouter — silnik DAG z wykrywaniem cykli
 *
 * 1. Przyjmuje mapę węzłów (AgentNode) i kontekst (PipelineContext)
 * 2. Wykonuje węzeł, analizuje wynik przez routePattern (Regex)
 * 3. Przekazuje sterowanie do następnego węzła
 * 4. Każde przejście zwiększa hopCount — przy 10 twardy stop
 */
export class WorkflowRouter {
  private readonly nodes: Map<string, AgentNode>;

  constructor(nodes: AgentNode[]) {
    this.nodes = new Map();
    for (const node of nodes) {
      if (this.nodes.has(node.id)) {
        throw new Error(`[DAG] Duplikat ID węzła: ${node.id}`);
      }
      this.nodes.set(node.id, node);
    }
  }

  /**
   * getNode(id) — zwraca węzeł po ID
   */
  getNode(id: string): AgentNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * getNodes() — zwraca wszystkie zarejestrowane węzły
   */
  getNodes(): AgentNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * execute(context) — główna pętla wykonawcza DAG
   *
   * @param context - PipelineContext z stanem wykonania
   * @param input - początkowy payload
   * @returns wynik końcowy ostatniego węzła
   *
   * @throws {CircularDependencyException} przy hopCount > MAX_STACK_DEPTH
   * @throws {Error} jeśli węzeł nie istnieje
   */
  async execute(context: PipelineContext, input?: any): Promise<any> {
    if (input !== undefined) {
      context.payload = input;
    }

    let currentNode = this.nodes.get(context.entryNodeId);
    if (!currentNode) {
      throw new Error(`[DAG] Węzeł początkowy '${context.entryNodeId}' nie istnieje`);
    }

    // Rejestruj pierwszy węzeł
    context.visitNode(currentNode.id);

    let result: any = context.payload;

    // ================================================================
    // Główna pętla DAG
    //
    // Każda iteracja:
    // 1. Wykonuje aktualny węzeł (agent)
    // 2. Analizuje wynik przez routePattern agentów
    // 3. Jeśli któryś agent pasuje — hopCount++ i wykonanie
    // 4. Jeśli żaden nie pasuje — koniec potoku
    // 5. Przy hopCount > MAX_STACK_DEPTH — CircularDependencyException
    // ================================================================
    while (true) {
      // Wykonaj aktualny węzeł
      result = await currentNode.execute(context, result);

      // Jeśli agent zwrócił null — koniec potoku
      if (result === null) {
        break;
      }

      // ================================================================
      // Mechanizm przekazywania instrukcji na stykach węzłów
      //
      // Agenci zwracają informację string (np. "router:agent_b")
      // i decydują o kolejnym adresacie z mapy DAG.
      // Routing odbywa się przez routePattern (Regex lub string prefix).
      //
      // Jeśli agent zwrócił string (nie-null), jest to zamiar routingu.
      // Jeżeli nie znaleziono pasującego węzła — rzucamy błąd.
      // Tylko result !== string (lub null) oznacza koniec potoku.
      // ================================================================
      if (typeof result !== 'string') {
        // Wynik nie jest stringiem — koniec potoku (agent zwrócił dane)
        break;
      }

      const nextNodeId = this._route(result);

      if (!nextNodeId) {
        // Agent zwrócił string, ale nie znaleziono pasującego węzła
        throw new Error(`[DAG] Węzeł docelowy '${result}' nie istnieje`);
      }

      const nextNode = this.nodes.get(nextNodeId);

      // ================================================================
      // INCREMENT HOP — kluczowa linia zabezpieczenia
      //
      // Osiągnięcie limitu 10 na liczniku zrzuca atomowe:
      //   throw new CircularDependencyException(...)
      // z twardym przerwaniem i wysłaniem błędu do użytkownika
      // bez pytania o zgodę.
      // ================================================================
      context.incrementHop();
      context.visitNode(nextNode.id);

      currentNode = nextNode;
    }

    return result;
  }

  /**
   * _route(result) — analizuje wynik agenta i znajduje następny węzeł
   *
   * Jeśli wynik jest string, szuka węzła którego routePattern pasuje.
   * Kolejność: najpierw exact match ID, potem regex/string pattern.
   */
  private _route(result: any): string | null {
    if (typeof result !== 'string') {
      return null;
    }

    // ================================================================
    // Exact match: jeśli wynik to "agent_b", szukamy węzła o ID "agent_b"
    // ================================================================
    if (this.nodes.has(result)) {
      return result;
    }

    // ================================================================
    // Pattern match: iteruj przez wszystkie węzły i testuj routePattern
    //
    // Wspiera:
    //   - RegExp: /^router:agent_[ab]$/
    //   - string: "router:agent_b" (exact match prefix)
    // ================================================================
    for (const [, node] of this.nodes) {
      if (!node.routePattern) continue;

      if (node.routePattern instanceof RegExp) {
        if (node.routePattern.test(result)) {
          return node.id;
        }
      } else if (typeof node.routePattern === 'string') {
        if (result.startsWith(node.routePattern)) {
          return node.id;
        }
      }
    }

    return null;
  }

  /**
   * createChainContext(entryNodeId, initialPayload) — tworzy nowy kontekst
   */
  createChainContext(entryNodeId: string, initialPayload?: any): PipelineContext {
    return new PipelineContext(entryNodeId, initialPayload);
  }
}

// ==============================================================
// Helper
// ==============================================================

/**
 * _generateCorrelationId — unikalne ID korelacji dla przebiegu
 *
 * Używa Date.now() + losowych bajtów z crypto.randomUUID,
 * bez zewnętrznych bibliotek.
 */
function _generateCorrelationId(): string {
  try {
    const { randomUUID } = require('crypto');
    return randomUUID();
  } catch {
    // Fallback dla środowisk bez crypto
    return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }
}
