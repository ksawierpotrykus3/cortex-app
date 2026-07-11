import { useState, useCallback } from 'react';
import type {
  ProjektyChatMessage,
  ProjektyNode,
  ProjektyEdge,
} from '../types';

export interface PlannerOperation {
  action: 'ADD' | 'UPDATE' | 'DELETE';
  reason?: string;
  node?: {
    id?: string;
    title: string;
    content: string;
    node_type?: string;
    status?: string;
    parent_id?: string | null;
  };
  edge?: {
    source_node_id: string;
    target_node_id: string;
    label?: string;
  };
  nodeId?: string;
}

export interface PlannerResult {
  operations: PlannerOperation[];
  parseError?: boolean;
}

// --- Slownik zakazane -> dozwolone (Faza 2, sekcja 4) ---
const BANNED_TO_ALLOWED: Record<string, string> = {
  'node': 'zadanie',
  'component': 'zadanie',
  'integration': 'polaczenie',
  'API': 'polaczenie',
  'architecture': 'struktura',
  'data_flow': 'przeplyw danych',
  'sync': 'przeplyw danych',
  'middleware': 'warstwa posrednia',
  'endpoint': 'punkt dostepu',
  'mandatory stack': 'wymagane narzedzia',
  'actors': 'osoby zaangazowane',
};

function cleanSlop(text: string): string {
  let result = text;
  for (const [banned, allowed] of Object.entries(BANNED_TO_ALLOWED)) {
    const regex = new RegExp(`\\b${banned}\\b`, 'gi');
    result = result.replace(regex, allowed);
  }
  return result;
}

// --- Warstwa wejsciowa: tlumaczenie nodow przed wyslaniem do AI ---
function translateNodesForAI(nodes: ProjektyNode[]): Record<string, unknown>[] {
  return nodes.map(n => ({
    id: n.id,
    rodzaj: n.node_type === 'component' ? 'zadanie' :
             n.node_type === 'integration' ? 'polaczenie' :
             n.node_type === 'task' ? 'zadanie' :
             n.node_type === 'domain' ? 'obszar' :
             n.node_type === 'root' ? 'glowny cel' : 'zadanie',
    tytul: n.title,
    opis: n.content || n.description || '',
    status: n.status || 'new',
    parent_id: n.parent_id || null,
  }));
}

// --- Warstwa wyjsciowa: tlumaczenie operacji z AI z powrotem ---
function translateOperationsFromAI(rawOps: any[]): PlannerOperation[] {
  return rawOps.map((op: any) => {
    const translated: PlannerOperation = { action: op.action, reason: op.reason };
    if (op.node) {
      translated.node = {
        ...op.node,
        title: cleanSlop(op.node.title || ''),
        content: cleanSlop(op.node.content || ''),
        node_type: op.node.node_type === 'zadanie' ? 'component' :
                    op.node.node_type === 'polaczenie' ? 'integration' :
                    op.node.node_type || 'component',
      };
    }
    if (op.edge) translated.edge = op.edge;
    if (op.nodeId) translated.nodeId = op.nodeId;
    return translated;
  });
}

// --- Retry z timeoutem 30s + obsluga 429/5xx ---
async function invokeAIWithRetry(
  invokeFn: () => Promise<string>,
  maxRetries: number = 3
): Promise<string> {
  const TIMEOUT_MS = 30_000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        invokeFn(),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('AI timeout po 30s')), TIMEOUT_MS)
        ),
      ]);

      const jsonMatch = result.match(/\{[\s\S]*\}/) || result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          JSON.parse(jsonMatch[0]);
          return result;
        } catch {
          // JSON zepsuty - retry
        }
      } else {
        return result;
      }
    } catch (err: any) {
      const is429 = err?.message?.includes('429') || err?.status === 429;
      const is5xx = err?.status >= 500 && err?.status < 600;
      const isTimeout = err?.message?.includes('timeout');

      if (attempt === maxRetries) {
        throw new Error(`AI nie zwrocilo poprawnej odpowiedzi po ${maxRetries} probach: ${err.message}`);
      }

      if (is429 || is5xx) {
        const delay = is429 ? 2000 * attempt : 1000 * attempt;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      if (isTimeout) {
        continue;
      }

      throw err;
    }
  }

  throw new Error('Max retries exceeded');
}

// --- Glowny hook ---
export function useExperimentalAI() {
  const [chatLoading, setChatLoading] = useState(false);
  const [plannerLoading, setPlannerLoading] = useState(false);

  // Zunifikowane wywolanie AI — Faza 2: jedno AI, jeden endpoint
  const invokeChat = useCallback(async (
    systemPrompt: string,
    messages: ProjektyChatMessage[],
    model: string
  ): Promise<string> => {
    const bridge = window.nexusBridge;
    if (!bridge?.projInvokeChatLLM) {
      throw new Error('Bridge AI nie jest dostepny — sprawdz polaczenie.');
    }
    setChatLoading(true);
    try {
      const fn = () => bridge.projInvokeChatLLM({ systemPrompt, messages, model }).then((r: { content: string }) => r.content);
      return await invokeAIWithRetry(fn);
    } finally {
      setChatLoading(false);
    }
  }, []);

  // W Faza 2 planner tez uzywa zunifikowanego chat LLM — przekazuje nodes/edges/specContent
  const invokePlanner = useCallback(async (
    systemPrompt: string,
    messages: ProjektyChatMessage[],
    nodes: ProjektyNode[],
    edges: ProjektyEdge[],
    specContent: string,
    model: string
  ): Promise<string> => {
    const bridge = window.nexusBridge;
    if (!bridge?.projInvokeChatLLM) {
      throw new Error('Bridge AI nie jest dostepny.');
    }
    setPlannerLoading(true);
    try {
      const translatedNodes = translateNodesForAI(nodes);
      const fn = () => bridge.projInvokeChatLLM({
        systemPrompt: cleanSlop(systemPrompt),
        messages,
        nodes: translatedNodes as any,
        edges,
        specContent,
        model,
      }).then((r: { content: string }) => r.content);
      return await invokeAIWithRetry(fn);
    } finally {
      setPlannerLoading(false);
    }
  }, []);

  const parsePlannerResponse = useCallback((raw: string): PlannerResult => {
    const jsonMatch = raw.match(/\{[\s\S]*"operations"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as PlannerResult;
        parsed.operations = translateOperationsFromAI(parsed.operations);
        return parsed;
      } catch {
        return { operations: [], parseError: true };
      }
    }
    return { operations: [], parseError: true };
  }, []);

  return {
    invokeChat,
    invokePlanner,
    parsePlannerResponse,
    chatLoading,
    plannerLoading,
    setPlannerLoading,
  };
}