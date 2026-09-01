import { describe, expect, it } from "vitest";
import { GET as geocode } from "../app/api/geocode/route";
import { GET as health } from "../app/api/health/route";
import { GET as graph } from "../app/api/graph/route";
import { POST as optimize } from "../app/api/routes/optimize/route";

describe("route handlers", () => {
  it("returns the health response", async () => {
    const response = health();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("returns the graph fixture", async () => {
    const response = graph();
    const body = await response.json();
    expect(body.nodes).toHaveLength(6);
    expect(body.edges).toHaveLength(6);
  });

  it("returns an optimized route", async () => {
    const response = await optimize(
      new Request("http://localhost/api/routes/optimize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          origin_id: "HOSPITAL",
          destination_id: "INCIDENT",
          traffic_level: 1,
          urgency: 0.9,
          seed: 42,
        }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.optimized.algorithm).toBe("fuzzy_aco");
    expect(body.optimized.node_ids).toContain("SAFE_1");
  });

  it("returns structured validation errors", async () => {
    const response = await optimize(
      new Request("http://localhost/api/routes/optimize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          origin_id: "HOSPITAL",
          destination_id: "INCIDENT",
          traffic_level: 4,
          urgency: 0.9,
          seed: 42,
        }),
      }),
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "traffic_level must be a number between 0 and 1",
    });
  });

  it("treats whitespace-only optimizer IDs as invalid input", async () => {
    const response = await optimize(
      new Request("http://localhost/api/routes/optimize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          origin_id: "   ",
          destination_id: "INCIDENT",
          traffic_level: 0,
          urgency: 0,
          seed: 42,
        }),
      }),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "origin_id is required" });
  });

  it("treats an overlong geocode query as invalid input", async () => {
    const query = "a".repeat(121);
    const response = await geocode(
      new Request(`http://localhost/api/geocode?q=${query}`),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "Search must be 120 characters or fewer",
    });
  });
});
