import {
  ROOT_LAYER_ID,
  buildLayerPath,
  getEndpointId,
  migrateState,
  nodeMatchesExportScope,
  resolveExportScope,
  resolveLayerTitle,
  strokeMatchesScope,
} from './schema.js';

const DEFAULT_NOTE_SIZE = { width: 240, height: 80 };
const DEFAULT_SCREENSHOT_SIZE = { width: 400, height: 300 };
const DEFAULT_TYPES = {
  aksjomat: 'Aksjomat',
  pewnik: 'Pewnik',
  przeblysk: 'Przebłysk',
  rozrzutka: 'Rozrzutka',
  problem: 'Problem',
};

export function buildSemanticExport(state = {}, options = {}) {
  const safeState = migrateState(state);
  const scope = resolveExportScope(safeState, options);
  const selectedIds = scope.type === 'selection' ? scope.selectedIds : [];
  const rawNodes = safeState.nodes.filter(node => nodeMatchesExportScope(node, scope, selectedIds));
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

  const connections = buildConnections(safeState.links, idMap);
  const externalConnections = buildExternalConnections(safeState.links, idMap, safeState);
  const drawings = buildDrawings(safeState.strokes.filter(stroke => strokeMatchesScope(stroke, scope)));
  const types = buildTypes(safeState.categories, nodes);

  const result = {
    schema: 'cortex.visible.v2',
    scope: buildScopeInfo(safeState, scope),
    ai_context: {
      purpose: 'Widzialny zapis tablicy Cortex dla modelu AI.',
      reading_rules: [
        'Czytaj tylko elementy opisane w JSON.',
        'Obrazy nie sa osadzane; screen reprezentuje opis AI/Flash i notatka użytkownika.',
        'ROBOCZE to surowiec, PLAN to przetworzona struktura.',
        'Pozycje, kolejność, warstwy, projekty, priorytet i połączenia mają znaczenie.',
      ],
      stages: {
        robocze: 'chaotyczny surowiec, screeny, fragmenty rozmów, pomysły',
        plan: 'przetworzony fundament, cel, mechanizm, feature, decyzja, pytanie albo next step',
      },
    },
    board: {
      counts: {
        items: items.length,
        screens: items.filter(item => item.kind === 'screen').length,
        projects: safeState.projects.length,
        layers: safeState.layers.length,
        planItems: items.filter(item => item.stage === 'plan').length,
        connections: connections.length,
        externalConnections: externalConnections.length,
        drawings: drawings.length,
      },
      bounds,
      readingOrder: items.map(item => item.id),
    },
    types,
    items,
  };

  const projects = buildProjects(safeState, nodes);
  const layers = buildLayers(safeState, nodes, scope);
  if (projects.length) result.projects = projects;
  if (layers.length) result.layers = layers;
  if (connections.length) result.connections = connections;
  if (externalConnections.length) result.externalConnections = externalConnections;
  if (drawings.length) result.drawings = drawings;
  if (options.includeInbox) result.inbox = buildInbox(safeState.inboxMessages);

  return result;
}

export function buildSemanticContext(state = {}, options = {}) {
  const payload = buildSemanticExport(state, options);
  return [
    'CORTEX_VISIBLE_CONTEXT',
    'Czytaj ten JSON jako to, co użytkownik widzi na tablicy. Nie zakładaj ukrytych danych ani obrazów.',
    JSON.stringify(payload, null, 2),
  ].join('\n\n');
}

function buildScopeInfo(state, scope) {
  const info = { type: scope.type };

  if (scope.type === 'view') {
    info.type = 'current';
    info.projectId = scope.state?.activeProjectId || 'all';
    info.layerId = scope.state?.activeLayerId || 'root';
  }

  if (scope.type === 'project') {
    const project = state.projects.find(item => item.id === scope.projectId);
    info.project = project ? { id: project.id, name: cleanText(project.name) } : { id: scope.projectId };
  }

  if (scope.type === 'layer') {
    const layer = state.layers.find(item => item.id === scope.layerId);
    info.layer = layer ? {
      id: layer.id,
      title: resolveLayerTitle(layer, state),
      originNodeId: layer.originNodeId || null,
      titleMode: layer.titleMode,
      path: buildLayerPath(layer.id, state),
    } : { id: scope.layerId };
  }

  if (scope.type === 'selection') {
    info.selectedIds = scope.selectedIds || [];
  }

  return info;
}

function buildItem(node, layout) {
  const type = cleanText(node.type) || 'note';
  const title = cleanText(node.title);
  const content = cleanText(node.content);
  const screen = parseVisionDescription(node.imageDescription);
  const isScreen = isScreenshotNode(node);
  const size = getDisplaySize(node);
  const rawState = node.rawState || 'raw';
  const isHidden = rawState === 'hidden';

  const item = {
    id: layout.id,
    type,
    category: type,
    priority: clampPriority(node.priority),
    rawState,
    stage: node.stage || 'robocze',
    where: {
      pos: [round(node.x), round(node.y)],
      zone: getZone(node, layout.bounds),
      row: layout.row,
      col: layout.col,
      layerId: node.layerId || ROOT_LAYER_ID,
    },
    chronology: {
      createdAt: node.createdAt || '',
      updatedAt: node.updatedAt || node.createdAt || '',
    },
  };

  if (node.projectId) item.projectId = cleanText(node.projectId);
  if (node.sourceIds?.length) item.sourceIds = node.sourceIds;
  if (node.stage === 'plan' && node.planKind) item.planKind = node.planKind;
  if (title) item.title = title;
  if (rawState === 'hidden' || rawState === 'archived') item.visualState = rawState;
  if (rawState === 'archived') item.visualWeight = 'low';

  if (isScreen) {
    item.kind = 'screen';
    if (!isHidden) {
      item.imageSize = [size.width, size.height];
      if (content) item.note = content;
      if (screen.text) item.screenText = screen.text;
      item.screenDescription = screen.description || '[brak opisu AI]';
    }
  } else if (content && !isHidden) {
    item.text = content;
  }

  const scale = Number(node.cardScale || 1);
  if (!isScreen && Number.isFinite(scale) && Math.abs(scale - 1) > 0.01) {
    item.size = [size.width, size.height];
  }

  return item;
}

function buildProjects(state, visibleNodes) {
  const usedProjectIds = new Set(visibleNodes.map(node => node.projectId).filter(Boolean));
  return state.projects
    .filter(project => usedProjectIds.has(project.id))
    .map(project => ({
      id: project.id,
      name: cleanText(project.name),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }));
}

function buildLayers(state, visibleNodes, scope) {
  const usedLayerIds = new Set(visibleNodes.map(node => node.layerId || ROOT_LAYER_ID));
  if (scope.type === 'layer') usedLayerIds.add(scope.layerId);
  if (scope.type === 'view') usedLayerIds.add(scope.state?.activeLayerId || ROOT_LAYER_ID);
  if (scope.type === 'all') state.layers.forEach(layer => usedLayerIds.add(layer.id));

  return state.layers
    .filter(layer => usedLayerIds.has(layer.id))
    .map(layer => ({
      id: layer.id,
      title: resolveLayerTitle(layer, state),
      titleMode: layer.titleMode,
      parentLayerId: layer.parentLayerId || null,
      originNodeId: layer.originNodeId || null,
      projectId: layer.projectId || null,
      path: buildLayerPath(layer.id, state),
    }));
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
    const source = getEndpointId(link?.source);
    const target = getEndpointId(link?.target);
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

function buildExternalConnections(links = [], idMap, state) {
  if (!Array.isArray(links)) return [];

  const nodeById = new Map((state.nodes || []).map(node => [node.id, node]));
  const projectById = new Map((state.projects || []).map(project => [project.id, project]));
  const seen = new Set();
  const connections = [];

  for (const link of links) {
    const source = getEndpointId(link?.source);
    const target = getEndpointId(link?.target);
    const sourceMapped = idMap.get(source);
    const targetMapped = idMap.get(target);
    if ((sourceMapped && targetMapped) || (!sourceMapped && !targetMapped)) continue;

    const externalId = sourceMapped ? target : source;
    const externalNode = nodeById.get(externalId);
    if (!externalNode) continue;

    const from = sourceMapped || buildExternalNodeRef(externalNode, projectById);
    const to = targetMapped || buildExternalNodeRef(externalNode, projectById);
    const key = `${typeof from === 'string' ? from : from.id}->${typeof to === 'string' ? to : to.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    connections.push({ from, to });
  }

  return connections;
}

function buildExternalNodeRef(node, projectById) {
  const ref = {
    id: node.id,
    title: cleanText(node.title) || cleanText(node.content) || node.id,
  };
  if (node.projectId) {
    const project = projectById.get(node.projectId);
    ref.projectId = node.projectId;
    ref.projectName = cleanText(project?.name) || node.projectId;
  }
  ref.layerId = node.layerId || ROOT_LAYER_ID;
  return ref;
}

function buildInbox(messages = []) {
  return Array.isArray(messages)
    ? messages.map(message => ({
      id: message.id,
      text: cleanText(message.text),
      createdAt: message.createdAt || '',
      ...(message.copiedAt ? { copiedAt: message.copiedAt } : {}),
    })).filter(message => message.text)
    : [];
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
        scope: stroke.scope || 'workspace',
        box: [box.left, box.top, box.right, box.bottom],
        path: simplified.map(point => [point.x, point.y]),
      };

      if (stroke.projectId) mark.projectId = stroke.projectId;
      if (stroke.layerId) mark.layerId = stroke.layerId;

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

function clampPriority(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.max(1, Math.min(10, number)) : 1;
}
