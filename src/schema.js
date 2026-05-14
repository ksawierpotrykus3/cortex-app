export const ROOT_LAYER_ID = 'root';

export const PLAN_KINDS = [
  'fundament',
  'cel',
  'mechanizm',
  'feature',
  'decyzja',
  'pytanie',
  'next_step',
];

const RAW_STATES = new Set(['raw', 'extracted', 'hidden', 'archived']);
const STAGES = new Set(['robocze', 'plan']);
const TITLE_MODES = new Set(['bound', 'custom']);

export function defaultCategories() {
  return [
    { id: 'aksjomat', name: 'Aksjomat', color: '#e5a54b', order: 0, isDefault: false, autoTitle: '' },
    { id: 'pewnik', name: 'Pewnik', color: '#c4a43a', order: 1, isDefault: false, autoTitle: '' },
    { id: 'przeblysk', name: 'Przebłysk', color: '#4da8a0', order: 2, isDefault: false, autoTitle: '' },
    { id: 'rozrzutka', name: 'Rozrzutka', color: '#7c6cb5', order: 3, isDefault: true, autoTitle: '' },
    { id: 'problem', name: 'Problem', color: '#c45c5c', order: 4, isDefault: false, autoTitle: '' },
  ];
}

export function defaultSemanticConfig() {
  return {
    rawStates: {
      raw: { label: 'Surowe' },
      extracted: { label: 'Wyciągnięte' },
      hidden: { label: 'Schowane' },
      archived: { label: 'Archiwum' },
    },
    planKinds: [
      { id: 'fundament', label: 'Fundament' },
      { id: 'cel', label: 'Cel' },
      { id: 'mechanizm', label: 'Mechanizm' },
      { id: 'feature', label: 'Feature' },
      { id: 'decyzja', label: 'Decyzja' },
      { id: 'pytanie', label: 'Pytanie' },
      { id: 'next_step', label: 'Next step' },
    ],
    stages: {
      robocze: { label: 'Robocze' },
      plan: { label: 'Plan' },
    },
  };
}

export function emptyState() {
  return migrateState({});
}

export function migrateState(input = {}) {
  const now = new Date().toISOString();
  const categories = normalizeCategories(input.categories);
  const semanticConfig = normalizeSemanticConfig(input.semanticConfig);
  const projects = normalizeProjects(input.projects, now);
  const nodes = normalizeNodes(input.nodes, categories, now, semanticConfig);
  const nodeIds = new Set(nodes.map(node => node.id));
  const layers = normalizeLayers(input.layers, nodes, now);
  const layerIds = new Set(layers.map(layer => layer.id));

  for (const node of nodes) {
    if (!layerIds.has(node.layerId)) node.layerId = ROOT_LAYER_ID;
    if (node.projectId && !projects.some(project => project.id === node.projectId)) {
      node.projectId = null;
    }
  }

  const links = normalizeLinks(input.links, nodeIds);
  const strokes = normalizeStrokes(input.strokes, projects, layerIds, now);

  const activeLayerId = layerIds.has(input.activeLayerId) ? input.activeLayerId : ROOT_LAYER_ID;
  const activeProjectId = normalizeProjectScope(input.activeProjectId, projects);

  return {
    nodes,
    links,
    parking: Array.isArray(input.parking) ? input.parking : [],
    inboxMessages: normalizeInboxMessages(input.inboxMessages, now),
    strokes,
    categories,
    semanticConfig,
    projects,
    layers,
    activeProjectId,
    activeLayerId,
  };
}

export function getEndpointId(endpoint) {
  return typeof endpoint === 'object' && endpoint !== null ? endpoint.id : endpoint;
}

export function normalizeLink(link) {
  const source = cleanId(getEndpointId(link?.source));
  const target = cleanId(getEndpointId(link?.target));
  if (!source || !target || source === target) return null;
  return { source, target };
}

export function currentScope(state = {}) {
  const activeLayerId = state.activeLayerId || ROOT_LAYER_ID;
  if (activeLayerId !== ROOT_LAYER_ID) {
    return { type: 'layer', layerId: activeLayerId };
  }

  const activeProjectId = state.activeProjectId || 'all';
  if (activeProjectId !== 'all' && activeProjectId !== 'dirty') {
    return { type: 'project', projectId: activeProjectId };
  }

  return { type: 'workspace' };
}

export function nodeMatchesView(node, state = {}) {
  if (!node) return false;
  const activeLayerId = state.activeLayerId || ROOT_LAYER_ID;
  if ((node.layerId || ROOT_LAYER_ID) !== activeLayerId) return false;

  const activeProjectId = state.activeProjectId || 'all';
  if (activeProjectId === 'all') return true;
  if (activeProjectId === 'dirty') return !node.projectId;
  return node.projectId === activeProjectId;
}

export function nodeMatchesExportScope(node, scope, selectedIds = []) {
  if (!node) return false;
  const normalizedScope = normalizeExportScope(scope);
  if (normalizedScope.type === 'all') return true;
  if (normalizedScope.type === 'selection') return selectedIds.includes(node.id);
  if (normalizedScope.type === 'layer') return (node.layerId || ROOT_LAYER_ID) === normalizedScope.layerId;
  if (normalizedScope.type === 'project') return node.projectId === normalizedScope.projectId;
  if (normalizedScope.type === 'workspace') {
    return (node.layerId || ROOT_LAYER_ID) === ROOT_LAYER_ID && !node.projectId;
  }
  if (normalizedScope.type === 'view') {
    return nodeMatchesView(node, normalizedScope.state || {});
  }
  return nodeMatchesView(node, normalizedScope.state || {});
}

export function strokeMatchesScope(stroke, scope) {
  if (!stroke) return false;
  const normalizedScope = normalizeExportScope(scope);
  if (normalizedScope.type === 'all') return true;
  if (normalizedScope.type === 'selection') return false;
  if (normalizedScope.type === 'layer') {
    return stroke.scope === 'layer' && stroke.layerId === normalizedScope.layerId;
  }
  if (normalizedScope.type === 'project') {
    return stroke.scope === 'project' && stroke.projectId === normalizedScope.projectId;
  }
  if (normalizedScope.type === 'workspace') {
    return stroke.scope === 'workspace';
  }
  if (normalizedScope.type === 'view') {
    return strokeMatchesScope(stroke, currentScope(normalizedScope.state || {}));
  }
  return false;
}

export function resolveExportScope(state = {}, options = {}) {
  if (options.scope === 'selection') {
    return { type: 'selection', selectedIds: Array.isArray(options.selectedIds) ? options.selectedIds : [] };
  }
  if (options.scope === 'project') {
    return { type: 'project', projectId: options.projectId || state.activeProjectId };
  }
  if (options.scope === 'layer') {
    return { type: 'layer', layerId: options.layerId || state.activeLayerId || ROOT_LAYER_ID };
  }
  if (options.scope === 'all') return { type: 'all' };
  if (options.scope === 'workspace') return { type: 'workspace' };
  return { type: 'view', state };
}

export function resolveLayerTitle(layer, state = {}) {
  if (!layer) return '';
  if (layer.titleMode === 'bound' && layer.originNodeId) {
    const origin = (state.nodes || []).find(node => node.id === layer.originNodeId);
    const boundTitle = cleanText(origin?.title);
    if (boundTitle) return boundTitle;
  }
  return cleanText(layer.title) || cleanText(layer.fallbackTitle) || 'Warstwa';
}

export function buildLayerPath(layerId, state = {}) {
  const layers = Array.isArray(state.layers) ? state.layers : [];
  const byId = new Map(layers.map(layer => [layer.id, layer]));
  const result = [];
  let current = byId.get(layerId || ROOT_LAYER_ID);
  const seen = new Set();

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    result.unshift({
      id: current.id,
      title: resolveLayerTitle(current, state),
      originNodeId: current.originNodeId || null,
      titleMode: current.titleMode || 'custom',
    });
    current = current.parentLayerId ? byId.get(current.parentLayerId) : null;
  }

  return result;
}

export function categorySlug(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ąćęłńóśźż]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function normalizeCategories(categories) {
  const source = Array.isArray(categories) && categories.length ? categories : defaultCategories();
  const normalized = source.map((category, index) => ({
    id: cleanId(category.id) || categorySlug(category.name) || `category_${index + 1}`,
    name: cleanText(category.name) || category.id || `Kategoria ${index + 1}`,
    color: normalizeColor(category.color) || '#7c6cb5',
    order: Number.isFinite(Number(category.order)) ? Number(category.order) : index,
    isDefault: category.isDefault === true,
    autoTitle: cleanText(category.autoTitle),
  }));

  let defaultSeen = false;
  for (const category of normalized) {
    if (category.isDefault && !defaultSeen) {
      defaultSeen = true;
    } else if (category.isDefault) {
      category.isDefault = false;
    }
  }

  if (!normalized.some(category => category.isDefault)) {
    const fallback = normalized.find(category => category.id === 'rozrzutka') || normalized[0];
    if (fallback) fallback.isDefault = true;
  }

  return normalized.sort((a, b) => a.order - b.order);
}

function normalizeProjects(projects, now) {
  if (!Array.isArray(projects)) return [];
  const seen = new Set();
  return projects
    .map((project, index) => {
      const id = cleanId(project?.id) || `project_${index + 1}`;
      if (seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        name: cleanText(project?.name) || `Projekt ${index + 1}`,
        createdAt: project?.createdAt || now,
        updatedAt: project?.updatedAt || project?.createdAt || now,
      };
    })
    .filter(Boolean);
}

function normalizeNodes(nodes, categories, now, semanticConfig) {
  if (!Array.isArray(nodes)) return [];
  const categoryIds = new Set(categories.map(category => category.id));
  const defaultCategory = categories.find(category => category.isDefault)?.id || categories[0]?.id || 'rozrzutka';
  const planKindIds = new Set((semanticConfig?.planKinds || []).map(kind => kind.id));
  const seen = new Set();

  return nodes
    .map((node, index) => {
      const id = cleanId(node?.id) || `node_${index + 1}`;
      if (seen.has(id)) return null;
      seen.add(id);
      const type = cleanId(node?.type);
      const createdAt = node?.createdAt || now;
      const priority = clampInt(node?.priority, 1, 10, 1);

      return {
        ...node,
        id,
        title: cleanText(node?.title),
        content: cleanText(node?.content),
        type: categoryIds.has(type) ? type : defaultCategory,
        stage: STAGES.has(node?.stage) ? node.stage : 'robocze',
        planKind: planKindIds.has(node?.planKind) ? node.planKind : '',
        priority,
        rawState: RAW_STATES.has(node?.rawState) ? node.rawState : 'raw',
        projectId: cleanId(node?.projectId) || null,
        layerId: cleanId(node?.layerId) || ROOT_LAYER_ID,
        sourceIds: Array.isArray(node?.sourceIds) ? node.sourceIds.map(cleanId).filter(Boolean) : [],
        x: finiteNumber(node?.x, 200),
        y: finiteNumber(node?.y, 200),
        createdAt,
        updatedAt: node?.updatedAt || createdAt,
      };
    })
    .filter(Boolean);
}

function normalizeInboxMessages(messages, now) {
  if (!Array.isArray(messages)) return [];
  const seen = new Set();

  return messages
    .map((message, index) => {
      const text = cleanText(message?.text);
      if (!text) return null;
      const id = cleanId(message?.id) || `inbox_${index + 1}`;
      if (seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        text,
        createdAt: message?.createdAt || now,
        ...(message?.copiedAt ? { copiedAt: message.copiedAt } : {}),
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function normalizeSemanticConfig(config = {}) {
  const defaults = defaultSemanticConfig();
  const rawStates = {};

  for (const id of Object.keys(defaults.rawStates)) {
    rawStates[id] = {
      label: cleanText(config?.rawStates?.[id]?.label) || defaults.rawStates[id].label,
    };
  }

  const inputKinds = Array.isArray(config?.planKinds) && config.planKinds.length
    ? config.planKinds
    : defaults.planKinds;
  const seen = new Set();
  const planKinds = inputKinds
    .map((kind, index) => {
      const id = cleanId(kind?.id) || (PLAN_KINDS[index] || '');
      if (!id || seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        label: cleanText(kind?.label) || id,
      };
    })
    .filter(Boolean);

  return {
    rawStates,
    planKinds: planKinds.length ? planKinds : defaults.planKinds,
    stages: {
      robocze: {
        label: cleanText(config?.stages?.robocze?.label) || defaults.stages.robocze.label,
      },
      plan: {
        label: cleanText(config?.stages?.plan?.label) || defaults.stages.plan.label,
      },
    },
  };
}

function normalizeLayers(layers, nodes, now) {
  const nodeIds = new Set(nodes.map(node => node.id));
  const normalized = [];
  const source = Array.isArray(layers) ? layers : [];
  const seen = new Set();

  normalized.push({
    id: ROOT_LAYER_ID,
    title: cleanText(source.find(layer => layer?.id === ROOT_LAYER_ID)?.title) || 'Tablica główna',
    titleMode: 'custom',
    parentLayerId: null,
    originNodeId: null,
    fallbackTitle: 'Tablica główna',
    createdAt: source.find(layer => layer?.id === ROOT_LAYER_ID)?.createdAt || now,
    updatedAt: source.find(layer => layer?.id === ROOT_LAYER_ID)?.updatedAt || now,
  });
  seen.add(ROOT_LAYER_ID);

  for (const layer of source) {
    const id = cleanId(layer?.id);
    if (!id || id === ROOT_LAYER_ID || seen.has(id)) continue;
    seen.add(id);
    const originNodeId = cleanId(layer?.originNodeId);
    const hasOrigin = originNodeId && nodeIds.has(originNodeId);
    const titleMode = TITLE_MODES.has(layer?.titleMode) ? layer.titleMode : (hasOrigin ? 'bound' : 'custom');
    normalized.push({
      id,
      title: cleanText(layer?.title),
      titleMode: titleMode === 'bound' && hasOrigin ? 'bound' : 'custom',
      parentLayerId: cleanId(layer?.parentLayerId) || ROOT_LAYER_ID,
      originNodeId: hasOrigin ? originNodeId : null,
      fallbackTitle: cleanText(layer?.fallbackTitle) || cleanText(layer?.title) || 'Warstwa',
      projectId: cleanId(layer?.projectId) || null,
      createdAt: layer?.createdAt || now,
      updatedAt: layer?.updatedAt || layer?.createdAt || now,
    });
  }

  return normalized;
}

function normalizeLinks(links, nodeIds) {
  if (!Array.isArray(links)) return [];
  const seen = new Set();
  const normalized = [];

  for (const link of links) {
    const clean = normalizeLink(link);
    if (!clean || !nodeIds.has(clean.source) || !nodeIds.has(clean.target)) continue;
    const key = [clean.source, clean.target].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(clean);
  }

  return normalized;
}

function normalizeStrokes(strokes, projects, layerIds, now) {
  if (!Array.isArray(strokes)) return [];
  const projectIds = new Set(projects.map(project => project.id));
  return strokes.map((stroke, index) => {
    let scope = stroke?.scope;
    let projectId = cleanId(stroke?.projectId) || null;
    let layerId = cleanId(stroke?.layerId) || null;

    if (!scope) {
      if (layerId && layerId !== ROOT_LAYER_ID) scope = 'layer';
      else if (projectId) scope = 'project';
      else scope = 'workspace';
    }

    if (scope === 'layer' && (!layerId || !layerIds.has(layerId))) {
      scope = 'workspace';
      layerId = null;
    }
    if (scope === 'project' && (!projectId || !projectIds.has(projectId))) {
      scope = 'workspace';
      projectId = null;
    }
    if (scope !== 'workspace' && scope !== 'project' && scope !== 'layer') scope = 'workspace';

    return {
      id: cleanId(stroke?.id) || `stroke_${index + 1}`,
      points: Array.isArray(stroke?.points) ? stroke.points : [],
      color: normalizeColor(stroke?.color) || '#ffffff',
      width: finiteNumber(stroke?.width, 2),
      scope,
      projectId: scope === 'project' ? projectId : null,
      layerId: scope === 'layer' ? layerId : null,
      createdAt: stroke?.createdAt || now,
    };
  });
}

function normalizeProjectScope(activeProjectId, projects) {
  const id = activeProjectId || 'all';
  if (id === 'all' || id === 'dirty') return id;
  return projects.some(project => project.id === id) ? id : 'all';
}

function normalizeExportScope(scope) {
  if (!scope) return { type: 'workspace' };
  if (typeof scope === 'string') return { type: scope };
  return scope;
}

function cleanId(value) {
  return typeof value === 'string' ? value.trim() : '';
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

function normalizeColor(value) {
  const text = cleanId(value);
  return /^#[0-9a-f]{6}$/i.test(text) ? text : '';
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}
