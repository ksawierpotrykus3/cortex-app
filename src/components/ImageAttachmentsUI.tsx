import React from "react";
import { Loader2, X, Expand, AlertTriangle } from "lucide-react";
import { ImageAttachment } from "../types";

export interface ImageAttachmentsUIProps {
  attachments: ImageAttachment[];
  onRemove: (id: string) => void;
}

export function ImageAttachmentsUI({ attachments, onRemove }: ImageAttachmentsUIProps) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="px-4 pb-3 flex flex-col gap-2">
      {attachments.map((att) => (
        <div key={att.id} className="relative group/img rounded-lg overflow-hidden border border-[rgb(var(--border))]">
          {/* Obraz thumbnail */}
          <img
            src={att.dataUrl}
            alt="Pasted image"
            className="w-full max-h-48 object-contain bg-black/20 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() =>window.open(att.dataUrl, '_blank')}
          />
          
          {/* Processing overlay */}
          {att.isProcessing && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
              <span className="text-white text-xs ml-2">Analizuję...</span>
            </div>
          )}

          {/* Przycisk powiększ */}
          <button
            onClick={() => window.open(att.dataUrl, '_blank')}
            className="absolute top-1 right-8 opacity-0 group-hover/img:opacity-100 bg-black/50 hover:bg-black/70 text-white p-1 rounded transition-opacity"
            title="Otwórz pełny rozmiar"
          >
            <Expand className="w-3 h-3" />
          </button>

          {/* Przycisk usuń */}
          <button
            onClick={() => onRemove(att.id)}
            className="absolute top-1 right-1 opacity-0 group-hover/img:opacity-100 bg-red-500/80 hover:bg-red-500 text-white p-1 rounded transition-opacity cursor-pointer"
            title="Usuń obraz"
          >
            <X className="w-3 h-3" />
          </button>

          {/* Gemini response preview (skrót) */}
          {att.geminiResponse && !att.isProcessing && (
            <div className="px-3 py-2 bg-[rgb(var(--panel))] text-[12px] text-[rgb(var(--text-muted))] border-t border-[rgb(var(--border))]">
              {att.geminiResponse.slice(0, 120)}...
            </div>
          )}

          {att.geminiError && (
            <div className="px-3 py-2 bg-red-500/10 text-red-400 text-[12px] border-t border-red-500/30">
              <AlertTriangle className="w-3.5 h-3.5 inline mr-1" /> {att.geminiError}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
