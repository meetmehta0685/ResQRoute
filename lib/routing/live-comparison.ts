import { optimizeRoute, parseOptimizeInput } from "./service";
import { parseLiveRouteInput, routeLiveLocations } from "../maps/routing";
import type {
  GraphData,
  LiveRouteOption,
  OptimizeInput,
  RouteComparisonResponse,
  RouteResult,
} from "../types";

export const LIVE_ORIGIN_ID = "LIVE_ORIGIN";
export const LIVE_DESTINATION_ID = "LIVE_DESTINATION";

const DEFAULT_SEED = 42;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object";
}

function parseComparisonInput(value: unknown): OptimizeInput {
  const input = isRecord(value) ? value : {};
  return parseOptimizeInput({
    origin_id: LIVE_ORIGIN_ID,
    destination_id: LIVE_DESTINATION_ID,
    traffic_level: input.traffic_level,
    urgency: input.urgency,
    seed: input.seed === undefined ? DEFAULT_SEED : input.seed,
  });
}

function candidateProfile(
  route: LiveRouteOption,
  fastestRouteId: string,
  routeRank: number,
): { congestion: number; risk: number } {
  if (route.id === fastestRouteId) {
    return { congestion: 0.9, risk: 0.25 };
  }

  return {
    congestion: Math.min(0.45, 0.24 + routeRank * 0.05),
    risk: Math.min(0.3, 0.12 + routeRank * 0.03),
  };
}

export function buildLiveCandidateGraph(
  originLabel: string,
  destinationLabel: string,
  routes: LiveRouteOption[],
): GraphData {
  const fastestRoute = routes.reduce((fastest, route) =>
    route.duration_s < fastest.duration_s ? route : fastest,
  );
  const rankedRoutes = [...routes].sort((first, second) => {
    return first.duration_s - second.duration_s || first.id.localeCompare(second.id);
  });
  const routeRanks = new Map(rankedRoutes.map((route, index) => [route.id, index]));

  return {
    nodes: [
      { id: LIVE_ORIGIN_ID, label: originLabel, x: 0.05, y: 0.5 },
      { id: LIVE_DESTINATION_ID, label: destinationLabel, x: 0.95, y: 0.5 },
    ],
    edges: routes.map((route) => {
      const profile = candidateProfile(
        route,
        fastestRoute.id,
        routeRanks.get(route.id) ?? 0,
      );
      return {
        id: route.id,
        from: LIVE_ORIGIN_ID,
        to: LIVE_DESTINATION_ID,
        distance_m: route.distance_m,
        base_time_s: route.duration_s,
        congestion: profile.congestion,
        risk: profile.risk,
      };
    }),
  };
}

function attachGeometry(
  route: RouteResult,
  liveRoutes: LiveRouteOption[],
): RouteResult {
  const geometry = liveRoutes.find((candidate) => candidate.id === route.edge_ids[0])?.geometry;
  return geometry ? { ...route, geometry } : route;
}

export async function compareLiveRoutes(value: unknown): Promise<RouteComparisonResponse> {
  const input = parseComparisonInput(value);
  const { origin, destination } = parseLiveRouteInput(value);
  const live = await routeLiveLocations(origin, destination);
  const graph = buildLiveCandidateGraph(origin.label, destination.label, live.routes);
  const optimization = optimizeRoute(input, graph);

  return {
    ...optimization,
    baseline: attachGeometry(optimization.baseline, live.routes),
    optimized: attachGeometry(optimization.optimized, live.routes),
    provider: live.provider,
    origin: live.origin,
    destination: live.destination,
    routes: live.routes,
    fetched_at: live.fetched_at,
    attribution: live.attribution,
  };
}
