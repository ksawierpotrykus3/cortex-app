import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { ProjektyNode, ProjektyEdge } from '../types';

const PROJECT_ID = 'default';
const NODE_WIDTH = 280;
const NODE_HEADER_HEIGHT = 24;
const NODE_BODY_HEIGHT = 116;
const NODE_HEIGHT = NODE_HEADER_HEIGHT + NODE_BODY_HEIGHT;

const genId = () => `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const centerOf = (node: ProjektyNode) => ({
  x: node.x + (node.width || NODE_WIDTH) / 2,
  y: node.y + (node.height || NODE_HEIGHT) / 2,
});

async function saveNode(node: ProjektyNode): Promise<void> {
  try {
    await window.nexusBridge?.projSaveNode?.({ node });
  } catch (err) {
    console.error('[NotesCanvas] saveNode', err);
  }
}

async function saveEdge(edge: ProjektyEdge): Promise<void> {
  try {
    await window.nexusBridge?.projSaveEdge?.({ edge });
  } catch (err) {
    console.error('[NotesCanvas] saveEdge', err);
  }
}

async function deleteEdgeApi(edgeId: string): Promise<void> {
  try {
    await window.nexusBridge?.projDeleteEdge?.({ id: edgeId });
  } catch (err) {
    console.error('[NotesCanvas] deleteEdge', err);
  }
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="fill-slate-600">
      <circle cx="3" cy="3" r="1.3" />
      <circle cx="7" cy="3" r="1.3" />
      <circle cx="11" cy="3" r="1.3" />
      <circle cx="3" cy="7" r="1.3" />
      <circle cx="7" cy="7" r="1.3" />
      <circle cx="11" cy="7" r="1.3" />
      <circle cx="3" cy="11" r="1.3" />
      <circle cx="7" cy="11" r="1.3" />
      <circle cx="11" cy="11" r="1.3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" className="stroke-current">
      <path d="M2 2l8 8M10 2l-8 8" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function NotesCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes] = useState<ProjektyNode[]>([]);
  const [edges, setEdges] = useState<ProjektyEdge[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef<{ startX: number; startY: number } | null>(null);

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; nx: number; ny: number; moved: boolean } | null>(null);

  // Zaznaczenie i edycja
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const cancelEditRef = useRef(false);

  // Tryb łączenia (linking)
  const [linkingMode, setLinkingMode] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number } | null>(null);

  const [showHelp, setShowHelp] = useState(false);

  // Referencje do najświeższych wartości dla globalnych listenerów
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const editingNodeIdRef = useRef(editingNodeId);
  const editingTextRef = useRef(editingText);
  const linkingModeRef = useRef(linkingMode);
  const linkSourceIdRef = useRef(linkSourceId);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);
  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);
  useEffect(() => {
    editingNodeIdRef.current = editingNodeId;
  }, [editingNodeId]);
  useEffect(() => {
    editingTextRef.current = editingText;
  }, [editingText]);
  useEffect(() => {
    linkingModeRef.current = linkingMode;
  }, [linkingMode]);
  useEffect(() => {
    linkSourceIdRef.current = linkSourceId;
  }, [linkSourceId]);

  // Synchroniczne mutatory dla stanu + refów (zapobiega opóźnieniom w eventach)
  const selectNode = (nodeId: string | null) => {
    selectedNodeIdRef.current = nodeId;
    setSelectedNodeId(nodeId);
  };

  const setLinking = (active: boolean, sourceId: string | null) => {
    linkingModeRef.current = active;
    linkSourceIdRef.current = sourceId;
    setLinkingMode(active);
    setLinkSourceId(sourceId);
  };

  // --- wczytanie danych ----------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const b = window.nexusBridge;
      if (!b?.projGetProjects || !b?.projSaveProject) {
        setLoaded(true);
        return;
      }

      try {
        const projects = await b.projGetProjects();
        if (!projects.some((p) => p.id === PROJECT_ID)) {
          await b.projSaveProject({
            project: {
              id: PROJECT_ID,
              name: 'Notatki',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          });
        }

        const nds = await b.projGetNodes({ projectId: PROJECT_ID });
        const eds = await b.projGetEdges({ projectId: PROJECT_ID });

        if (!cancelled) {
          setNodes(nds);
          nodesRef.current = nds;
          setEdges(eds);
          edgesRef.current = eds;
        }
      } catch (err) {
        console.error('[NotesCanvas] load failed', err);
        if (!cancelled) setLoadError(String(err));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // --- geometria canvasu ---------------------------------------------------
  const screenToCanvas = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const cx = rect ? clientX - rect.left : clientX;
    const cy = rect ? clientY - rect.top : clientY;
    return {
      x: (cx - offsetRef.current.x) / scaleRef.current,
      y: (cy - offsetRef.current.y) / scaleRef.current,
    };
  };

  // --- edycja notatek ------------------------------------------------------
  const startEditing = (nodeId: string) => {
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (!node) return;
    cancelEditRef.current = false;
    selectNode(nodeId);
    editingNodeIdRef.current = nodeId;
    setEditingNodeId(nodeId);
    editingTextRef.current = node.content ?? '';
    setEditingText(node.content ?? '');
  };

  const commitEditing = async (targetId?: string, targetText?: string) => {
    const id = targetId ?? editingNodeIdRef.current;
    if (!id) return;

    const text = targetText !== undefined ? targetText : editingTextRef.current;
    const wasCancelled = cancelEditRef.current;

    editingNodeIdRef.current = null;
    setEditingNodeId(null);
    editingTextRef.current = '';
    setEditingText('');

    if (wasCancelled) return;

    const node = nodesRef.current.find((n) => n.id === id);
    if (!node || node.content === text) return;

    const updated: ProjektyNode = { ...node, content: text, updated_at: new Date().toISOString() };
    setNodes((prev) => prev.map((n) => (n.id === id ? updated : n)));
    nodesRef.current = nodesRef.current.map((n) => (n.id === id ? updated : n));
    await saveNode(updated);
  };

  const cancelEditing = () => {
    cancelEditRef.current = true;
    editingNodeIdRef.current = null;
    setEditingNodeId(null);
    editingTextRef.current = '';
    setEditingText('');
  };

  const deleteNote = async (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    nodesRef.current = nodesRef.current.filter((n) => n.id !== nodeId);
    setEdges((prev) => prev.filter((e) => e.source_node_id !== nodeId && e.target_node_id !== nodeId));
    edgesRef.current = edgesRef.current.filter((e) => e.source_node_id !== nodeId && e.target_node_id !== nodeId);
    if (selectedNodeIdRef.current === nodeId) selectNode(null);
    if (editingNodeIdRef.current === nodeId) {
      editingNodeIdRef.current = null;
      setEditingNodeId(null);
    }
    if (linkSourceIdRef.current === nodeId) setLinking(linkingModeRef.current, null);
    try {
      await window.nexusBridge?.projDeleteNode?.({ id: nodeId });
    } catch (err) {
      console.error('[NotesCanvas] deleteNote', err);
    }
  };

  const deleteEdge = async (edgeId: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
    edgesRef.current = edgesRef.current.filter((e) => e.id !== edgeId);
    await deleteEdgeApi(edgeId);
  };

  // --- skróty klawiszowe ---------------------------------------------------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const isTyping = !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT');

      if (e.key === 'Tab') {
        e.preventDefault(); // Kluczowe: ZAWSZE zapobiegaj natywnemu przełączaniu focusu przeglądarki!

        const currentEditing = editingNodeIdRef.current;
        const currentSelected = selectedNodeIdRef.current;
        const currentLinking = linkingModeRef.current;
        const currentLinkSource = linkSourceIdRef.current;

        // Jeśli notatka była edytowana: zatwierdź tekst i natychmiast rozpocznij łączenie z tej notatki
        if (currentEditing) {
          void commitEditing(currentEditing, editingTextRef.current);
          selectNode(currentEditing);
          setLinking(true, currentEditing);
          return;
        }

        // Jeśli notatka jest zaznaczona:
        if (currentSelected) {
          if (currentLinking && currentLinkSource === currentSelected) {
            // Ponowne wciśnięcie Tab wyłącza tryb łączenia
            setLinking(false, null);
          } else {
            // Włącz łączenie z zaznaczonej notatki jako źródła
            setLinking(true, currentSelected);
          }
          return;
        }

        // Brak zaznaczonej notatki
        if (currentLinking) {
          setLinking(false, null);
        } else {
          setLinking(true, null);
        }
      } else if (e.key === 'Escape') {
        if (linkingModeRef.current) {
          e.preventDefault();
          setLinking(false, null);
        } else if (editingNodeIdRef.current) {
          e.preventDefault();
          cancelEditing();
        } else if (selectedNodeIdRef.current) {
          e.preventDefault();
          selectNode(null);
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping) {
        if (selectedNodeIdRef.current && !editingNodeIdRef.current) {
          e.preventDefault();
          void deleteNote(selectedNodeIdRef.current);
        }
      } else if (e.key === 'Enter' && !isTyping) {
        if (selectedNodeIdRef.current && !editingNodeIdRef.current) {
          e.preventDefault();
          startEditing(selectedNodeIdRef.current);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // --- zoom (natywny listener) ---------------------------------------------
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((prev) => Math.min(3, Math.max(0.2, prev * factor)));
    };

    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, []);

  // --- interakcje canvasu --------------------------------------------------
  const onCanvasMouseDown = (e: ReactMouseEvent) => {
    const target = e.target as HTMLElement;
    if (target === canvasRef.current || target.dataset?.canvas === 'bg') {
      e.preventDefault();

      if (linkingModeRef.current) {
        setLinking(false, null);
      }
      if (editingNodeIdRef.current) {
        void commitEditing();
      }
      selectNode(null);

      panRef.current = {
        startX: e.clientX - offsetRef.current.x,
        startY: e.clientY - offsetRef.current.y,
      };
      setIsPanning(true);
    }
  };

  // Globalne listenery myszy
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Śledzenie pozycji dla linii łączącej
      const pos = screenToCanvas(e.clientX, e.clientY);
      setMouseCanvasPos(pos);

      const pan = panRef.current;
      if (pan) {
        setOffset({ x: e.clientX - pan.startX, y: e.clientY - pan.startY });
        return;
      }

      const drag = dragRef.current;
      if (!drag) return;

      const totalMove = Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY);
      if (!drag.moved && totalMove > 4) {
        drag.moved = true;
        setDraggingNodeId(drag.id);
      }
      if (drag.moved) {
        const dx = (e.clientX - drag.startX) / scaleRef.current;
        const dy = (e.clientY - drag.startY) / scaleRef.current;
        setNodes((prev) =>
          prev.map((n) => (n.id === drag.id ? { ...n, x: drag.nx + dx, y: drag.ny + dy } : n)),
        );
      }
    };

    const handleMouseUp = () => {
      const pan = panRef.current;
      if (pan) {
        panRef.current = null;
        setIsPanning(false);
        return;
      }

      const drag = dragRef.current;
      if (!drag) return;

      const wasMoved = drag.moved;
      const clickedId = drag.id;
      dragRef.current = null;

      if (wasMoved) {
        setDraggingNodeId(null);
        const node = nodesRef.current.find((n) => n.id === clickedId);
        if (node) void saveNode(node);
      } else {
        // Kliknięcie bez przesunięcia -> zaznaczenie notatki
        if (linkingModeRef.current) {
          void handleNodeLinkingClick(clickedId);
        } else {
          selectNode(clickedId);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const resetView = () => {
    setOffset({ x: 0, y: 0 });
    setScale(1);
  };

  const zoomBy = (factor: number) => {
    setScale((prev) => Math.min(3, Math.max(0.2, prev * factor)));
  };

  // --- notatki -------------------------------------------------------------
  const addNoteAt = async (pos: { x: number; y: number }) => {
    const node: ProjektyNode = {
      id: genId(),
      project_id: PROJECT_ID,
      title: '',
      content: '',
      node_type: 'note',
      x: pos.x - NODE_WIDTH / 2,
      y: pos.y - NODE_HEIGHT / 2,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      created_at: new Date().toISOString(),
    };

    cancelEditRef.current = false;
    setNodes((prev) => [...prev, node]);
    nodesRef.current = [...nodesRef.current, node];
    selectNode(node.id);
    editingNodeIdRef.current = node.id;
    setEditingNodeId(node.id);
    editingTextRef.current = '';
    setEditingText('');
    await saveNode(node);
  };

  const createNoteAtCenter = async () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
    await addNoteAt(pos);
  };

  const createNote = async (e: ReactMouseEvent) => {
    const target = e.target as HTMLElement;
    if (target !== canvasRef.current && target.dataset?.canvas !== 'bg') return;
    const pos = screenToCanvas(e.clientX, e.clientY);
    await addNoteAt(pos);
  };

  const onCardMouseDown = (node: ProjektyNode, e: ReactMouseEvent) => {
    e.stopPropagation();
    if (linkingModeRef.current) {
      return;
    }
    dragRef.current = {
      id: node.id,
      startX: e.clientX,
      startY: e.clientY,
      nx: node.x,
      ny: node.y,
      moved: false,
    };
  };

  const onHeaderMouseDown = (node: ProjektyNode, e: ReactMouseEvent) => {
    e.stopPropagation();
    if (linkingModeRef.current) {
      return;
    }
    dragRef.current = {
      id: node.id,
      startX: e.clientX,
      startY: e.clientY,
      nx: node.x,
      ny: node.y,
      moved: false,
    };
  };

  // --- łączenie notatek ----------------------------------------------------
  const handleNodeLinkingClick = async (nodeId: string) => {
    const sourceId = linkSourceIdRef.current;

    if (!sourceId) {
      setLinking(true, nodeId);
      return;
    }

    if (sourceId === nodeId) {
      // Kliknięcie na tę samą notatkę odznacza źródło
      setLinking(true, null);
      return;
    }

    const currentEdges = edgesRef.current;
    const exists = currentEdges.some(
      (e) =>
        (e.source_node_id === sourceId && e.target_node_id === nodeId) ||
        (e.source_node_id === nodeId && e.target_node_id === sourceId),
    );

    if (!exists) {
      const edge: ProjektyEdge = {
        id: genId(),
        project_id: PROJECT_ID,
        source_node_id: sourceId,
        target_node_id: nodeId,
        relation_type: 'depends_on',
        created_at: new Date().toISOString(),
      };

      setEdges((prev) => [...prev, edge]);
      edgesRef.current = [...edgesRef.current, edge];
      void saveEdge(edge);
    }

    // Zakończ łączenie i zaznacz notatkę docelową
    setLinking(false, null);
    selectNode(nodeId);
  };

  // --- render --------------------------------------------------------------
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 text-slate-900 overflow-hidden select-none">
      {/* pasek narzędzi */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-slate-200 bg-white shrink-0 z-20">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-tight text-slate-900">Cortex</span>
          <span className="text-xs text-slate-500">Notatki</span>
        </div>

        {/* Pasek statusu łączenia */}
        {linkingMode && (
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
            <span className="text-xs font-medium text-blue-700">
              {linkSourceId
                ? 'Kliknij notatkę docelową, aby połączyć'
                : 'Kliknij pierwszą notatkę (źródło połączenia)'}
            </span>
            <button
              tabIndex={-1}
              onClick={() => setLinking(false, null)}
              className="ml-1 text-[11px] px-1.5 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 transition-colors"
            >
              Anuluj (Esc)
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            tabIndex={-1}
            onClick={() => void createNoteAtCenter()}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700 transition-colors shadow-sm cursor-pointer"
          >
            + Nowa notatka
          </button>

          <div className="flex items-center gap-1 ml-1">
            <button
              tabIndex={-1}
              onClick={() => zoomBy(1 / 1.1)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              title="Pomniejsz"
            >
              −
            </button>
            <button
              tabIndex={-1}
              onClick={resetView}
              className="h-7 px-2 rounded-md text-xs tabular-nums text-slate-500 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              title="Przywróć 100%"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              tabIndex={-1}
              onClick={() => zoomBy(1.1)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              title="Powiększ"
            >
              +
            </button>
          </div>

          <button
            tabIndex={-1}
            onClick={() => setShowHelp((v) => !v)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            title="Skróty klawiszowe"
          >
            ?
          </button>
        </div>
      </header>

      {/* obszar roboczy */}
      <div
        ref={canvasRef}
        data-testid="canvas-container"
        className="flex-1 relative overflow-hidden bg-slate-50"
        style={{ cursor: isPanning || draggingNodeId ? 'grabbing' : linkingMode ? 'crosshair' : 'default' }}
        onMouseDown={onCanvasMouseDown}
        onDoubleClick={createNote}
      >
        {/* tło z siatką */}
        <div
          data-canvas="bg"
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.14) 1px, transparent 0)',
            backgroundSize: `${28 * scale}px ${28 * scale}px`,
            backgroundPosition: `${offset.x}px ${offset.y}px`,
          }}
        />

        {/* świat (przesuwany i skalowany) */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            pointerEvents: 'none',
          }}
        >
          <svg
            className="absolute"
            style={{ top: 0, left: 0, width: 10000, height: 10000, pointerEvents: 'none', overflow: 'visible' }}
          >
            <defs>
              <marker
                id="cortex-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563eb" />
              </marker>
              <marker
                id="cortex-arrow-hover"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
              </marker>
            </defs>

            {/* Krawędzie łączące */}
            {edges.map((edge) => {
              const src = nodes.find((n) => n.id === edge.source_node_id);
              const tgt = nodes.find((n) => n.id === edge.target_node_id);
              if (!src || !tgt) return null;
              const s = centerOf(src);
              const t = centerOf(tgt);
              const midX = (s.x + t.x) / 2;
              const midY = (s.y + t.y) / 2;

              return (
                <g
                  key={edge.id}
                  className="group/edge cursor-pointer pointer-events-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteEdge(edge.id);
                  }}
                >
                  {/* Szerszy niewidzialny obszar klikalny */}
                  <line
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke="transparent"
                    strokeWidth={16}
                  />
                  {/* Widoczna linia połączenia */}
                  <line
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke="rgba(37, 99, 235, 0.55)"
                    strokeWidth={2.5}
                    markerEnd="url(#cortex-arrow)"
                    className="group-hover/edge:stroke-red-500 group-hover/edge:stroke-[3px] transition-all"
                  />
                  {/* Przycisk usunięcia na środku linii przy hover */}
                  <g
                    className="opacity-0 group-hover/edge:opacity-100 transition-opacity"
                    transform={`translate(${midX}, ${midY})`}
                  >
                    <circle r={10} fill="#ef4444" className="shadow-sm" />
                    <path
                      d="M -3 -3 L 3 3 M 3 -3 L -3 3"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                  </g>
                </g>
              );
            })}

            {/* Dynamiczna linia podglądu podczas łączenia */}
            {linkingMode && linkSourceId && mouseCanvasPos && (() => {
              const src = nodes.find((n) => n.id === linkSourceId);
              if (!src) return null;
              const s = centerOf(src);
              return (
                <line
                  x1={s.x}
                  y1={s.y}
                  x2={mouseCanvasPos.x}
                  y2={mouseCanvasPos.y}
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  markerEnd="url(#cortex-arrow)"
                  className="animate-pulse"
                />
              );
            })()}
          </svg>

          {/* Karty notatek */}
          {nodes.map((node) => {
            const isSource = linkSourceId === node.id;
            const isSelected = selectedNodeId === node.id;
            const isEditing = editingNodeId === node.id;

            let cardStyles = 'border-slate-200 hover:border-slate-300 shadow-sm';
            if (linkingMode) {
              if (isSource) {
                cardStyles = 'border-blue-600 ring-2 ring-blue-500 shadow-lg shadow-blue-500/20';
              } else {
                cardStyles = 'border-blue-300 hover:border-blue-500 hover:ring-2 hover:ring-blue-400 cursor-pointer shadow-md';
              }
            } else if (isEditing) {
              cardStyles = 'border-blue-500 ring-2 ring-blue-500/40 shadow-lg';
            } else if (isSelected) {
              cardStyles = 'border-blue-500 ring-2 ring-blue-500 shadow-md';
            }

            return (
              <div
                key={node.id}
                tabIndex={0}
                data-testid={`note-card-${node.id}`}
                data-node-id={node.id}
                data-selected={isSelected}
                data-editing={isEditing}
                data-linking-source={isSource}
                className={`absolute rounded-lg border bg-white group ${cardStyles} transition-all pointer-events-auto outline-none`}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.width || NODE_WIDTH,
                  minHeight: node.height || NODE_HEIGHT,
                  zIndex: draggingNodeId === node.id ? 100 : isSelected ? 50 : 1,
                  cursor: linkingMode ? 'pointer' : 'default',
                }}
                onClick={
                  linkingMode
                    ? (e) => {
                        e.stopPropagation();
                        void handleNodeLinkingClick(node.id);
                      }
                    : undefined
                }
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (!linkingModeRef.current) {
                    startEditing(node.id);
                  }
                }}
                onMouseDown={(e) => onCardMouseDown(node, e)}
              >
                {/* Pasek uchwytu */}
                <div
                  className="flex items-center justify-between bg-slate-100/90 border-b border-slate-200/80 rounded-t-lg cursor-grab active:cursor-grabbing px-2"
                  style={{ height: NODE_HEADER_HEIGHT }}
                  onMouseDown={(e) => onHeaderMouseDown(node, e)}
                >
                  <span className="flex items-center">
                    <GripIcon />
                  </span>
                  <div className="flex items-center gap-1">
                    {linkingMode && isSource && (
                      <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">
                        Źródło
                      </span>
                    )}
                    <button
                      tabIndex={-1}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteNote(node.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 h-5 w-5 flex items-center justify-center rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Usuń notatkę"
                      aria-label="Usuń notatkę"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                </div>

                {/* Treść notatki */}
                {isEditing ? (
                  <textarea
                    autoFocus
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={() => void commitEditing()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        e.stopPropagation();
                        const currentNodeId = node.id;
                        void commitEditing(currentNodeId, e.currentTarget.value).then(() => {
                          selectNode(currentNodeId);
                          setLinking(true, currentNodeId);
                        });
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        cancelEditing();
                      } else if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        void commitEditing();
                      }
                    }}
                    className="block w-full resize-none bg-transparent text-sm text-slate-900 leading-relaxed px-3 py-2.5 outline-none placeholder:text-slate-400"
                    style={{ height: NODE_BODY_HEIGHT }}
                    placeholder="Wpisz treść… (Tab: połącz, Enter: zapisz)"
                    data-ignore-drag="true"
                  />
                ) : (
                  <div
                    onClick={(e) => {
                      if (!linkingModeRef.current && isSelected) {
                        e.stopPropagation();
                        startEditing(node.id);
                      }
                    }}
                    className="text-sm text-slate-900 whitespace-pre-wrap break-words px-3.5 py-3 cursor-text"
                    style={{ minHeight: NODE_BODY_HEIGHT }}
                  >
                    {node.content || <span className="text-slate-400 italic">Kliknij dwukrotnie, aby wpisać treść…</span>}
                  </div>
                )}
              </div>
            );
          })}

          {/* Pusty stan */}
          {loaded && nodes.length === 0 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <p className="text-sm font-semibold text-slate-600">Twoja przestrzeń notatek</p>
              <p className="mt-1 text-xs text-slate-500">Kliknij dwukrotnie w dowolnym miejscu, aby utworzyć notatkę</p>
            </div>
          )}
        </div>

        {/* Błąd wczytywania */}
        {loadError && (
          <div className="absolute inset-0 z-30 bg-slate-100/90 flex items-center justify-center">
            <div className="max-w-sm px-5 py-4 rounded-md bg-white border border-red-200 text-center shadow-lg">
              <p className="text-sm font-medium text-slate-900">Nie udało się wczytać danych</p>
              <p className="mt-1 text-xs text-red-600 break-words">{loadError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Stopka ze skrótami */}
      <footer className="h-9 flex items-center justify-center gap-5 border-t border-slate-200 bg-white text-xs text-slate-600 shrink-0 z-20">
        <span>Dwuklik — nowa notatka / edycja</span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded border border-slate-300 bg-slate-100 font-mono text-[11px] font-medium text-slate-700">Tab</kbd>{' '}
          — połącz notatkę
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded border border-slate-300 bg-slate-100 font-mono text-[11px] font-medium text-slate-700">Enter</kbd>{' '}
          — edytuj / zatwierdź
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded border border-slate-300 bg-slate-100 font-mono text-[11px] font-medium text-slate-700">Esc</kbd>{' '}
          — anuluj
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded border border-slate-300 bg-slate-100 font-mono text-[11px] font-medium text-slate-700">Del</kbd>{' '}
          — usuń
        </span>
      </footer>
    </div>
  );
}