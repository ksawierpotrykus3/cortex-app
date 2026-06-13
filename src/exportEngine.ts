import { NexusNode, NexusLink, ExportScope, DEFAULT_EXPORT_SCOPE, ViewMode } from "./types";

// ─── Presety per-widok ───────────────────────────────────────
// Każdy widok ma określone co domyślnie exportuje.
// Gdy ViewsCount zmieni typ na Extract, zrobi się z tego
// Record<ViewMode, ExportScope> ale póki co presety są ręczne.
export type ExportPreset = {
  label: string;       // Nazwa do filename: "nexus", "tasks", "drafts"...
  scope: ExportScope;  // Domylny zakres dla tego widoku
};

export const VIEW_EXPORT_PRESETS: Record<string, ExportPreset> = {
  nexus:         { label: "nexus",       scope: { ...DEFAULT_EXPORT_SCOPE } },
  "lab-todo":    { label: "tasks",       scope: { ...DEFAULT_EXPORT_SCOPE, nodes: false, tasks: true } },
  "lab-writing": { label: "drafts",      scope: { ...DEFAULT_EXPORT_SCOPE, nodes: false, drafts: true } },
  sandbox:       { label: "sandbox",     scope: { ...DEFAULT_EXPORT_SCOPE, nodes: true, links: false, tasks: false, drafts: false, axioms: false, images: false } },
  "raw-fragments": { label: "fragments", scope: { ...DEFAULT_EXPORT_SCOPE, nodes: true } },
  logs:          { label: "logs",        scope: { nodes: false, links: false, tasks: false, drafts: false, axioms: false, images: false, onlySelected: false } },
  draft:         { label: "draft",       scope: { ...DEFAULT_EXPORT_SCOPE } },
  agents:        { label: "agents",      scope: { nodes: false, links: false, tasks: false, drafts: false, axioms: false, images: false, onlySelected: false } },
  changes:       { label: "changes",     scope: { ...DEFAULT_EXPORT_SCOPE } },
  wiki:          { label: "wiki",        scope: { ...DEFAULT_EXPORT_SCOPE } },
  git:           { label: "git",         scope: { ...DEFAULT_EXPORT_SCOPE } },
};

/**
 * Zwraca preset dla danego widoku.
 * Jeśli widok nie ma presetu → DEFAULT_EXPORT_SCOPE.
 */
export function getExportPreset(view?: ViewMode | string): ExportPreset {
  if (view && VIEW_EXPORT_PRESETS[view]) {
    return VIEW_EXPORT_PRESETS[view];
  }
  return { label: "nexus", scope: { ...DEFAULT_EXPORT_SCOPE } };
}

// ─── Export data shapes ───────────────────────────────────────

export interface TaskExport {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  projectId?: string;
}

export interface DraftExport {
  id: string;
  title: string;
  content: string;
  status: string;
  folderId?: string;
}

// ─── Główna funkcja eksportu ──────────────────────────────────

/**
 * generateAIExport — generuje JSON z danymi workspace według scope.
 * Jeśli scope nie podany → DEFAULT_EXPORT_SCOPE (backwards compatible).
 *
 * Zastępuje starą generateAIExport oraz exportWorkspace (był martwym kodem).
 */
export function generateAIExport(
  nodes: NexusNode[],
  links: NexusLink[],
  axioms: string,
  scope?: Partial<ExportScope>,
  tasks?: TaskExport[],
  drafts?: DraftExport[]
): string {
  const s: ExportScope = { ...DEFAULT_EXPORT_SCOPE, ...scope };

  const exportObject: Record<string, unknown> = {};

  if (s.axioms && axioms.trim()) {
    exportObject.axioms = axioms;
  }

  if (s.nodes) {
    exportObject.nodes = nodes.map((n) => ({
      id: n.id,
      title: n.title,
      project: n.projectId || "Uncategorized",
      content: n.content,
      ...(n.annotations && n.annotations.length > 0 ? { annotations: n.annotations } : {}),
    }));
  }

  if (s.images && nodes.some((n) => n.imageAttachments?.length)) {
    exportObject.images = nodes.flatMap((n) =>
      (n.imageAttachments || []).map((att) => ({
        nodeId: n.id,
        mimeType: att.mimeType,
        geminiText: att.geminiResponse?.slice(0, 500),
        filePath: `./attachments/${n.id}/${att.id}.${att.mimeType.split("/")[1]}`,
      }))
    );
  }

  if (s.links && links && links.length > 0) {
    exportObject.topology = links.map((l) => ({
      source: l.source,
      target: l.target,
    }));
  }

  if (s.tasks && tasks && tasks.length > 0) {
    exportObject.tasks = tasks;
  }

  if (s.drafts && drafts && drafts.length > 0) {
    exportObject.drafts = drafts;
  }

  exportObject._meta = {
    exportedAt: new Date().toISOString(),
    scopes: s,
    nodeCount: nodes.length,
    linkCount: links.length,
  };

  return JSON.stringify(exportObject, null, 2);
}

// ─── Nazwy plików ─────────────────────────────────────────────

export function sanitizeFilename(name: string): string {
  const sanitized = name
    .replace(/[ąáàâä]/gi, "a")
    .replace(/[ćč]/gi, "c")
    .replace(/[ęéèêë]/gi, "e")
    .replace(/[ł]/gi, "l")
    .replace(/[ńň]/gi, "n")
    .replace(/[óòôö]/gi, "o")
    .replace(/[śš]/gi, "s")
    .replace(/[źżž]/gi, "z")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
  return sanitized || "export";
}

/**
 * generateExportFilename — generuje nazwę pliku.
 * Format: {label}_{YYYY-MM-DD}.json
 * label pochodzi z presetu widoku lub jest dowolnym stringiem.
 */
export function generateExportFilename(label: string, date: Date = new Date()): string {
  const dateStr = date.toISOString().split("T")[0];
  const clean = sanitizeFilename(label);
  return `${clean}_${dateStr}.json`;
}

// ─── Download ──────────────────────────────────────────────────

export function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
