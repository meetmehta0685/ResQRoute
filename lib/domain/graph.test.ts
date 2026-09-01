import { describe, expect, it } from "vitest";
import { GRAPH, GraphValidationError, validateGraph, validateRoutePath } from "./graph";

describe("road graph", () => {
  it("loads the six-node fixture with valid edges", () => {
    expect(GRAPH.nodes).toHaveLength(6);
    expect(GRAPH.edges).toHaveLength(6);
    expect(GRAPH.edges.every((edge) => edge.base_time_s > 0)).toBe(true);
  });

  it("validates a contiguous route", () => {
    expect(
      validateRoutePath(GRAPH, "HOSPITAL", "INCIDENT", [
        "HOSPITAL_FAST_1",
        "FAST_1_FAST_2",
        "FAST_2_INCIDENT",
      ]),
    ).toEqual(["HOSPITAL", "FAST_1", "FAST_2", "INCIDENT"]);
  });

  it("rejects duplicate node IDs", () => {
    expect(() =>
      validateGraph({
        nodes: [
          { id: "A", label: "A", x: 0, y: 0 },
          { id: "A", label: "Duplicate", x: 1, y: 1 },
        ],
        edges: [],
      }),
    ).toThrow(GraphValidationError);
  });

  it("rejects a route with a broken transition", () => {
    expect(() =>
      validateRoutePath(GRAPH, "HOSPITAL", "INCIDENT", ["SAFE_1_SAFE_2"]),
    ).toThrow(GraphValidationError);
  });
});
