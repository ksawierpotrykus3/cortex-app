import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ExperimentalProject,
  ExperimentalConversation,
  ExperimentalChatMessage,
  ExperimentalNode,
  ExperimentalEdge,
  ExperimentalNodeAnnotation,
  ExperimentalAIConfig,
} from '../types';
import { useExperimentalAI, PlannerOperation } from '../hooks/useExperimentalAI';

// ---------------------------------------------------------------------------
// Pomocnicze
// ---------------------------------------------------------------------------
const genId = () => `exp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

const parseAiConfig = (raw: any): ExperimentalAIConfig => {
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
  return raw || {};
};

const AI_MODELS = ['DeepSeek V4 Flash', 'DeepSeek V4 Pro'] as const;

// ---------------------------------------------------------------------------
// Komponent
// ---------------------------------------------------------------------------
export function ExperimentalCanvas() {
  // -- projekty --
  const [projects, setProjects] = useState<ExperimentalProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  // -- konwersacje --
  const [conversations, setConversations] = useState<ExperimentalConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // -- dane projektu --
  const [specContent, setSpecContent] = useState('');
  const [messages, setMessages] = useState<ExperimentalChatMessage[]>([]);
  const [nodes, setNodes] = useState<ExperimentalNode[]>([]);
  const [edges, setEdges] = useState<ExperimentalEdge[]>([]);

  // -- AI config --
  const [chatModel, setChatModel] = useState<string>('DeepSeek V4 Flash');
  const [plannerModel, setPlannerModel] = useState<string>('DeepSeek V4 Flash');
  const [chatSystemPrompt, setChatSystemPrompt] = useState('Jestes architektem AI. Odpowiadaj krotko i rzeczowo.');
  const [plannerSystemPrompt, setPlannerSystemPrompt] = useState(
    'Jestes Planerem Architektury. Analizujesz rozmowe i istniejący plan, proponujesz zmiany w wezlach. Zwracasz JSON z operacjami.'
  );
  const [showSettings, setShowSettings] = useState(false);

  // -- czat --
  const [chatInput, setChatInput] = useState('');
  const [chatDrawerOpen, setChatDrawerOpen] = useState(true);
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
  const { invokeChat, invokePlanner, parsePlannerResponse, chatLoading, plannerLoading } = useExperimentalAI();
  const [diffProposal, setDiffProposal] = useState<{ operations: PlannerOperation[] } | null>(null);

  // ==========================================================================
  // Ladowanie projektow
  // ==========================================================================
  useEffect(() => {
    loadProjects();
  }, []);

  // Auto-scroll czatu
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Ladowanie ostatniego projektu z localStorage
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
      if (b?.expGetProjects) {
        const list = await b.expGetProjects();
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

    const cfg = parseAiConfig(proj.ai_config);
    setChatModel(cfg.chatModel || 'DeepSeek V4 Flash');
    setPlannerModel(cfg.plannerModel || 'DeepSeek V4 Flash');
    if (cfg.chatSystemPrompt) setChatSystemPrompt(cfg.chatSystemPrompt);
    if (cfg.mapPlannerSystemPrompt) setPlannerSystemPrompt(cfg.mapPlannerSystemPrompt);
    setSpecContent(proj.spec_content || '');

    // Laduj konwersacje
    const b = window.nexusBridge;
    let convs: ExperimentalConversation[] = [];
    if (b?.expGetConversations) {
      convs = await b.expGetConversations({ projectId: id });
    }
    if (convs.length === 0) {
      // Domyslna konwersacja
      const def: ExperimentalConversation = { id: genId(), project_id: id, name: 'Rozmowa 1' };
      if (b?.expSaveConversation) await b.expSaveConversation({ conversation: def });
      convs = [def];
    }
    setConversations(convs);
    setActiveConversationId(convs[0].id);

    // Laduj wiadomosci konwersacji
    if (b?.expGetChatMessages) {
      const msgs = await b.expGetChatMessages({ projectId: id, conversationId: convs[0].id });
      setMessages(msgs);
    }

    // Laduj wezly i krawedzie
    if (b?.expGetNodes) {
      const nds = await b.expGetNodes({ projectId: id });
      setNodes(nds);
    }
    if (b?.expGetEdges) {
      const eds = await b.expGetEdges({ projectId: id });
      setEdges(eds);
    }
  };

  // ==========================================================================
  // CRUD projekty
  // ==========================================================================
  const createProject = async () => {
    const name = newProjectName.trim() || `Projekt ${projects.length + 1}`;
    const id = genId();
    const proj: ExperimentalProject = {
      id, name,
      spec_content: '# Plan\n\nOpisz czego dotyczy projekt.',
      ai_config: { chatModel, plannerModel, chatSystemPrompt, mapPlannerSystemPrompt: plannerSystemPrompt },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const b = window.nexusBridge;
    if (b?.expSaveProject) await b.expSaveProject({ project: proj });
    setProjects(prev => [...prev, proj]);
    setNewProjectName('');
    setShowNewProjectInput(false);
    await selectProject(id, [...projects, proj]);
  };

  const deleteProject = async (id: string) => {
    const b = window.nexusBridge;
    if (b?.expDeleteProject) await b.expDeleteProject({ id });
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
    if (b?.expSaveProject) await b.expSaveProject({ project: updated });
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
    if (b?.expGetChatMessages) {
      const msgs = await b.expGetChatMessages({ projectId: activeProjectId, conversationId: convId });
      setMessages(msgs);
    }
  };

  const addConversation = async () => {
    if (!activeProjectId) return;
    const conv: ExperimentalConversation = {
      id: genId(),
      project_id: activeProjectId,
      name: `Rozmowa ${conversations.length + 1}`,
    };
    const b = window.nexusBridge;
    if (b?.expSaveConversation) await b.expSaveConversation({ conversation: conv });
    setConversations(prev => [...prev, conv]);
    setActiveConversationId(conv.id);
    setMessages([]);
  };

  // ==========================================================================
  // Wysylanie wiadomosci (Chat AI #1)
  // ==========================================================================
  const sendMessage = async () => {
    if (!chatInput.trim() || !activeProjectId || !activeConversationId) return;
    const content = chatInput.trim();
    setChatInput('');

    const userMsg: ExperimentalChatMessage = {
      id: genId(),
      project_id: activeProjectId,
      conversation_id: activeConversationId || undefined,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    const b = window.nexusBridge;
    if (b?.expSaveChatMessage) await b.expSaveChatMessage({ message: userMsg });

    // Odpowiedz AI
    const reply = await invokeChat(chatSystemPrompt, [...messages, userMsg], chatModel);
    const aiMsg: ExperimentalChatMessage = {
      id: genId(),
      project_id: activeProjectId,
      conversation_id: activeConversationId || undefined,
      role: 'ai',
      content: reply,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, aiMsg]);
    if (b?.expSaveChatMessage) await b.expSaveChatMessage({ message: aiMsg });
  };

  // ==========================================================================
  // Planer (#3) — recznie
  // ==========================================================================
  const runPlanner = async () => {
    if (!activeProjectId || !activeConversationId) return;

    const b = window.nexusBridge;
    let unprocessed: ExperimentalChatMessage[] = [];
    if (b?.expGetUnprocessedMessages) {
      unprocessed = await b.expGetUnprocessedMessages({ projectId: activeProjectId, conversationId: activeConversationId });
    } else {
      // fallback: wez ostatnie wiadomosci uzytkownika
      unprocessed = messages.filter(m => m.role === 'user' && !m.extracted_to_canvas);
    }

    if (unprocessed.length === 0) {
      // Wez wszystkie wiadomosci z tej konwersacji
      unprocessed = messages;
    }

    const raw = await invokePlanner(
      plannerSystemPrompt,
      unprocessed,
      nodes,
      edges,
      specContent,
      plannerModel
    );

    const result = parsePlannerResponse(raw);
    if (result.operations.length === 0) {
      // Wyswietl surowa odpowiedz jako wiadomosc systemowa
      const sysMsg: ExperimentalChatMessage = {
        id: genId(),
        project_id: activeProjectId,
        conversation_id: activeConversationId || undefined,
        role: 'system',
        content: `[Planer] Nie rozpoznano operacji w odpowiedzi:\n${raw}`,
      };
      setMessages(prev => [...prev, sysMsg]);
      return;
    }

    // Pokaz diff
    setDiffProposal(result);

    // Oznacz wiadomosci jako przetworzone
    if (unprocessed.length > 0 && b?.expMarkMessagesProcessed) {
      await b.expMarkMessagesProcessed({ ids: unprocessed.map(m => m.id) });
    }
  };

  // ==========================================================================
  // Akceptacja propozycji Planera
  // ==========================================================================
  const acceptPlannerDiff = async () => {
    if (!diffProposal || !activeProjectId) return;
    const b = window.nexusBridge;

    for (const op of diffProposal.operations) {
      if (op.action === 'ADD' && op.node) {
        const node: ExperimentalNode = {
          id: op.node.id || genId(),
          project_id: activeProjectId,
          title: op.node.title,
          content: op.node.content,
          parent_id: op.node.parent_id || null,
          x: 100 + Math.random() * 300,
          y: 100 + Math.random() * 300,
          width: 220,
          height: 100,
          source_conversation_id: activeConversationId,
        };
        setNodes(prev => [...prev, node]);
        if (b?.expSaveNode) await b.expSaveNode({ node });
      }
      if (op.action === 'UPDATE' && op.node?.id) {
        const existing = nodes.find(n => n.id === op.node!.id);
        if (existing) {
          const updated = { ...existing, title: op.node.title, content: op.node.content };
          setNodes(prev => prev.map(n => n.id === op.node!.id ? updated : n));
          if (b?.expSaveNode) await b.expSaveNode({ node: updated });
        }
      }
      if (op.action === 'DELETE' && op.nodeId) {
        setNodes(prev => prev.filter(n => n.id !== op.nodeId));
        if (b?.expDeleteNode) await b.expDeleteNode({ id: op.nodeId });
      }
      if (op.edge) {
        // Dodaj krawedz jesli podana
        const edge: ExperimentalEdge = {
          id: genId(),
          project_id: activeProjectId,
          source_node_id: op.edge.source_node_id,
          target_node_id: op.edge.target_node_id,
          label: op.edge.label || '',
        };
        setEdges(prev => [...prev, edge]);
        if (b?.expSaveEdge) await b.expSaveEdge({ edge });
      }
    }

    setDiffProposal(null);
  };

  // ==========================================================================
  // Adnotacja do wezla
  // ==========================================================================
  const submitAnnotation = async (nodeId: string) => {
    if (!annotationText.trim() || !activeProjectId) return;
    const ann: ExperimentalNodeAnnotation = {
      id: genId(),
      node_id: nodeId,
      project_id: activeProjectId,
      content: annotationText.trim(),
    };
    const b = window.nexusBridge;
    if (b?.expSaveAnnotation) await b.expSaveAnnotation({ annotation: ann });

    // Wyslij jako prompt do AI #1 z kontekstem wezla
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      const prompt = `Uzytkownik skomentowal wezel "${node.title}": "${annotationText.trim()}". Zaktualizuj tresc tego wezla.`;
      const userMsg: ExperimentalChatMessage = {
        id: genId(),
        project_id: activeProjectId,
        conversation_id: activeConversationId || undefined,
        role: 'user',
        content: prompt,
      };
      setMessages(prev => [...prev, userMsg]);
      if (b?.expSaveChatMessage) await b.expSaveChatMessage({ message: userMsg });

      const reply = await invokeChat(chatSystemPrompt, [...messages, userMsg], chatModel);
      const aiMsg: ExperimentalChatMessage = {
        id: genId(),
        project_id: activeProjectId,
        conversation_id: activeConversationId || undefined,
        role: 'ai',
        content: reply,
      };
      setMessages(prev => [...prev, aiMsg]);
      if (b?.expSaveChatMessage) await b.expSaveChatMessage({ message: aiMsg });

      // Podstawowa aktualizacja wezla (AI moze sugerowac zmiane)
      const updated = { ...node, content: annotationText.trim() };
      setNodes(prev => prev.map(n => n.id === nodeId ? updated : n));
      if (b?.expSaveNode) await b.expSaveNode({ node: updated });
    }

    setAnnotationNode(null);
    setAnnotationText('');
  };

  // ==========================================================================
  // Canvas: Pan & Zoom
  // ==========================================================================
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).dataset?.canvas === 'bg') {
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
      // Zapisz nowa pozycje
      const node = nodes.find(n => n.id === dragNode);
      if (node && window.nexusBridge?.expSaveNode) {
        window.nexusBridge.expSaveNode({ node });
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
  // Zapisz specyfikacje i konfiguracje AI
  // ==========================================================================
  const saveSpec = async () => {
    if (!activeProjectId) return;
    const proj = projects.find(p => p.id === activeProjectId);
    if (!proj) return;
    const updated = { ...proj, spec_content: specContent, updated_at: new Date().toISOString() };
    const b = window.nexusBridge;
    if (b?.expSaveProject) await b.expSaveProject({ project: updated });
    setProjects(prev => prev.map(p => p.id === activeProjectId ? updated : p));
  };

  const saveAiConfig = async () => {
    if (!activeProjectId) return;
    const proj = projects.find(p => p.id === activeProjectId);
    if (!proj) return;
    const aiConfig: ExperimentalAIConfig = {
      chatModel,
      plannerModel,
      chatSystemPrompt,
      mapPlannerSystemPrompt: plannerSystemPrompt,
    };
    const updated = { ...proj, ai_config: aiConfig, updated_at: new Date().toISOString() };
    const b = window.nexusBridge;
    if (b?.expSaveProject) await b.expSaveProject({ project: updated });
    setProjects(prev => prev.map(p => p.id === activeProjectId ? updated : p));
  };

  // ==========================================================================
  // Render
  // ==========================================================================
  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <div className="flex flex-col h-full bg-black text-gray-200 overflow-hidden select-none">
      {/* ===== Top Bar ===== */}
      <div className="h-11 border-b border-gray-800 bg-[#0a0a0a] flex items-center px-3 gap-2 shrink-0">
        {/* Lewa strona: projekty */}
        <div className="flex items-center gap-1 overflow-x-auto flex-1">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mr-1 shrink-0">Projekty:</span>

          {/* Przyciski projektow */}
          <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
            {projects.map(p => (
              <div key={p.id} className="flex items-center shrink-0 group">
                {renameProjectId === p.id ? (
                  <input
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') renameProject(p.id); if (e.key === 'Escape') setRenameProjectId(null); }}
                    className="w-28 px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded outline-none focus:border-gray-500"
                    autoFocus
                    onBlur={() => renameProject(p.id)}
                  />
                ) : (
                  <button
                    onClick={() => selectProject(p.id)}
                    className={`px-2.5 py-1 text-xs rounded transition-colors ${
                      activeProjectId === p.id
                        ? 'bg-gray-700 text-white'
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
                      className="text-[10px] px-1 py-0.5 text-gray-500 hover:text-white rounded"
                      title="Zmien nazwe"
                    >E</button>
                    <button
                      onClick={() => deleteProject(p.id)}
                      className="text-[10px] px-1 py-0.5 text-gray-500 hover:text-red-400 rounded"
                      title="Usun projekt"
                    >X</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Przycisk + Nowy */}
          {showNewProjectInput ? (
            <div className="flex items-center gap-1 shrink-0">
              <input
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createProject(); if (e.key === 'Escape') setShowNewProjectInput(false); }}
                placeholder="Nazwa projektu..."
                className="w-32 px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded outline-none focus:border-gray-500"
                autoFocus
                onBlur={() => { if (!newProjectName.trim()) setShowNewProjectInput(false); }}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowNewProjectInput(true)}
              className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded shrink-0"
            >
              + Nowy
            </button>
          )}
        </div>

        {/* Prawa strona: akcje */}
        {activeProject && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowSettings(true)}
              className="px-2 py-1 text-[11px] text-gray-500 hover:text-white rounded"
            >
              Ustawienia AI
            </button>
            <button
              onClick={saveSpec}
              className="px-2 py-1 text-[11px] text-gray-500 hover:text-white rounded"
            >
              Zapisz spec
            </button>
            <button
              onClick={() => setChatDrawerOpen(prev => !prev)}
              className={`px-2 py-1 text-[11px] rounded ${chatDrawerOpen ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              Czat
            </button>
          </div>
        )}
      </div>

      {/* ===== Glowny obszar ===== */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* === Infinite Canvas === */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden bg-[#050505]"
          style={{ cursor: isPanning ? 'grabbing' : dragNode ? 'grabbing' : 'grab' }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onWheel={handleWheel}
        >
          {/* Kropkowane tlo */}
          <div
            data-canvas="bg"
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 0)',
              backgroundSize: `${24 * canvasScale}px ${24 * canvasScale}px`,
              backgroundPosition: `${canvasOffset.x}px ${canvasOffset.y}px`,
            }}
          />

          {/* Transform container */}
          <div
            className="absolute inset-0"
            style={{
              transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`,
              transformOrigin: '0 0',
            }}
          >
            {/* Edges (linie polaczen) - proste SVG */}
            <svg className="absolute inset-0 pointer-events-none" style={{ width: 4000, height: 4000 }}>
              {edges.map(edge => {
                const src = nodes.find(n => n.id === edge.source_node_id);
                const tgt = nodes.find(n => n.id === edge.target_node_id);
                if (!src || !tgt) return null;
                return (
                  <g key={edge.id}>
                    <line
                      x1={src.x + (src.width || 220) / 2}
                      y1={src.y + (src.height || 100) / 2}
                      x2={tgt.x + (tgt.width || 220) / 2}
                      y2={tgt.y + (tgt.height || 100) / 2}
                      stroke="rgba(75,85,99,0.5)"
                      strokeWidth={1.5}
                    />
                    {edge.label && (
                      <text
                        x={(src.x + (src.width || 220) / 2 + tgt.x + (tgt.width || 220) / 2) / 2}
                        y={(src.y + (src.height || 100) / 2 + tgt.y + (tgt.height || 100) / 2) / 2 - 6}
                        fill="rgb(107,114,128)"
                        fontSize={10}
                        textAnchor="middle"
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Nodes */}
            {nodes.map(node => {
              const isParent = nodes.some(n => n.parent_id === node.id);
              const depth = node.parent_id ? 1 : 0;
              const annotations: ExperimentalNodeAnnotation[] = []; // TODO: zaladowac z bridge jesli potrzeba

              return (
                <div
                  key={node.id}
                  className={`absolute bg-[#111] border rounded-md group ${
                    annotationNode === node.id ? 'border-gray-500' : 'border-gray-800 hover:border-gray-600'
                  }`}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: node.width || 220,
                    minHeight: node.height || 100,
                    marginLeft: depth * 16,
                    transition: dragNode === node.id ? 'none' : 'box-shadow 0.15s',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    zIndex: dragNode === node.id ? 100 : 1,
                  }}
                >
                  {/* Naglowek z przeciaganiem */}
                  <div
                    className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-800 cursor-grab active:cursor-grabbing"
                    onMouseDown={e => handleNodeDragStart(node.id, e)}
                  >
                    <span className="text-xs font-medium text-gray-200 truncate flex-1">{node.title}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => { e.stopPropagation(); setAnnotationNode(node.id); }}
                        className="text-[10px] px-1 py-0.5 text-gray-500 hover:text-blue-400 rounded"
                        title="Komentuj"
                      >
                        Komentuj
                      </button>
                      <button
                        onClick={async e => {
                          e.stopPropagation();
                          setNodes(prev => prev.filter(n => n.id !== node.id));
                          const b = window.nexusBridge;
                          if (b?.expDeleteNode) await b.expDeleteNode({ id: node.id });
                        }}
                        className="text-[10px] px-1 py-0.5 text-gray-500 hover:text-red-400 rounded"
                      >
                        X
                      </button>
                    </div>
                  </div>

                  {/* Tresc */}
                  <div className="px-2.5 py-2">
                    <p className="text-[11px] text-gray-400 leading-relaxed whitespace-pre-wrap">{node.content}</p>
                  </div>

                  {/* Adnotacja inline */}
                  {annotationNode === node.id && (
                    <div className="px-2.5 pb-2 border-t border-gray-800 pt-1.5">
                      <input
                        value={annotationText}
                        onChange={e => setAnnotationText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') submitAnnotation(node.id); if (e.key === 'Escape') setAnnotationNode(null); }}
                        placeholder="Twoja uwaga..."
                        className="w-full px-2 py-1 text-[11px] bg-gray-900 border border-gray-700 rounded outline-none focus:border-gray-500"
                        autoFocus
                      />
                      <div className="flex justify-end gap-1 mt-1">
                        <button
                          onClick={() => setAnnotationNode(null)}
                          className="text-[10px] px-1.5 py-0.5 text-gray-500 hover:text-white"
                        >
                          Anuluj
                        </button>
                        <button
                          onClick={() => submitAnnotation(node.id)}
                          className="text-[10px] px-1.5 py-0.5 bg-gray-700 text-white rounded hover:bg-gray-600"
                        >
                          Wyślij
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Podwezly badge */}
                  {isParent && (
                    <div className="px-2.5 py-1 border-t border-gray-800">
                      <span className="text-[10px] text-gray-600">{nodes.filter(n => n.parent_id === node.id).length} podwezlow</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pusta tablica */}
            {nodes.length === 0 && activeProject && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <p className="text-sm text-gray-600">Brak wezlow.</p>
                <p className="text-xs text-gray-700 mt-1">Napisz cos w czacie, a nastepnie uzyj Planera.</p>
              </div>
            )}
          </div>

          {/* Zoom info */}
          <div className="absolute bottom-3 left-3 text-[10px] text-gray-700">
            {Math.round(canvasScale * 100)}%
          </div>
        </div>

        {/* === Chat Drawer === */}
        {chatDrawerOpen && activeProject && (
          <div className="w-80 border-l border-gray-800 bg-[#0a0a0a] flex flex-col shrink-0">
            {/* Naglowek czatu */}
            <div className="h-10 px-3 border-b border-gray-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <select
                  value={activeConversationId || ''}
                  onChange={e => switchConversation(e.target.value)}
                  className="bg-transparent text-xs text-gray-300 border border-gray-700 rounded px-1.5 py-0.5 outline-none max-w-[140px]"
                >
                  {conversations.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  onClick={addConversation}
                  className="text-[10px] text-gray-500 hover:text-white px-1 shrink-0"
                  title="Nowa rozmowa"
                >
                  + Nowa
                </button>
              </div>

              {/* Selektor modelu czatu */}
              <select
                value={chatModel}
                onChange={e => { setChatModel(e.target.value); setTimeout(saveAiConfig, 0); }}
                className="bg-transparent text-[10px] text-gray-500 border border-gray-800 rounded px-1 py-0.5 outline-none"
              >
                {AI_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Wiadomosci */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 custom-scrollbar">
              {messages.length === 0 && (
                <div className="text-center text-gray-700 text-xs mt-8">Brak wiadomosci.</div>
              )}
              {messages.map(m => (
                <div key={m.id} className={`text-xs leading-relaxed ${m.role === 'user' ? 'text-gray-300' : m.role === 'system' ? 'text-yellow-700' : 'text-gray-400'}`}>
                  <span className="text-[10px] text-gray-600 block mb-0.5">
                    {m.role === 'user' ? 'Ty' : m.role === 'ai' ? 'AI' : 'System'}
                  </span>
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                </div>
              ))}
              {chatLoading && <div className="text-xs text-gray-700 animate-pulse">AI mysli...</div>}
              <div ref={messagesEndRef} />
            </div>

            {/* Input czatu + Planer */}
            <div className="border-t border-gray-800 p-3 shrink-0">
              <div className="flex gap-1.5 mb-2">
                <input
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Napisz wiadomosc..."
                  className="flex-1 bg-gray-900 border border-gray-800 rounded px-2.5 py-1.5 text-xs outline-none focus:border-gray-600 text-gray-200 placeholder-gray-600"
                />
                <button
                  onClick={sendMessage}
                  disabled={!chatInput.trim() || chatLoading}
                  className="px-2.5 py-1.5 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 disabled:opacity-40"
                >
                  Wyślij
                </button>
              </div>

              {/* Planer */}
              <div className="flex items-center gap-2">
                <button
                  onClick={runPlanner}
                  disabled={plannerLoading || messages.length === 0}
                  className="flex-1 px-2.5 py-1.5 bg-gray-800 text-gray-300 text-xs rounded hover:bg-gray-700 disabled:opacity-40 border border-gray-700"
                >
                  {plannerLoading ? 'Planowanie...' : 'Przebuduj plan z rozmowy'}
                </button>
                <select
                  value={plannerModel}
                  onChange={e => { setPlannerModel(e.target.value); setTimeout(saveAiConfig, 0); }}
                  className="bg-gray-900 text-[10px] text-gray-500 border border-gray-800 rounded px-1 py-1 outline-none"
                  title="Model Planera"
                >
                  {AI_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== Modal: Ustawienia AI ===== */}
      {showSettings && activeProject && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <div className="bg-[#111] border border-gray-800 rounded-lg w-full max-w-md p-5">
            <h3 className="text-sm font-medium text-gray-200 mb-4">Ustawienia AI</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-gray-500 block mb-1">Prompt systemowy czatu (AI #1)</label>
                <textarea
                  value={chatSystemPrompt}
                  onChange={e => setChatSystemPrompt(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded px-2.5 py-1.5 h-16 resize-none outline-none text-gray-300"
                />
              </div>
              <div>
                <label className="text-gray-500 block mb-1">Prompt systemowy Planera (AI #3)</label>
                <textarea
                  value={plannerSystemPrompt}
                  onChange={e => setPlannerSystemPrompt(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded px-2.5 py-1.5 h-16 resize-none outline-none text-gray-300"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowSettings(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-white rounded">Zamknij</button>
              <button onClick={() => { saveAiConfig(); setShowSettings(false); }} className="px-3 py-1.5 text-xs bg-gray-700 text-white rounded hover:bg-gray-600">Zapisz</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal: Diff Planera ===== */}
      {diffProposal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <div className="bg-[#111] border border-gray-800 rounded-lg w-full max-w-lg p-5 max-h-[70vh] overflow-y-auto">
            <h3 className="text-sm font-medium text-gray-200 mb-3">Propozycje Planera</h3>
            <div className="space-y-2 mb-4">
              {diffProposal.operations.map((op, i) => (
                <div key={i} className="border border-gray-800 rounded p-2.5 text-xs">
                  <span className={`font-medium ${op.action === 'ADD' ? 'text-green-500' : op.action === 'DELETE' ? 'text-red-400' : 'text-yellow-500'}`}>
                    {op.action === 'ADD' ? '+ Dodaj' : op.action === 'DELETE' ? '- Usun' : '~ Zmien'}
                  </span>
                  {op.node && <span className="text-gray-300 ml-2">{op.node.title}</span>}
                  {op.node?.content && <p className="text-gray-500 mt-1">{op.node.content}</p>}
                  {op.nodeId && <span className="text-gray-500 ml-2">ID: {op.nodeId}</span>}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDiffProposal(null)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-white rounded">Odrzuc</button>
              <button onClick={acceptPlannerDiff} className="px-3 py-1.5 text-xs bg-gray-700 text-white rounded hover:bg-gray-600">Zatwierdz</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Ekran startowy (brak projektow) ===== */}
      {projectLoaded && projects.length === 0 && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-base font-medium text-gray-300 mb-3">Nowy projekt</h2>
            <input
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createProject()}
              placeholder="Nazwa projektu..."
              className="w-64 px-3 py-2 text-sm bg-gray-900 border border-gray-700 rounded outline-none focus:border-gray-500 text-gray-200"
              autoFocus
            />
            <button
              onClick={createProject}
              className="block mx-auto mt-3 px-4 py-2 text-xs bg-gray-700 text-white rounded hover:bg-gray-600"
            >
              Utworz
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
