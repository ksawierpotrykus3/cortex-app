import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateState } from './schema.js';
import { buildSemanticExport } from './semanticExport.js';

test('migrates old state with semantic defaults and removes broken links', () => {
  const migrated = migrateState({
    nodes: [
      { id: 'n1', title: 'Root', type: 'problem', x: 10, y: 20 },
      { id: 'n2', content: 'Loose thought' },
    ],
    links: [
      { source: { id: 'n1' }, target: 'n2' },
      { source: 'n1', target: 'missing' },
    ],
    strokes: [
      { id: 's1', points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] },
    ],
  });

  assert.equal(migrated.nodes[0].priority, 1);
  assert.equal(migrated.nodes[0].stage, 'robocze');
  assert.equal(migrated.nodes[0].rawState, 'raw');
  assert.equal(migrated.nodes[0].layerId, 'root');
  assert.deepEqual(migrated.nodes[0].sourceIds, []);
  assert.equal(migrated.links.length, 1);
  assert.deepEqual(migrated.links[0], { source: 'n1', target: 'n2' });
  assert.equal(migrated.strokes[0].scope, 'workspace');
  assert.equal(migrated.activeLayerId, 'root');
});

test('exports visible v2 without embedded images and with bound layer title', () => {
  const state = migrateState({
    nodes: [
      {
        id: 'root-note',
        title: 'Główny projekt',
        content: 'Parent',
        type: 'informacja_dla_ai',
        x: 0,
        y: 0,
      },
      {
        id: 'screen-1',
        title: 'Screen',
        type: 'rozrzutka',
        image: 'data:image/png;base64,SHOULD_NOT_EXPORT',
        imageDescription: 'TEKST:\nWidoczny tekst\n\nOPIS:\nOpis screena',
        imageWidth: 800,
        imageHeight: 600,
        rawState: 'extracted',
        layerId: 'layer-1',
        x: 50,
        y: 60,
      },
      {
        id: 'other',
        title: 'Outside',
        layerId: 'other-layer',
        x: 500,
        y: 500,
      },
    ],
    layers: [
      { id: 'root', title: 'Tablica główna', titleMode: 'custom' },
      { id: 'layer-1', parentLayerId: 'root', originNodeId: 'root-note', titleMode: 'bound' },
    ],
    links: [{ source: { id: 'root-note' }, target: { id: 'screen-1' } }],
    strokes: [
      { id: 'draw-1', scope: 'layer', layerId: 'layer-1', points: [{ x: 1, y: 1 }, { x: 20, y: 20 }] },
      { id: 'draw-2', scope: 'workspace', points: [{ x: 2, y: 2 }, { x: 3, y: 3 }] },
    ],
    activeLayerId: 'layer-1',
  });

  const exported = buildSemanticExport(state, { scope: 'layer', layerId: 'layer-1' });

  assert.equal(exported.schema, 'cortex.visible.v2');
  assert.equal(exported.scope.type, 'layer');
  assert.equal(exported.scope.layer.title, 'Główny projekt');
  assert.equal(exported.items.length, 1);
  assert.equal(exported.items[0].kind, 'screen');
  assert.equal(exported.items[0].screenText, 'Widoczny tekst');
  assert.equal(exported.items[0].screenDescription, 'Opis screena');
  assert.equal(exported.items[0].image, undefined);
  assert.equal(JSON.stringify(exported).includes('SHOULD_NOT_EXPORT'), false);
  assert.equal(exported.connections, undefined);
  assert.equal(exported.drawings.length, 1);
  assert.equal(exported.ai_context.reading_rules.includes('base64'), false);
});

test('exports selection with only selected visible relations', () => {
  const state = migrateState({
    nodes: [
      { id: 'a', title: 'A', x: 0, y: 0 },
      { id: 'b', title: 'B', x: 100, y: 0 },
      { id: 'c', title: 'C', x: 200, y: 0 },
    ],
    links: [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ],
  });

  const exported = buildSemanticExport(state, { scope: 'selection', selectedIds: ['a', 'b'] });

  assert.deepEqual(exported.board.readingOrder, ['n1', 'n2']);
  assert.deepEqual(exported.connections, [['n1', 'n2']]);
});

test('exports current all-project view as the same root-layer nodes the user sees', () => {
  const state = migrateState({
    activeProjectId: 'all',
    activeLayerId: 'root',
    projects: [{ id: 'p1', name: 'Projekt' }],
    nodes: [
      { id: 'dirty', title: 'Dirty root', layerId: 'root' },
      { id: 'project', title: 'Project root', projectId: 'p1', layerId: 'root' },
      { id: 'child', title: 'Child layer', layerId: 'layer-1' },
    ],
    layers: [{ id: 'layer-1', title: 'Layer', titleMode: 'custom' }],
  });

  const exported = buildSemanticExport(state, { scope: 'current' });

  assert.deepEqual(exported.items.map(item => item.title), ['Dirty root', 'Project root']);
});
