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

test('store keeps inbox messages separate from parking and builds AI context', () => {
  const storage = memoryStorage(JSON.stringify({
    parking: [{ id: 'parked', title: 'Old parked note' }],
  }));
  const store = new Store({ storage });

  const first = store.addInboxMessage('first raw message');
  const second = store.addInboxMessage('second raw message');
  const context = store.copyInboxContext();

  assert.equal(store.getParking().length, 1);
  assert.deepEqual(store.getInboxMessages().map(message => message.text), ['first raw message', 'second raw message']);
  assert.ok(first.createdAt <= second.createdAt);
  assert.match(context, /CORTEX_INBOX_CONTEXT/);
  assert.match(context, /first raw message/);
  assert.match(context, /second raw message/);
});

test('store selects nodes in a rectangle and moves them as a group', () => {
  const storage = memoryStorage(JSON.stringify({
    nodes: [
      { id: 'a', title: 'A', x: 10, y: 10 },
      { id: 'b', title: 'B', x: 120, y: 80 },
      { id: 'c', title: 'C', x: 900, y: 900 },
    ],
  }));
  const store = new Store({ storage });

  const selected = store.selectNodesInRect({ left: 0, top: 0, right: 400, bottom: 220 });
  store.moveNodesBy(selected, 20, -10);

  assert.deepEqual(selected, ['a', 'b']);
  assert.equal(store.getNodeById('a').x, 30);
  assert.equal(store.getNodeById('a').y, 0);
  assert.equal(store.getNodeById('b').x, 140);
  assert.equal(store.getNodeById('b').y, 70);
  assert.equal(store.getNodeById('c').x, 900);
  assert.equal(store.getNodeById('c').y, 900);
});

test('store returns all visible and external connections for a node', () => {
  const storage = memoryStorage(JSON.stringify({
    projects: [
      { id: 'p1', name: 'One' },
      { id: 'p2', name: 'Two' },
    ],
    activeProjectId: 'p1',
    nodes: [
      { id: 'a', title: 'A', projectId: 'p1' },
      { id: 'b', title: 'B', projectId: 'p1' },
      { id: 'c', title: 'C', projectId: 'p2' },
    ],
    links: [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'c' },
    ],
  }));
  const store = new Store({ storage });

  const connections = store.getAllConnectionsForNode('a');
  assert.equal(connections[0].nodeId, 'b');
  assert.equal(connections[0].title, 'B');
  assert.equal(connections[0].isVisible, true);
  assert.equal(connections[0].projectName, 'One');
  assert.equal(connections[1].nodeId, 'c');
  assert.equal(connections[1].title, 'C');
  assert.equal(connections[1].isVisible, false);
  assert.equal(connections[1].projectName, 'Two');
});

test('store builds a non-mutating child layer preview', () => {
  const storage = memoryStorage(JSON.stringify({
    nodes: [
      { id: 'origin', title: 'Parent', x: 0, y: 0 },
      { id: 'child-a', title: 'Child A', layerId: 'layer-1', x: 0, y: 0 },
      { id: 'child-b', title: 'Child B', layerId: 'layer-1', x: 100, y: 0 },
    ],
    layers: [{ id: 'layer-1', originNodeId: 'origin', titleMode: 'bound' }],
    links: [{ source: 'child-a', target: 'child-b' }],
  }));
  const store = new Store({ storage });

  const preview = store.getLayerPreview('origin');

  assert.equal(preview.title, 'Parent');
  assert.equal(preview.counts.items, 2);
  assert.equal(preview.counts.connections, 1);
  assert.deepEqual(preview.items.map(item => item.title), ['Child A', 'Child B']);
  assert.equal(store.getActiveLayerId(), 'root');
});

test('store updates semantic configuration without changing behavior ids', () => {
  const storage = memoryStorage();
  const store = new Store({ storage });

  store.updateSemanticConfig({
    rawStates: {
      hidden: { label: 'Ukryte' },
    },
    planKinds: [
      { id: 'fundament', label: 'Fundament systemu' },
      { id: 'custom_kind', label: 'Custom kind' },
    ],
  });

  assert.equal(store.state.semanticConfig.rawStates.hidden.label, 'Ukryte');
  assert.deepEqual(store.state.semanticConfig.planKinds.map(kind => kind.id), ['fundament', 'custom_kind']);
  assert.equal(store.setNodeRawState('missing', 'hidden'), false);
});
