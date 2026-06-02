import React, { useState, useRef, useEffect, useMemo } from "react";
import { Plus, ChevronDown, Activity, Settings2, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { NexusNode, NexusLink } from "../types";

export function NexusCanvas({ 
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
  onDraggedProjectRelease
}: {
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
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isPanModifierPressed, setIsPanModifierPressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [nodeHeights, setNodeHeights] = useState<Record<string, number>>({});
  const [draggedNode, setDraggedNode] = useState<{ id: string, ids?: string[], startX?: number, startY?: number } | null>(null);

  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  
  const stateRef = useRef({
    isPanning, draggedNode, linkingFrom, offset, scale, selectedNodeId, nodes, selectedNodeIds, draggedProject
  });

  useEffect(() => {
    stateRef.current = { isPanning, draggedNode, linkingFrom, offset, scale, selectedNodeId, nodes, selectedNodeIds, draggedProject };
  }, [isPanning, draggedNode, linkingFrom, offset, scale, selectedNodeId, nodes, selectedNodeIds, draggedProject]);

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
        
        const { selectedNodeId, nodes: currentNodes } = stateRef.current;
        if (selectedNodeId) {
            e.preventDefault();
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
            const selectedNode = currentNodes.find(n => n.id === selectedNodeId);
            if (selectedNode) {
                const newId = Math.random().toString(36).substring(2, 9);
                const newNode: NexusNode = {
                    id: newId,
                    title: 'New Node',
                    content: '',
                    x: selectedNode.x + 320,
                    y: selectedNode.y,
                    accent: 'none',
                    projectId: selectedNode.projectId
                };
                setNodes(prev => [...prev, newNode]);
                setLinks(prev => [...prev, { source: selectedNodeId, target: newId }]);
                if (setSelectedNodeIds) setSelectedNodeIds([newId]);
                else setSelectedNodeId(newId);
                
                // Auto start editing title
                setTimeout(() => {
                    const el = document.querySelector(`[data-node-title-edit="${newId}"]`);
                    if (el) {
                        el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
                    }
                }, 50);
            }
        }
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
  }, []);

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
      const { isPanning, draggedNode, linkingFrom, offset, scale, selectedNodeIds, draggedProject } = stateRef.current;
      
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
      const { linkingFrom, draggedProject } = stateRef.current;
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

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isPanModifierPressed || e.button === 1) { // Space or Middle click
      setIsPanning(true);
    } else {
      if (e.target === containerRef.current || (e.target as Element).tagName === 'svg' || (e.target as Element).tagName === 'path') {
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

    const newNode: NexusNode = {
      id: Math.random().toString(36).substring(2, 9),
      title: "New Objective",
      content: "Specify parameters...",
      x,
      y,
      accent: "none",
      projectId: "default_namespace"
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

  return (
    <div
      ref={containerRef}
      className={`flex-1 h-[calc(100vh-3.5rem)] relative overflow-hidden touch-none nexus-grid outline-none select-none transition-colors ${isPanModifierPressed || isPanning ? 'cursor-grab active:cursor-grabbing' : ''}`}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
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
          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none stroke-[rgb(var(--text-muted))]"
          style={{ zIndex: 0 }}
        >
          {links.map((link, idx) => {
            const source = visibleNodes.find(n => n.id === link.source);
            const target = visibleNodes.find(n => n.id === link.target);
            if (!source || !target) return null;
            return (
                 <motion.path
                 key={idx}
                 d={generateManhattanPath(source, target)}
                 fill="none"
                 strokeWidth="2"
                 strokeLinejoin="round"
                 initial={{ pathLength: 0 }}
                 animate={{ pathLength: 1 }}
                 className="opacity-30 stroke-[rgb(var(--text-muted))]"
               />
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
                        setSelectedNodeIds(current.includes(node.id) ? current.filter(id => id !== node.id) : [...current, node.id]);
                    } else setSelectedNodeId(node.id);
                } else {
                    if (setSelectedNodeIds) setSelectedNodeIds([node.id]);
                    else setSelectedNodeId(node.id);
                }
            }}
            onDragStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
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
}

const NodeCard: React.FC<NodeProps> = ({ node, scale, isSelected, isDragging, onSelect, onDragStart, onLinkStart, onLinkComplete, onUpdateTitle, onAddAnnotation, onUpdateFont, onResize, onHeightChange }) => {
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
            <span className="font-semibold text-[13px] text-[rgb(var(--text-main))] truncate pr-2 select-none">{node.title}</span>
        )}
        <div className="flex items-center gap-1.5 shrink-0 transition-opacity relative">
          <span className="text-[10px] text-[rgb(var(--text-muted))] hidden group-hover:block opacity-70">
             {node.id.substring(0,4)}
          </span>
          <Plus 
             className="w-4 h-4 text-[rgb(var(--text-muted))] opacity-0 group-hover:opacity-100 hover:text-[rgb(var(--text-main))] transition-colors cursor-pointer"
             onPointerDown={(e) => { e.stopPropagation(); setIsAddingAnnotation(!isAddingAnnotation); setShowSettings(false); }}
             title="Add inline annotation"
          />
          <Settings2 
             className={`w-4 h-4 transition-colors cursor-pointer ${showSettings ? 'text-[rgb(var(--text-main))] opacity-100' : 'text-[rgb(var(--text-muted))] opacity-0 group-hover:opacity-100 hover:text-[rgb(var(--text-main))]'}`}
             onPointerDown={(e) => { e.stopPropagation(); setShowSettings(!showSettings); setIsAddingAnnotation(false); }}
             title="Settings"
          />
          {showSettings && (
             <div className="absolute top-6 right-0 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg shadow-xl p-2 z-50 min-w-[120px]" onPointerDown={e => e.stopPropagation()}>
                <div className="text-[10px] font-bold text-[rgb(var(--text-muted))] uppercase mb-1">Font Family</div>
                <div className="flex flex-col gap-1">
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
                              id: Math.random().toString(36).substring(2, 9),
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

      <div className="p-4 text-[rgb(var(--text-muted))] whitespace-pre-wrap break-words font-medium leading-relaxed min-h-[50px]">
        {node.content || "Empty parameters..."}
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
