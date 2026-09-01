import type { GeoJsonLineString } from "../types";

export type RouteLayer = "baseline" | "optimized";

export const ROUTE_COLORS = {
  baseline: "#0b3b78",
  optimized: "#ed5b3b",
} as const;

export function sameRouteGeometry(
  first: GeoJsonLineString | undefined,
  second: GeoJsonLineString | undefined,
): boolean {
  return Boolean(
    first &&
      second &&
      first.type === second.type &&
      JSON.stringify(first.coordinates) === JSON.stringify(second.coordinates),
  );
}

export function routeOverlayOrder(
  baseline: GeoJsonLineString | undefined,
  optimized: GeoJsonLineString | undefined,
): RouteLayer[] {
  return sameRouteGeometry(baseline, optimized)
    ? ["optimized", "baseline"]
    : ["baseline", "optimized"];
}
