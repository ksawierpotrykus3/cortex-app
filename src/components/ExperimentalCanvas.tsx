import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Projekt,
  ProjektyNode,
  ProjektyEdge,
  ProjektyNodeAnnotation,
} from '../types';

const genId = () => `exp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;



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

  // -- dane projektu --
  const [nodes, setNodes] = useState<ProjektyNode[]>([]);
  const [edges, setEdges] = useState<ProjektyEdge[]>([]);

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

    const b = window.nexusBridge;
    if (b?.projGetNodes) {
      const nds = await b.projGetNodes({ projectId: id });
      setNodes(nds);
    }
    if (b?.projGetEdges) {
      const eds = await b.projGetEdges({ projectId: id });
      setEdges(eds);
    }
  };

  // ==========================================================================
  // CRUD projekty
  // ==========================================================================
  const createProject = async () => {
    const name = newProjectName.trim() || `Projekt ${projects.length + 1}`;
    const id = genId();
    const proj: Projekt = {
      id,
      name,
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
  // Adnotacje
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
      const updated = { ...node, content: annotationText.trim() };
      setNodes(prev => prev.map(n => n.id === nodeId ? updated : n));
      if (b?.projSaveNode) await b.projSaveNode({ node: updated });
    }

    setAnnotationNode(null);
    setAnnotationText('');
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
      </div>

      {/* ===== Glowny obszar ===== */}
      <div className="flex-1 flex overflow-hidden relative">
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
              </div>
            )}
          </div>

          <div className="absolute bottom-3 left-3 text-xs text-gray-600 bg-[#0d0d0d] px-2 py-1 rounded border border-gray-700">
            {Math.round(canvasScale * 100)}%
          </div>
        </div>
      </div>

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