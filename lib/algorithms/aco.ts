import { getOutgoingEdges } from "../domain/graph";
import type { GraphData, NodeId } from "../types";
import type { PathResult } from "./dijkstra";

export interface AcoConfig {
  ants: number;
  iterations: number;
  alpha: number;
  beta: number;
  evaporation: number;
  deposit_constant: number;
  seed: number;
}

export interface AcoResult {
  path: PathResult | null;
  valid_routes: number;
}

export const DEFAULT_ACO_CONFIG: Omit<AcoConfig, "seed"> = {
  ants: 30,
  iterations: 80,
  alpha: 1,
  beta: 2,
  evaporation: 0.25,
  deposit_constant: 1,
};

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0) || 1;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
}

function chooseWeighted<T>(
  items: T[],
  weights: number[],
  random: SeededRandom,
): T {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!Number.isFinite(total) || total <= 0) {
    return items[Math.floor(random.next() * items.length)] as T;
  }
  let target = random.next() * total;
  for (let index = 0; index < items.length; index += 1) {
    target -= weights[index] ?? 0;
    if (target <= 0) return items[index] as T;
  }
  return items[items.length - 1] as T;
}

function buildAntPath(
  graph: GraphData,
  originId: NodeId,
  destinationId: NodeId,
  costByEdgeId: Map<string, number>,
  pheromone: Map<string, number>,
  config: AcoConfig,
  random: SeededRandom,
): PathResult | null {
  const nodeIds: NodeId[] = [originId];
  const edgeIds: string[] = [];
  const visited = new Set<NodeId>(nodeIds);
  let current = originId;
  let totalCost = 0;

  for (let step = 0; step < graph.nodes.length && current !== destinationId; step += 1) {
    const candidates = getOutgoingEdges(graph, current).filter(
      (edge) => !visited.has(edge.to) && costByEdgeId.has(edge.id),
    );
    if (candidates.length === 0) return null;

    const weights = candidates.map((edge) => {
      const pheromoneValue = pheromone.get(edge.id) ?? 1;
      const edgeCost = costByEdgeId.get(edge.id) ?? Number.POSITIVE_INFINITY;
      return Math.pow(pheromoneValue, config.alpha) * Math.pow(1 / edgeCost, config.beta);
    });
    const selected = chooseWeighted(candidates, weights, random);
    const selectedCost = costByEdgeId.get(selected.id);
    if (selectedCost === undefined) return null;

    edgeIds.push(selected.id);
    nodeIds.push(selected.to);
    visited.add(selected.to);
    current = selected.to;
    totalCost += selectedCost;
  }

  if (current !== destinationId) return null;
  return { node_ids: nodeIds, edge_ids: edgeIds, total_cost: totalCost };
}

export function optimizeWithAco(
  graph: GraphData,
  originId: NodeId,
  destinationId: NodeId,
  costByEdgeId: Map<string, number>,
  config: AcoConfig,
): AcoResult {
  const random = new SeededRandom(config.seed);
  const pheromone = new Map(graph.edges.map((edge) => [edge.id, 1]));
  let bestPath: PathResult | null = null;
  let validRoutes = 0;

  for (let iteration = 0; iteration < config.iterations; iteration += 1) {
    const iterationPaths: PathResult[] = [];

    for (let ant = 0; ant < config.ants; ant += 1) {
      const path = buildAntPath(
        graph,
        originId,
        destinationId,
        costByEdgeId,
        pheromone,
        config,
        random,
      );
      if (!path) continue;
      validRoutes += 1;
      iterationPaths.push(path);
      if (!bestPath || path.total_cost < bestPath.total_cost) {
        bestPath = path;
      }
    }

    for (const edge of graph.edges) {
      const current = pheromone.get(edge.id) ?? 1;
      pheromone.set(edge.id, Math.max(0.000001, current * (1 - config.evaporation)));
    }

    for (const path of iterationPaths) {
      const deposit = config.deposit_constant / Math.max(path.total_cost, 0.000001);
      for (const edgeId of path.edge_ids) {
        pheromone.set(edgeId, (pheromone.get(edgeId) ?? 0) + deposit);
      }
    }
  }

  return { path: bestPath, valid_routes: validRoutes };
}
