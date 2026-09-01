import { getOutgoingEdges, validateRoutePath } from "../domain/graph";
import type { GraphData, NodeId } from "../types";

export interface PathResult {
  node_ids: NodeId[];
  edge_ids: string[];
  total_cost: number;
}

export function shortestPath(
  graph: GraphData,
  originId: NodeId,
  destinationId: NodeId,
  costByEdgeId: Map<string, number>,
): PathResult | null {
  const distances = new Map<NodeId, number>(
    graph.nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]),
  );
  const previous = new Map<NodeId, { nodeId: NodeId; edgeId: string }>();
  const unvisited = new Set(graph.nodes.map((node) => node.id));
  distances.set(originId, 0);

  while (unvisited.size > 0) {
    let current: NodeId | undefined;
    let currentDistance = Number.POSITIVE_INFINITY;

    for (const nodeId of unvisited) {
      const distance = distances.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (distance < currentDistance) {
        current = nodeId;
        currentDistance = distance;
      }
    }

    if (!current || currentDistance === Number.POSITIVE_INFINITY) break;
    unvisited.delete(current);
    if (current === destinationId) break;

    for (const edge of getOutgoingEdges(graph, current)) {
      if (!unvisited.has(edge.to)) continue;
      const edgeCost = costByEdgeId.get(edge.id);
      if (edgeCost === undefined || edgeCost < 0) continue;
      const nextDistance = currentDistance + edgeCost;
      if (nextDistance < (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        distances.set(edge.to, nextDistance);
        previous.set(edge.to, { nodeId: current, edgeId: edge.id });
      }
    }
  }

  const destinationDistance = distances.get(destinationId);
  if (destinationDistance === undefined || !Number.isFinite(destinationDistance)) {
    return null;
  }

  const edgeIds: string[] = [];
  let current = destinationId;
  while (current !== originId) {
    const prior = previous.get(current);
    if (!prior) return null;
    edgeIds.unshift(prior.edgeId);
    current = prior.nodeId;
  }

  const nodeIds = validateRoutePath(graph, originId, destinationId, edgeIds);
  return { node_ids: nodeIds, edge_ids: edgeIds, total_cost: destinationDistance };
}
