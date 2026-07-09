// ============================================================================
// NEXUS — DocumentPanel
// Panel dokumentów projektu w trybie eksperymentalnym
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';

interface ProjectDocument {
  id: string;
  project_id: string;
  name: string;
  file_type: string;
  content: string;
  summary: string | null;
  token_count: number;
  file_size: number;
  imported_at: string;
}

interface DocumentPanelProps {
  projectId: string;
  onUseFullContent: (docName: string, content: string) => void;
}

export function DocumentPanel({ projectId, onUseFullContent }: DocumentPanelProps) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [importingFiles, setImportingFiles] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = async () => {
    if (!projectId) return;
    try {
      const bridge = (window as any).nexusBridge;
      if (bridge?.expGetDocuments) {
        const docs = await bridge.expGetDocuments({ projectId });
        setDocuments(docs || []);
      }
    } catch (err) {
      console.error('[DocumentPanel] Failed to load documents:', err);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [projectId]);

  const handleImportClick = () => {
    if (documents.length >= 50) {
      setError('Osiągnięto limit 50 dokumentów. Usuń niepotrzebne przed dodaniem nowych.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const bridge = (window as any).nexusBridge;
    if (!bridge?.expImportDocument) {
      setError('Bridge IPC nie jest dostępny.');
      return;
    }

    setError(null);
    const newImporting = new Set(importingFiles);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      const filePath = (file as any).path;
      if (!filePath) {
        // Browser fallback — użyj FileReader
        const reader = new FileReader();
        reader.onload = async (evt) => {
          const content = evt.target?.result as string;
          if (content) {
            // W przeglądarce nie mamy ścieżki — pomijamy
            setError('Import plików wymaga Electron (ścieżka pliku).');
          }
        };
        reader.readAsText(file);
        continue;
      }

      newImporting.add(file.name);
      setImportingFiles(new Set(newImporting));

      try {
        const result = await bridge.expImportDocument({ projectId, filePath });
        if (!result.success) {
          setError(`Błąd importu ${file.name}: ${result.error}`);
        }
      } catch (err: any) {
        setError(`Błąd importu ${file.name}: ${err.message}`);
      } finally {
        newImporting.delete(file.name);
        setImportingFiles(new Set(newImporting));
      }
    }

    await loadDocuments();
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (docId: string) => {
    try {
      const bridge = (window as any).nexusBridge;
      if (bridge?.expDeleteDocument) {
        await bridge.expDeleteDocument({ id: docId });
        setDocuments(prev => prev.filter(d => d.id !== docId));
      }
    } catch (err) {
      console.error('[DocumentPanel] Delete failed:', err);
    }
  };

  const handleUseFullContent = async (doc: ProjectDocument) => {
    try {
      const bridge = (window as any).nexusBridge;
      if (bridge?.expGetDocumentContent) {
        const result = await bridge.expGetDocumentContent({ id: doc.id });
        if (result.success && result.content) {
          onUseFullContent(doc.name, result.content);
        }
      }
    } catch (err) {
      console.error('[DocumentPanel] Get content failed:', err);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string): string => {
    try {
      return new Date(iso).toLocaleDateString('pl-PL');
    } catch {
      return iso;
    }
  };

  const fileTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      pdf: 'bg-red-900/30 text-red-300',
      docx: 'bg-blue-900/30 text-blue-300',
      txt: 'bg-gray-700 text-gray-300',
      md: 'bg-green-900/30 text-green-300',
    };
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${colors[type] || 'bg-gray-700 text-gray-300'}`}>
        {type}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#0a0e14', color: '#c9d1d9' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: '#21262d' }}>
        <h3 className="text-sm font-semibold">Dokumenty projektu</h3>
        <button
          onClick={handleImportClick}
          disabled={documents.length >= 50}
          className="text-xs px-2 py-1 rounded cursor-pointer transition-colors"
          style={{ background: '#1a1f2e', color: '#58a6ff', border: '1px solid #30363d' }}
        >
          Importuj pliki
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.docx"
          onChange={handleFilesSelected}
          className="hidden"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-1.5 text-xs" style={{ color: '#f85149', background: '#1a0a0a' }}>
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">x</button>
        </div>
      )}

      {/* Document List */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {documents.length === 0 ? (
          <div className="text-xs text-center py-8" style={{ color: '#8b949e' }}>
            Brak zaimportowanych dokumentow. Uzyj przycisku Importuj pliki powyzej.
          </div>
        ) : (
          documents.map(doc => (
            <div
              key={doc.id}
              className="mb-1 p-2 rounded border text-xs"
              style={{ background: '#1a1f2e', borderColor: '#21262d' }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 truncate">
                  {fileTypeBadge(doc.file_type)}
                  <span className="font-medium truncate">{doc.name}</span>
                </div>
                <span style={{ color: '#8b949e' }}>{formatDate(doc.imported_at)}</span>
              </div>
              <div className="flex items-center gap-3 mb-1" style={{ color: '#8b949e' }}>
                <span>{formatSize(doc.file_size)}</span>
                <span>{doc.token_count} tokenów</span>
                {doc.summary && <span style={{ color: '#3fb950' }}>streszczony</span>}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleUseFullContent(doc)}
                  className="text-[11px] px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                  style={{ background: '#0d419d20', color: '#58a6ff' }}
                  title="Dodaj pełną treść do następnego promptu"
                >
                  Użyj pełnej treści
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="text-[11px] px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                  style={{ background: '#f8514920', color: '#f85149' }}
                >
                  Usuń
                </button>
              </div>
              {/* Loading indicator for importing */}
              {importingFiles.size > 0 && (
                <div className="mt-1 text-xs" style={{ color: '#d2991d' }}>Importowanie...</div>
              )}
            </div>
          ))
        )}
        {importingFiles.size > 0 && documents.length === 0 && (
          <div className="text-xs text-center py-4" style={{ color: '#d2991d' }}>
            Importowanie {importingFiles.size} plików...
          </div>
        )}
      </div>

      {/* Info footer */}
      <div className="px-3 py-1.5 text-[10px] border-t" style={{ borderColor: '#21262d', color: '#484f58' }}>
        {documents.length}/50 dokumentów · PDF, TXT, MD, DOCX
      </div>
    </div>
  );
}