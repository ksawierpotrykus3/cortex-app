import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from './store.js';

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem() { return value; },
    setItem(_key, next) { value = next; },
    removeItem() { value = null; },
    read() { return value ? JSON.parse(value) : null; },
  };
}

test('store deletes object-endpoint links and detaches bound layers safely', () => {
  const storage = memoryStorage(JSON.stringify({
    nodes: [
      { id: 'a', title: 'Parent' },
      { id: 'b', title: 'Child' },
    ],
    links: [{ source: { id: 'a' }, target: { id: 'b' } }],
    layers: [{ id: 'layer-a', originNodeId: 'a', titleMode: 'bound' }],
  }));
  const store = new Store({ storage });

  const deleted = store.deleteNode('a', { originLayerAction: 'detach' });

  assert.equal(deleted, true);
  assert.equal(store.getLinks().length, 0);
  assert.equal(store.getLayerById('layer-a').originNodeId, null);
  assert.equal(store.getLayerById('layer-a').titleMode, 'custom');
  assert.equal(store.getLayerTitle('layer-a'), 'Parent');
});

test('store scopes visible nodes and strokes by layer and project', () => {
  const storage = memoryStorage(JSON.stringify({
    projects: [{ id: 'p1', name: 'Projekt' }],
    nodes: [
      { id: 'root', title: 'Root', layerId: 'root' },
      { id: 'project-note', title: 'Project', projectId: 'p1', layerId: 'root' },
      { id: 'layer-note', title: 'Layer', layerId: 'layer-1' },
    ],
    layers: [{ id: 'layer-1', title: 'Layer', titleMode: 'custom' }],
    strokes: [
      { id: 's-work', scope: 'workspace', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
      { id: 's-project', scope: 'project', projectId: 'p1', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
      { id: 's-layer', scope: 'layer', layerId: 'layer-1', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
    ],
  }));
  const store = new Store({ storage });

  store.setActiveProjectId('p1');
  assert.deepEqual(store.getVisibleNodes().map(node => node.id), ['project-note']);
  assert.deepEqual(store.getVisibleStrokes().map(stroke => stroke.id), ['s-project']);

  store.setActiveLayerId('layer-1');
  assert.deepEqual(store.getVisibleNodes().map(node => node.id), ['layer-note']);
  assert.deepEqual(store.getVisibleStrokes().map(stroke => stroke.id), ['s-layer']);
});

test('store keeps layer title bound to origin note until layer is manually renamed', () => {
  const storage = memoryStorage(JSON.stringify({
    nodes: [{ id: 'a', title: 'Old title' }],
  }));
  const store = new Store({ storage });
  const layer = store.createLayerFromNode('a');

  store.updateNode('a', { title: 'New title' });
  assert.equal(store.getLayerTitle(layer.id), 'New title');

  store.renameLayer(layer.id, 'Custom title');
  store.updateNode('a', { title: 'Another title' });
  assert.equal(store.getLayerTitle(layer.id), 'Custom title');
});
