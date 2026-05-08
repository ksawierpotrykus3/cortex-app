import * as d3 from 'd3';
import { COLORS, NODE_SIZES, GRAPH_CONFIG } from './constants.js';

class Graph {
  constructor(containerId) {
    this.container = d3.select(`#${containerId}`);
    this.svg = null;
    this.simulation = null;
    this.linkGroup = null;
    this.nodeGroup = null;
    this.zoom = null;
    this.data = { nodes: [], links: [] };
    this.onNodeClickCallback = null;

    this.init();
  }

  init() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.svg = this.container.append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', [0, 0, width, height]);

    this.mainGroup = this.svg.append('g');
    this.linkGroup = this.mainGroup.append('g').attr('class', 'links');
    this.nodeGroup = this.mainGroup.append('g').attr('class', 'nodes');

    this.setupZoom();
    this.setupSimulation();

    window.addEventListener('resize', () => this.handleResize());
  }

  setupZoom() {
    this.zoom = d3.zoom()
      .scaleExtent(GRAPH_CONFIG.zoomRange)
      .on('zoom', (event) => {
        this.mainGroup.attr('transform', event.transform);
      });

    this.svg.call(this.zoom);
  }

  setupSimulation() {
    this.simulation = d3.forceSimulation()
      .force('link', d3.forceLink().id(d => d.id).distance(GRAPH_CONFIG.forceLinkDistance))
      .force('charge', d3.forceManyBody().strength(GRAPH_CONFIG.forceChargeStrength))
      .force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
      .force('collision', d3.forceCollide().radius(d => NODE_SIZES[d.type] + 20));

    this.simulation.on('tick', () => this.ticked());
  }

  setData(data) {
    // We need to clone data because D3 mutates objects (adds x, y, vy, vx)
    this.data = {
      nodes: data.nodes.map(d => ({ ...d })),
      links: data.links.map(d => ({ ...d }))
    };
    this.update();
  }

  update() {
    const { nodes, links } = this.data;

    // Update Links
    this.linkElements = this.linkGroup.selectAll('line')
      .data(links, d => `${d.source}-${d.target}`)
      .join('line')
      .attr('stroke', COLORS.border)
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1.5);

    // Update Nodes
    this.nodeElements = this.nodeGroup.selectAll('.node-container')
      .data(nodes, d => d.id)
      .join('g')
      .attr('class', 'node-container')
      .call(this.drag(this.simulation));

    this.nodeElements.selectAll('circle')
      .data(d => [d])
      .join('circle')
      .attr('r', d => NODE_SIZES[d.type])
      .attr('fill', d => COLORS[d.type])
      .attr('fill-opacity', 0.15)
      .attr('stroke', d => COLORS[d.type])
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if (this.onNodeClickCallback) this.onNodeClickCallback(d);
      });

    // Node Labels
    this.nodeElements.selectAll('.label-type')
      .data(d => [d])
      .join('text')
      .attr('class', 'label-type')
      .attr('dy', d => -NODE_SIZES[d.type] - 8)
      .attr('text-anchor', 'middle')
      .attr('fill', d => COLORS[d.type])
      .style('font-size', '9px')
      .style('font-weight', '700')
      .style('text-transform', 'uppercase')
      .style('pointer-events', 'none')
      .text(d => d.type);

    this.nodeElements.selectAll('.label-title')
      .data(d => [d])
      .join('text')
      .attr('class', 'label-title')
      .attr('dy', d => NODE_SIZES[d.type] + 20)
      .attr('text-anchor', 'middle')
      .attr('fill', COLORS.textSecondary)
      .style('font-size', '11px')
      .style('pointer-events', 'none')
      .text(d => d.title.length > 25 ? d.title.substring(0, 22) + '...' : d.title);

    this.simulation.nodes(nodes);
    this.simulation.force('link').links(links);
    this.simulation.alpha(1).restart();
  }

  ticked() {
    this.linkElements
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    this.nodeElements
      .attr('transform', d => `translate(${d.x},${d.y})`);
  }

  drag(simulation) {
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  }

  handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.svg.attr('viewBox', [0, 0, width, height]);
    this.simulation.force('center', d3.forceCenter(width / 2, height / 2));
    this.simulation.alpha(0.3).restart();
  }

  onNodeClick(callback) {
    this.onNodeClickCallback = callback;
  }
  
  applyFilters(filteredNodes) {
    // Merge filter state into current data
    this.data.nodes.forEach(node => {
      const match = filteredNodes.find(fn => fn.id === node.id);
      node.isFiltered = match ? match.isFiltered : false;
    });
    
    // Update visuals immediately
    this.nodeElements.transition().duration(200)
      .style('opacity', d => d.isFiltered ? 0.15 : 1)
      .style('pointer-events', d => d.isFiltered ? 'none' : 'all');
      
    this.linkElements.transition().duration(200)
      .style('opacity', d => {
        const sourceMatch = filteredNodes.find(fn => fn.id === (d.source.id || d.source));
        const targetMatch = filteredNodes.find(fn => fn.id === (d.target.id || d.target));
        return (sourceMatch?.isFiltered || targetMatch?.isFiltered) ? 0.05 : 0.6;
      });
  }

  focusNode(id) {
    const node = this.data.nodes.find(n => n.id === id);
    if (node) {
      const transform = d3.zoomIdentity
        .translate(window.innerWidth / 2, window.innerHeight / 2)
        .scale(1.5)
        .translate(-node.x, -node.y);
      
      this.svg.transition().duration(750).call(this.zoom.transform, transform);
    }
  }
}

export const graph = new Graph('graph-container');
