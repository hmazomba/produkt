import type { GraphDocument, GraphEdge, GraphNode } from "@/domain/graph";

export interface RoutedGraphEdge extends GraphEdge {
  type: string;
  data?: Record<string, unknown> & {
    routeFallback?: string;
    routeOffset?: number;
  };
}

function cyclicNodeIds(document: GraphDocument): Set<string> {
  const adjacency = new Map(document.nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of document.edges) adjacency.get(edge.source)?.push(edge.target);

  let nextIndex = 0;
  const indexById = new Map<string, number>();
  const lowLinkById = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cyclic = new Set<string>();

  const visit = (id: string) => {
    indexById.set(id, nextIndex);
    lowLinkById.set(id, nextIndex);
    nextIndex += 1;
    stack.push(id);
    onStack.add(id);

    for (const target of adjacency.get(id) ?? []) {
      if (!indexById.has(target)) {
        visit(target);
        lowLinkById.set(id, Math.min(lowLinkById.get(id)!, lowLinkById.get(target)!));
      } else if (onStack.has(target)) {
        lowLinkById.set(id, Math.min(lowLinkById.get(id)!, indexById.get(target)!));
      }
    }

    if (lowLinkById.get(id) !== indexById.get(id)) return;
    const component: string[] = [];
    let member: string;
    do {
      member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
    } while (member !== id);

    if (component.length > 1) component.forEach((nodeId) => cyclic.add(nodeId));
    else if ((adjacency.get(id) ?? []).includes(id)) cyclic.add(id);
  };

  for (const node of document.nodes) if (!indexById.has(node.id)) visit(node.id);
  return cyclic;
}

function pairKey(source: string, target: string): string {
  return [source, target].sort().join("\u0000");
}

function isBackwards(edge: GraphEdge, nodesById: Map<string, GraphNode>): boolean {
  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);
  if (!source || !target || edge.source === edge.target) return false;
  return target.position.x + 24 < source.position.x;
}

/** Adds presentation-only fallback routes while retaining authored edge identity and metadata. */
export function routeGraphEdges(document: GraphDocument): RoutedGraphEdge[] {
  const cyclic = cyclicNodeIds(document);
  const nodesById = new Map(document.nodes.map((node) => [node.id, node]));
  const pairCounts = new Map<string, number>();
  const pairIndexes = new Map<string, number>();

  for (const edge of document.edges) {
    const key = pairKey(edge.source, edge.target);
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }

  return document.edges.map((edge) => {
    const key = pairKey(edge.source, edge.target);
    const routeOffset = pairIndexes.get(key) ?? 0;
    pairIndexes.set(key, routeOffset + 1);

    const fallbackReasons = [
      edge.source === edge.target ? "self-loop" : "",
      cyclic.has(edge.source) && cyclic.has(edge.target) ? "cycle" : "",
      isBackwards(edge, nodesById) ? "reverse direction" : "",
      (pairCounts.get(key) ?? 0) > 1 ? "overlapping connections" : "",
    ].filter(Boolean);

    if (!fallbackReasons.length) return { ...edge, type: "smoothstep" };
    return {
      ...edge,
      type: "produkt-fallback",
      data: {
        ...(edge.data && typeof edge.data === "object" ? edge.data : {}),
        routeFallback: fallbackReasons.join(", "),
        routeOffset,
      },
    };
  });
}
