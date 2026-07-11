import { useCallback } from 'react';
import dagre from '@dagrejs/dagre';
import type { ProjektyNode, ProjektyEdge } from '../types';

const NODE_WIDTH = 240;
const NODE_HEIGHT = 100;

/**
 * Uzywa dagre do obliczenia pozycji wezlow na podstawie hierarchii i krawedzi.
 * Rodzice na gorze, dzieci ponizej, galezie obok siebie.
 * - Wezly z locked_position=true sa pomijane przez dagre (zostaja na swoim miejscu)
 * - Osierocone wezly (bez parent_id, bez krawedzi) ukladane w grid
 * Zwraca nowa tablice wezlow z poprawionymi x, y.
 */
export function useAutoLayout() {
  const applyLayout = useCallback((
    nodes: ProjektyNode[],
    edges: ProjektyEdge[],
  ): ProjektyNode[] => {
    if (nodes.length === 0) return nodes;

    // Oddziel zablokowane wezly
    const lockedNodes = nodes.filter(n => n.locked_position);
    const unlockedNodes = nodes.filter(n => !n.locked_position);

    if (unlockedNodes.length === 0) return nodes;

    // Znajdz osierocone wezly (brak parent_id, brak krawedzi)
    const connectedIds = new Set<string>();
    for (const e of edges) {
      connectedIds.add(e.source_node_id);
      connectedIds.add(e.target_node_id);
    }
    for (const n of unlockedNodes) {
      if (n.parent_id) {
        connectedIds.add(n.id);
        connectedIds.add(n.parent_id);
      }
    }

    const orphanNodes = unlockedNodes.filter(n => !connectedIds.has(n.id));
    const layoutNodes = unlockedNodes.filter(n => connectedIds.has(n.id));

    // Uklad dagre dla polaczonych wezlow
    let dagreResult: ProjektyNode[] = [];
    if (layoutNodes.length > 0) {
      const g = new dagre.graphlib.Graph();
      g.setDefaultEdgeLabel(() => ({}));
      g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80, marginx: 40, marginy: 40 });

      for (const n of layoutNodes) {
        g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
      }

      for (const e of edges) {
        g.setEdge(e.source_node_id, e.target_node_id);
      }
      for (const n of layoutNodes) {
        if (n.parent_id) {
          if (!edges.some(e => e.source_node_id === n.parent_id && e.target_node_id === n.id)) {
            g.setEdge(n.parent_id, n.id);
          }
        }
      }

      dagre.layout(g);

      dagreResult = layoutNodes.map(n => {
        const dagNode = g.node(n.id);
        if (!dagNode) return n;
        return {
          ...n,
          x: dagNode.x - NODE_WIDTH / 2,
          y: dagNode.y - NODE_HEIGHT / 2,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        };
      });
    }

    // Grid dla osieroconych wezlow
    const COLUMNS = 4;
    const orphanResult = orphanNodes.map((n, i) => ({
      ...n,
      x: (i % COLUMNS) * (NODE_WIDTH + 50),
      y: Math.floor(i / COLUMNS) * (NODE_HEIGHT + 50),
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }));

    // Polacz: zablokowane (oryginalne pozycje) + dagre + orphan
    return [...lockedNodes, ...dagreResult, ...orphanResult];
  }, []);

  return { applyLayout };
}