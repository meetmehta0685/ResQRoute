import { describe, expect, it } from "vitest";
import {
  routeOverlayOrder,
  sameRouteGeometry,
} from "./route-display";
import type { GeoJsonLineString } from "../types";

const SHARED_ROUTE: GeoJsonLineString = {
  type: "LineString",
  coordinates: [[72.54, 23.15], [72.56, 23.18], [72.58, 23.2]],
};

describe("route display", () => {
  it("recognizes identical route geometries", () => {
    expect(sameRouteGeometry(SHARED_ROUTE, { ...SHARED_ROUTE })).toBe(true);
    expect(sameRouteGeometry(SHARED_ROUTE, {
      type: "LineString",
      coordinates: [[72.54, 23.15], [72.57, 23.18], [72.58, 23.2]],
    })).toBe(false);
    expect(sameRouteGeometry(SHARED_ROUTE, undefined)).toBe(false);
  });

  it("puts the solid emergency route underneath the dashed normal route when they overlap", () => {
    expect(routeOverlayOrder(SHARED_ROUTE, SHARED_ROUTE)).toEqual([
      "optimized",
      "baseline",
    ]);
    expect(routeOverlayOrder(SHARED_ROUTE, {
      type: "LineString",
      coordinates: [[72.54, 23.15], [72.57, 23.18], [72.58, 23.2]],
    })).toEqual(["baseline", "optimized"]);
  });
});
