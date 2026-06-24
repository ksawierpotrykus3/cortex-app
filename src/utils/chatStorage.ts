// ============================================================================
// NEXUS — Chat Storage (IndexedDB)
// Permanentny zapis konwersacji FloatingAgentPanel
// Używa idb-keyval do prostego key-value w IndexedDB
// ============================================================================

import { get, set, del, keys, createStore } from 'idb-keyval';

// Interfejs zapisywanej konwersacji
export interface StoredChatSession {
  id: string;           // agentId
  name: string;
  model: string;
  messages: StoredMessage[];
  collapsed: boolean;
  lastActive: string;   // ISO timestamp
}

export interface StoredMessage {
  role: string;
  content: string;
  timestamp: string;
  capability?: string;
}

// Dedicated store dla konwersacji (nie koliduje z default store)
const chatStore = createStore('nexus-chats', 'sessions');

/** Zapisuje stan wszystkich agentów */
export async function saveChatSessions(agents: {
  id: string; name: string; model: string;
  messages: { role: string; content: string; timestamp: string; capability?: string }[];
  collapsed: boolean;
}[]): Promise<void> {
  try {
    // Save each agent session individually
    for (const agent of agents) {
      const session: StoredChatSession = {
        id: agent.id,
        name: agent.name,
        model: agent.model,
        messages: agent.messages,
        collapsed: agent.collapsed,
        lastActive: new Date().toISOString(),
      };
      await set(agent.id, session, chatStore);
    }
    // Update the index of all agent IDs
    const allIds = agents.map(a => a.id);
    await set('__agent_ids__', allIds, chatStore);
  } catch (err) {
    console.warn('[ChatStorage] Failed to save sessions:', err);
  }
}

/** Wczytuje wszystkie zapisane sesje */
export async function loadChatSessions(): Promise<StoredChatSession[]> {
  try {
    const allIds = await get<string[]>('__agent_ids__', chatStore);
    if (!allIds || !Array.isArray(allIds)) return [];

    const sessions: StoredChatSession[] = [];
    for (const id of allIds) {
      const session = await get<StoredChatSession>(id, chatStore);
      if (session) sessions.push(session);
    }
    return sessions;
  } catch (err) {
    console.warn('[ChatStorage] Failed to load sessions:', err);
    return [];
  }
}

/** Usuwa pojedynczą sesję */
export async function deleteChatSession(agentId: string): Promise<void> {
  try {
    await del(agentId, chatStore);
    const allIds = (await get<string[]>('__agent_ids__', chatStore)) || [];
    await set('__agent_ids__', allIds.filter(id => id !== agentId), chatStore);
  } catch (err) {
    console.warn('[ChatStorage] Failed to delete session:', err);
  }
}

/** Czyści wszystkie sesje */
export async function clearAllChatSessions(): Promise<void> {
  try {
    const allKeys = await keys(chatStore);
    for (const key of allKeys) {
      await del(key, chatStore);
    }
  } catch (err) {
    console.warn('[ChatStorage] Failed to clear sessions:', err);
  }
}