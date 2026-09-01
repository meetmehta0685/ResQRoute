import { afterEach, describe, expect, it, vi } from "vitest";
import { optimizeRoute } from "./service";
import {
  buildLiveCandidateGraph,
  compareLiveRoutes,
  LIVE_DESTINATION_ID,
  LIVE_ORIGIN_ID,
} from "./live-comparison";
import type { LiveRouteOption } from "../types";

const CANDIDATES: LiveRouteOption[] = [
  {
    id: "fast-route",
    geometry: { type: "LineString", coordinates: [[77, 28], [77.01, 28.01]] },
    distance_m: 1000,
    duration_s: 100,
    provider: "OSRM",
    is_alternative: false,
  },
  {
    id: "safe-route",
    geometry: { type: "LineString", coordinates: [[77, 28], [77.01, 28], [77.01, 28.01]] },
    distance_m: 1200,
    duration_s: 120,
    provider: "OSRM",
    is_alternative: true,
  },
];

describe("live route comparison", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("turns provider candidates into a graph with real route costs", () => {
    const graph = buildLiveCandidateGraph("Starting point", "Incident", CANDIDATES);

    expect(graph.nodes.map((node) => node.id)).toEqual([
      LIVE_ORIGIN_ID,
      LIVE_DESTINATION_ID,
    ]);
    expect(graph.edges.map((edge) => [edge.id, edge.base_time_s])).toEqual([
      ["fast-route", 100],
      ["safe-route", 120],
    ]);
  });

  it("keeps the fastest candidate in clear conditions", () => {
    const graph = buildLiveCandidateGraph("Starting point", "Incident", CANDIDATES);
    const result = optimizeRoute({
      origin_id: LIVE_ORIGIN_ID,
      destination_id: LIVE_DESTINATION_ID,
      traffic_level: 0,
      urgency: 0.2,
      seed: 42,
    }, graph);

    expect(result.baseline.edge_ids).toEqual(["fast-route"]);
    expect(result.optimized.edge_ids).toEqual(["fast-route"]);
  });

  it("lets fuzzy + ACO choose the safer candidate under heavy traffic", () => {
    const graph = buildLiveCandidateGraph("Starting point", "Incident", CANDIDATES);
    const result = optimizeRoute({
      origin_id: LIVE_ORIGIN_ID,
      destination_id: LIVE_DESTINATION_ID,
      traffic_level: 1,
      urgency: 0.9,
      seed: 42,
    }, graph);

    expect(result.baseline.edge_ids).toEqual(["fast-route"]);
    expect(result.optimized.edge_ids).toEqual(["safe-route"]);
    expect(result.optimized.fuzzy_cost_s).toBeLessThan(result.baseline.fuzzy_cost_s);
  });

  it.each([
    ["low traffic / routine", 0, 0.2, "fast-route"],
    ["low traffic / elevated", 0, 0.5, "fast-route"],
    ["low traffic / critical", 0, 0.9, "fast-route"],
    ["medium traffic / routine", 0.5, 0.2, "fast-route"],
    ["medium traffic / elevated", 0.5, 0.5, "fast-route"],
    ["medium traffic / critical", 0.5, 0.9, "safe-route"],
    ["heavy traffic / routine", 1, 0.2, "safe-route"],
    ["heavy traffic / elevated", 1, 0.5, "safe-route"],
    ["heavy traffic / critical", 1, 0.9, "safe-route"],
  ] as const)("selects the expected candidate for %s", (_name, traffic, urgency, expectedRoute) => {
    const graph = buildLiveCandidateGraph("Starting point", "Incident", CANDIDATES);
    const result = optimizeRoute({
      origin_id: LIVE_ORIGIN_ID,
      destination_id: LIVE_DESTINATION_ID,
      traffic_level: traffic,
      urgency,
      seed: 42,
    }, graph);

    expect(result.baseline.edge_ids).toEqual(["fast-route"]);
    expect(result.optimized.edge_ids).toEqual([expectedRoute]);
  });

  it("chooses a viable bounded detour for the critical-condition demonstration", async () => {
    const origin = { label: "Adani University", lat: 23.15635, lng: 72.54441 };
    const destination = { label: "Karnavati University", lat: 23.20224, lng: 72.58361 };
    const start = [origin.lng, origin.lat];
    const end = [destination.lng, destination.lat];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        code: "Ok",
        routes: [{
          distance: 10_174.4,
          duration: 709.7,
          geometry: { type: "LineString", coordinates: [start, [72.575, 23.171], end] },
        }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        code: "Ok",
        routes: [{
          distance: 15_773,
          duration: 1_386.8,
          geometry: { type: "LineString", coordinates: [start, [72.555, 23.186], end] },
        }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        code: "Ok",
        routes: [{
          distance: 11_671.8,
          duration: 931.4,
          geometry: { type: "LineString", coordinates: [start, [72.573, 23.173], end] },
        }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await compareLiveRoutes({
      origin,
      destination,
      traffic_level: 1,
      urgency: 0.9,
      seed: 42,
    });

    expect(result.baseline.edge_ids).toEqual(["osrm-route-1"]);
    expect(result.optimized.edge_ids).toEqual(["osrm-detour-route"]);
    expect(result.optimized.base_time_s).toBe(931.4);
    expect(result.optimized.geometry).not.toEqual(result.baseline.geometry);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects invalid conditions before contacting the routing provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(compareLiveRoutes({
      origin: { label: "Origin", lat: 28.6129, lng: 77.2295 },
      destination: { label: "Destination", lat: 28.6315, lng: 77.2167 },
      traffic_level: 2,
      urgency: 0.9,
      seed: 42,
    })).rejects.toThrow("traffic_level must be a number between 0 and 1");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
