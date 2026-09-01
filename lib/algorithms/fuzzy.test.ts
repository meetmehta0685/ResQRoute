import { describe, expect, it } from "vitest";
import { evaluateEdge, membership } from "./fuzzy";
import { GRAPH } from "../domain/graph";

const fastMiddleEdge = GRAPH.edges.find((edge) => edge.id === "FAST_1_FAST_2");
const safeMiddleEdge = GRAPH.edges.find((edge) => edge.id === "SAFE_1_SAFE_2");

if (!fastMiddleEdge || !safeMiddleEdge) {
  throw new Error("Fixture edges are missing");
}

describe("fuzzy route cost", () => {
  it("has complete low, medium, and high membership boundaries", () => {
    expect(membership(0).low).toBe(1);
    expect(membership(0.5).medium).toBe(1);
    expect(membership(1).high).toBe(1);
  });

  it("clamps traffic input to the valid range", () => {
    const evaluation = evaluateEdge({ ...fastMiddleEdge, congestion: 1 }, 4, 0.5);
    expect(evaluation.traffic_input).toBe(1);
    expect(Number.isFinite(evaluation.effective_cost_s)).toBe(true);
  });

  it("marks high traffic as a dominant fuzzy condition", () => {
    const evaluation = evaluateEdge(fastMiddleEdge, 1, 0.9);
    expect(evaluation.dominant_rule_ids).toContain("R2_HIGH_TRAFFIC");
    expect(evaluation.fired_rules.some((rule) => rule.id === "R4_TRAFFIC_AND_RISK_CRITICAL")).toBe(false);
  });

  it("keeps safe low-traffic edges cheaper than the congested edge", () => {
    const congested = evaluateEdge(fastMiddleEdge, 1, 0.9);
    const safe = evaluateEdge(safeMiddleEdge, 1, 0.9);
    expect(safe.effective_cost_s).toBeLessThan(congested.effective_cost_s);
  });

  it("does not erase a high-risk penalty when urgency is high", () => {
    const edge = { ...safeMiddleEdge, risk: 0.9 };
    const lowUrgency = evaluateEdge(edge, 0.2, 0.1);
    const highUrgency = evaluateEdge(edge, 0.2, 0.9);
    expect(lowUrgency.penalty).toBeGreaterThan(0.45);
    expect(highUrgency.penalty).toBeGreaterThan(0.45);
  });
});
