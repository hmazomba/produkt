import dagre from "@dagrejs/dagre";
import type { GraphDocument } from "@/domain/graph";

export const NODE_WIDTH = 238;
export const NODE_HEIGHT = 150;

export function layoutGraph(document: GraphDocument): GraphDocument {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "LR", nodesep: 54, ranksep: 112, marginx: 48, marginy: 48 });
  document.nodes.forEach((node) => graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  document.edges.forEach((edge) => graph.setEdge(edge.source, edge.target));
  dagre.layout(graph);
  return {
    ...document,
    nodes: document.nodes.map((node) => {
      const point = graph.node(node.id) as { x: number; y: number };
      return { ...node, position: { x: point.x - NODE_WIDTH / 2, y: point.y - NODE_HEIGHT / 2 } };
    }),
  };
}
