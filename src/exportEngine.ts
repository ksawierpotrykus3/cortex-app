import { NexusNode, NexusLink } from "./types";

export function generateAIExport(
  nodes: NexusNode[],
  links: NexusLink[],
  axioms: string
): string {
  const exportObject: any = {};

  if (axioms) {
    exportObject.axioms = axioms;
  }

  exportObject.nodes = nodes.map(n => ({
    id: n.id,
    title: n.title,
    project: n.projectId || 'Uncategorized',
    content: n.content,
    ...(n.annotations && n.annotations.length > 0 ? { annotations: n.annotations } : {})
  }));

  if (nodes.some(n => n.imageAttachments?.length)) {
    exportObject.images = nodes.flatMap(n => 
      (n.imageAttachments || []).map(att => ({
        nodeId: n.id,
        mimeType: att.mimeType,
        geminiText: att.geminiResponse?.slice(0, 500), 
        filePath: `./attachments/${n.id}/${att.id}.${att.mimeType.split('/')[1]}`,
      }))
    );
  }

  if (links && links.length > 0) {
    exportObject.topology = links.map(l => ({
      source: l.source,
      target: l.target
    }));
  }

  return JSON.stringify(exportObject, null, 2);
}

export function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
