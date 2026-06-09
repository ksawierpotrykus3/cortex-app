import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const key = (import.meta as any).env?.VITE_GEMINI_API_KEY || localStorage.getItem('nexus_gemini_key') || (window as any).__nexusState?.geminiKey;
    if (!key) throw new Error('Brak GEMINI_API_KEY — ustaw w Settings (Google AI Studio Key)');
    aiInstance = new GoogleGenAI({ apiKey: key });
  }
  return aiInstance;
}

export interface GeminiVisionResult {
  text: string;      // co Gemini wygenerował (HTML + [TEXT])
  raw: string;       // surowy response text (HTML część)
}

let processing = false;
const queue: Array<() => Promise<void>> = [];

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;
  const task = queue.shift()!;
  await task();
  processing = false;
  setTimeout(processQueue, 500); // Small delay between requests to be safe with rate limits
}

/**
 * Wysyła obraz do Gemini 2.5 Flash / Flash Lite z promptem
 * @param dataUrl - base64 data URL (data:image/png;base64,...)
 * @param prompt - prompt dla Gemini
 * @returns HTML + extracted text
 */
export function analyzeImageWithGemini(
  dataUrl: string,
  prompt?: string
): Promise<GeminiVisionResult> {
  return new Promise((resolve, reject) => {
    queue.push(async () => {
      try {
        const ai = getAI();

        // Wydziel base64 części bez prefixu "data:image/png;base64,"
        const base64Data = dataUrl.split(',')[1];
        const mimeType = dataUrl.match(/data:([^;]+);/)?.[1] || 'image/png';

        const defaultPrompt = `Jesteś asystentem w aplikacji Nexus — systemie do zarządzania notatkami, zadaniami i wiedzą.

Zrób z tego obrazu DWIE RZECZY:

1. OPIS WIZUALNY (HTML):
   - Opisz szczegółowo co widać na obrazie
   - Użyj <strong>, <em>, <ul><li> do strukturyzacji
   - Jeśli to screenshot UI: wymień wszystkie przyciski, napisy, elementy
   - Jeśli to dokument: podaj tytuł, sekcje, kluczowe informacje
   - Jeśli to rysunek/szkic: opisz co przedstawia

2. WYODRĘDNIONY TEKST ([TEXT] blok):
   - Na KONIEC odpowiedzi dodaj block:
   [TEXT]
   Tutaj wklej cały widoczny tekst ze zdjęcia (verbatim)
   [/TEXT]

WAŻNE:
- Odpowiedz po POLSKU
- Jeśli tekst na obrazie jest po angielsku — przetłumacz go w opisie, ale w [TEXT] zostaw oryginał
- Jeśli obraz jest pusty/nieczytelny — powiedz to wprost
- Maksymalnie 1000 słów w opisie`;

        const fetchPromise = ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt || defaultPrompt },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          config: {
            temperature: 0.4,
            maxOutputTokens: 4096,
          },
        });

        const timeoutPromise = new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout: Gemini API took longer than 30s")), 30000)
        );

        const response = await Promise.race([fetchPromise, timeoutPromise]);

        const raw = response.text || '';
        
        // Parsuj [TEXT] blok jeśli istnieje
        const textMatch = raw.match(/\[TEXT\]([\s\S]*?)\[\/TEXT\]/i);
        const extractedText = textMatch ? textMatch[1].trim() : '';
        
        // HTML = całość minus [TEXT] blok
        const htmlPart = raw.replace(/\[TEXT\][\s\S]*?\[\/TEXT\]/gi, '').trim();

        resolve({
          text: extractedText || raw, 
          raw: htmlPart,              
        });
      } catch (err) {
        reject(err);
      }
    });

    processQueue();
  });
}
