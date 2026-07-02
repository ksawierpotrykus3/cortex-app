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
      throw new Error('Bridge AI nie jest dostepny — sprawdz polaczenie.');
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
      throw new Error('Bridge Planera nie jest dostepny.');
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
    const jsonMatch = raw.match(/\{[\s\S]*"operations"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as PlannerResult;
      } catch {
        // ignore
      }
    }
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
