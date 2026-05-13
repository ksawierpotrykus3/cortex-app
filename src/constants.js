export const COLORS = {
  aksjomat: '#e5a54b',
  pewnik: '#c4a43a',
  przeblysk: '#4da8a0',
  rozrzutka: '#7c6cb5',
  problem: '#c45c5c',
  accent: '#4f46e5',
  accentHover: '#5b52f0',
  border: '#2a2a32',
  surface: '#17171c',
  surfaceHover: '#1f1f26',
  bgPrimary: '#0f0f12',
  textPrimary: '#ededef',
  textSecondary: '#8b8b94',
  textMuted: '#55555e',
  drawDefault: '#ffffff',
};

export const NOTE_CONFIG = {
  width: 240,
  minHeight: 80,
  borderRadius: 10,
  accentBarWidth: 4,
  padding: 14,
  titleFontSize: 13,
  bodyFontSize: 11,
  maxBodyLines: 3,
  lineHeight: 15,
  expandGap: 24,          // Min gap between expanded notes
  charsPerLine: 32,       // Approx chars that fit per line at bodyFontSize
};

export const CANVAS_CONFIG = {
  zoomRange: [0.08, 4],
  zoomSemanticTitleOnly: 0.45,
  zoomSemanticDot: 0.2,
  gridSize: 40,
  newNoteSpread: 30,
};

export const DRAW_CONFIG = {
  defaultColor: '#ffffff',
  defaultWidth: 2,
  minDistance: 3,          // Min px between recorded points (perf)
};

export const SCREENSHOT_CONFIG = {
  width: 380,              // Card width for screenshot nodes
  height: 280,             // Card height for screenshot nodes
  maxPx: 800,              // Max image dimension for compression
  quality: 0.7,            // JPEG quality
  imgPadding: 10,          // Padding around image inside card
  imgTopOffset: 24,        // Y offset for image (below type label)
  descLines: 2,            // Max description lines on card
};

export const STORAGE_KEY = 'cortex-data-v2';
