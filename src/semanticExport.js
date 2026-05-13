const DEFAULT_NOTE_SIZE = { width: 240, height: 80 };
const DEFAULT_SCREENSHOT_SIZE = { width: 400, height: 300 };
const DEFAULT_TYPES = {
  aksjomat: 'Aksjomat',
  pewnik: 'Pewnik',
  przeblysk: 'Przebłysk',
  rozrzutka: 'Rozrzutka',
  problem: 'Problem',
};

export function buildSemanticExport(state = {}) {
  const rawNodes = Array.isArray(state.nodes) ? state.nodes : [];
  const nodes = rawNodes
    .filter(isMeaningfulNode)
    .sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));

  const idMap = new Map(nodes.map((node, index) => [node.id, `n${index + 1}`]));
  const bounds = getBoardBounds(nodes);
  const rows = assignBands(nodes, 'y', 180);
  const cols = assignBands(nodes, 'x', 300);

  const items = nodes.map(node => buildItem(node, {
    id: idMap.get(node.id),
    bounds,
    row: rows.get(node.id) || 1,
    col: cols.get(node.id) || 1,
  }));

  const connections = buildConnections(state.links, idMap);
  const drawings = buildDrawings(state.strokes);
  const types = buildTypes(state.categories, nodes);

  const result = {
    schema: 'cortex.visible.v1',
    board: {
      counts: {
        items: items.length,
        screens: items.filter(item => item.kind === 'screen').length,
        connections: connections.length,
        drawings: drawings.length,
      },
      bounds,
      readingOrder: items.map(item => item.id),
    },
    types,
    items,
  };

  if (connections.length) result.connections = connections;
  if (drawings.length) result.drawings = drawings;

  return result;
}

export function buildSemanticContext(state = {}) {
  return JSON.stringify(buildSemanticExport(state));
}

function buildItem(node, layout) {
  const type = cleanText(node.type) || 'note';
  const title = cleanText(node.title);
  const content = cleanText(node.content);
  const screen = parseVisionDescription(node.imageDescription);
  const isScreen = isScreenshotNode(node);
  const size = getDisplaySize(node);

  const item = {
    id: layout.id,
    type,
    where: {
      pos: [round(node.x), round(node.y)],
      zone: getZone(node, layout.bounds),
      row: layout.row,
      col: layout.col,
    },
  };

  if (isScreen) {
    item.kind = 'screen';
    item.size = [size.width, size.height];
  }

  if (title) item.title = title;

  if (isScreen) {
    if (content) item.note = content;
    if (screen.text) item.screenText = screen.text;
    item.screenDescription = screen.description || '[brak opisu AI]';
  } else if (content) {
    item.text = content;
  }

  const scale = Number(node.cardScale || 1);
  if (!isScreen && Number.isFinite(scale) && Math.abs(scale - 1) > 0.01) {
    item.size = [size.width, size.height];
  }

  return item;
}

function buildTypes(categories = [], nodes = []) {
  const used = new Set(nodes.map(node => cleanText(node.type)).filter(Boolean));
  const types = {};

  for (const id of [...used].sort()) {
    const category = Array.isArray(categories)
      ? categories.find(cat => cat.id === id)
      : null;
    types[id] = cleanText(category?.name) || DEFAULT_TYPES[id] || id;
  }

  return types;
}

function buildConnections(links = [], idMap) {
  if (!Array.isArray(links)) return [];

  const seen = new Set();
  const connections = [];

  for (const link of links) {
    const source = endpointId(link?.source);
    const target = endpointId(link?.target);
    const from = idMap.get(source);
    const to = idMap.get(target);
    if (!from || !to || from === to) continue;

    const key = [from, to].sort().join('|');
    if (seen.has(key)) continue;

    seen.add(key);
    connections.push([from, to]);
  }

  return connections;
}

function buildDrawings(strokes = []) {
  if (!Array.isArray(strokes)) return [];

  return strokes
    .map((stroke, index) => {
      const points = normalizePoints(stroke?.points);
      if (points.length < 2) return null;

      const simplified = capPolyline(simplifyPolyline(points, 10), 24);
      const box = getPointBounds(points);
      const mark = {
        id: `d${index + 1}`,
        box: [box.left, box.top, box.right, box.bottom],
        path: simplified.map(point => [point.x, point.y]),
      };

      const width = round(stroke.width);
      const color = cleanText(stroke.color).toLowerCase();

      if (width && width !== 2) mark.width = width;
      if (color && color !== '#ffffff' && color !== 'white') mark.color = color;

      return mark;
    })
    .filter(Boolean);
}

function parseVisionDescription(value) {
  const text = cleanText(value);
  if (!text) return { text: '', description: '' };

  const textMatch = text.match(/(?:^|\n)\s*TEKST\s*:\s*([\s\S]*?)(?=\n\s*OPIS\s*:|$)/i);
  const descriptionMatch = text.match(/(?:^|\n)\s*OPIS\s*:\s*([\s\S]*)$/i);

  if (!textMatch && !descriptionMatch) {
    return { text: '', description: text };
  }

  return {
    text: cleanText(textMatch?.[1]),
    description: cleanText(descriptionMatch?.[1]),
  };
}

function isMeaningfulNode(node) {
  if (!node) return false;
  return Boolean(
    cleanText(node.title) ||
    cleanText(node.content) ||
    cleanText(node.imageDescription) ||
    isScreenshotNode(node)
  );
}

function isScreenshotNode(node) {
  return Boolean(node?.image || node?.imageDescription || node?.imageWidth || node?.imageHeight);
}

function getDisplaySize(node) {
  const scale = Number.isFinite(Number(node.cardScale)) ? Number(node.cardScale) : 1;
  if (isScreenshotNode(node)) {
    return {
      width: round((Number(node.imageWidth) || DEFAULT_SCREENSHOT_SIZE.width) * scale),
      height: round((Number(node.imageHeight) || DEFAULT_SCREENSHOT_SIZE.height) * scale),
    };
  }

  return {
    width: round(DEFAULT_NOTE_SIZE.width * scale),
    height: round(DEFAULT_NOTE_SIZE.height * scale),
  };
}

function getBoardBounds(nodes) {
  if (!nodes.length) return { left: 0, top: 0, right: 0, bottom: 0 };

  return nodes.reduce((bounds, node) => {
    const size = getDisplaySize(node);
    const left = round(node.x);
    const top = round(node.y);
    const right = round((node.x ?? 0) + size.width);
    const bottom = round((node.y ?? 0) + size.height);

    return {
      left: Math.min(bounds.left, left),
      top: Math.min(bounds.top, top),
      right: Math.max(bounds.right, right),
      bottom: Math.max(bounds.bottom, bottom),
    };
  }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
}

function assignBands(nodes, axis, gap) {
  const center = axis === 'x'
    ? node => (node.x ?? 0) + getDisplaySize(node).width / 2
    : node => (node.y ?? 0) + getDisplaySize(node).height / 2;

  const sorted = [...nodes].sort((a, b) => center(a) - center(b));
  const result = new Map();
  let band = 0;
  let previous = null;

  for (const node of sorted) {
    const value = center(node);
    if (previous === null || value - previous > gap) band += 1;
    result.set(node.id, band);
    previous = value;
  }

  return result;
}

function getZone(node, bounds) {
  const size = getDisplaySize(node);
  const width = Math.max(1, bounds.right - bounds.left);
  const height = Math.max(1, bounds.bottom - bounds.top);
  const xRatio = ((node.x ?? 0) + size.width / 2 - bounds.left) / width;
  const yRatio = ((node.y ?? 0) + size.height / 2 - bounds.top) / height;

  const horizontal = xRatio < 1 / 3 ? 'left' : xRatio < 2 / 3 ? 'center' : 'right';
  const vertical = yRatio < 1 / 3 ? 'top' : yRatio < 2 / 3 ? 'middle' : 'bottom';

  return `${vertical}-${horizontal}`;
}

function normalizePoints(points = []) {
  if (!Array.isArray(points)) return [];

  const normalized = [];
  for (const point of points) {
    const x = round(point?.x);
    const y = round(point?.y);
    const last = normalized[normalized.length - 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (last && last.x === x && last.y === y) continue;
    normalized.push({ x, y });
  }

  return normalized;
}

function simplifyPolyline(points, epsilon) {
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }

  if (maxDistance <= epsilon) return [first, last];

  const left = simplifyPolyline(points.slice(0, index + 1), epsilon);
  const right = simplifyPolyline(points.slice(index), epsilon);
  return left.slice(0, -1).concat(right);
}

function capPolyline(points, maxPoints) {
  if (points.length <= maxPoints) return points;

  const capped = [];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i += 1) {
    capped.push(points[Math.round(i * step)]);
  }

  return normalizePoints(capped);
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }

  return Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) /
    Math.hypot(dx, dy);
}

function getPointBounds(points) {
  return points.reduce((bounds, point) => ({
    left: Math.min(bounds.left, point.x),
    top: Math.min(bounds.top, point.y),
    right: Math.max(bounds.right, point.x),
    bottom: Math.max(bounds.bottom, point.y),
  }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
}

function endpointId(endpoint) {
  return typeof endpoint === 'object' && endpoint !== null ? endpoint.id : endpoint;
}

function cleanText(value) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function round(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : 0;
}
