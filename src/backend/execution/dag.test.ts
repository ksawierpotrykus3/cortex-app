// ================================================================
// NEXUS V2 — TDD Verification: DAG Cycle Detection (Phase 4.2)
// ================================================================
// Test 1: Zamknięty cykl A -> B -> C -> A
//         Node.js musi bezwzględnie wyrzucić CircularDependencyException
//         z 10. instancji bez dopuszczenia do Maximum Call Stack Size
//         Exceeded.
// Test 2: Poprawny DAG (A -> B -> C) — brak cyklu
// Test 3: Routing przez Regex
// Test 4: Routing przez string prefix
// Test 5: Konfiguracja PipelineContext.MAX_STACK_DEPTH
// Test 6: Brak węzła początkowego
// ================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WorkflowRouter,
  PipelineContext,
  CircularDependencyException,
  type AgentNode,
} from './dag';

describe('Phase 4.2 — DAG Cycle Detection', () => {
  // ============================================================
  // Test 1: Zamknięty cykl A -> B -> C -> A
  //
  // Stwórz fałszywy zestaw Agentów w konfiguracji pliku
  // symulacyjnego o zamkniętej architekturze wywołań w okrąg
  // A -> B -> C -> A.
  //
  // Asercja TDD narzuca twardy rygor, że po uruchomieniu testu
  // Node.js musi bezwzględnie wyrzucić wyjątek
  // CircularDependencyException z 10. instancji bez dopuszczenia
  // do zjawiska Maximum Call Stack Size Exceeded (które oznaczałoby
  // dziurę w naszym zmyślnym zabezpieczeniu).
  // ============================================================
  describe('Test 1: Cykl A -> B -> C -> A', () => {
    it('powinien wyrzucić CircularDependencyException po 10 hopach', async () => {
      // ================================================================
      // Konfiguracja zamkniętego cyklu
      // A: "go_to_b" → B: "go_to_c" → C: "go_to_a" → A: "go_to_b" → ...
      // ================================================================
      const nodeA: AgentNode = {
        id: 'agent_a',
        name: 'Agent A',
        execute: async () => 'agent_b',
      };

      const nodeB: AgentNode = {
        id: 'agent_b',
        name: 'Agent B',
        execute: async () => 'agent_c',
      };

      const nodeC: AgentNode = {
        id: 'agent_c',
        name: 'Agent C',
        execute: async () => 'agent_a', // Zamknięcie cyklu: C → A
      };

      const router = new WorkflowRouter([nodeA, nodeB, nodeC]);
      const context = router.createChainContext('agent_a', { test: true });

      let threw = false;
      try {
        await router.execute(context);
      } catch (err) {
        if (err instanceof CircularDependencyException) {
          threw = true;

          // === WERYFIKACJA CIRCULAR_DEPENDENCY_EXCEPTION ===
          expect(err.hopCount).toBeGreaterThanOrEqual(10);
          expect(err.correlationId).toBeDefined();
          expect(err.visitedNodes.length).toBeGreaterThanOrEqual(10);

          // Komunikat błędu powinien zawierać kluczowe informacje
          expect(err.message).toContain('Pipeline Loop Detected');
          expect(err.message).toContain('10');
          expect(err.message).toContain('API');
        }
      }

      // === TWARDA ASERCJA ===
      // Musiał rzucić CircularDependencyException, a nie RangeError
      // (Maximum Call Stack Size Exceeded) ani inny błąd
      expect(threw).toBe(true);
    });

    it('NIE powinien dopuścić do Maximum Call Stack Size Exceeded', async () => {
      const nodeA: AgentNode = {
        id: 'a',
        name: 'A',
        execute: async () => 'b',
      };
      const nodeB: AgentNode = {
        id: 'b',
        name: 'B',
        execute: async () => 'c',
      };
      const nodeC: AgentNode = {
        id: 'c',
        name: 'C',
        execute: async () => 'a',
      };

      const router = new WorkflowRouter([nodeA, nodeB, nodeC]);
      const context = router.createChainContext('a');

      try {
        await router.execute(context);
        // Jeśli doszliśmy tutaj — test FAIL (brak błędu)
        expect.unreachable('Oczekiwano CircularDependencyException');
      } catch (err) {
        // === KRYTYCZNA ASERCJA ===
        // Błąd MUSI być CircularDependencyException
        // RangeError (Maximum Call Stack) = DZIURA W ZABEZPIECZENIU
        expect(err).toBeInstanceOf(CircularDependencyException);
        expect(err).not.toBeInstanceOf(RangeError);
      }
    });
  });

  // ============================================================
  // Test 2: Poprawny DAG (A -> B -> C) — brak cyklu
  // ============================================================
  describe('Test 2: Poprawny DAG A -> B -> C', () => {
    it('powinien przejść przez wszystkie węzły bez cyklu', async () => {
      const visited: string[] = [];

      const nodeA: AgentNode = {
        id: 'a',
        name: 'A',
        execute: async (ctx) => {
          visited.push('a');
          return 'b';
        },
      };

      const nodeB: AgentNode = {
        id: 'b',
        name: 'B',
        execute: async (ctx) => {
          visited.push('b');
          return 'c';
        },
      };

      const nodeC: AgentNode = {
        id: 'c',
        name: 'C',
        execute: async (ctx) => {
          visited.push('c');
          return null; // Koniec potoku
        },
      };

      const router = new WorkflowRouter([nodeA, nodeB, nodeC]);
      const context = router.createChainContext('a');

      await router.execute(context);

      // Sprawdź kolejność odwiedzin
      expect(visited).toEqual(['a', 'b', 'c']);

      // Hop count powinien być 2 (przejścia: a→b, b→c)
      expect(context.hopCount).toBe(2);

      // 3 odwiedzone węzły
      expect(context.visitedNodes.length).toBe(3);
    });
  });

  // ============================================================
  // Test 3: Routing przez Regex
  // ============================================================
  describe('Test 3: Routing przez Regex', () => {
    it('powinien routować przez routePattern RegExp', async () => {
      const visited: string[] = [];

      const nodeA: AgentNode = {
        id: 'a',
        name: 'A',
        execute: async () => 'router:agent_b',
      };

      const nodeB: AgentNode = {
        id: 'b',
        name: 'B',
        routePattern: /^router:agent_[ab]$/,
        execute: async (ctx) => {
          visited.push('b');
          return null;
        },
      };

      const router = new WorkflowRouter([nodeA, nodeB]);
      const context = router.createChainContext('a');

      await router.execute(context);

      expect(visited).toContain('b');
    });
  });

  // ============================================================
  // Test 4: Routing przez string prefix
  // ============================================================
  describe('Test 4: Routing przez string prefix', () => {
    it('powinien routować przez routePattern string', async () => {
      const visited: string[] = [];

      const nodeA: AgentNode = {
        id: 'a',
        name: 'A',
        execute: async () => 'go:writer',
      };

      const nodeB: AgentNode = {
        id: 'writer',
        name: 'Writer',
        routePattern: 'go:',
        execute: async (ctx) => {
          visited.push('writer');
          return null;
        },
      };

      const router = new WorkflowRouter([nodeA, nodeB]);
      const context = router.createChainContext('a');

      await router.execute(context);

      expect(visited).toContain('writer');
    });
  });

  // ============================================================
  // Test 5: Konfiguracja PipelineContext
  // ============================================================
  describe('Test 5: PipelineContext - konfiguracja i stan', () => {
    it('MAX_STACK_DEPTH powinien wynosić 10', () => {
      expect(PipelineContext.MAX_STACK_DEPTH).toBe(10);
    });

    it('powinien inicjalizować poprawnie kontekst', () => {
      const ctx = new PipelineContext('entry_node', { initial: true });

      expect(ctx.entryNodeId).toBe('entry_node');
      expect(ctx.correlationId).toBeDefined();
      expect(typeof ctx.correlationId).toBe('string');
      expect(ctx.hopCount).toBe(0);
      expect(ctx.visitedNodes).toEqual([]);
      expect(ctx.payload).toEqual({ initial: true });
      expect(ctx.startedAt).toBeGreaterThan(0);
    });

    it('powinien inkrementować hopCount', () => {
      const ctx = new PipelineContext('start');
      expect(ctx.hopCount).toBe(0);

      ctx.incrementHop();
      expect(ctx.hopCount).toBe(1);

      ctx.incrementHop();
      expect(ctx.hopCount).toBe(2);
    });

    it('powinien rzucić CircularDependencyException przy hopCount > 10', () => {
      const ctx = new PipelineContext('start');

      // 10 poprawnych inkrementacji
      for (let i = 0; i < 10; i++) {
        ctx.visitNode(`node_${i}`);
        ctx.incrementHop();
      }

      // 11. powinna rzucić błąd
      ctx.visitNode('node_11');
      expect(() => ctx.incrementHop()).toThrow(CircularDependencyException);
    });

    it('powinien rejestrować odwiedzone węzły', () => {
      const ctx = new PipelineContext('start');
      ctx.visitNode('a');
      ctx.visitNode('b');
      ctx.visitNode('c');

      expect(ctx.currentNodeId).toBe('c');
      expect(ctx.visitedNodes).toEqual(['a', 'b', 'c']);
    });
  });

  // ============================================================
  // Test 6: Obsługa błędów — brak węzła
  // ============================================================
  describe('Test 6: Obsługa błędów konfiguracji', () => {
    it('powinien rzucić błąd przy nieistniejącym węźle początkowym', async () => {
      const nodeA: AgentNode = {
        id: 'a',
        name: 'A',
        execute: async () => null,
      };

      const router = new WorkflowRouter([nodeA]);
      const context = router.createChainContext('non_existent_node');

      await expect(router.execute(context)).rejects.toThrow(
        '[DAG] Węzeł początkowy \'non_existent_node\' nie istnieje'
      );
    });

    it('powinien rzucić błąd przy duplikacie ID węzła', () => {
      const nodeA: AgentNode = {
        id: 'duplicate',
        name: 'A',
        execute: async () => null,
      };
      const nodeB: AgentNode = {
        id: 'duplicate',
        name: 'B',
        execute: async () => null,
      };

      expect(() => new WorkflowRouter([nodeA, nodeB])).toThrow('Duplikat');
    });

    it('powinien rzucić błąd przy routingu do nieistniejącego węzła', async () => {
      const nodeA: AgentNode = {
        id: 'a',
        name: 'A',
        execute: async () => 'non_existent',
      };

      const router = new WorkflowRouter([nodeA]);
      const context = router.createChainContext('a');

      await expect(router.execute(context)).rejects.toThrow(
        "[DAG] Węzeł docelowy 'non_existent' nie istnieje"
      );
    });
  });
});
