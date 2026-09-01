import type { GraphData, NodeId, RoadEdge } from "../types";
import { GRAPH_DATA } from "../data/graph";

export class GraphValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphValidationError";
  }
}

export class UnknownNodeError extends Error {
  constructor(nodeId: NodeId) {
    super(`Unknown node: ${nodeId}`);
    this.name = "UnknownNodeError";
  }
}

export function validateGraph(graph: GraphData): GraphData {
  const nodeIds = new Set<NodeId>();

  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) {
      throw new GraphValidationError(`Duplicate node ID: ${node.id}`);
    }
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      throw new GraphValidationError(`Node ${node.id} has invalid coordinates`);
    }
    nodeIds.add(node.id);
  }

  const edgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id)) {
      throw new GraphValidationError(`Duplicate edge ID: ${edge.id}`);
    }
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new GraphValidationError(`Edge ${edge.id} references an unknown node`);
    }
    if (edge.from === edge.to) {
      throw new GraphValidationError(`Edge ${edge.id} cannot be a self-loop`);
    }
    if (!Number.isFinite(edge.distance_m) || edge.distance_m <= 0) {
      throw new GraphValidationError(`Edge ${edge.id} has invalid distance`);
    }
    if (!Number.isFinite(edge.base_time_s) || edge.base_time_s <= 0) {
      throw new GraphValidationError(`Edge ${edge.id} has invalid base time`);
    }
    for (const [field, value] of [
      ["congestion", edge.congestion],
      ["risk", edge.risk],
    ] as const) {
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new GraphValidationError(`Edge ${edge.id} has invalid ${field}`);
      }
    }
    edgeIds.add(edge.id);
  }

  return graph;
}

export function getNode(graph: GraphData, nodeId: NodeId) {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    throw new UnknownNodeError(nodeId);
  }
  return node;
}

export function getOutgoingEdges(graph: GraphData, nodeId: NodeId): RoadEdge[] {
  return graph.edges.filter((edge) => edge.from === nodeId);
}

export function getEdgesById(graph: GraphData): Map<string, RoadEdge> {
  return new Map(graph.edges.map((edge) => [edge.id, edge]));
}

export function validateRoutePath(
  graph: GraphData,
  originId: NodeId,
  destinationId: NodeId,
  edgeIds: string[],
): NodeId[] {
  getNode(graph, originId);
  getNode(graph, destinationId);
  const edgesById = getEdgesById(graph);
  const nodeIds: NodeId[] = [originId];
  const visited = new Set<NodeId>([originId]);
  let current = originId;

  for (const edgeId of edgeIds) {
    const edge = edgesById.get(edgeId);
    if (!edge || edge.from !== current) {
      throw new GraphValidationError(`Invalid route transition at edge ${edgeId}`);
    }
    if (visited.has(edge.to)) {
      throw new GraphValidationError(`Route contains a repeated node: ${edge.to}`);
    }
    nodeIds.push(edge.to);
    visited.add(edge.to);
    current = edge.to;
  }

  if (current !== destinationId) {
    throw new GraphValidationError(
      `Route ends at ${current}, expected ${destinationId}`,
    );
  }

  return nodeIds;
}

export const GRAPH = validateGraph(GRAPH_DATA);
