const VISION_API_KEY_STORAGE = 'cortex-vision-api-key';
const VISION_MODEL = 'gemini-3.1-flash-lite';
const VISION_PROMPT = `To jest screenshot wrzucony do osobistej tablicy Cortex.

Najpierw potraktuj go jak OCR:
1. Odczytaj widoczny tekst jak najwierniej.
2. Jezeli tekst jest maly, korzystaj tez z powiekszonych wycinkow obrazu.
3. Nie udawaj pewnosci. Jesli fragment jest nieczytelny, napisz [nieczytelne].

Odpowiedz po polsku w tym formacie:
TEKST:
<przepisany tekst lub najwazniejsze fragmenty>

OPIS:
<krotko co przedstawia screenshot>

Nie dodawaj sekcji UWAGI, wnioskow, porad ani interpretacji.`;

class Vision {
  constructor() {
    this.apiKey = localStorage.getItem(VISION_API_KEY_STORAGE) || '';
  }

  setApiKey(key) {
    this.apiKey = key.trim();
    localStorage.setItem(VISION_API_KEY_STORAGE, this.apiKey);
  }

  getApiKey() {
    return this.apiKey;
  }

  hasApiKey() {
    return this.apiKey.length > 0;
  }

  /**
   * Compress an image File/Blob to JPEG base64, preserving original size.
   * @param {File|Blob} file
   * @param {number} quality
   * @returns {Promise<{dataUrl: string, width: number, height: number}>}
   */
  compressImage(file, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);

        const w = img.width;
        const h = img.height;

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({ dataUrl, width: w, height: h });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  _loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  _cropToJpeg(img, crop, maxSide = 1600) {
    const scale = Math.min(maxSide / Math.max(crop.w, crop.h), 3);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(crop.w * scale));
    canvas.height = Math.max(1, Math.round(crop.h * scale));

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      img,
      crop.x, crop.y, crop.w, crop.h,
      0, 0, canvas.width, canvas.height
    );

    return canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
  }

  async _buildVisionImageParts(base64DataUrl) {
    const img = await this._loadImage(base64DataUrl);
    const crops = [
      { x: 0, y: 0, w: img.width, h: img.height },
    ];

    if (img.width >= 900 || img.height >= 700) {
      crops.push(
        { x: 0, y: 0, w: img.width / 2, h: img.height },
        { x: img.width / 2, y: 0, w: img.width / 2, h: img.height },
        { x: 0, y: 0, w: img.width, h: img.height / 2 },
        { x: 0, y: img.height / 2, w: img.width, h: img.height / 2 }
      );
    }

    return crops.map(crop => ({
      inlineData: {
        mimeType: 'image/jpeg',
        data: this._cropToJpeg(img, crop)
      }
    }));
  }

  /**
   * Send image to Gemini Flash Vision for analysis.
   * @param {string} base64DataUrl - data:image/jpeg;base64,...
   * @returns {Promise<string>} description text
   */
  async analyzeImage(base64DataUrl) {
    if (!this.hasApiKey()) {
      return '[Brak API key — ustaw w ⚙️]';
    }

    if (!base64DataUrl.includes(',')) return '[Błąd: nieprawidłowy format obrazu]';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${this.apiKey}`;

    try {
      const imageParts = await this._buildVisionImageParts(base64DataUrl);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: VISION_PROMPT },
              ...imageParts
            ]
          }]
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData?.error?.message || response.statusText;
        console.error('Vision API error:', msg);
        return `[Błąd API: ${msg}]`;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return text || '[Flash nie zwrócił opisu]';
    } catch (err) {
      console.error('Vision fetch error:', err);
      return `[Błąd sieci: ${err.message}]`;
    }
  }

  /**
   * Ask a custom question about an image.
   * @param {string} base64DataUrl
   * @param {string} question - user's question
   * @returns {Promise<string>}
   */
  async queryImage(base64DataUrl, question) {
    if (!this.hasApiKey()) return '[Brak API key]';

    const base64 = base64DataUrl.split(',')[1];
    if (!base64) return '[Błąd formatu]';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${this.apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: question },
              { inlineData: { mimeType: 'image/jpeg', data: base64 } }
            ]
          }]
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return `[Błąd: ${errData?.error?.message || response.statusText}]`;
      }

      const data = await response.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || '[Brak odpowiedzi]';
    } catch (err) {
      return `[Błąd: ${err.message}]`;
    }
  }

  /**
   * Text-only query to Flash (no image).
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async queryText(prompt) {
    if (!this.hasApiKey()) return '[Brak API key]';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || response.statusText);
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '[Brak odpowiedzi]';
  }
}
export const vision = new Vision();
