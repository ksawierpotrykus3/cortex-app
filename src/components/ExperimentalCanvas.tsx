import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Projekt,
  ProjektyConversation,
  ProjektyChatMessage,
  ProjektyNode,
  ProjektyEdge,
  ProjektyNodeAnnotation,
  ProjektyAIConfig,
  GlobalContext,
  NodeType,
  NodeStatus,
  RelationType,
} from '../types';
import { useExperimentalAI, PlannerOperation } from '../hooks/useExperimentalAI';
import { useAutoLayout } from '../hooks/useAutoLayout';

const genId = () => `exp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

const parseAiConfig = (raw: any): ProjektyAIConfig => {
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
  return raw || {};
};

const AI_MODELS = ['DeepSeek V4 Flash', 'DeepSeek V4 Pro'] as const;



const NODE_BORDER: Record<string, string> = {
  root: 'border-white',
  domain: 'border-blue-500',
  component: 'border-gray-400',
  task: 'border-gray-600',
  integration: 'border-green-500',
};

export function ExperimentalCanvas() {
  // -- projekty --
  const [projects, setProjects] = useState<Projekt[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'unsaved'>('saved');
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // -- konwersacje --
  const [conversations, setConversations] = useState<ProjektyConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // -- dane projektu --
  const [specContent, setSpecContent] = useState('');
  const [messages, setMessages] = useState<ProjektyChatMessage[]>([]);
  const [nodes, setNodes] = useState<ProjektyNode[]>([]);
  const [edges, setEdges] = useState<ProjektyEdge[]>([]);

  // -- panele boczne --
  const [specPanelOpen, setSpecPanelOpen] = useState(true);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(true);

  // -- AI config --
  const [chatModel, setChatModel] = useState<string>('DeepSeek V4 Flash');
  const [plannerModel, setPlannerModel] = useState<string>('DeepSeek V4 Flash');
  // Chat AI
  const [chatSystemPrompt, setChatSystemPrompt] = useState('');
  const [plannerSystemPrompt, setPlannerSystemPrompt] = useState(
    'Jestes Planerem Architektury. Analizujesz rozmowe i istniejący plan, proponujesz zmiany w wezlach. Zwracasz JSON z operacjami.'
  );
  const [showSettings, setShowSettings] = useState(false);

  // -- czat --
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // -- canvas --
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [canvasScale, setCanvasScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, nx: 0, ny: 0 });
  const [annotationNode, setAnnotationNode] = useState<string | null>(null);
  const [annotationText, setAnnotationText] = useState('');

  // -- planner --
  const { invokeChat, invokePlanner, parsePlannerResponse, chatLoading, plannerLoading, setPlannerLoading } = useExperimentalAI();
  const { applyLayout } = useAutoLayout();
  const [diffProposal, setDiffProposal] = useState<{ operations: PlannerOperation[] } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // -- Fazy planowania --
  const [plannerPhase, setPlannerPhase] = useState<'idle' | 'phase1' | 'phase2' | 'phase3' | 'phase4' | 'done'>('idle');
  const [plannerProgress, setPlannerProgress] = useState({ current: 0, total: 0 });
  const [globalContext, setGlobalContext] = useState<GlobalContext | null>(null);

  // fix(audyt): funkcje nie były zdefiniowane, powodowały ReferenceError
  const nodePosCounter = useRef(0);
  const nextNodePos = () => {
    const cols = 4;
    const x = 200 + (nodePosCounter.current % cols) * 280;
    const y = 200 + Math.floor(nodePosCounter.current / cols) * 200;
    nodePosCounter.current++;
    return { x, y };
  };
  const resetNodePos = () => { nodePosCounter.current = 0; };

  // -- undo (Faza 2: ostatnie 10 operacji, Ctrl+Z) --
  const [undoStack, setUndoStack] = useState<{ nodes: ProjektyNode[]; edges: ProjektyEdge[] }[]>([]);
  const pushUndo = useCallback(() => {
    setUndoStack(s => {
      const stack = [...s, { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }];
      if (stack.length > 10) stack.shift();
      return stack;
    });
  }, [nodes, edges]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey && undoStack.length > 0) {
        e.preventDefault();
        const prev = undoStack[undoStack.length - 1];
        setUndoStack(s => s.slice(0, -1));
        setNodes(prev.nodes);
        setEdges(prev.edges);
        setSaveStatus('unsaved');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoStack]);

  // -- dirty nodes auto-save (Faza 2: co 30s) --
  const [dirtyNodeIds, setDirtyNodeIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (dirtyNodeIds.size === 0) return;
    const interval = setInterval(async () => {
      setSaveStatus('saving');
      try {
        for (const id of dirtyNodeIds) {
          const node = nodes.find(n => n.id === id);
          if (node && window.nexusBridge?.projSaveNode) {
            await window.nexusBridge.projSaveNode({ node });
          }
        }
        setDirtyNodeIds(new Set());
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [dirtyNodeIds, nodes]);

  // ==========================================================================
  // Ladowanie
  // ==========================================================================
  useEffect(() => { loadProjects(); }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (projectLoaded && projects.length > 0) {
      const lastId = localStorage.getItem('exp_last_project_id');
      const target = lastId && projects.find(p => p.id === lastId) ? lastId : projects[0].id;
      selectProject(target, projects);
    }
  }, [projectLoaded]);

  const loadProjects = async () => {
    try {
      const b = window.nexusBridge;
      if (b?.projGetProjects) {
        const list = await b.projGetProjects();
        setProjects(list);
      }
    } catch { /* ignore */ }
    setProjectLoaded(true);
  };

  // ==========================================================================
  // Wybor projektu
  // ==========================================================================
  const selectProject = async (id: string, list = projects) => {
    const proj = list.find(p => p.id === id);
    if (!proj) return;
    setActiveProjectId(id);
    localStorage.setItem('exp_last_project_id', id);

    try {
      const cfg = parseAiConfig(proj.ai_config);
      setChatModel(cfg.chatModel || 'DeepSeek V4 Flash');
      setPlannerModel(cfg.plannerModel || 'DeepSeek V4 Flash');
      if (cfg.chatSystemPrompt) setChatSystemPrompt(cfg.chatSystemPrompt);
      if (cfg.mapPlannerSystemPrompt) setPlannerSystemPrompt(cfg.mapPlannerSystemPrompt);
      // Wczytaj global_context jesli istnieje
      if ((cfg as any).global_context) setGlobalContext((cfg as any).global_context as GlobalContext);
      setSpecContent(proj.spec_content || '');

      const b = window.nexusBridge;
      let convs: ProjektyConversation[] = [];
      if (b?.projGetConversations) {
        convs = await b.projGetConversations({ projectId: id });
      }
      if (convs.length === 0) {
        const def: ProjektyConversation = { id: genId(), project_id: id, name: 'Rozmowa 1', enabled: true, deleted: false };
        if (b?.projSaveConversation) await b.projSaveConversation({ conversation: def });
        convs = [def];
      }
      setConversations(convs);
      setActiveConversationId(convs[0].id);
      setAiError(null);

      if (b?.projGetChatMessages) {
        const msgs = await b.projGetChatMessages({ projectId: id, conversationId: convs[0].id });
        setMessages(msgs);
      }
      if (b?.projGetNodes) {
        const nds = await b.projGetNodes({ projectId: id });
        setNodes(nds);
      }
      if (b?.projGetEdges) {
        const eds = await b.projGetEdges({ projectId: id });
        setEdges(eds);
      }
    } catch (err: any) {
      setAiError(err.message || 'Blad ladowania projektu');
    }
  };

  // ==========================================================================
  // CRUD projekty
  // ==========================================================================
  const createProject = async () => {
    const name = newProjectName.trim() || `Projekt ${projects.length + 1}`;
    const id = genId();
    const proj: Projekt = {
      id, name,
      spec_content: '# Plan projektu\n\nOpisz czego dotyczy projekt.',
      ai_config: { chatModel, plannerModel, chatSystemPrompt, mapPlannerSystemPrompt: plannerSystemPrompt },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const b = window.nexusBridge;
    if (b?.projSaveProject) await b.projSaveProject({ project: proj });
    setProjects(prev => [...prev, proj]);
    setNewProjectName('');
    setShowNewProjectInput(false);
    await selectProject(id, [...projects, proj]);
  };

  const deleteProject = async (id: string) => {
    const b = window.nexusBridge;
    if (b?.projDeleteProject) await b.projDeleteProject({ id });
    const list = projects.filter(p => p.id !== id);
    setProjects(list);
    if (activeProjectId === id) {
      if (list.length > 0) selectProject(list[0].id, list);
      else setActiveProjectId(null);
    }
  };

  const renameProject = async (id: string) => {
    if (!renameValue.trim()) return;
    const b = window.nexusBridge;
    const proj = projects.find(p => p.id === id);
    if (!proj) return;
    const updated = { ...proj, name: renameValue.trim(), updated_at: new Date().toISOString() };
    if (b?.projSaveProject) await b.projSaveProject({ project: updated });
    setProjects(prev => prev.map(p => p.id === id ? updated : p));
    setRenameProjectId(null);
    setRenameValue('');
  };

  // ==========================================================================
  // Konwersacje
  // ==========================================================================
  const switchConversation = async (convId: string) => {
    if (!activeProjectId) return;
    setActiveConversationId(convId);
    const b = window.nexusBridge;
    if (b?.projGetChatMessages) {
      const msgs = await b.projGetChatMessages({ projectId: activeProjectId, conversationId: convId });
      setMessages(msgs);
    }
  };

  const addConversation = async () => {
    if (!activeProjectId) return;
    const conv: ProjektyConversation = {
      id: genId(),
      project_id: activeProjectId,
      name: `Rozmowa ${conversations.length + 1}`,
      enabled: true,
      deleted: false,
    };
    const b = window.nexusBridge;
    if (b?.projSaveConversation) await b.projSaveConversation({ conversation: conv });
    setConversations(prev => [...prev, conv]);
    setActiveConversationId(conv.id);
    setMessages([]);
  };

  // ==========================================================================
  // Spec
  // ==========================================================================
  const saveSpec = async () => {
    if (!activeProjectId) return;
    const proj = projects.find(p => p.id === activeProjectId);
    if (!proj) return;
    setSaveStatus('saving');
    try {
      const updated = { ...proj, spec_content: specContent, updated_at: new Date().toISOString() };
      const b = window.nexusBridge;
      if (b?.projSaveProject) await b.projSaveProject({ project: updated });
      setProjects(prev => prev.map(p => p.id === activeProjectId ? updated : p));
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  };

  // Auto-zapis SPEC co 500ms bezczynnosci (Faza 2)
  useEffect(() => {
    if (!activeProjectId) return;
    const timer = setTimeout(() => { saveSpec(); }, 500);
    return () => clearTimeout(timer);
  }, [specContent]);

  // ==========================================================================
  // Chat AI: tylko pisanie, bez system promptu, NIE modyfikuje nodów
  // ==========================================================================
  const sendMessage = async () => {
    if (!chatInput.trim() || !activeProjectId || !activeConversationId) return;
    const content = chatInput.trim();
    setChatInput('');
    setAiError(null);

    const userMsg: ProjektyChatMessage = {
      id: genId(),
      project_id: activeProjectId,
      conversation_id: activeConversationId || undefined,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    const b = window.nexusBridge;
    if (b?.projSaveChatMessage) await b.projSaveChatMessage({ message: userMsg });

    try {
      const reply = await invokeChat('', [...messages, userMsg], chatModel); // Chat AI bez system promptu — tylko pisanie
      const aiMsg: ProjektyChatMessage = {
        id: genId(),
        project_id: activeProjectId,
        conversation_id: activeConversationId || undefined,
        role: 'ai',
        content: reply,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
      if (b?.projSaveChatMessage) await b.projSaveChatMessage({ message: aiMsg });
    } catch (err: any) {
      setAiError(err.message || 'Blad polaczenia z AI');
      const errMsg: ProjektyChatMessage = {
        id: genId(),
        project_id: activeProjectId,
        conversation_id: activeConversationId || undefined,
        role: 'system',
        content: `[Blad] ${err.message || 'Nie udalo sie polaczyc z AI'}`,
      };
      setMessages(prev => [...prev, errMsg]);
    }
  };

  // ==========================================================================
  // Spec Analyzer
  // ==========================================================================
  const analyzeSpec = async () => {
    if (!activeProjectId || !activeConversationId || !specContent.trim()) return;
    setAiError(null);

    const prompt = `Przeanalizuj ponizsza specyfikacje projektu. Zaproponuj konkretne kroki, komponenty architektoniczne, technologie i strukture danych. Odpowiedz zwięźle.\n\nSPEC:\n${specContent}`;

    const userMsg: ProjektyChatMessage = {
      id: genId(),
      project_id: activeProjectId,
      conversation_id: activeConversationId || undefined,
      role: 'user',
      content: prompt,
    };
    setMessages(prev => [...prev, userMsg]);
    const b = window.nexusBridge;
    if (b?.projSaveChatMessage) await b.projSaveChatMessage({ message: userMsg });

    try {
      const reply = await invokeChat(chatSystemPrompt, [...messages, userMsg], chatModel);
      const aiMsg: ProjektyChatMessage = {
        id: genId(),
        project_id: activeProjectId,
        conversation_id: activeConversationId || undefined,
        role: 'ai',
        content: reply,
      };
      setMessages(prev => [...prev, aiMsg]);
      if (b?.projSaveChatMessage) await b.projSaveChatMessage({ message: aiMsg });
    } catch (err: any) {
      setAiError(err.message);
    }
  };

  // ==========================================================================
  // Auto-layout helper (przyjmuje aktualne wezly, zeby uniknac stale closure)
  // ==========================================================================
  const runAutoLayout = useCallback((newNodes?: ProjektyNode[], newEdges?: ProjektyEdge[]) => {
    const targetNodes = newNodes || nodes;
    const targetEdges = newEdges || edges;
    const laidOut = applyLayout(targetNodes, targetEdges);
    setNodes(laidOut);
  }, [nodes, edges, applyLayout]);

  // ==========================================================================
  // Faza 3: Krawedzie (edges)
  // ==========================================================================
  const runPhase3Edges = async (nodesToUse?: ProjektyNode[]) => {
    const effectiveNodes = nodesToUse || nodes;
    if (!activeProjectId) return;
    setPlannerPhase('phase3');

    const readyNodes = effectiveNodes.filter(n => n.status === 'ready');
    if (readyNodes.length === 0) {
      setPlannerPhase('done');
      return;
    }

    try {
      const prompt = `Znajdz zaleznosci miedzy tymi zadaniami. Zwroc TYLKO JSON:
{
  "edges": [
    { "source_node_id": "ID1", "target_node_id": "ID2", "relation_type": "requires|depends_on|data_flow|sync", "label": "krotki opis" }
  ]
}
WEZLY:
${JSON.stringify(readyNodes)}`;

      const phase3Msg: ProjektyChatMessage = {
        id: genId(),
        project_id: activeProjectId,
        conversation_id: activeConversationId || undefined,
        role: 'user',
        content: prompt,
      };
      const raw = await invokePlanner(plannerSystemPrompt, [phase3Msg], readyNodes, edges, specContent, plannerModel);
      const jsonMatch = raw.match(/\{[\s\S]*"edges"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const b = window.nexusBridge;
        const allNewEdges: ProjektyEdge[] = [];
        for (const e of parsed.edges || []) {
          const edge: ProjektyEdge = {
            id: genId(),
            project_id: activeProjectId,
            source_node_id: e.source_node_id,
            target_node_id: e.target_node_id,
            label: e.label || '',
            relation_type: e.relation_type || 'depends_on',
          };
          allNewEdges.push(edge);
          setEdges(prev => [...prev, edge]);
          if (b?.projSaveEdge) await b.projSaveEdge({ edge });
        }
        // Auto-layout z lokalna lista krawedzi (unikamy stale closure)
        runAutoLayout(effectiveNodes, allNewEdges);
      }
    } catch (err: any) {
      setAiError(err.message);
    }

    setPlannerPhase('done');
  };

  // ==========================================================================
  // Faza 2: Dekompozycja wezlow
  // ==========================================================================
  const runPhase2Decompose = async (initialNodes?: ProjektyNode[]) => {
    if (!activeProjectId || !activeConversationId) return;
    setPlannerPhase('phase2');

    // Jesli Phase 1 przekazala initialNodes, uzyj ich; inaczej wez z closure
    const allNodesLocal = initialNodes || nodes;

    const nodesToProcess = allNodesLocal.filter(
      n => (n.node_type === 'root' || n.node_type === 'domain' || n.node_type === 'component') && n.status !== 'ready'
    );

    if (nodesToProcess.length === 0) {
      setPlannerPhase('phase3');
      await runPhase3Edges(allNodesLocal);
      return;
    }

    setPlannerProgress({ current: 0, total: nodesToProcess.length });

    const b = window.nexusBridge;
    // Lokalny akumulator: sledzimy nowe wezly, zeby Faza 3 je widziala
    let allNodes = allNodesLocal;

    for (let i = 0; i < nodesToProcess.length; i++) {
      const wezel = nodesToProcess[i];
      setPlannerProgress({ current: i + 1, total: nodesToProcess.length });

      try {
        const prompt = `Jestes Planerem Architektury. Twoim zadaniem jest rozbicie JEDNEGO wezla na podwezly.

ZASADY:
- Rozbij wezel na 2-6 podwezlow
- Kazdy podwezel to konkretny, pojedynczy element
- Tytul: max 5 slow
- Tresc: 1-2 zdania
- Jesli wezel jest juz konkretny i nie da sie rozbic → ustaw is_leaf: true

GLOBALNY KONTEKST PROJEKTU:
${JSON.stringify(globalContext)}

BIEZACY WEZEL DO ROZBIENIA:
${JSON.stringify(wezel)}

Zwroc TYLKO JSON:
{
  "is_leaf": false,
  "children": [
    { "title": "...", "content": "...", "node_type": "component|task|integration", "status": "new", "parent_id": "${wezel.id}" }
  ]
}
Jesli is_leaf = true, children = [].`;

        const phase2Msg: ProjektyChatMessage = {
          id: genId(),
          project_id: activeProjectId,
          conversation_id: activeConversationId || undefined,
          role: 'user',
          content: prompt,
        };
        const raw = await invokePlanner(plannerSystemPrompt, [phase2Msg], allNodes, edges, specContent, plannerModel);
        const jsonMatch = raw.match(/\{[\s\S]*"is_leaf"[\s\S]*\}/);
        if (!jsonMatch) continue;

        const parsed = JSON.parse(jsonMatch[0]);

        if (parsed.is_leaf) {
          const updated: ProjektyNode = { ...wezel, status: 'ready' };
          allNodes = allNodes.map(n => n.id === wezel.id ? updated : n);
          setNodes(prev => prev.map(n => n.id === wezel.id ? updated : n));
          if (b?.projSaveNode) await b.projSaveNode({ node: updated });
        } else if (parsed.children && parsed.children.length > 0) {
          resetNodePos();
          for (const child of parsed.children) {
            const pos = nextNodePos();
            const childNode: ProjektyNode = {
              id: genId(),
              project_id: activeProjectId,
              title: child.title,
              content: child.content,
              node_type: child.node_type || 'component',
              status: child.status || 'new',
              parent_id: wezel.id,
              x: pos.x,
              y: pos.y,
              width: 240,
              height: 100,
              source_conversation_id: activeConversationId,
            };
            allNodes.push(childNode);
            setNodes(prev => [...prev, childNode]);
            if (b?.projSaveNode) await b.projSaveNode({ node: childNode });
          }
          const updated: ProjektyNode = { ...wezel, status: 'ready' };
          allNodes = allNodes.map(n => n.id === wezel.id ? updated : n);
          setNodes(prev => prev.map(n => n.id === wezel.id ? updated : n));
          if (b?.projSaveNode) await b.projSaveNode({ node: updated });
        }
      } catch (err: any) {
        setAiError(err.message);
      }
    }

    setPlannerPhase('phase3');
    await runPhase3Edges(allNodes);
  };

  // ==========================================================================
  // Faza 1: Generuj plan ze SPEC
  // ==========================================================================
  const runFullPlanFromSpec = async () => {
    if (!activeProjectId || !activeConversationId || !specContent.trim()) return;
    setAiError(null);
    setPlannerPhase('phase1');
    setPlannerProgress({ current: 1, total: 1 });

    try {
      const prompt = `Przeanalizuj ponizsza specyfikacje projektu. Zwroc TYLKO JSON:
{
  "project_name": "...",
  "mandatory_stack": ["tech1", "tech2"],
  "out_of_scope": ["rzecz1", "rzecz2"],
  "actors": [{"role": "...", "description": "..."}],
  "integrations": [{"system": "...", "type": "API", "purpose": "..."}],
  "data_io": {"inputs": [...], "outputs": [...]}
}
SPEC: ${specContent}`;

      const phase1Msg: ProjektyChatMessage = {
        id: genId(),
        project_id: activeProjectId,
        conversation_id: activeConversationId || undefined,
        role: 'user',
        content: prompt,
      };
      const reply = await invokeChat('Jestes analitykiem projektu. Generuj JSON.', [phase1Msg], chatModel);
      const jsonMatch = reply.match(/\{[\s\S]*"project_name"[\s\S]*\}/);
      if (!jsonMatch) {
        setAiError('Phase 1: Nie udalo sie sparsowac odpowiedzi LLM');
        setPlannerPhase('idle');
        return;
      }

      const ctx: GlobalContext = JSON.parse(jsonMatch[0]);
      setGlobalContext(ctx);

      const b = window.nexusBridge;
      if (b?.projSaveGlobalContext) await b.projSaveGlobalContext({ projectId: activeProjectId, context: ctx });

      // Utworz wezel root
      const rootNode: ProjektyNode = {
        id: genId(),
        project_id: activeProjectId,
        title: ctx.project_name,
        content: 'Root project node',
        node_type: 'root',
        status: 'new',
        parent_id: null,
        x: 0,
        y: 0,
        width: 240,
        height: 100,
        source_conversation_id: activeConversationId,
      };
      const newNodes = [...nodes, rootNode];
      setNodes(newNodes);
      if (b?.projSaveNode) await b.projSaveNode({ node: rootNode });

      // Przejdz do fazy 2 (przekaz nowa liste wezlow, zeby Faza 2 widziala rootNode)
      await runPhase2Decompose(newNodes);
    } catch (err: any) {
      setAiError(err.message);
      setPlannerPhase('idle');
    }
  };

  // ==========================================================================
  // Faza 4 (dawny Planer): Diff z rozmowy z klasyfikacja intencji
  // ==========================================================================
  const runPhase4Diff = async () => {
    if (!activeProjectId || !activeConversationId) return;
    setAiError(null);
    setPlannerPhase('phase4');

    const b = window.nexusBridge;
    let unprocessed: ProjektyChatMessage[] = [];
    if (b?.projGetUnprocessedMessages) {
      unprocessed = await b.projGetUnprocessedMessages({ projectId: activeProjectId, conversationId: activeConversationId });
    } else {
      unprocessed = messages.filter(m => m.role === 'user' && !m.extracted_to_canvas);
    }

    if (unprocessed.length === 0) {
      unprocessed = messages;
    }

    try {
      const intentPrompt = `Przeanalizuj NOWE wiadomosci z czatu w kontekscie aktualnego planu.
Najpierw okresl intencje:

1. NONE — pytanie, dyskusja, brak zmian w planie
2. REFINEMENT — doprecyzowanie istniejacego wezla
3. STRUCTURAL — nowa funkcjonalnosc
4. DESTRUCTIVE — wywala istniejaca galaz

AKTUALNY PLAN (wezly):
${JSON.stringify(nodes)}

AKTUALNE POLACZENIA:
${JSON.stringify(edges)}

SPECYFIKACJA:
${specContent}

NOWE WIADOMOSCI:
${JSON.stringify(unprocessed)}

Zwroc TYLKO JSON:
{
  "intent_category": "NONE|REFINEMENT|STRUCTURAL|DESTRUCTIVE",
  "reasoning": "krotkie uzasadnienie",
  "operations": []
}
Jesli NONE → operations = []. 
Jesli DESTRUCTIVE → usun cale galaz (parent_id chain).
Jesli REFINEMENT → UPDATE na konkretnych wezlach.
Jesli STRUCTURAL → ADD nowych wezlow.`;

      const raw = await invokePlanner(plannerSystemPrompt, unprocessed, nodes, edges, specContent, plannerModel);
      const result = parsePlannerResponse(raw);

      if (result.operations.length === 0) {
        const sysMsg: ProjektyChatMessage = {
          id: genId(),
          project_id: activeProjectId,
          conversation_id: activeConversationId || undefined,
          role: 'system',
          content: `[Planer] Brak operacji (intencja: NONE lub nie rozpoznano). Surowa odpowiedz:\n${raw.slice(0, 500)}`,
        };
        setMessages(prev => [...prev, sysMsg]);
        if (b?.projSaveChatMessage) await b.projSaveChatMessage({ message: sysMsg });
        setPlannerPhase('idle');
        return;
      }

      setDiffProposal(result);

      if (unprocessed.length > 0 && b?.projMarkMessagesProcessed) {
        await b.projMarkMessagesProcessed({ ids: unprocessed.map(m => m.id) });
      }
    } catch (err: any) {
      setAiError(err.message);
      const errMsg: ProjektyChatMessage = {
        id: genId(),
        project_id: activeProjectId,
        conversation_id: activeConversationId || undefined,
        role: 'system',
        content: `[Blad Planera] ${err.message || 'Nie udalo sie uruchomic Planera'}`,
      };
      setMessages(prev => [...prev, errMsg]);
    }
    setPlannerPhase('idle');
  };

  // ==========================================================================
  // Akceptacja propozycji Planera
  // ==========================================================================
  const acceptPlannerDiff = async () => {
    if (!diffProposal || !activeProjectId) return;
    const b = window.nexusBridge;
    resetNodePos();

    // Lokalne tablice, zeby uniknac stale closure
    let localNodes = [...nodes];
    const allNewEdges: ProjektyEdge[] = [];

    for (const op of diffProposal.operations) {
      if (op.action === 'ADD' && op.node) {
        const pos = nextNodePos();
        const node: ProjektyNode = {
          id: op.node.id || genId(),
          project_id: activeProjectId,
          title: op.node.title,
          content: op.node.content,
          node_type: (op.node.node_type as NodeType) || 'component',
          status: (op.node.status as NodeStatus) || 'new',
          parent_id: op.node.parent_id || null,
          x: pos.x,
          y: pos.y,
          width: 240,
          height: 100,
          source_conversation_id: activeConversationId,
        };
        localNodes.push(node);
        setNodes(prev => [...prev, node]);
        if (b?.projSaveNode) await b.projSaveNode({ node });
      }
      if (op.action === 'UPDATE' && op.node?.id) {
        const existing = localNodes.find(n => n.id === op.node!.id);
        if (existing) {
          const updated = { ...existing, title: op.node.title, content: op.node.content };
          localNodes = localNodes.map(n => n.id === op.node!.id ? updated : n);
          setNodes(prev => prev.map(n => n.id === op.node!.id ? updated : n));
          if (b?.projSaveNode) await b.projSaveNode({ node: updated });
        }
      }
      if (op.action === 'DELETE' && op.nodeId) {
        const idsToDelete = new Set<string>();
        const collectChildren = (parentId: string) => {
          idsToDelete.add(parentId);
          localNodes.filter(n => n.parent_id === parentId).forEach(child => collectChildren(child.id));
        };
        collectChildren(op.nodeId);
        localNodes = localNodes.filter(n => !idsToDelete.has(n.id));
        setNodes(prev => prev.filter(n => !idsToDelete.has(n.id)));
        for (const nid of idsToDelete) {
          if (b?.projDeleteNode) await b.projDeleteNode({ id: nid });
        }
        setEdges(prev => prev.filter(e => !idsToDelete.has(e.source_node_id) && !idsToDelete.has(e.target_node_id)));
      }
      if (op.edge) {
        const edge: ProjektyEdge = {
          id: genId(),
          project_id: activeProjectId,
          source_node_id: op.edge.source_node_id,
          target_node_id: op.edge.target_node_id,
          label: op.edge.label || '',
        };
        allNewEdges.push(edge);
        setEdges(prev => [...prev, edge]);
        if (b?.projSaveEdge) await b.projSaveEdge({ edge });
      }
    }
    setDiffProposal(null);

    // Oznacz wiadomości jako przetworzone
    const updatedMessages = messages.map(m => ({
      ...m,
      metadata: { ...((m.metadata || {}) as any), processed_by_ai: true }
    }));
    setMessages(updatedMessages);

    // Auto-layout po zatwierdzeniu diffa (z lokalna lista)
    runAutoLayout(localNodes);
  };

  // ==========================================================================
  // Planer AI: Analizuje SPEC + nodes + edges + historię czatu, tworzy nody na planszy
  // ==========================================================================
  const runPlannerAI = async () => {
    if (!activeProjectId) return;
    setAiError(null);

    // ŚCIEŻKA A: Plansza pusta + SPEC niepusty → wywołaj runFullPlanFromSpec
    if (nodes.length === 0 && specContent.trim().length > 0) {
      await runFullPlanFromSpec();
      return;
    }

    // ŚCIEŻKA B: Planer tworzy nody od razu na planszę
    setPlannerLoading(true);
    try {
      const b = window.nexusBridge;

      const systemMsg: ProjektyChatMessage = {
        id: genId(),
        project_id: activeProjectId,
        conversation_id: activeConversationId || undefined,
        role: 'system',
        content: `SPEC: ${specContent || '(brak)'}\n\nNODES: ${JSON.stringify(nodes)}\n\nEDGES: ${JSON.stringify(edges)}`,
      };

      const reply = await invokePlanner(plannerSystemPrompt, [systemMsg, ...messages], nodes, edges, specContent, plannerModel);
      const jsonMatch = reply.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        setAiError('AI nie zwróciło poprawnego formatu JSON. Spróbuj ponownie.');
        return;
      }

      let operations: any[];
      try {
        operations = JSON.parse(jsonMatch[0]);
      } catch {
        setAiError('AI zwróciło odpowiedź w nieprawidłowym formacie. Spróbuj ponownie.');
        return;
      }

      if (!Array.isArray(operations) || operations.length === 0) {
        return;
      }

      // Wykonaj operacje od razu na planszy — bez panelu diff
      resetNodePos();
      const localNodes = [...nodes];
      const newEdges: ProjektyEdge[] = [];

      for (const op of operations) {
        if (op.action === 'add_node') {
          const pos = nextNodePos();
          const node: ProjektyNode = {
            id: genId(),
            project_id: activeProjectId,
            title: op.title || '',
            content: op.content || '',
            node_type: (op.node_type as NodeType) || 'component',
            status: 'new',
            parent_id: op.parent_id || null,
            x: pos.x,
            y: pos.y,
            width: 240,
            height: 100,
            ai_suggestion: op.is_ai_idea === true,
            ai_suggestion_reason: op.is_ai_idea === true ? (op.reason || '') : undefined,
            source_conversation_id: activeConversationId,
          };
          localNodes.push(node);
          setNodes(prev => [...prev, node]);
          if (b?.projSaveNode) await b.projSaveNode({ node });
        }
        if (op.action === 'update_node' && op.node_id) {
          const existing = localNodes.find(n => n.id === op.node_id);
          if (existing) {
            const updated = {
              ...existing,
              title: op.title || existing.title,
              content: op.content || existing.content,
              node_type: (op.node_type as NodeType) || existing.node_type,
              ai_suggestion: op.is_ai_idea !== undefined ? op.is_ai_idea : existing.ai_suggestion,
              ai_suggestion_reason: op.is_ai_idea ? (op.reason || '') : existing.ai_suggestion_reason,
            };
            const idx = localNodes.findIndex(n => n.id === op.node_id);
            if (idx >= 0) localNodes[idx] = updated;
            setNodes(prev => prev.map(n => n.id === op.node_id ? updated : n));
            if (b?.projSaveNode) await b.projSaveNode({ node: updated });
          }
        }
        if (op.action === 'delete_node' && op.node_id) {
          const idsToDelete = new Set<string>();
          const collectChildren = (parentId: string) => {
            idsToDelete.add(parentId);
            localNodes.filter(n => n.parent_id === parentId).forEach(child => collectChildren(child.id));
          };
          collectChildren(op.node_id);
          for (const nid of idsToDelete) {
            if (b?.projDeleteNode) await b.projDeleteNode({ id: nid });
          }
          setNodes(prev => prev.filter(n => !idsToDelete.has(n.id)));
          setEdges(prev => prev.filter(e => !idsToDelete.has(e.source_node_id) && !idsToDelete.has(e.target_node_id)));
        }
        if (op.action === 'add_edge' && op.source_node_id && op.target_node_id) {
          const edge: ProjektyEdge = {
            id: genId(),
            project_id: activeProjectId,
            source_node_id: op.source_node_id,
            target_node_id: op.target_node_id,
            label: op.edge_label || 'supports',
          };
          newEdges.push(edge);
          setEdges(prev => [...prev, edge]);
          if (b?.projSaveEdge) await b.projSaveEdge({ edge });
        }
      }

      // Oznacz wiadomości jako przetworzone
      const updatedMessages = messages.map(m => ({
        ...m,
        metadata: { ...((m.metadata || {}) as any), processed_by_ai: true }
      }));
      setMessages(updatedMessages);

      // Auto-layout
      runAutoLayout(localNodes);
    } catch (err: any) {
      setAiError(err.message || 'Nieznany błąd');
    } finally {
      setPlannerLoading(false);
    }
  };

  // ==========================================================================
  // Adnotacja do wezla
  // ==========================================================================
  const submitAnnotation = async (nodeId: string) => {
    if (!annotationText.trim() || !activeProjectId) return;
    const ann: ProjektyNodeAnnotation = {
      id: genId(),
      node_id: nodeId,
      project_id: activeProjectId,
      content: annotationText.trim(),
    };
    const b = window.nexusBridge;
    if (b?.projSaveAnnotation) await b.projSaveAnnotation({ annotation: ann });

    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      const prompt = `Uzytkownik skomentowal wezel "${node.title}": "${annotationText.trim()}". Zaktualizuj tresc tego wezla.`;
      const userMsg: ProjektyChatMessage = {
        id: genId(),
        project_id: activeProjectId,
        conversation_id: activeConversationId || undefined,
        role: 'user',
        content: prompt,
      };
      setMessages(prev => [...prev, userMsg]);
      if (b?.projSaveChatMessage) await b.projSaveChatMessage({ message: userMsg });

      try {
        const reply = await invokeChat(chatSystemPrompt, [...messages, userMsg], chatModel);
        const aiMsg: ProjektyChatMessage = {
          id: genId(),
          project_id: activeProjectId,
          conversation_id: activeConversationId || undefined,
          role: 'ai',
          content: reply,
        };
        setMessages(prev => [...prev, aiMsg]);
        if (b?.projSaveChatMessage) await b.projSaveChatMessage({ message: aiMsg });
      } catch { /* cicha obsluga bledu */ }

      const updated = { ...node, content: annotationText.trim() };
      setNodes(prev => prev.map(n => n.id === nodeId ? updated : n));
      if (b?.projSaveNode) await b.projSaveNode({ node: updated });
    }

    setAnnotationNode(null);
    setAnnotationText('');
  };

  // ==========================================================================
  // Canvas: Pan & Zoom
  // ==========================================================================
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).dataset?.canvas === 'bg' || (e.target as HTMLElement).dataset?.canvas === 'empty') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setCanvasOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
    if (dragNode) {
      const dx = (e.clientX - dragStart.x) / canvasScale;
      const dy = (e.clientY - dragStart.y) / canvasScale;
      setNodes(prev => prev.map(n => n.id === dragNode ? { ...n, x: dragStart.nx + dx, y: dragStart.ny + dy } : n));
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    if (dragNode) {
      const node = nodes.find(n => n.id === dragNode);
      if (node) {
        // Faza 2: locked_position = true po recznym przesunieciu
        const updated = { ...node, locked_position: true };
        setNodes(prev => prev.map(n => n.id === dragNode ? updated : n));
        if (window.nexusBridge?.projSaveNode) {
          window.nexusBridge.projSaveNode({ node: updated });
        }
      }
      setDragNode(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setCanvasScale(prev => Math.max(0.2, Math.min(3, prev * delta)));
  };

  const handleNodeDragStart = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setDragNode(nodeId);
    setDragStart({ x: e.clientX, y: e.clientY, nx: node.x, ny: node.y });
  };

  // ==========================================================================
  // Zapisz konfiguracje AI
  // ==========================================================================
  const saveAiConfig = async () => {
    if (!activeProjectId) return;
    const proj = projects.find(p => p.id === activeProjectId);
    if (!proj) return;
    const aiConfig: ProjektyAIConfig & { global_context?: GlobalContext } = {
      chatModel, plannerModel, chatSystemPrompt, mapPlannerSystemPrompt: plannerSystemPrompt,
    };
    if (globalContext) aiConfig.global_context = globalContext;
    const updated = { ...proj, ai_config: aiConfig, updated_at: new Date().toISOString() };
    const b = window.nexusBridge;
    if (b?.projSaveProject) await b.projSaveProject({ project: updated });
    setProjects(prev => prev.map(p => p.id === activeProjectId ? updated : p));
  };

  // ==========================================================================
  // Render
  // ==========================================================================
  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-gray-200 overflow-hidden select-none">
      {/* ===== Top Bar ===== */}
      <div className="h-12 border-b border-gray-700 bg-[#111] flex items-center px-4 gap-2 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto flex-1">
          <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider mr-2 shrink-0">Projekty:</span>
          <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
            {projects.map(p => (
              <div key={p.id} className="flex items-center shrink-0 group">
                {renameProjectId === p.id ? (
                  <input
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') renameProject(p.id); if (e.key === 'Escape') setRenameProjectId(null); }}
                    className="w-32 px-2 py-1 text-sm bg-[#1a1a1a] border border-gray-600 rounded outline-none focus:border-gray-400"
                    autoFocus
                    onBlur={() => renameProject(p.id)}
                  />
                ) : (
                  <button
                    onClick={() => selectProject(p.id)}
                    className={`px-3 py-1.5 text-sm rounded transition-colors ${
                      activeProjectId === p.id
                        ? 'bg-gray-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    {p.name}
                  </button>
                )}
                {activeProjectId === p.id && !renameProjectId && (
                  <div className="hidden group-hover:flex items-center gap-0.5 ml-0.5">
                    <button
                      onClick={() => { setRenameProjectId(p.id); setRenameValue(p.name); }}
                      className="text-xs px-1 py-0.5 text-gray-500 hover:text-white rounded"
                      title="Zmien nazwe"
                    >Edycja</button>
                    <button
                      onClick={() => deleteProject(p.id)}
                      className="text-xs px-1 py-0.5 text-gray-500 hover:text-red-400 rounded"
                      title="Usun projekt"
                    >Usun</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {showNewProjectInput ? (
            <div className="flex items-center gap-1 shrink-0">
              <input
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createProject(); if (e.key === 'Escape') setShowNewProjectInput(false); }}
                placeholder="Nazwa projektu..."
                className="w-36 px-2 py-1 text-sm bg-[#1a1a1a] border border-gray-600 rounded outline-none focus:border-gray-400"
                autoFocus
                onBlur={() => { if (!newProjectName.trim()) setShowNewProjectInput(false); }}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowNewProjectInput(true)}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded shrink-0"
            >+ Nowy</button>
          )}
        </div>

        {activeProject && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setSpecPanelOpen(prev => !prev)}
              className={`px-3 py-1.5 text-sm rounded ${specPanelOpen ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >Specyfikacja</button>
            <button
              onClick={() => setChatDrawerOpen(prev => !prev)}
              className={`px-3 py-1.5 text-sm rounded ${chatDrawerOpen ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >Czat</button>
            <button onClick={() => setShowSettings(true)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded">
              Ustawienia AI
            </button>
          </div>
        )}
      </div>

      {/* ===== Glowny obszar ===== */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* === Panel SPEC (lewy) === */}
        {specPanelOpen && activeProject && (
          <div className="w-[360px] min-w-[360px] border-r border-gray-700 bg-[#111] flex flex-col shrink-0">
            <div className="h-10 px-4 border-b border-gray-700 flex items-center shrink-0">
              <span className="text-sm font-medium text-gray-300">Specyfikacja projektu</span>
            </div>
            <div className="flex-1 p-3">
              <textarea
                value={specContent}
                onChange={e => setSpecContent(e.target.value)}
                className="w-full h-full bg-[#0d0d0d] border border-gray-700 rounded p-3 text-sm text-gray-300 font-mono leading-relaxed resize-none outline-none focus:border-gray-500"
                placeholder="# Plan projektu&#10;&#10;Opisz architekture, komponenty, technologie..."
              />
            </div>
            {/* Progress bar planowania */}
            {plannerPhase !== 'idle' && (
              <div className="px-3 py-2 border-t border-gray-700 bg-gray-900 shrink-0">
                <div className="text-xs text-gray-400 mb-1">
                  Phase: {plannerPhase} — {plannerProgress.current}/{plannerProgress.total}
                </div>
                <div className="w-full bg-gray-700 rounded h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded transition-all duration-300"
                    style={{ width: `${plannerProgress.total > 0 ? (plannerProgress.current / plannerProgress.total) * 100 : plannerPhase === 'phase1' ? 15 : plannerPhase === 'phase3' ? 70 : plannerPhase === 'done' ? 100 : 40}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* === Infinite Canvas === */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden bg-[#0a0a0a]"
          style={{ cursor: isPanning ? 'grabbing' : dragNode ? 'grabbing' : 'crosshair' }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onWheel={handleWheel}
        >
          <div
            data-canvas="bg"
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 0)',
              backgroundSize: `${30 * canvasScale}px ${30 * canvasScale}px`,
              backgroundPosition: `${canvasOffset.x}px ${canvasOffset.y}px`,
            }}
          />

          <div
            className="absolute inset-0"
            style={{
              transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`,
              transformOrigin: '0 0',
            }}
          >
            {/* Edges */}
            <svg className="absolute inset-0 pointer-events-none" style={{ width: 4000, height: 4000 }}>
              {edges.map(edge => {
                const src = nodes.find(n => n.id === edge.source_node_id);
                const tgt = nodes.find(n => n.id === edge.target_node_id);
                if (!src || !tgt) return null;
                return (
                  <g key={edge.id}>
                    <line
                      x1={src.x + (src.width || 240) / 2}
                      y1={src.y + (src.height || 100) / 2}
                      x2={tgt.x + (tgt.width || 240) / 2}
                      y2={tgt.y + (tgt.height || 100) / 2}
                      stroke="rgba(100,110,120,0.6)"
                      strokeWidth={2}
                    />
                    {edge.label && (
                      <text
                        x={(src.x + (src.width || 240) / 2 + tgt.x + (tgt.width || 240) / 2) / 2}
                        y={(src.y + (src.height || 100) / 2 + tgt.y + (tgt.height || 100) / 2) / 2 - 8}
                        fill="rgb(140,150,160)"
                        fontSize={11}
                        textAnchor="middle"
                      >{edge.label}</text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Nodes */}
            {nodes.map(node => {
              const isParent = nodes.some(n => n.parent_id === node.id);
              const depth = node.parent_id ? 1 : 0;
              const borderClass = NODE_BORDER[node.node_type || ''] || 'border-gray-700';
              const isAiSuggestion = node.ai_suggestion === true;

              return (
                <div
                  key={node.id}
                  className={`absolute bg-[#161616] border-2 rounded-lg group ${
                    isAiSuggestion ? 'border-dashed border-purple-500' :
                    annotationNode === node.id ? 'border-blue-500' : borderClass
                  } ${node.node_type === 'root' ? 'font-bold' : ''}`}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: node.width || 240,
                    minHeight: node.height || 100,
                    marginLeft: depth * 20,
                    transition: dragNode === node.id ? 'none' : 'box-shadow 0.15s',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    zIndex: dragNode === node.id ? 100 : 1,
                  }}
                >
                  <div
                    className="flex items-center justify-between px-3 py-2 border-b-2 border-gray-700 cursor-grab active:cursor-grabbing"
                    onMouseDown={e => handleNodeDragStart(node.id, e)}
                  >
                    <span className="text-sm font-semibold text-gray-100 truncate flex-1">{node.title}</span>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => { e.stopPropagation(); setAnnotationNode(node.id); }}
                        className="text-xs px-2 py-0.5 text-gray-400 hover:text-blue-300 rounded hover:bg-gray-800"
                        title="Komentuj"
                      >+</button>
                      <button
                        onClick={async e => {
                          e.stopPropagation();
                          setNodes(prev => prev.filter(n => n.id !== node.id));
                          const b = window.nexusBridge;
                          if (b?.projDeleteNode) await b.projDeleteNode({ id: node.id });
                        }}
                        className="text-xs px-2 py-0.5 text-gray-400 hover:text-red-400 rounded hover:bg-gray-800"
                      >X</button>
                    </div>
                  </div>

                  <div className="px-3 py-2">
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{node.content}</p>
                    {node.node_type && (
                      <span className="inline-block mt-1.5 text-[10px] uppercase tracking-wider text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                        {node.node_type}
                      </span>
                    )}
                    {node.status && (
                      <span className={`inline-block mt-1.5 ml-1.5 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        node.status === 'ready' ? 'text-green-500 bg-green-900/30' :
                        node.status === 'in_progress' ? 'text-yellow-500 bg-yellow-900/30' :
                        'text-gray-500 bg-gray-800'
                      }`}>
                        {node.status}
                      </span>
                    )}
                  </div>

                  {annotationNode === node.id && (
                    <div className="px-3 pb-3 border-t border-gray-700 pt-2">
                      <input
                        value={annotationText}
                        onChange={e => setAnnotationText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') submitAnnotation(node.id); if (e.key === 'Escape') setAnnotationNode(null); }}
                        placeholder="Twoja uwaga do tego wezla..."
                        className="w-full px-2.5 py-1.5 text-sm bg-[#0d0d0d] border border-gray-600 rounded outline-none focus:border-blue-500"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2 mt-1.5">
                        <button onClick={() => setAnnotationNode(null)} className="text-xs px-2 py-1 text-gray-500 hover:text-white">Anuluj</button>
                        <button onClick={() => submitAnnotation(node.id)} className="text-xs px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-500">Wyslij</button>
                      </div>
                    </div>
                  )}

                  {isParent && (
                    <div className="px-3 py-1.5 border-t border-gray-700">
                      <span className="text-xs text-gray-500">{nodes.filter(n => n.parent_id === node.id).length} podwezlow</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pusta tablica */}
            {nodes.length === 0 && activeProject && (
              <div data-canvas="empty" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <p className="text-base text-gray-500">Brak wezlow na mapie.</p>
                <p className="text-sm text-gray-600 mt-2">Napisz cos w czacie, a nastepnie uzyj Planera lub wygeneruj plan ze SPEC.</p>
              </div>
            )}
          </div>

          <div className="absolute bottom-3 left-3 text-xs text-gray-600 bg-[#0d0d0d] px-2 py-1 rounded border border-gray-700">
            {Math.round(canvasScale * 100)}%
          </div>
        </div>

        {/* === Chat Drawer (prawy) === */}
        {chatDrawerOpen && activeProject && (
          <div className="w-[380px] min-w-[380px] border-l border-gray-700 bg-[#111] flex flex-col shrink-0">
            <div className="h-10 px-4 border-b border-gray-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 overflow-hidden">
                <select
                  value={activeConversationId || ''}
                  onChange={e => switchConversation(e.target.value)}
                  className="bg-[#1a1a1a] text-sm text-gray-300 border border-gray-600 rounded px-2 py-1 outline-none max-w-[160px]"
                >
                  {conversations.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={addConversation} className="text-xs text-gray-400 hover:text-white px-1 shrink-0">+ Nowa</button>
              </div>
              <select
                value={chatModel}
                onChange={e => { setChatModel(e.target.value); setTimeout(saveAiConfig, 0); }}
                className="bg-[#1a1a1a] text-xs text-gray-400 border border-gray-700 rounded px-1.5 py-1 outline-none"
              >
                {AI_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar">
              {messages.length === 0 && (
                <div className="text-center text-gray-600 text-sm mt-8">Brak wiadomosci. Rozpocznij rozmowe.</div>
              )}
              {messages.map(m => (
                <div key={m.id} className="text-sm leading-relaxed">
                  <span className="text-xs text-gray-500 block mb-0.5 font-medium">
                    {m.role === 'user' ? 'Ty' : m.role === 'ai' ? 'Asystent AI' : 'System'}
                  </span>
                  <div className={`whitespace-pre-wrap break-words ${m.role === 'user' ? 'text-gray-100' : m.role === 'system' ? 'text-yellow-600' : 'text-gray-300'}`}>
                    {m.content}
                  </div>
                  </div>
              ))}
              {chatLoading && <div className="text-sm text-gray-500 animate-pulse">Asystent odpowiada...</div>}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-gray-700 p-3 shrink-0">
              <div className="flex gap-2 mb-2">
                <input
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Napisz wiadomosc..."
                  className="flex-1 bg-[#0d0d0d] border border-gray-600 rounded px-3 py-2 text-sm outline-none focus:border-gray-400 text-gray-200 placeholder-gray-600"
                />
                <button
                  onClick={sendMessage}
                  disabled={!chatInput.trim() || chatLoading}
                  className="px-4 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-500 disabled:opacity-40"
                >Wyslij</button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={runPlannerAI}
                  disabled={plannerLoading || plannerPhase !== 'idle'}
                  className="flex-1 px-3 py-2 bg-blue-700 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-40"
                >
                  {plannerLoading ? 'Planowanie...' : 'Aktualizuj plan'}
                </button>
                <select
                  value={plannerModel}
                  onChange={e => { setPlannerModel(e.target.value); setTimeout(saveAiConfig, 0); }}
                  className="bg-[#1a1a1a] text-xs text-gray-400 border border-gray-700 rounded px-1.5 py-2 outline-none"
                >
                  {AI_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {aiError && (
                <div className="mt-2 text-xs text-red-400 bg-red-900/30 px-2.5 py-1.5 rounded border border-red-800">
                  {aiError}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== Modal: Ustawienia AI ===== */}
      {showSettings && activeProject && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <div className="bg-[#161616] border border-gray-700 rounded-lg w-full max-w-xl p-6">
            <h3 className="text-base font-medium text-gray-200 mb-4">Ustawienia AI</h3>
            <div className="space-y-4 text-sm">
              <div>
                <label className="text-gray-400 block mb-1.5">Prompt systemowy czatu (AI #1)</label>
                <textarea
                  value={chatSystemPrompt}
                  onChange={e => setChatSystemPrompt(e.target.value)}
                  className="w-full bg-[#0d0d0d] border border-gray-700 rounded px-3 py-2 h-20 resize-none outline-none text-gray-300 text-sm"
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1.5">Prompt systemowy Planera (AI #3)</label>
                <textarea
                  value={plannerSystemPrompt}
                  onChange={e => setPlannerSystemPrompt(e.target.value)}
                  className="w-full bg-[#0d0d0d] border border-gray-700 rounded px-3 py-2 h-20 resize-none outline-none text-gray-300 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setShowSettings(false); saveAiConfig(); }} className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-500">Zapisz</button>
              <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Anuluj</button>
            </div>
          </div>
        </div>
      )}

      

      {/* ===== Ekran startowy ===== */}
      {projectLoaded && projects.length === 0 && !loadError && (
        <div className="fixed inset-0 z-50 bg-[#0d0d0d] flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-medium text-gray-300 mb-4">Nowy projekt</h2>
            <input
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createProject()}
              placeholder="Nazwa projektu..."
              className="w-72 px-3 py-2 text-sm bg-[#1a1a1a] border border-gray-600 rounded outline-none focus:border-gray-400 text-gray-200"
              autoFocus
            />
            <button onClick={createProject} className="block mx-auto mt-4 px-5 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-500">Utworz</button>
          </div>
        </div>
      )}
      {loadError && (
        <div className="fixed inset-0 z-50 bg-[#0d0d0d] flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-medium text-red-400 mb-2">Blad ladowania</h2>
            <p className="text-sm text-gray-400">{loadError}</p>
          </div>
        </div>
      )}
    </div>
  );
}