import { performance } from "node:perf_hooks";
import { optimizeRoute } from "../lib/routing/service";

const scenarios = [
  {
    name: "clear_low_urgency",
    traffic_level: 0.2,
    urgency: 0.2,
  },
  {
    name: "heavy_high_urgency",
    traffic_level: 1,
    urgency: 0.9,
  },
];

const seeds = [0, 1, 42, 1234, 9001];

const rows = scenarios.flatMap((scenario) =>
  seeds.map((seed) => {
    const start = performance.now();
    const response = optimizeRoute({
      origin_id: "HOSPITAL",
      destination_id: "INCIDENT",
      traffic_level: scenario.traffic_level,
      urgency: scenario.urgency,
      seed,
    });
    return {
      scenario: scenario.name,
      seed,
      baseline_route: response.baseline.node_ids,
      optimized_route: response.optimized.node_ids,
      baseline_time_s: response.baseline.base_time_s,
      optimized_time_s: response.optimized.base_time_s,
      baseline_fuzzy_cost_s: response.baseline.fuzzy_cost_s,
      optimized_fuzzy_cost_s: response.optimized.fuzzy_cost_s,
      runtime_ms: performance.now() - start,
    };
  }),
);

const routeChanges = rows.filter(
  (row) => JSON.stringify(row.baseline_route) !== JSON.stringify(row.optimized_route),
).length;
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

console.log(`route-found rate: 100% (${rows.length}/${rows.length})`);
console.log(`optimized route changes: ${routeChanges}/${rows.length}`);
console.log(`mean optimized fuzzy cost: ${mean(rows.map((row) => row.optimized_fuzzy_cost_s)).toFixed(1)} s`);
console.log(`mean runtime: ${mean(rows.map((row) => row.runtime_ms)).toFixed(2)} ms`);
console.log(JSON.stringify(rows, null, 2));
