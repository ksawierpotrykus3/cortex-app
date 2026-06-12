import React, { useState, useRef, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from "react";
import { Plus, ChevronDown, Activity, Settings2, ZoomIn, ZoomOut, Maximize, MoveRight, Download, Trash2, X, Image as ImageIcon, Loader2, Expand } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { NexusNode, NexusLink, ImageAttachment, ThoughtMarker } from "../types";
import { generateAIExport, downloadFile } from "../exportEngine";
import { useClipboardPaste } from '../hooks/useClipboardPaste';
import { analyzeImageWithGemini, GeminiVisionResult } from '../utils/geminiVision';
import { uid } from '../utils/ids';
import { compressImage, fileToDataURL } from '../utils/image';

import { ImageAttachmentsUI } from "./ImageAttachmentsUI";

export interface NexusCanvasHandle {
  panToProject: (projectId: string) => void;
}

export const NexusCanvas = forwardRef<NexusCanvasHandle, React.ComponentProps<typeof NexusCanvasInner>>((props, ref) => {
  const panToProjectRef = useRef<(projectId: string) => void>(() => {});

  useImperativeHandle(ref, () => ({
    panToProject: (projectId: string) => {
      panToProjectRef.current(projectId);
    }
  }));

  return <NexusCanvasInner {...props} />;
});

NexusCanvas.displayName = 'NexusCanvas';

interface NexusCanvasInnerProps {
  nodes: NexusNode[];
  setNodes: React.Dispatch<React.SetStateAction<NexusNode[]>>;
  links: NexusLink[];
  setLinks: React.Dispatch<React.SetStateAction<NexusLink[]>>;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  selectedNodeIds?: string[];
  setSelectedNodeIds?: (ids: string[]) => void;
  expandedProjects?: Record<string, boolean>;
  draggedProject?: string | null;
  onDraggedProjectRelease?: () => void;
  onProjectCenter?: (projectId: string) => void;
  panToProjectRef?: React.MutableRefObject<(projectId: string) => void>;
}

function NexusCanvasInner({ 
  panToProjectRef,
  nodes, 
  setNodes,
  links,
  setLinks,
  selectedNodeId,
  setSelectedNodeId,
  selectedNodeIds = [],
  setSelectedNodeIds,
  expandedProjects = {},
  draggedProject,
  onDraggedProjectRelease,
  onProjectCenter
}: {
  panToProjectRef?: React.MutableRefObject<(projectId: string) => void>;
  nodes: NexusNode[];
  setNodes: React.Dispatch<React.SetStateAction<NexusNode[]>>;
  links: NexusLink[];
  setLinks: React.Dispatch<React.SetStateAction<NexusLink[]>>;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  selectedNodeIds?: string[];
  setSelectedNodeIds?: (ids: string[]) => void;
  expandedProjects?: Record<string, boolean>;
  draggedProject?: string | null;
  onDraggedProjectRelease?: () => void;
  onProjectCenter?: (projectId: string) => void;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isPanModifierPressed, setIsPanModifierPressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [nodeHeights, setNodeHeights] = useState<Record<string, number>>({});
  const [draggedNode, setDraggedNode] = useState<{ id: string, ids?: string[], startX?: number, startY?: number } | null>(null);

  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredLink, setHoveredLink] = useState<number | null>(null);

  // --- Rectangle select state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectStart, setSelectStart] = useState({ x: 0, y: 0 });
  const [selectEnd, setSelectEnd] = useState({ x: 0, y: 0 });

  // --- Teleport to project ---
  const panToProject = useCallback((projectId: string) => {
    const projectNodes = nodes.filter(n => (n.projectId === projectId || (!n.projectId && projectId === 'Uncategorized')));
    if (!projectNodes.length) return;
    const cx = projectNodes.reduce((s, n) => s + n.x + (n.width || 256) / 2, 0) / projectNodes.length;
    const cy = projectNodes.reduce((s, n) => s + n.y + (nodeHeights[n.id] || 150) / 2, 0) / projectNodes.length;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const newScale = Math.max(scale, 0.5);
    setScale(newScale);
    setOffset({
      x: rect.width / 2 - cx * newScale,
      y: rect.height / 2 - cy * newScale,
    });
  }, [nodes, nodeHeights, scale]);

  // --- Clipboard paste handler ---
  const handleImagePaste = useCallback(async (imageData: { dataUrl: string; mimeType: string; name: string }) => {
    const tempId = uid();
    
    // Compress image before storing
    const compressedDataUrl = await compressImage(imageData.dataUrl, 1600);

    // 1. Stwórz node z obrazem (bez Gemini najpierw — instant feedback)
    const newNode: NexusNode = {
      id: tempId,
      title: `Screenshot ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      content: '',
      x: -offset.x / scale + 100, // pojawia się widocznie na ekranie
      y: -offset.y / scale + 100,
      accent: 'purple',
      projectId: 'Screenshots',
      imageAttachments: [{
        id: uid(),
        dataUrl: compressedDataUrl,
        mimeType: imageData.mimeType,
        isProcessing: true,
        createdAt: new Date().toISOString(),
      }],
    };

    setNodes(prev => [...prev, newNode]);
    if(setSelectedNodeIds) setSelectedNodeIds([tempId]);

    // 2. Wyślij do Gemini (w tle, nie blokuj UI)
    try {
      const result: GeminiVisionResult = await analyzeImageWithGemini(compressedDataUrl);
      
      // 3. Zaktualizuj node z odpowiedzią Gemini
      setNodes(prev => prev.map(n => {
        if (n.id !== tempId) return n;
        return {
          ...n,
          content: result.text.length > 50 
            ? result.text 
            : `Obraz załadowany.\n\n${result.text}`,
          imageAttachments: (n.imageAttachments || []).map((att, idx) => 
            idx === 0
              ? { ...att, isProcessing: false, geminiResponse: result.raw }
              : att
          ),
        };
      }));
    } catch (err: any) {
      // 4. Error — usuń isProcessing, pokaż błąd
      setNodes(prev => prev.map(n => {
        if (n.id !== tempId) return n;
        return {
          ...n,
          content: `⚠ Błąd analizy obrazu: ${err.message}\n\nSprawdź czy masz ustawiony klucz Gemini w Settings.`,
          imageAttachments: (n.imageAttachments || []).map((att, idx) =>
            idx === 0
              ? { ...att, isProcessing: false, geminiError: err.message }
              : att
          ),
        };
      }));
    }
  }, [setNodes, setSelectedNodeIds, offset, scale]);

  useClipboardPaste(handleImagePaste);

  // --- Drag and Drop from File System ---
  useEffect(() => {
    const handleDrop = async (e: DragEvent) => {
      // If dropping exactly on an input/textarea, let it handle it
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }
      
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) {
          const dataUrl = await fileToDataURL(file);
          await handleImagePaste({ dataUrl, mimeType: file.type, name: file.name });
        }
      }
    };
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    
    // We bind to document so we can drop anywhere
    document.addEventListener('drop', handleDrop);
    document.addEventListener('dragover', handleDragOver);
    return () => {
      document.removeEventListener('drop', handleDrop);
      document.removeEventListener('dragover', handleDragOver);
    };
  }, [handleImagePaste]);

  // --- NAJSILNIEJSZA BLOKADA: Śledź czy Shift jest wciśnięty i zablokuj WSZYSTKO
  const [shiftIsPressed, setShiftIsPressed] = useState(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setShiftIsPressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setShiftIsPressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  
  const stateRef = useRef({
    isPanning, draggedNode, linkingFrom, offset, scale, selectedNodeId, nodes, selectedNodeIds, draggedProject, isSelecting, selectStart, selectEnd, shiftIsPressed
  });

  useEffect(() => {
    stateRef.current = { isPanning, draggedNode, linkingFrom, offset, scale, selectedNodeId, nodes, selectedNodeIds, draggedProject, isSelecting, selectStart, selectEnd, shiftIsPressed };
  }, [isPanning, draggedNode, linkingFrom, offset, scale, selectedNodeId, nodes, selectedNodeIds, draggedProject, isSelecting, selectStart, selectEnd, shiftIsPressed]);

  useEffect(() => {
    const handleBlockAll = (e: MouseEvent | PointerEvent | Event) => {
      if ('shiftKey' in e && e.shiftKey) {
        e.preventDefault(); // TYLKO ZATRZYMAJ DOMYŚLNĄ AKCJĘ, A NIE PROPAGACJĘ!
      }
    };
    // Zawsze zarejestruj listenery, nie tylko gdy shiftIsPressed!
    const events = [
      'mousedown', 'mouseup', 'click', 'auxclick', 'dblclick',
      'pointerdown', 'pointerup', 'pointerclick',
      'dragstart', 'drag', 'dragenter', 'dragleave', 'dragover', 'dragend', 'drop',
      'contextmenu'
    ];
    events.forEach(evt => {
      window.addEventListener(evt, handleBlockAll, { capture: true, passive: false });
    });
    return () => {
      events.forEach(evt => {
        window.removeEventListener(evt, handleBlockAll, { capture: true });
      });
    };
  }, [shiftIsPressed]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = e.target as HTMLElement;
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA' || activeElement?.tagName === 'SELECT' || activeElement?.isContentEditable;
      
      if (e.code === 'Space' && !isInput) {
          setIsPanModifierPressed(true);
          e.preventDefault();
      }
      if (e.key === 'Escape') {
        setLinkingFrom(null);
      }
      if (e.key === 'Tab') {
        if (isInput) return;
        e.preventDefault();
        setLinkingFrom(prev => prev ? null : (selectedNodeId ? selectedNodeId : null));
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const activeElement = e.target as HTMLElement;
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA' || activeElement?.tagName === 'SELECT' || activeElement?.isContentEditable;
      if (e.code === 'Space' && !isInput) {
        setIsPanModifierPressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [selectedNodeId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleNativeWheel = (e: WheelEvent) => {
       e.preventDefault();
       const { scale: prevScale, offset: prevOffset } = stateRef.current;
       
       const factor = Math.exp(-e.deltaY * 0.005);
       const newScale = Math.min(Math.max(0.1, prevScale * factor), 4);
       
       if (newScale !== prevScale) {
           const el = containerRef.current;
           if (el) {
               const rect = el.getBoundingClientRect();
               const mx = e.clientX - rect.left;
               const my = e.clientY - rect.top;
               
               setOffset({
                   x: mx - (mx - prevOffset.x) * newScale / prevScale,
                   y: my - (my - prevOffset.y) * newScale / prevScale,
               });
           }
           setScale(newScale);
       }
     };

    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleNativeWheel);
  }, []);

  // Global Pointer Listeners for linking & dragging
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      const { isPanning, draggedNode, linkingFrom, offset, scale, selectedNodeIds, draggedProject, isSelecting } = stateRef.current;
      
      if (isSelecting) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setSelectEnd({
            x: (e.clientX - rect.left - offset.x) / scale,
            y: (e.clientY - rect.top - offset.y) / scale
          });
        }
        return;
      }

      if (linkingFrom && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setMousePos({
              x: (e.clientX - rect.left - offset.x) / scale,
              y: (e.clientY - rect.top - offset.y) / scale
          });
      }

      if (isPanning) {
        setOffset(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
      } else if (draggedNode && !linkingFrom) {
        const dx = e.movementX / scale;
        const dy = e.movementY / scale;
        const idsToMove = (draggedNode.ids && draggedNode.ids.length > 0) ? draggedNode.ids : [draggedNode.id];
        setNodes(prev => prev.map(n => {
          if (idsToMove.includes(n.id)) {
            return { ...n, x: n.x + dx, y: n.y + dy };
          }
          return n;
        }));
      } else if (draggedProject && !linkingFrom) {
        const dx = e.movementX / scale;
        const dy = e.movementY / scale;
        setNodes(prev => prev.map(n => {
          if (n.projectId === draggedProject || (!n.projectId && draggedProject === 'Uncategorized')) {
            return { ...n, x: n.x + dx, y: n.y + dy };
          }
          return n;
        }));
      }
    };

    const handleGlobalPointerUp = (e: PointerEvent) => {
      const { linkingFrom, draggedProject, isSelecting, selectStart, selectEnd, nodes } = stateRef.current;
      
      if (isSelecting) {
        const x1 = Math.min(selectStart.x, selectEnd.x);
        const x2 = Math.max(selectStart.x, selectEnd.x);
        const y1 = Math.min(selectStart.y, selectEnd.y);
        const y2 = Math.max(selectStart.y, selectEnd.y);
        
        const selected = nodes.filter(n => {
          const w = n.width || 256;
          const h = nodeHeights[n.id] || 150;
          return (n.x + w > x1 && n.x < x2 && n.y + h > y1 && n.y < y2);
        }).map(n => n.id);
        
         if (e.shiftKey) {
           // merge selected with existing selectedNodeIds
           let current: string[] = [];
           if (setSelectedNodeIds) {
             current = selectedNodeIds || [];
           } else if (selectedNodeId) {
             current = [selectedNodeId];
           }
           const merged = Array.from(new Set([...current, ...selected]));
           if (setSelectedNodeIds) setSelectedNodeIds(merged);
           else setSelectedNodeId(merged.length === 0 ? null : merged[0]);
         } else {
           if (setSelectedNodeIds) setSelectedNodeIds(selected);
           else setSelectedNodeId(selected.length > 0 ? selected[0] : null);
         }
         setIsSelecting(false);
         return;
      }

      setIsPanning(false);
      setDraggedNode(null);
      if (draggedProject && onDraggedProjectRelease) {
         onDraggedProjectRelease();
      }
      
      if (linkingFrom) {
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const targetNodeEl = el?.closest('[data-node-id]');
          if (targetNodeEl) {
              const targetId = targetNodeEl.getAttribute('data-node-id');
              if (targetId && targetId !== linkingFrom) {
                  // Check if link already exists
                  setLinks(prev => {
                      const exists = prev.find(l => (l.source === linkingFrom && l.target === targetId) || (l.source === targetId && l.target === linkingFrom));
                      if (!exists) {
                          return [...prev, { source: linkingFrom, target: targetId }];
                      }
                      return prev;
                  });
                  setLinkingFrom(null); // Finished linking!
              } else if (targetId === linkingFrom) {
                  // User just clicked the handle, keep linkingFrom active for click-to-link!
              } else {
                  setLinkingFrom(null);
              }
          } else {
              // Missed everything
              setLinkingFrom(null);
          }
      }
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    
    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
    };
  }, [setNodes, setLinks]);

  // --- Ekran na świat
  const screenToWorld = React.useCallback((sx: number, sy: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (sx - rect.left - offset.x) / scale, y: (sy - rect.top - offset.y) / scale };
  }, [offset, scale]);

  const handlePointerDown = (e: React.PointerEvent) => {
     if (e.shiftKey && containerRef.current) {
      const target = e.target as Element;
      const nodeElement = target.closest('[data-node-id]');
      if (nodeElement) {
        // Clicked on a node with shift
        const nodeId = nodeElement.getAttribute('data-node-id');
        if (!nodeId) return; // should not happen
        e.preventDefault();
        e.stopPropagation();
        // Toggle node in selection
        let newSelection: string[] = [];
        if (setSelectedNodeIds) {
          const current = selectedNodeIds || [];
          if (current.includes(nodeId)) {
            newSelection = current.filter(id => id !== nodeId);
          } else {
            newSelection = [...current, nodeId];
          }
          setSelectedNodeIds(newSelection);
        } else {
          // fallback to single selection
          const current = selectedNodeId ? [selectedNodeId] : [];
          if (current.includes(nodeId)) {
            newSelection = []; // removing the only selected node
          } else {
            newSelection = [nodeId];
          }
          setSelectedNodeId(newSelection.length === 0 ? null : newSelection[0]);
        }
        // Set draggedNode for dragging the selection
        setDraggedNode({ id: nodeId, ids: newSelection });
        return;
      } else {
        // Clicked on empty space with shift -> start rectangle select
        e.preventDefault();
        e.stopPropagation();
        const worldPos = screenToWorld(e.clientX, e.clientY);
        setSelectStart(worldPos);
        setSelectEnd(worldPos);
        setIsSelecting(true);
        return;
      }
    }
    if (isPanModifierPressed || e.button === 1) { // Space or Middle click
      setIsPanning(true);
    } else {
      if (containerRef.current && containerRef.current.contains(e.target as Element)) {
        if (setSelectedNodeIds) setSelectedNodeIds([]);
        else setSelectedNodeId(null);
        setLinkingFrom(null);
        setIsPanning(true);
      }
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (e.target !== containerRef.current && (e.target as Element).tagName !== 'svg') return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = (e.clientX - rect.left - offset.x) / scale - 128;
    const y = (e.clientY - rect.top - offset.y) / scale - 100; 

    // Check if click is inside a project envelope
    const clickWorldX = (e.clientX - rect.left - offset.x) / scale;
    const clickWorldY = (e.clientY - rect.top - offset.y) / scale;
    const clickedEnvelope = projectEnvelopes.find(env => 
      env && clickWorldX >= env.x && clickWorldX <= env.x + env.width && clickWorldY >= env.y && clickWorldY <= env.y + env.height
    );

    const newNode: NexusNode = {
      id: uid(),
      title: clickedEnvelope ? "New Note" : "New Objective",
      content: "",
      x,
      y,
      accent: "none",
      projectId: clickedEnvelope ? clickedEnvelope.id : "default_namespace"
    };
    
    setNodes([...nodes, newNode]);
    if (setSelectedNodeIds) setSelectedNodeIds([newNode.id]);
    else setSelectedNodeId(newNode.id);
  };

  const generateManhattanPath = (source: NexusNode, target: NexusNode | { x: number, y: number }) => {
    const CARD_WIDTH = source.width || 256; 
    const startX = source.x + CARD_WIDTH - 2;
    const startY = source.y + 31;
    
    const isNode = 'title' in target;
    const endX = isNode ? target.x : target.x;
    const endY = isNode ? target.y + 29 : target.y; 

    // Always use Manhattan routing (90-degree corners)
    if (endX > startX + 40) {
        // Target is directly to the right
        const midX = startX + (endX - startX) / 2;
        return `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
    } else {
        // Target is behind, left, or underneath the source
        const midY = startY + (endY - startY) / 2 + 15; // +15 to avoid horizontal overlaps
        const clearX1 = startX + 30;
        const clearX2 = endX - 30;
        // M -> start -> right -> down -> left -> up/down -> right -> end
        return `M ${startX} ${startY} L ${clearX1} ${startY} L ${clearX1} ${midY} L ${clearX2} ${midY} L ${clearX2} ${endY} L ${endX} ${endY}`;
    }
  };

  const visibleNodes = useMemo(() => {
    return nodes.filter(n => expandedProjects[n.projectId || 'Uncategorized'] !== false);
  }, [nodes, expandedProjects]);

  const selectionRect = useMemo(() => {
    if (!isSelecting) return null;
    return {
      x: Math.min(selectStart.x, selectEnd.x),
      y: Math.min(selectStart.y, selectEnd.y),
      width: Math.abs(selectStart.x - selectEnd.x),
      height: Math.abs(selectStart.y - selectEnd.y)
    };
  }, [isSelecting, selectStart, selectEnd]);

  const projectEnvelopes = useMemo(() => {
    const groups: Record<string, NexusNode[]> = {};
    visibleNodes.forEach(n => {
      if (n.projectId) {
        if (!groups[n.projectId]) groups[n.projectId] = [];
        groups[n.projectId].push(n);
      }
    });

    return Object.entries(groups).map(([projectId, groupedNodes]) => {
      if (groupedNodes.length === 0) return null;
      
      const paddingX = 40;
      const paddingY = 60;
      
      const minX = Math.min(...groupedNodes.map(n => n.x)) - paddingX;
      const maxX = Math.max(...groupedNodes.map(n => n.x + (n.width || 256))) + paddingX;
      
      const minY = Math.min(...groupedNodes.map(n => n.y)) - paddingY;
      const maxY = Math.max(...groupedNodes.map(n => n.y + (nodeHeights[n.id] || 150))) + paddingY;

      return {
        id: projectId,
        title: projectId.replace(/_/g, ' '),
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      };
    }).filter(Boolean);
  }, [nodes]);

  const allProjects = useMemo(() => Array.from(new Set(nodes.map(n => n.projectId).filter(Boolean))) as string[], [nodes]);

  const handleExport = () => {
    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    const selectedEdges = links.filter(l => selectedNodeIds.includes(l.source) || selectedNodeIds.includes(l.target));
    const exportData = generateAIExport(selectedNodes, selectedEdges, "");
        
    downloadFile(exportData, `nexus_nodes_export_${new Date().toISOString().split('T')[0]}.json`);
    if (setSelectedNodeIds) setSelectedNodeIds([]);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      e.preventDefault();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`flex-1 h-[calc(100vh-3.5rem)] relative overflow-hidden touch-none nexus-grid outline-none select-none transition-colors ${isPanModifierPressed || isPanning ? 'cursor-grab active:cursor-grabbing' : ''}`}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      tabIndex={0}
    >
      <motion.div 
        className="absolute inset-0 transform-gpu pointer-events-none origin-top-left"
        animate={{ x: offset.x, y: offset.y, scale }}
        transition={{ type: "tween", duration: 0 }}
      >
        <AnimatePresence>
          {projectEnvelopes.map((env) => env && (
             <motion.div 
               key={env.id}
               initial={{ opacity: 0 }}
               animate={{ opacity: 1, x: env.x, y: env.y, width: env.width, height: env.height }}
               transition={{ type: "spring", bounce: 0, duration: 0.5 }}
               className="absolute top-0 left-0 border-2 border-dashed border-[rgb(var(--border))] rounded-3xl pointer-events-none bg-[rgb(var(--border))]/10"
             >
               <div className="absolute -top-3 left-6 bg-[rgb(var(--background))] px-3 py-0.5 text-xs font-semibold text-[rgb(var(--accent))] border border-[rgb(var(--border))] rounded-full pointer-events-auto capitalize shadow-sm z-0">
                 {env.title}
               </div>
             </motion.div>
          ))}
        </AnimatePresence>

        <svg
          className="absolute inset-0 w-full h-full overflow-visible stroke-[rgb(var(--text-muted))]"
          style={{ zIndex: 5, pointerEvents: 'none' }}
        >
          {links.map((link, idx) => {
            const source = visibleNodes.find(n => n.id === link.source);
            const target = visibleNodes.find(n => n.id === link.target);
            if (!source || !target) return null;
            const d = generateManhattanPath(source, target);
            return (
              <g key={idx}>
                {/* Invisible wide hit area for clicking */}
                <path
                  d={d}
                  fill="none"
                  strokeWidth="14"
                  stroke="transparent"
                  style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onClick={() => setLinks(prev => prev.filter(l => !(l.source === link.source && l.target === link.target)))}
                  onMouseEnter={() => setHoveredLink(idx)}
                  onMouseLeave={() => setHoveredLink(null)}
                />
                {/* Visible line */}
                <motion.path
                  d={d}
                  fill="none"
                  strokeWidth={hoveredLink === idx ? "3" : "2"}
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  className={hoveredLink === idx ? "stroke-red-400 opacity-80" : "opacity-30 stroke-[rgb(var(--text-muted))]"}
                />
              </g>
            );
          })}
          {linkingFrom && (() => {
               const source = visibleNodes.find(n => n.id === linkingFrom);
               if (source) {
                   return (
                       <path
                         d={generateManhattanPath(source, mousePos)}
                         fill="none"
                         stroke="rgb(var(--accent))"
                         strokeWidth="2"
                         strokeLinejoin="round"
                         strokeDasharray="4,4"
                         className="opacity-70 pointer-events-none"
                       />
                   );
               }
               return null;
          })()}
          {selectionRect && (
            <rect
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              fill="rgba(251, 191, 36, 0.15)"
              stroke="rgba(251, 191, 36, 0.9)"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          )}
        </svg>

        {visibleNodes.map(node => (
          <NodeCard
            key={node.id}
            node={node}
            scale={scale}
            isSelected={selectedNodeIds.includes(node.id)}
            isDragging={draggedNode?.id === node.id}
            onSelect={(e) => {
                e.stopPropagation();
                if (e.shiftKey) e.preventDefault(); // Dodaj to
                if (linkingFrom && linkingFrom !== node.id) {
                    setLinks(prev => {
                        const exists = prev.find(l => (l.source === linkingFrom && l.target === node.id) || (l.source === node.id && l.target === linkingFrom));
                        if (!exists) {
                            return [...prev, { source: linkingFrom, target: node.id }];
                        }
                        return prev;
                    });
                    setLinkingFrom(null);
                    return;
                }
                
                if (e.shiftKey) {
                    if (setSelectedNodeIds) {
                        const current = selectedNodeIds;
                        const newSelection = current.includes(node.id) ? current.filter(id => id !== node.id) : [...current, node.id];
                        setSelectedNodeIds(newSelection);
                    } else setSelectedNodeId(node.id);
                } else {
                    if (setSelectedNodeIds) setSelectedNodeIds([node.id]);
                }
            }}
            onDragStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.shiftKey) e.preventDefault(); // Dodaj to
                if (linkingFrom) {
                    if (linkingFrom !== node.id) {
                        setLinks(prev => {
                            const exists = prev.find(l => (l.source === linkingFrom && l.target === node.id) || (l.source === node.id && l.target === linkingFrom));
                            if (!exists) {
                                return [...prev, { source: linkingFrom, target: node.id }];
                            }
                            return prev;
                        });
                    }
                    setLinkingFrom(null);
                    return;
                }
                
                let newSelection = selectedNodeIds;
                
                if (e.shiftKey) {
                    if (setSelectedNodeIds) {
                        const current = selectedNodeIds;
                        newSelection = current.includes(node.id) ? current.filter(id => id !== node.id) : [...current, node.id];
                        setSelectedNodeIds(newSelection);
                    } else setSelectedNodeId(node.id);
                } else if (!selectedNodeIds.includes(node.id)) {
                    newSelection = [node.id];
                    if (setSelectedNodeIds) setSelectedNodeIds(newSelection);
                }
                
                if (!setSelectedNodeIds) setSelectedNodeId(node.id);
                if (newSelection.includes(node.id)) {
                    setDraggedNode({ id: node.id, ids: newSelection });
                }
            }}
            onLinkStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.shiftKey) e.preventDefault(); // Dodaj to
                if (linkingFrom) {
                    if (linkingFrom !== node.id) {
                        setLinks(prev => {
                            const exists = prev.find(l => (l.source === linkingFrom && l.target === node.id) || (l.source === node.id && l.target === linkingFrom));
                            if (!exists) {
                                return [...prev, { source: linkingFrom, target: node.id }];
                            }
                            return prev;
                        });
                    }
                    setLinkingFrom(null);
                } else {
                    setLinkingFrom(node.id);
                    if (containerRef.current) {
                        const rect = containerRef.current.getBoundingClientRect();
                        setMousePos({
                            x: (e.clientX - rect.left - offset.x) / scale,
                            y: (e.clientY - rect.top - offset.y) / scale
                        });
                    }
                }
            }}
            onLinkComplete={(e) => {
                if (linkingFrom && linkingFrom !== node.id) {
                    e.preventDefault();
                    e.stopPropagation();
                    setLinks(prev => {
                        const exists = prev.find(l => (l.source === linkingFrom && l.target === node.id) || (l.source === node.id && l.target === linkingFrom));
                        if (!exists) {
                            return [...prev, { source: linkingFrom, target: node.id }];
                        }
                        return prev;
                    });
                    setLinkingFrom(null);
                }
            }}
            onUpdateTitle={(newTitle) => {
                setNodes(nodes.map(n => n.id === node.id ? { ...n, title: newTitle } : n));
            }}
            onAddAnnotation={(ann) => {
                setNodes(nodes.map(n => {
                   if (n.id === node.id) {
                       return { ...n, annotations: [...(n.annotations || []), ann] };
                   }
                   return n;
                }));
            }}
            onUpdateFont={(font) => {
                setNodes(nodes.map(n => n.id === node.id ? { ...n, fontFamily: font } : n));
            }}
            onResize={(width) => {
                setNodes(nodes.map(n => n.id === node.id ? { ...n, width } : n));
            }}
            onHeightChange={(height) => {
                setNodeHeights(prev => prev[node.id] === height ? prev : { ...prev, [node.id]: height });
            }}
            onUpdateNode={(id, updates) => {
                setNodes(nodes.map(n => n.id === id ? { ...n, ...updates } : n));
            }}
          />
        ))}
      </motion.div>
      <div className="absolute bottom-6 right-6 flex items-center bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg shadow-lg overflow-hidden z-10 p-1 gap-1">
        <button 
           onClick={() => {
               const newScale = Math.min(scale + 0.2, 3);
               if (newScale !== scale && containerRef.current) {
                   const rect = containerRef.current.getBoundingClientRect();
                   const mx = rect.width / 2;
                   const my = rect.height / 2;
                   setOffset(prev => ({
                       x: mx - (mx - prev.x) * newScale / scale,
                       y: my - (my - prev.y) * newScale / scale,
                   }));
                   setScale(newScale);
               }
           }}
           className="p-1.5 hover:bg-[rgb(var(--border))] rounded transition-colors text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))]"
           title="Zoom In"
        >
           <ZoomIn className="w-4 h-4" />
        </button>
        <span className="text-[11px] font-mono font-medium text-[rgb(var(--text-muted))] w-12 text-center pointer-events-none">
           {Math.round(scale * 100)}%
        </span>
        <button 
           onClick={() => {
               const newScale = Math.max(scale - 0.2, 0.1);
               if (newScale !== scale && containerRef.current) {
                   const rect = containerRef.current.getBoundingClientRect();
                   const mx = rect.width / 2;
                   const my = rect.height / 2;
                   setOffset(prev => ({
                       x: mx - (mx - prev.x) * newScale / scale,
                       y: my - (my - prev.y) * newScale / scale,
                   }));
                   setScale(newScale);
               }
           }}
           className="p-1.5 hover:bg-[rgb(var(--border))] rounded transition-colors text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))]"
           title="Zoom Out"
        >
           <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-[rgb(var(--border))] mx-1" />
        <button 
           onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
           className="p-1.5 hover:bg-[rgb(var(--border))] rounded transition-colors text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))]"
           title="Reset View"
        >
           <Maximize className="w-4 h-4" />
        </button>
      </div>

      {selectedNodeIds && selectedNodeIds.length > 0 && (
        <div 
          className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] shadow-2xl rounded-2xl px-6 py-4 flex items-center gap-6 z-50 pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
           <div className="flex items-center gap-3 shrink-0">
             <div className="bg-[rgb(var(--accent))] text-[rgb(var(--background))] px-2.5 py-0.5 rounded-md text-[13px] font-bold">
               {selectedNodeIds.length}
             </div>
             <span className="text-[14px] font-medium text-[rgb(var(--text-main))]">Selected</span>
           </div>
           
           <div className="w-px h-8 bg-[rgb(var(--border))] shrink-0" />
           
           <div className="flex items-center gap-3">
              <div className="relative group/move shrink-0">
                  <button className="flex items-center gap-2 text-[14px] font-medium text-[rgb(var(--text-main))] bg-[rgb(var(--background))] group-hover/move:border-[rgb(var(--accent))] px-4 py-2 rounded-xl transition-colors border border-[rgb(var(--border))]">
                     <MoveRight className="w-4 h-4 text-[rgb(var(--text-muted))] group-hover/move:text-[rgb(var(--accent))]" /> Move
                  </button>
                  <div className="absolute bottom-full left-0 mb-2 w-48 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] shadow-xl rounded-xl py-2 opacity-0 invisible group-hover/move:opacity-100 group-hover/move:visible transition-all z-50">
                     <button 
                         className="w-full text-left px-4 py-2 text-[13px] hover:bg-[rgb(var(--border))] text-[rgb(var(--text-main))]"
                         onClick={() => {
                             setNodes(nodes.map(n => selectedNodeIds.includes(n.id) ? { ...n, projectId: "" } : n));
                             if (setSelectedNodeIds) setSelectedNodeIds([]);
                         }}
                     >
                         None (Uncategorized)
                     </button>
                     {allProjects.filter(p => p !== 'Uncategorized').map(p => (
                         <button 
                             key={p}
                             className="w-full text-left px-4 py-2 text-[13px] hover:bg-[rgb(var(--border))] text-[rgb(var(--text-main))]"
                             onClick={() => {
                                 setNodes(nodes.map(n => selectedNodeIds.includes(n.id) ? { ...n, projectId: p } : n));
                                 if (setSelectedNodeIds) setSelectedNodeIds([]);
                             }}
                         >
                             {p}
                         </button>
                     ))}
                  </div>
              </div>

              <button 
                 onClick={handleExport}
                 className="flex items-center gap-2 text-[14px] font-medium text-[rgb(var(--text-main))] hover:border-[rgb(var(--text-muted))] bg-[rgb(var(--background))] px-4 py-2 rounded-xl transition-colors border border-[rgb(var(--border))] shrink-0">
                 <Download className="w-4 h-4 text-[rgb(var(--text-muted))]" /> Export
              </button>

              <button 
                 onClick={() => {
                    setNodes(nodes.filter(n => !selectedNodeIds.includes(n.id)));
                    setLinks(links.filter(l => !selectedNodeIds.includes(l.source) && !selectedNodeIds.includes(l.target)));
                    if (setSelectedNodeIds) setSelectedNodeIds([]);
                 }}
                 className="flex items-center gap-2 text-[14px] font-medium text-red-500 hover:text-red-400 hover:bg-red-500/10 bg-[rgb(var(--background))] px-4 py-2 rounded-xl transition-colors border border-red-500/30 shrink-0">
                 <Trash2 className="w-4 h-4" /> Delete
              </button>
              
              <button 
                 onClick={() => {
                     if (setSelectedNodeIds) setSelectedNodeIds([]);
                 }}
                 className="ml-2 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] p-2 rounded-lg hover:bg-[rgb(var(--border))] transition-colors shrink-0"
              >
                 <X className="w-4 h-4" />
              </button>
           </div>
        </div>
      )}
    </div>
  );
}

interface NodeProps {
  node: NexusNode;
  scale: number;
  isSelected: boolean;
  isDragging: boolean;
  onSelect: (e: React.PointerEvent) => void;
  onDragStart: (e: React.PointerEvent) => void;
  onLinkStart: (e: React.PointerEvent) => void;
  onLinkComplete: (e: React.PointerEvent) => void;
  onUpdateTitle: (newTitle: string) => void;
  onAddAnnotation: (ann: any) => void;
  onUpdateFont: (font: 'sans' | 'serif' | 'mono') => void;
  onResize: (width: number) => void;
  onHeightChange: (height: number) => void;
  onUpdateNode?: (id: string, updates: Partial<NexusNode>) => void;
}

const NodeCard: React.FC<NodeProps> = ({ node, scale, isSelected, isDragging, onSelect, onDragStart, onLinkStart, onLinkComplete, onUpdateTitle, onAddAnnotation, onUpdateFont, onResize, onHeightChange, onUpdateNode }) => {

  const isSpecial = node.accent && node.accent !== 'none';
  const cardRef = useRef<HTMLDivElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(node.title);
  
  const [isAddingAnnotation, setIsAddingAnnotation] = useState(false);
  const [annotationDraft, setAnnotationDraft] = useState('');
  const [annotationCat, setAnnotationCat] = useState<'comment' | 'raw-fragment' | 'issue'>('comment');
  const [showSettings, setShowSettings] = useState(false);

  const cardWidth = node.width || 256;
  const fontFamilyClass = node.fontFamily === 'serif' ? 'font-serif' : node.fontFamily === 'mono' ? 'font-mono' : 'font-sans';

  useEffect(() => {
      if (!cardRef.current) return;
      const observer = new ResizeObserver(() => {
          if (cardRef.current) {
              onHeightChange(cardRef.current.offsetHeight);
          }
      });
      observer.observe(cardRef.current);
      return () => observer.disconnect();
  }, [onHeightChange]);

  const handleResizeStart = (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const startX = e.clientX;
      const initialWidth = cardWidth;
      
      const handleMove = (ev: PointerEvent) => {
          const dx = (ev.clientX - startX) / scale;
          const newWidth = Math.max(200, Math.min(1000, initialWidth + dx));
          onResize(newWidth);
      };
      
      const handleUp = () => {
          window.removeEventListener('pointermove', handleMove);
          window.removeEventListener('pointerup', handleUp);
      };
      
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
  };

  return (
    <motion.div
      ref={cardRef}
      data-node-id={node.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1, x: node.x, y: node.y }}
      transition={isDragging ? { type: "tween", duration: 0 } : { type: "spring", bounce: 0.1, duration: 0.2 }}
      style={{ width: cardWidth }}
      className={`absolute top-0 left-0 bg-[rgb(var(--panel))] text-[13px] flex flex-col z-10 pointer-events-auto group shadow-lg rounded-xl overflow-visible touch-none
        border ${isSpecial ? (node.accent === 'blue' ? 'border-[rgb(var(--accent))] shadow-[0_0_15px_rgba(45,212,191,0.1)]' : 'border-purple-400/50') : 'border-[rgb(var(--border))]'}
        ${isSelected ? 'ring-2 ring-[rgb(var(--accent))] shadow-xl' : 'hover:border-[rgb(var(--text-muted))] transition-colors'}
        ${fontFamilyClass}
      `}
      onPointerDown={onSelect}
      onPointerUp={onLinkComplete}
    >
      {/* Input Handle (Left side) */}
      <div 
        className="absolute -left-2.5 top-[19px] w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        onPointerDown={(e) => {
            onLinkStart(e);
        }}
      >
         <div className="w-2.5 h-2.5 bg-[rgb(var(--background))] border-[1.5px] border-[rgb(var(--text-muted))] rounded-full pointer-events-none" />
      </div>

      {/* Output Handle (Right side) */}
      <div 
        className="absolute -right-2.5 top-[19px] w-6 h-6 flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity cursor-crosshair z-20"
        onPointerDown={(e) => {
            onLinkStart(e);
        }}
      >
         <div className="w-3 h-3 bg-[rgb(var(--background))] border-2 border-[rgb(var(--accent))] rounded-full hover:scale-125 transition-transform pointer-events-none" />
      </div>

      <div 
        data-node-title-edit={node.id}
        className="px-4 py-3 border-b border-[rgb(var(--border))] flex items-center justify-between bg-[rgb(var(--background))]/50 hover:bg-[rgb(var(--background))] cursor-grab active:cursor-grabbing transition-colors touch-none"
        onPointerDown={onDragStart}
        onDoubleClick={(e) => {
            e.stopPropagation();
            setIsEditingTitle(true);
            setEditTitle(node.title);
        }}
      >
        {isEditingTitle ? (
            <input 
                autoFocus
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onBlur={() => {
                    setIsEditingTitle(false);
                    if (editTitle.trim() && editTitle !== node.title) onUpdateTitle(editTitle);
                }}
                onKeyDown={e => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                onPointerDown={e => e.stopPropagation()}
                className="bg-[rgb(var(--background))] text-[13px] font-semibold text-[rgb(var(--text-main))] border border-[rgb(var(--accent))] rounded px-1.5 py-0.5 outline-none w-full mr-2"
            />
        ) : (
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                 <span className="font-semibold text-[13px] text-[rgb(var(--text-main))] truncate select-none">{node.title}</span>
                 {node.thoughtMarkers && node.thoughtMarkers.length > 0 && (
                   <div className="flex gap-1 shrink-0">
                     {node.thoughtMarkers.map((m, i) => (
                       <div 
                         key={i} 
                         title={`Thought status: ${m}`}
                         className={`w-1.5 h-1.5 rounded-full ${
                           m === 'certain' ? 'bg-orange-400' : 
                           m === 'hypothesis' ? 'bg-purple-400' : 
                           m === 'question' ? 'bg-blue-400' : 'bg-green-400'
                         }`} 
                       />
                     ))}
                   </div>
                 )}
             </div>
        )}
        <div className="flex items-center gap-1.5 shrink-0 transition-opacity relative">
          <span className="text-[10px] text-[rgb(var(--text-muted))] hidden group-hover:block opacity-70">
             {node.id.substring(0,4)}
          </span>
          <span
             className="w-4 h-4 text-[rgb(var(--text-muted))] opacity-0 group-hover:opacity-100 hover:text-[rgb(var(--text-main))] transition-colors cursor-pointer flex items-center justify-center"
             onPointerDown={(e) => { e.stopPropagation(); setIsAddingAnnotation(!isAddingAnnotation); setShowSettings(false); }}
             title="Add inline annotation"
          >+</span>
          <span
             className={`w-4 h-4 transition-colors cursor-pointer flex items-center justify-center ${showSettings ? 'text-[rgb(var(--text-main))] opacity-100' : 'text-[rgb(var(--text-muted))] opacity-0 group-hover:opacity-100 hover:text-[rgb(var(--text-main))]'}`}
             onPointerDown={(e) => { e.stopPropagation(); setShowSettings(!showSettings); setIsAddingAnnotation(false); }}
             title="Settings"
          >...</span>
          {showSettings && (
             <div className="absolute top-6 right-0 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg shadow-xl p-2 z-50 min-w-[140px]" onPointerDown={e => e.stopPropagation()}>
                <div className="text-[10px] font-bold text-[rgb(var(--text-muted))] uppercase mb-1">Font Family</div>
                <div className="flex flex-col gap-1 mb-2">
                   {['sans', 'serif', 'mono'].map(font => (
                       <button
                          key={font}
                          onClick={() => onUpdateFont(font as any)}
                          className={`text-left px-2 py-1 text-[12px] capitalize rounded ${node.fontFamily === font || (!node.fontFamily && font==='sans') ? 'bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]' : 'hover:bg-[rgb(var(--border))] text-[rgb(var(--text-main))]'}`}
                       >
                          {font}
                       </button>
                   ))}
                </div>
                <div className="text-[10px] font-bold text-[rgb(var(--text-muted))] uppercase mb-1">Thought Status</div>
                <div className="flex flex-col gap-1">
                   {(['certain', 'hypothesis', 'question', 'answer'] as ThoughtMarker[]).map(marker => {
                       const hasMarker = node.thoughtMarkers?.includes(marker);
                       return (
                           <button
                              key={marker}
                              onClick={() => {
                                 const current = node.thoughtMarkers || [];
                                 const next = current.includes(marker) ? current.filter(m => m !== marker) : [...current, marker];
                                 onUpdateNode(node.id, { thoughtMarkers: next });
                              }}
                              className={`text-left px-2 py-1 text-[12px] capitalize rounded flex items-center gap-1.5 hover:bg-[rgb(var(--border))] text-[rgb(var(--text-main))] ${hasMarker ? 'bg-[rgb(var(--border))] font-semibold' : ''}`}
                           >
                              <div className={`w-1.5 h-1.5 rounded-full ${
                                 marker === 'certain' ? 'bg-orange-400' :
                                 marker === 'hypothesis' ? 'bg-purple-400' :
                                 marker === 'question' ? 'bg-blue-400' : 'bg-green-400'
                              }`} />
                              <span>{marker}</span>
                              {hasMarker && <span className="ml-auto text-[rgb(var(--accent))] font-normal">✓</span>}
                           </button>
                       );
                   })}
                </div>
             </div>
          )}
        </div>
      </div>
      
      {isAddingAnnotation && (
         <div className="absolute top-10 right-2 p-3 border border-[rgb(var(--border))] rounded-lg shadow-xl bg-[rgb(var(--panel))] flex flex-col gap-2 z-50 min-w-[200px]" onPointerDown={e => e.stopPropagation()}>
            <select 
               className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] text-[11px] text-[rgb(var(--text-main))] rounded outline-none w-full p-1 cursor-pointer"
               value={annotationCat}
               onChange={e => setAnnotationCat(e.target.value as any)}
            >
               <option value="comment">Comment</option>
               <option value="raw-fragment">Raw Fragment</option>
               <option value="issue">Issue</option>
            </select>
            <textarea 
               autoFocus
               placeholder="Write annotation..."
               value={annotationDraft}
               onChange={e => setAnnotationDraft(e.target.value)}
               className="bg-transparent border border-[rgb(var(--border))] rounded p-1.5 text-[12px] resize-none outline-none focus:border-[rgb(var(--accent))] min-h-[40px] text-[rgb(var(--text-main))]"
            />
            <div className="flex justify-end gap-2 mt-1">
               <button onClick={() => setIsAddingAnnotation(false)} className="text-[10px] uppercase font-bold text-[rgb(var(--text-muted))] hover:text-white">Cancel</button>
               <button 
                  onClick={() => {
                      if (annotationDraft.trim()) {
                          onAddAnnotation({
                              id: uid(),
                              content: annotationDraft,
                              category: annotationCat,
                              author: 'user',
                              timestamp: new Date().toISOString()
                          });
                          setAnnotationDraft('');
                          setIsAddingAnnotation(false);
                      }
                  }}
                  className="text-[10px] uppercase font-bold text-[rgb(var(--accent))] hover:text-teal-300"
               >
                  Save
               </button>
            </div>
         </div>
      )}

      {node.imageAttachments && node.imageAttachments.length > 0 && (
        <ImageAttachmentsUI 
          attachments={node.imageAttachments} 
          onRemove={(attId) => {
             if (onUpdateNode) {
               const updated = node.imageAttachments!.filter(a => a.id !== attId);
               onUpdateNode(node.id, { imageAttachments: updated });
             }
          }}
        />
      )}

      <div className={`p-4 text-[rgb(var(--text-muted))] whitespace-pre-wrap break-words font-medium leading-relaxed min-h-[50px] ${
        node.imageAttachments && node.imageAttachments.length > 0 ? 'border-t border-[rgb(var(--border))]' : ''
      }`}>
        {node.content || (node.imageAttachments?.length ? '' : 'Empty parameters...')}
      </div>
      {(node.annotations && node.annotations.length > 0) ? (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5 opacity-80 mt-[-4px]">
           {(node.annotations.filter(a => a.category === 'comment').length > 0) && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[rgb(var(--border))] text-[rgb(var(--text-muted))]">
                [N] {node.annotations.filter(a => a.category === 'comment').length}
              </span>
           )}
           {(node.annotations.filter(a => a.category === 'raw-fragment').length > 0) && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-orange-500/30 text-orange-400 bg-orange-500/10">
                [F] {node.annotations.filter(a => a.category === 'raw-fragment').length}
              </span>
           )}
           {(node.annotations.filter(a => a.category === 'issue').length > 0) && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-red-500/30 text-red-400 bg-red-500/10">
                [I] {node.annotations.filter(a => a.category === 'issue').length}
              </span>
           )}
        </div>
      ) : null}
      
      {/* Resizer Handle */}
      <div 
         className="absolute right-0 bottom-0 w-4 h-4 cursor-ew-resize flex items-end justify-end p-1 opacity-0 group-hover:opacity-100 z-20"
         onPointerDown={handleResizeStart}
      >
         <div className="w-2.5 h-2.5 bg-transparent border-r-2 border-b-2 border-[rgb(var(--text-muted))]/50 rounded-br-sm pointer-events-none" />
      </div>
    </motion.div>
  );
}
