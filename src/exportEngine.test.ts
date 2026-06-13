// @vitest-environment jsdom
// ================================================================
// NEXUS F5 — Export: Testy
// F5.1: Nazwy plików z projektem + timestamp
// F5.2: Multi-scope z ptaszkami
// F5.3: Export kontekstowy z każdego widoku
// ================================================================

import { describe, it, expect } from 'vitest';
import {
  sanitizeFilename,
  generateExportFilename,
  generateAIExport,
  getExportPreset,
  VIEW_EXPORT_PRESETS,
} from './exportEngine';
import { DEFAULT_EXPORT_SCOPE } from './types';

// ============================================================
// F5.1 — Nazwy plików z projektem + timestamp
// ============================================================
describe('F5.1 — Filename generation', () => {

  it('generuje nazwę z label + datą', () => {
    const name = generateExportFilename('Q3_Planning', new Date('2026-06-13'));
    expect(name).toBe('q3_planning_2026-06-13.json');
  });

  it('sanitizeFilename usuwa polskie znaki', () => {
    expect(sanitizeFilename('Zażółć gęślą jaźń')).toBe('zazolc_gesla_jazn');
  });

  it('sanitizeFilename czyści spacje i znaki specjalne', () => {
    expect(sanitizeFilename('Mój Projekt!! [test]')).toBe('moj_projekt_test');
  });

  it('sanitizeFilename zwraca "export" dla pustego stringa', () => {
    expect(sanitizeFilename('')).toBe('export');
  });

  it('generateExportFilename z domyślną datą (dzisiaj)', () => {
    const name = generateExportFilename('nexus');
    // Format: nexus_2026-06-13.json (bo dzisiaj jest 2026-06-13)
    expect(name).toMatch(/^nexus_\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('obsługuje wielokrotne podkreślniki (deduplikacja)', () => {
    expect(sanitizeFilename('test___case')).toBe('test_case');
  });

  it('usuwa podkreślniki z początku i końca', () => {
    expect(sanitizeFilename('__hello_world__')).toBe('hello_world');
  });

  it('zachowuje liczby i myślniki', () => {
    expect(sanitizeFilename('v2-beta-2026')).toBe('v2-beta-2026');
  });
});

// ============================================================
// F5.2 — Multi-scope z ptaszkami (logika eksportu z scope)
// ============================================================
describe('F5.2 — Export scope filtering', () => {
  const sampleNodes = [
    { id: 'n1', title: 'Node 1', content: 'treść 1', x: 0, y: 0, projectId: 'Proj A', annotations: [] },
    { id: 'n2', title: 'Node 2', content: 'treść 2', x: 100, y: 100, projectId: 'Proj B' },
    { id: 'n3', title: 'Node 3', content: '', x: 200, y: 200, projectId: 'Proj A' },
  ] as any;
  const sampleLinks = [{ source: 'n1', target: 'n2' }] as any;

  it('z nodes=true eksport zawiera nodes', () => {
    const json = generateAIExport(sampleNodes, sampleLinks, '', { nodes: true, links: false, tasks: false, drafts: false, axioms: false, images: false, onlySelected: false });
    const data = JSON.parse(json);
    expect(data.nodes).toBeDefined();
    expect(data.nodes.length).toBe(3);
    expect(data.nodes[0].title).toBe('Node 1');
  });

  it('z links=true eksport zawiera topology', () => {
    const json = generateAIExport(sampleNodes, sampleLinks, '', { nodes: false, links: true, tasks: false, drafts: false, axioms: false, images: false, onlySelected: false });
    const data = JSON.parse(json);
    expect(data.topology).toBeDefined();
    expect(data.topology.length).toBe(1);
    expect(data.topology[0].source).toBe('n1');
  });

  it('z tasks=true eksport zawiera tasks', () => {
    const tasks = [{ id: 't1', title: 'Task 1', description: 'desc', priority: 'High', status: 'Open' }];
    const json = generateAIExport([], [], '', { nodes: false, links: false, tasks: true, drafts: false, axioms: false, images: false, onlySelected: false }, tasks);
    const data = JSON.parse(json);
    expect(data.tasks).toBeDefined();
    expect(data.tasks.length).toBe(1);
    expect(data.tasks[0].title).toBe('Task 1');
  });

  it('z drafts=true eksport zawiera drafts', () => {
    const drafts = [{ id: 'd1', title: 'Draft 1', content: 'content', status: 'draft' }];
    const json = generateAIExport([], [], '', { nodes: false, links: false, tasks: false, drafts: true, axioms: false, images: false, onlySelected: false }, undefined, drafts);
    const data = JSON.parse(json);
    expect(data.drafts).toBeDefined();
    expect(data.drafts.length).toBe(1);
  });

  it('z axioms=true i treścią — eksport zawiera axioms', () => {
    const json = generateAIExport([], [], 'moje aksjomaty', { nodes: false, links: false, tasks: false, drafts: false, axioms: true, images: false, onlySelected: false });
    const data = JSON.parse(json);
    expect(data.axioms).toBe('moje aksjomaty');
  });

  it('z images=true eksport zawiera obrazy', () => {
    const nodesWithImages = [
      { id: 'n1', title: 'Img Node', content: '', x: 0, y: 0, imageAttachments: [{ id: 'att1', mimeType: 'image/png', dataUrl: 'data:image/png;base64,...', isProcessing: false, createdAt: '' }] },
    ] as any;
    const json = generateAIExport(nodesWithImages, [], '', { nodes: false, links: false, tasks: false, drafts: false, axioms: false, images: true, onlySelected: false });
    const data = JSON.parse(json);
    expect(data.images).toBeDefined();
    expect(data.images.length).toBe(1);
    expect(data.images[0].mimeType).toBe('image/png');
  });

  it('z all false — eksportuje tylko _meta', () => {
    const json = generateAIExport(sampleNodes, sampleLinks, 'axiom', {
      nodes: false, links: false, tasks: false, drafts: false, axioms: false, images: false, onlySelected: false
    });
    const data = JSON.parse(json);
    expect(data.nodes).toBeUndefined();
    expect(data.topology).toBeUndefined();
    expect(data.tasks).toBeUndefined();
    expect(data.drafts).toBeUndefined();
    expect(data.axioms).toBeUndefined();
    expect(data._meta).toBeDefined();
  });
});

// ============================================================
// F5.3 — Export kontekstowy z każdego widoku (presety)
// ============================================================
describe('F5.3 — View-based export presets', () => {

  it('nexus preset ma nodes=true, tasks=false, drafts=false', () => {
    const preset = getExportPreset('nexus');
    expect(preset.label).toBe('nexus');
    expect(preset.scope.nodes).toBe(true);
    expect(preset.scope.tasks).toBe(false);
    expect(preset.scope.drafts).toBe(false);
  });

  it('lab-todo preset ma tasks=true, nodes=false', () => {
    const preset = getExportPreset('lab-todo');
    expect(preset.label).toBe('tasks');
    expect(preset.scope.tasks).toBe(true);
    expect(preset.scope.nodes).toBe(false);
  });

  it('lab-writing preset ma drafts=true, nodes=false', () => {
    const preset = getExportPreset('lab-writing');
    expect(preset.label).toBe('drafts');
    expect(preset.scope.drafts).toBe(true);
    expect(preset.scope.nodes).toBe(false);
  });

  it('sandbox preset ma tylko nodes', () => {
    const preset = getExportPreset('sandbox');
    expect(preset.label).toBe('sandbox');
    expect(preset.scope.nodes).toBe(true);
    expect(preset.scope.links).toBe(false);
    expect(preset.scope.tasks).toBe(false);
    expect(preset.scope.drafts).toBe(false);
    expect(preset.scope.axioms).toBe(false);
    expect(preset.scope.images).toBe(false);
  });

  it('agents preset ma wszystko false (brak danych strukturalnych)', () => {
    const preset = getExportPreset('agents');
    expect(preset.scope.nodes).toBe(false);
    expect(preset.scope.links).toBe(false);
    expect(preset.scope.tasks).toBe(false);
    expect(preset.scope.drafts).toBe(false);
    expect(preset.scope.axioms).toBe(false);
    expect(preset.scope.images).toBe(false);
  });

  it('nieznany widok zwraca domyślny preset (nexus)', () => {
    const preset = getExportPreset('nonexistent' as any);
    expect(preset.label).toBe('nexus');
  });

  it('wszystkie znane widoki mają preset w VIEW_EXPORT_PRESETS', () => {
    const knownViews = ['nexus', 'lab-todo', 'lab-writing', 'sandbox', 'raw-fragments', 'logs', 'draft', 'agents', 'changes', 'wiki', 'git'];
    for (const view of knownViews) {
      expect(VIEW_EXPORT_PRESETS[view]).toBeDefined();
    }
  });
});
