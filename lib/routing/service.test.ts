import { describe, expect, it } from "vitest";
import { GraphValidationError } from "../domain/graph";
import { optimizeRoute } from "./service";

const clearConditions = {
  origin_id: "HOSPITAL",
  destination_id: "INCIDENT",
  traffic_level: 0.2,
  urgency: 0.2,
  seed: 42,
} as const;

const heavyConditions = {
  origin_id: "HOSPITAL",
  destination_id: "INCIDENT",
  traffic_level: 1,
  urgency: 0.9,
  seed: 42,
} as const;

describe("routing service", () => {
  it("keeps the fast corridor when traffic is clear", () => {
    const result = optimizeRoute(clearConditions);
    expect(result.baseline.node_ids).toEqual(["HOSPITAL", "FAST_1", "FAST_2", "INCIDENT"]);
    expect(result.optimized.node_ids).toEqual(["HOSPITAL", "FAST_1", "FAST_2", "INCIDENT"]);
  });

  it("moves the optimized route to the safe corridor under heavy traffic", () => {
    const result = optimizeRoute(heavyConditions);
    expect(result.baseline.node_ids).toEqual(["HOSPITAL", "FAST_1", "FAST_2", "INCIDENT"]);
    expect(result.optimized.node_ids).toEqual(["HOSPITAL", "SAFE_1", "SAFE_2", "INCIDENT"]);
    expect(result.optimized.fuzzy_cost_s).toBeLessThan(result.baseline.fuzzy_cost_s);
    expect(result.explanation.dominant_rule_ids).toContain("R2_HIGH_TRAFFIC");
  });

  it("serializes the same result for the same request and seed", () => {
    expect(JSON.stringify(optimizeRoute(heavyConditions))).toBe(
      JSON.stringify(optimizeRoute(heavyConditions)),
    );
  });

  it("rejects invalid request values", () => {
    expect(() => optimizeRoute({ ...heavyConditions, urgency: 2 })).toThrow(
      "urgency must be a number between 0 and 1",
    );
  });

  it("rejects an invalid custom graph before calculating a route", () => {
    expect(() =>
      optimizeRoute(
        {
          origin_id: "A",
          destination_id: "B",
          traffic_level: 0.5,
          urgency: 0.5,
          seed: 42,
        },
        {
          nodes: [
            { id: "A", label: "A", x: 0, y: 0 },
            { id: "B", label: "B", x: 1, y: 1 },
          ],
          edges: [
            {
              id: "A_B",
              from: "A",
              to: "B",
              distance_m: 100,
              base_time_s: 10,
              congestion: 2,
              risk: 0.1,
            },
          ],
        },
      ),
    ).toThrow(GraphValidationError);
  });
});
