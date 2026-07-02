import { useState, useCallback } from 'react';
import type {
  ExperimentalChatMessage,
  ExperimentalNode,
  ExperimentalEdge,
} from '../types';

export interface PlannerOperation {
  action: 'ADD' | 'UPDATE' | 'DELETE';
  node?: {
    id?: string;
    title: string;
    content: string;
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
}

export function useExperimentalAI() {
  const [chatLoading, setChatLoading] = useState(false);
  const [plannerLoading, setPlannerLoading] = useState(false);

  const invokeChat = useCallback(async (
    systemPrompt: string,
    messages: ExperimentalChatMessage[],
    model: string
  ): Promise<string> => {
    const bridge = window.nexusBridge;
    if (!bridge?.expInvokeChatLLM) {
      // Fallback — symulacja gdy bridge nie jest dostepny
      await new Promise(r => setTimeout(r, 600));
      return `[AI offline] Przeanalizowalem: "${messages[messages.length - 1]?.content}". Uzyj przycisku Planera by zaktualizowac plan.`;
    }
    setChatLoading(true);
    try {
      const result = await bridge.expInvokeChatLLM({ systemPrompt, messages, model });
      return result.content;
    } finally {
      setChatLoading(false);
    }
  }, []);

  const invokePlanner = useCallback(async (
    systemPrompt: string,
    messages: ExperimentalChatMessage[],
    nodes: ExperimentalNode[],
    edges: ExperimentalEdge[],
    specContent: string,
    model: string
  ): Promise<string> => {
    const bridge = window.nexusBridge;
    if (!bridge?.expInvokePlanner) {
      // Fallback
      await new Promise(r => setTimeout(r, 900));
      return JSON.stringify({
        operations: [
          {
            action: 'ADD',
            node: { title: 'Analiza wymagan', content: 'Przeglad wymagan projektu na podstawie rozmowy.', parent_id: null },
          },
          {
            action: 'ADD',
            node: { title: 'Architektura systemu', content: 'Projekt struktury i komponentow.', parent_id: null },
          },
        ],
      });
    }
    setPlannerLoading(true);
    try {
      const result = await bridge.expInvokePlanner({
        systemPrompt,
        messages,
        nodes,
        edges,
        specContent,
        model,
      });
      return result.content;
    } finally {
      setPlannerLoading(false);
    }
  }, []);

  const parsePlannerResponse = useCallback((raw: string): PlannerResult => {
    // Szukaj JSON w odpowiedzi
    const jsonMatch = raw.match(/\{[\s\S]*"operations"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as PlannerResult;
      } catch {
        // ignore
      }
    }
    // Fallback: pusta lista
    return { operations: [] };
  }, []);

  return {
    invokeChat,
    invokePlanner,
    parsePlannerResponse,
    chatLoading,
    plannerLoading,
  };
}
