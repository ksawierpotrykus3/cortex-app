// ============================================================================
// NEXUS — MermaidPlanPanel 2.0
// Środowisko Planowania: przeglądarka diagramów Mermaid
// z interaktywnym komentowaniem i kompilacją do Workflow Studio
// ============================================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Send, RefreshCw, Maximize2, Minimize2, Copy, Download, ArrowRight, X, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// ============================================================================
// Typy
// ============================================================================
export interface MermaidDraft {
  id: string;
  title: string;
  mermaidCode: string;
  description: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  isCompiled: boolean;  // true = już wygenerowany na płótnie
}

interface MermaidNodeClick {
  nodeId: string;
  label: string;
  x: number;
  y: number;
}

interface MermaidPlanPanelProps {
  drafts: MermaidDraft[];
  onSaveDraft: (draft: MermaidDraft) => void;
  onDeleteDraft: (id: string) => void;
  /** Wyślij prompt do AI aby wygenerowało kod Mermaid */
  onGenerateMermaid?: (draft: MermaidDraft, customPrompt?: string) => Promise<string>;

  /** Zapisz do Wiki */
  onPromoteToWiki?: (draft: MermaidDraft) => void;
  /** Custom system prompt dla generatora */
  mermaidSystemPrompt?: string;
  onSaveMermaidPrompt?: (prompt: string) => void;
}

// ============================================================================
// Prosty parser Mermaid → SVG (inline, bez zewn. biblioteki)
// ============================================================================
export function parseMermaidToSVG(code: string): { svg: string; nodes: MermaidNodeClick[] } {
  const nodes: MermaidNodeClick[] = [];
  const lines = code.split('\n').map(l => l.trim()).filter(Boolean);
  let graphType = 'TD';

  // Determine graph direction
  if (lines[0]?.startsWith('graph ') || lines[0]?.startsWith('flowchart ')) {
    const parts = lines[0].split(' ');
    graphType = parts[1] || 'TD';
  }

  // Build graph model
  interface Edge { from: string; to: string; label?: string; }
  interface MNode { id: string; label: string; shape: 'rect' | 'diamond' | 'round' | 'circle'; }
  const mnodes: MNode[] = [];
  const edges: Edge[] = [];

  for (const line of lines.slice(1)) {
    // Skip subgraph declarations
    if (line.startsWith('subgraph') || line.startsWith('end')) continue;
    if (line.startsWith('classDef') || line.startsWith('class ') || line.startsWith('style ')) continue;
    if (line.startsWith('click ') || line.startsWith('linkStyle ')) continue;

    // Match node definition:  ID[Label] or ID(Label) or ID{Label} or ID((Label))
    const nodeMatch = line.match(/^(\w+)\s*(\[([^\]]+)\]|\(\(([^)]+)\)\)|\(([^)]+)\)|\{([^}]+)\})/);
    if (nodeMatch) {
      const id = nodeMatch[1];
      const label = nodeMatch[3] || nodeMatch[4] || nodeMatch[5] || nodeMatch[6] || id;
      let shape: MNode['shape'] = 'rect';
      if (nodeMatch[0].includes('[(') || nodeMatch[0].includes('))')) shape = 'round';
      else if (nodeMatch[0].includes('{')) shape = 'diamond';
      else if (nodeMatch[0].includes('((')) shape = 'circle';
      else if (nodeMatch[0].includes('(')) shape = 'round';
      mnodes.push({ id, label, shape });
      continue;
    }

    // Match edge:  A --> B or A -->|label| B or A -.-> B
    const edgeMatch = line.match(/^(\w+)\s*(-->|--->|---|\.\.->|==>|-\.->)\s*(?:\|([^|]*)\|)?\s*(\w+)/);
    if (edgeMatch) {
      edges.push({ from: edgeMatch[1], to: edgeMatch[4], label: edgeMatch[3] });
      continue;
    }
  }

  // Layout engine — simple grid
  const isHorizontal = graphType === 'LR' || graphType === 'RL';
  const cols = Math.ceil(Math.sqrt(mnodes.length)) || 3;
  const spacingX = isHorizontal ? 180 : 160;
  const spacingY = isHorizontal ? 100 : 80;

  const positionedNodes = mnodes.map((n, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * spacingX + 20;
    const y = row * spacingY + 20;
    nodes.push({ nodeId: n.id, label: n.label, x, y });
    return { ...n, x, y };
  });

  const svgWidth = cols * spacingX + 40;
  const svgHeight = (Math.ceil(mnodes.length / cols)) * spacingY + 60;

  // Build SVG
  const svgParts: string[] = [];
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%">`);
  svgParts.push(`<style>text { font-family: system-ui, sans-serif; font-size: 12px; } .node-rect { fill: rgba(167,139,250,0.15); stroke: rgba(167,139,250,0.4); } .node-diamond { fill: rgba(96,165,250,0.15); stroke: rgba(96,165,250,0.4); } .node-round { fill: rgba(52,211,153,0.15); stroke: rgba(52,211,153,0.4); } .node-circle { fill: rgba(251,191,36,0.15); stroke: rgba(251,191,36,0.4); } .edge { stroke: rgb(var(--border)); stroke-width: 1.5; fill: none; } .edge-label { font-size: 9px; fill: rgb(var(--text-muted)); }</style>`);

  // Edges
  for (const edge of edges) {
    const from = positionedNodes.find(n => n.id === edge.from);
    const to = positionedNodes.find(n => n.id === edge.to);
    if (!from || !to) continue;

    const fx = from.x + (from.shape === 'diamond' ? 60 : 70);
    const fy = from.y + 30;
    const tx = to.x + 5;
    const ty = to.y + 30;
    const mid = (fx + tx) / 2;

    svgParts.push(`<path class="edge" d="M${fx},${fy} C${mid},${fy} ${mid},${ty} ${tx},${ty}" marker-end="url(#arrow)"/>`);
    if (edge.label) {
      svgParts.push(`<text class="edge-label" x="${mid}" y="${(fy + ty) / 2 - 5}" text-anchor="middle">${esc(edge.label)}</text>`);
    }
  }

  // Arrow marker
  svgParts.push(`<defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="rgb(var(--border))"/></marker></defs>`);

  // Nodes
  for (const node of positionedNodes) {
    const w = 140, h = 44;
    const cx = node.x + w / 2;
    const cy = node.y + h / 2;

    switch (node.shape) {
      case 'diamond':
        svgParts.push(`<polygon class="node-diamond" points="${cx},${cy - 28} ${cx + 65},${cy} ${cx},${cy + 28} ${cx - 65},${cy}"/>`);
        svgParts.push(`<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="currentColor" class="text-[11px]">${esc(node.label)}</text>`);
        break;
      case 'round':
        svgParts.push(`<rect class="node-round" x="${node.x}" y="${node.y}" width="${w}" height="${h}" rx="20" ry="20"/>`);
        svgParts.push(`<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="currentColor">${esc(node.label)}</text>`);
        break;
      case 'circle':
        svgParts.push(`<circle class="node-circle" cx="${cx}" cy="${cy}" r="30"/>`);
        svgParts.push(`<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="currentColor">${esc(node.label)}</text>`);
        break;
      default:
        svgParts.push(`<rect class="node-rect" x="${node.x}" y="${node.y}" width="${w}" height="${h}" rx="6"/>`);
        svgParts.push(`<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="currentColor">${esc(node.label)}</text>`);
    }
  }

  svgParts.push('</svg>');
  return { svg: svgParts.join('\n'), nodes };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================================
// MermaidPlanPanel
// ============================================================================
export function MermaidPlanPanel({
  drafts,
  onSaveDraft,
  onDeleteDraft,
  onGenerateMermaid,

  onPromoteToWiki,
  mermaidSystemPrompt,
  onSaveMermaidPrompt,
}: MermaidPlanPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(drafts[0]?.id || null);
  const [editingCode, setEditingCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(mermaidSystemPrompt || DEFAULT_MERMAID_PROMPT);
  const [clickedNode, setClickedNode] = useState<MermaidNodeClick | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [fullscreen, setFullscreen] = useState(false);

  const selected = drafts.find(d => d.id === selectedId) || null;

  useEffect(() => {
    if (selected) {
      setEditingCode(selected.mermaidCode);
    }
  }, [selected]);

  const handleGenerate = useCallback(async () => {
    if (!selected || !onGenerateMermaid) return;
    setIsGenerating(true);
    try {
      const code = await onGenerateMermaid(selected, customPrompt);
      const updated = { ...selected, mermaidCode: code, updatedAt: new Date().toISOString() };
      setEditingCode(code);
      onSaveDraft(updated);
    } catch (err) {
      console.error('[MermaidPlan] Failed to generate:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [selected, customPrompt, onGenerateMermaid, onSaveDraft]);

  const handleSaveCode = useCallback(() => {
    if (!selected) return;
    onSaveDraft({ ...selected, mermaidCode: editingCode, updatedAt: new Date().toISOString() });
  }, [selected, editingCode, onSaveDraft]);

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>, nodes: MermaidNodeClick[]) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const svgX = e.clientX - rect.left;
    const svgY = e.clientY - rect.top;

    // Find closest node
    let closest: MermaidNodeClick | null = null;
    let minDist = 50;
    for (const node of nodes) {
      const dist = Math.sqrt((svgX - (node.x + 70)) ** 2 + (svgY - (node.y + 22)) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closest = node;
      }
    }
    if (closest) setClickedNode(closest);
  }, []);

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || !clickedNode || !onGenerateMermaid || !selected) return;
    const prompt = `Użytkownik kliknął na węzeł "${clickedNode.label}" w diagramie Mermaid. ${chatInput}\n\nAktualny diagram:\n\`\`\`mermaid\n${selected.mermaidCode}\n\`\`\`\n\nZmodyfikuj diagram zgodnie z prośbą użytkownika. Zwróć TYLKO kod mermaid w bloku \`\`\`mermaid.`;
    setIsGenerating(true);
    try {
      const code = await onGenerateMermaid(selected, prompt);
      const updated = { ...selected, mermaidCode: code, updatedAt: new Date().toISOString() };
      setEditingCode(code);
      onSaveDraft(updated);
      setChatInput('');
      setClickedNode(null);
    } catch (err) {
      console.error('[MermaidPlan] Failed to modify:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [chatInput, clickedNode, onGenerateMermaid, selected, onSaveDraft]);

  const createNewDraft = useCallback(() => {
    const now = new Date().toISOString();
    const draft: MermaidDraft = {
      id: `md_${Date.now()}`,
      title: 'Nowy szkic',
      mermaidCode: 'graph TD\n  A[Start] --> B[Proces]\n  B --> C[Koniec]',
      description: '',
      createdAt: now,
      updatedAt: now,
      tags: [],
      isCompiled: false,
    };
    onSaveDraft(draft);
    setSelectedId(draft.id);
  }, [onSaveDraft]);

  const { svg, nodes } = selected ? parseMermaidToSVG(editingCode || selected.mermaidCode) : { svg: '', nodes: [] };

  return (
    <div className={`flex h-full ${fullscreen ? 'fixed inset-0 z-50 bg-[rgb(var(--background))]' : ''}`}>
      {/* Left sidebar: lista szkiców */}
      <div className="w-56 border-r border-[rgb(var(--border))] bg-[rgb(var(--panel))] flex flex-col shrink-0">
        <div className="px-3 py-2 border-b border-[rgb(var(--border))]">
          <button
            onClick={createNewDraft}
            className="w-full px-3 py-1.5 text-[11px] font-medium bg-[rgb(var(--accent))] text-white rounded-lg hover:opacity-90 cursor-pointer"
          >
            + Nowy szkic
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {drafts.map(d => (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={`w-full text-left px-2.5 py-2 rounded-lg text-[12px] transition-colors cursor-pointer ${
                d.id === selectedId
                  ? 'bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]'
                  : 'text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--border))]/20'
              }`}
            >
              <div className="font-medium truncate">{d.title}</div>
              <div className="text-[10px] text-[rgb(var(--text-muted))] mt-0.5">
                {d.isCompiled ? '✓ Skompilowany' : 'Szkic'} · {new Date(d.updatedAt).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-[rgb(var(--text-muted))]">
            <div className="text-center">
              <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Wybierz szkic lub utwórz nowy</p>
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="h-10 border-b border-[rgb(var(--border))] bg-[rgb(var(--panel))] flex items-center justify-between px-3 shrink-0">
              <div className="flex items-center gap-2">
                <input
                  value={selected.title}
                  onChange={(e) => onSaveDraft({ ...selected, title: e.target.value })}
                  className="bg-transparent text-[12px] font-semibold outline-none w-40"
                />
                <span className="text-[10px] text-[rgb(var(--text-muted))]">Mermaid</span>
                <button
                  onClick={() => setShowPromptEditor(!showPromptEditor)}
                  className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer ${
                    showPromptEditor ? 'bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))]'
                  }`}
                >
                  Prompt
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !onGenerateMermaid}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent))]/20 disabled:opacity-40 cursor-pointer"
                >
                  <RefreshCw size={11} className={isGenerating ? 'animate-spin' : ''} /> Generuj
                </button>

                {onPromoteToWiki && (
                  <button
                    onClick={() => onPromoteToWiki(selected)}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 cursor-pointer"
                  >
                    <ArrowRight size={11} /> Do Wiki
                  </button>
                )}
                <button onClick={() => setFullscreen(!fullscreen)} className="p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] cursor-pointer">
                  {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
                <button
                  onClick={() => onDeleteDraft(selected.id)}
                  className="p-1 text-[rgb(var(--text-muted))] hover:text-red-400 cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Prompt Editor */}
            <AnimatePresence>
              {showPromptEditor && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-b border-[rgb(var(--border))] bg-[rgb(var(--panel))] overflow-hidden"
                >
                  <div className="p-3 space-y-2">
                    <label className="text-[10px] font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wide">
                      System Prompt dla generatora Mermaid
                    </label>
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      className="w-full bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded px-3 py-2 text-[11px] outline-none resize-none font-mono"
                      rows={5}
                    />
                    {onSaveMermaidPrompt && (
                      <button
                        onClick={() => onSaveMermaidPrompt(customPrompt)}
                        className="text-[10px] px-2 py-1 rounded bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent))]/20 cursor-pointer"
                      >
                        Zapisz jako domyślny prompt
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main content: diagram + code editor */}
            <div className="flex-1 flex overflow-hidden">
              {/* SVG Diagram */}
              <div className="flex-1 overflow-auto p-4 bg-[rgb(var(--background))] flex items-start justify-center">
                <div
                  className="min-w-[400px]"
                  dangerouslySetInnerHTML={{ __html: svg }}
                  onClick={(e) => handleSvgClick(e as any, nodes)}
                />
              </div>

              {/* Code editor sidebar */}
              <div className="w-72 border-l border-[rgb(var(--border))] bg-[rgb(var(--panel))] flex flex-col shrink-0">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wide border-b border-[rgb(var(--border))]">
                  Kod Mermaid
                </div>
                <textarea
                  value={editingCode}
                  onChange={(e) => setEditingCode(e.target.value)}
                  onBlur={handleSaveCode}
                  className="flex-1 bg-transparent px-3 py-2 text-[11px] font-mono outline-none resize-none text-[rgb(var(--text-secondary))]"
                  spellCheck={false}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Chat bubble (kliknięty węzeł) */}
      <AnimatePresence>
        {clickedNode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-20 left-64 right-4 z-40 bg-[rgb(var(--panel))] border border-[rgb(var(--accent))]/30 rounded-xl shadow-xl p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-[rgb(var(--accent))]" />
              <span className="text-[11px] font-semibold">Węzeł: {clickedNode.label}</span>
              <button onClick={() => setClickedNode(null)} className="ml-auto p-0.5 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] cursor-pointer"><X size={12} /></button>
            </div>
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder={`Dodaj od tego klocka rozgałęzienie...`}
                className="flex-1 bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-lg px-3 py-1.5 text-[11px] outline-none"
              />
              <button
                onClick={handleSendChat}
                disabled={isGenerating}
                className="px-3 py-1.5 bg-[rgb(var(--accent))] text-white rounded-lg text-[11px] font-medium disabled:opacity-40 cursor-pointer"
              >
                <Send size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Domyślny prompt systemowy dla generatora Mermaid
// ============================================================================
const DEFAULT_MERMAID_PROMPT = `Jesteś ekspertem od diagramów Mermaid. Generujesz diagramy w formacie flowchart.

Zasady:
1. Używaj flowchart TD (top-down) lub flowchart LR (left-right)
2. Nazwy węzłów - krótkie, opisowe, po polsku
3. Używaj kształtów: [] dla prostokątów, {} dla decyzji, () dla zaokrąglonych, (()) dla okręgów
4. Dodawaj etykiety na krawędziach: A -->|"tak"| B
5. Grupuj powiązane węzły w subgraphy
6. Używaj classDef do kolorowania: classDef decision fill:#60a5fa,stroke:#60a5fa
7. Maksymalnie 15 węzłów
8. Zwracaj TYLKO kod mermaid w bloku \`\`\`mermaid

Przykład:
\`\`\`mermaid
flowchart TD
  A[Start: Ofertowanie] --> B{Wykryto zlecenie?}
  B -->|"tak"| C[Analiza opisu]
  B -->|"nie"| D[Czekaj]
  C --> E[Wygeneruj wycenę]
  E --> F[Wyślij ofertę]
  D --> B
\`\`\``;