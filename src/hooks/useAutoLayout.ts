import { useCallback } from 'react';
import dagre from '@dagrejs/dagre';
import type { ExperimentalNode, ExperimentalEdge } from '../types';

const NODE_WIDTH = 240;
const NODE_HEIGHT = 100;

/**
 * Uzywa dagre do obliczenia pozycji wezlow na podstawie hierarchii i krawedzi.
 * Rodzice na gorze, dzieci ponizej, galezie obok siebie.
 * Zwraca nowa tablice wezlow z poprawionymi x, y.
 */
export function useAutoLayout() {
  const applyLayout = useCallback((
    nodes: ExperimentalNode[],
    edges: ExperimentalEdge[],
  ): ExperimentalNode[] => {
    if (nodes.length === 0) return nodes;

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80, marginx: 40, marginy: 40 });

    // Dodaj wezly
    for (const n of nodes) {
      g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }

    // Dodaj krawedzie
    for (const e of edges) {
      g.setEdge(e.source_node_id, e.target_node_id);
    }
    // Tez z parent_id (hierarchia bez krawedzi)
    for (const n of nodes) {
      if (n.parent_id) {
        if (!edges.some(e => e.source_node_id === n.parent_id && e.target_node_id === n.id)) {
          g.setEdge(n.parent_id, n.id);
        }
      }
    }

    dagre.layout(g);

    const updated = nodes.map(n => {
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

    return updated;
  }, []);

  return { applyLayout };
}
