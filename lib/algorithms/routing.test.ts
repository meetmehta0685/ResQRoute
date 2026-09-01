import { describe, expect, it } from "vitest";
import { optimizeWithAco, DEFAULT_ACO_CONFIG } from "./aco";
import { effectiveEdgeCost } from "./fuzzy";
import { shortestPath } from "./dijkstra";
import { GRAPH } from "../domain/graph";

function fuzzyCosts(trafficLevel: number, urgency: number) {
  return new Map(
    GRAPH.edges.map((edge) => [edge.id, effectiveEdgeCost(edge, trafficLevel, urgency)]),
  );
}

describe("routing algorithms", () => {
  it("finds the shortest travel-time path", () => {
    const result = shortestPath(
      GRAPH,
      "HOSPITAL",
      "INCIDENT",
      new Map(GRAPH.edges.map((edge) => [edge.id, edge.base_time_s])),
    );
    expect(result?.node_ids).toEqual(["HOSPITAL", "FAST_1", "FAST_2", "INCIDENT"]);
    expect(result?.total_cost).toBe(200);
  });

  it("returns deterministic ACO output for the same seed", () => {
    const costs = fuzzyCosts(1, 0.9);
    const config = { ...DEFAULT_ACO_CONFIG, seed: 42 };
    const first = optimizeWithAco(GRAPH, "HOSPITAL", "INCIDENT", costs, config);
    const second = optimizeWithAco(GRAPH, "HOSPITAL", "INCIDENT", costs, config);
    expect(first).toEqual(second);
    expect(first.path?.node_ids[0]).toBe("HOSPITAL");
    expect(first.path?.node_ids.at(-1)).toBe("INCIDENT");
  });

  it("produces complete routes for multiple seeds", () => {
    const costs = fuzzyCosts(1, 0.9);
    for (const seed of [0, 1, 42, 1234]) {
      const result = optimizeWithAco(GRAPH, "HOSPITAL", "INCIDENT", costs, {
        ...DEFAULT_ACO_CONFIG,
        seed,
      });
      expect(result.path?.edge_ids.length).toBe(3);
      expect(result.valid_routes).toBeGreaterThan(0);
    }
  });

  it("returns no path for a disconnected graph", () => {
    const disconnected = {
      nodes: [
        { id: "A", label: "A", x: 0, y: 0 },
        { id: "B", label: "B", x: 1, y: 1 },
      ],
      edges: [],
    };
    const result = optimizeWithAco(disconnected, "A", "B", new Map(), {
      ...DEFAULT_ACO_CONFIG,
      seed: 42,
    });
    expect(result.path).toBeNull();
    expect(result.valid_routes).toBe(0);
  });
});
