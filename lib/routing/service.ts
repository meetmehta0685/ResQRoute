import { optimizeWithAco, DEFAULT_ACO_CONFIG } from "../algorithms/aco";
import {
  dominantRuleIds,
  evaluateEdge,
  type FuzzyEvaluation,
} from "../algorithms/fuzzy";
import { shortestPath, type PathResult } from "../algorithms/dijkstra";
import {
  getEdgesById,
  getNode,
  GRAPH,
  validateGraph,
  validateRoutePath,
} from "../domain/graph";
import type {
  GraphData,
  OptimizeInput,
  OptimizationResponse,
  RouteResult,
  RoadEdge,
} from "../types";

export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputValidationError";
  }
}

export class NoRouteError extends Error {
  constructor(originId: string, destinationId: string) {
    super(`No route exists from ${originId} to ${destinationId}`);
    this.name = "NoRouteError";
  }
}

export function parseOptimizeInput(value: unknown): OptimizeInput {
  if (!value || typeof value !== "object") {
    throw new InputValidationError("Request body must be an object");
  }
  const input = value as Record<string, unknown>;
  const originId = typeof input.origin_id === "string" ? input.origin_id.trim() : "";
  const destinationId =
    typeof input.destination_id === "string" ? input.destination_id.trim() : "";
  const trafficLevel = input.traffic_level;
  const urgency = input.urgency;
  const seed = input.seed;

  if (typeof originId !== "string" || originId.length === 0) {
    throw new InputValidationError("origin_id is required");
  }
  if (typeof destinationId !== "string" || destinationId.length === 0) {
    throw new InputValidationError("destination_id is required");
  }
  if (originId === destinationId) {
    throw new InputValidationError("origin_id and destination_id must differ");
  }
  for (const [name, candidate] of [
    ["traffic_level", trafficLevel],
    ["urgency", urgency],
  ] as const) {
    if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate < 0 || candidate > 1) {
      throw new InputValidationError(`${name} must be a number between 0 and 1`);
    }
  }
  if (
    typeof seed !== "number" ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 2147483647
  ) {
    throw new InputValidationError("seed must be an integer between 0 and 2147483647");
  }

  return {
    origin_id: originId,
    destination_id: destinationId,
    traffic_level: trafficLevel as number,
    urgency: urgency as number,
    seed: seed as number,
  };
}

function routeResult(
  graph: GraphData,
  path: PathResult,
  algorithm: RouteResult["algorithm"],
  fuzzyCosts: Map<string, number>,
  usedFallback: boolean,
): RouteResult {
  const edgesById = getEdgesById(graph);
  const edges = path.edge_ids.map((edgeId) => edgesById.get(edgeId));
  if (edges.some((edge) => !edge)) {
    throw new NoRouteError(path.node_ids[0] ?? "", path.node_ids.at(-1) ?? "");
  }
  const definedEdges = edges as RoadEdge[];
  return {
    algorithm,
    node_ids: path.node_ids,
    edge_ids: path.edge_ids,
    distance_m: definedEdges.reduce((sum, edge) => sum + edge.distance_m, 0),
    base_time_s: definedEdges.reduce((sum, edge) => sum + edge.base_time_s, 0),
    fuzzy_cost_s: definedEdges.reduce(
      (sum, edge) => sum + (fuzzyCosts.get(edge.id) ?? edge.base_time_s),
      0,
    ),
    used_fallback: usedFallback,
  };
}

export function optimizeRoute(
  input: OptimizeInput,
  graph: GraphData = GRAPH,
): OptimizationResponse {
  const parsed = parseOptimizeInput(input);
  const validatedGraph = validateGraph(graph);
  getNode(validatedGraph, parsed.origin_id);
  getNode(validatedGraph, parsed.destination_id);

  const evaluations = new Map<string, FuzzyEvaluation>();
  const fuzzyCosts = new Map<string, number>();
  const baseCosts = new Map<string, number>();
  for (const edge of validatedGraph.edges) {
    const evaluation = evaluateEdge(edge, parsed.traffic_level, parsed.urgency);
    evaluations.set(edge.id, evaluation);
    fuzzyCosts.set(edge.id, evaluation.effective_cost_s);
    baseCosts.set(edge.id, edge.base_time_s);
  }

  const baselinePath = shortestPath(
    validatedGraph,
    parsed.origin_id,
    parsed.destination_id,
    baseCosts,
  );
  if (!baselinePath) {
    throw new NoRouteError(parsed.origin_id, parsed.destination_id);
  }

  const aco = optimizeWithAco(
    validatedGraph,
    parsed.origin_id,
    parsed.destination_id,
    fuzzyCosts,
    {
      ...DEFAULT_ACO_CONFIG,
      seed: parsed.seed,
    },
  );
  const usedFallback = !aco.path;
  const optimizedPath = aco.path ?? baselinePath;
  validateRoutePath(
    validatedGraph,
    parsed.origin_id,
    parsed.destination_id,
    optimizedPath.edge_ids,
  );

  const baseline = routeResult(
    validatedGraph,
    baselinePath,
    "shortest_time",
    fuzzyCosts,
    false,
  );
  const optimized = routeResult(
    validatedGraph,
    optimizedPath,
    "fuzzy_aco",
    fuzzyCosts,
    usedFallback,
  );
  const optimizedEvaluations = optimized.edge_ids
    .map((edgeId) => evaluations.get(edgeId))
    .filter((evaluation): evaluation is FuzzyEvaluation => Boolean(evaluation));
  const baselineEvaluations = baseline.edge_ids
    .map((edgeId) => evaluations.get(edgeId))
    .filter((evaluation): evaluation is FuzzyEvaluation => Boolean(evaluation));

  return {
    request: parsed,
    baseline,
    optimized,
    comparison: {
      base_time_delta_s: optimized.base_time_s - baseline.base_time_s,
      fuzzy_cost_delta_s: optimized.fuzzy_cost_s - baseline.fuzzy_cost_s,
    },
    explanation: {
      seed: parsed.seed,
      dominant_rule_ids: dominantRuleIds([...baselineEvaluations, ...optimizedEvaluations]),
      search_stats: {
        seed: parsed.seed,
        ants: DEFAULT_ACO_CONFIG.ants,
        iterations: DEFAULT_ACO_CONFIG.iterations,
        valid_routes: aco.valid_routes,
        used_fallback: usedFallback,
      },
    },
  };
}
