import { useEffect } from 'react';
import { fileToDataURL } from '../utils/image';

type PasteHandler = (imageData: { dataUrl: string; mimeType: string; name: string }) => void;

export function useClipboardPaste(onImagePaste: PasteHandler) {
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Ignoruj jeśli focus jest w input/textarea (użytkownik może chcieć wkleić tekst)
      const target = e.target as HTMLElement;
      const isInput = target?.tagName === 'INPUT' 
                   || target?.tagName === 'TEXTAREA' 
                   || target?.isContentEditable;

      if (isInput) return; // nie przerywaj pisania

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault(); // ZATRZYMAJ domyślne wklejenie
          
          const file = item.getAsFile();
          if (!file) continue;

          try {
            const dataUrl = await fileToDataURL(file);
            const mimeType = item.type; // np. "image/png"

            onImagePaste({ dataUrl, mimeType, name: file.name || 'screenshot.png' });
          } catch (err) {
            console.error("Paste image failed:", err);
            alert("Nie udało się pomyślnie odczytać wklejonego obrazu.");
          }
          break; // tylko pierwszy obraz
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onImagePaste]);
}
