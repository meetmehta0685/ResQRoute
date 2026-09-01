import { explainRule } from "../lib/algorithms/fuzzy";
import type { OptimizationResponse, RouteResult } from "../lib/types";

interface RouteMetricsProps {
  response: OptimizationResponse | null;
  labels: Map<string, string>;
}

function formatSeconds(value: number): string {
  return `${value.toFixed(1)} s`;
}

function formatDistance(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(2)} km` : `${value.toFixed(0)} m`;
}

function formatDelta(value: number, suffix: string): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} ${suffix}`;
}

function routeName(route: RouteResult): string {
  return route.algorithm === "fuzzy_aco" ? "Fuzzy + ACO" : "Shortest time";
}

function RouteBlock({ route, labels }: { route: RouteResult; labels: Map<string, string> }) {
  return (
    <div className="route-block">
      <div className="route-block-heading">
        <span className={route.algorithm === "fuzzy_aco" ? "route-dot optimized" : "route-dot baseline"} />
        <strong>{routeName(route)}</strong>
        {route.used_fallback && <span className="fallback-badge">Fallback</span>}
      </div>
      <div className="metric-grid">
        <div><span>Travel time</span><strong>{formatSeconds(route.base_time_s)}</strong></div>
        <div><span>Fuzzy cost</span><strong>{formatSeconds(route.fuzzy_cost_s)}</strong></div>
        <div><span>Distance</span><strong>{formatDistance(route.distance_m)}</strong></div>
      </div>
      <p className="route-sequence">
        {route.node_ids.map((nodeId) => labels.get(nodeId) ?? nodeId).join("  →  ")}
      </p>
    </div>
  );
}

export function RouteMetrics({ response, labels }: RouteMetricsProps) {
  if (!response) {
    return (
      <div className="results-empty">
        <span className="section-label">Route result</span>
        <strong>No route calculated yet.</strong>
        <p>Choose the endpoints and operating conditions, then calculate a route to see the comparison.</p>
      </div>
    );
  }

  return (
    <div className="results-content">
      <div className="result-status"><span className="status-dot" />Route calculated <span>seed {response.explanation.seed}</span></div>
      <RouteBlock route={response.baseline} labels={labels} />
      <RouteBlock route={response.optimized} labels={labels} />
      <div className="comparison-block">
        <span className="section-label">Difference from baseline</span>
        <div className="comparison-row"><span>Travel time</span><strong>{formatDelta(response.comparison.base_time_delta_s, "s")}</strong></div>
        <div className="comparison-row"><span>Fuzzy cost</span><strong>{formatDelta(response.comparison.fuzzy_cost_delta_s, "s")}</strong></div>
      </div>
      <div className="explanation-block">
        <span className="section-label">Why the route changed</span>
        <p>{response.explanation.dominant_rule_ids.length ? "The optimizer responded most to these fuzzy conditions:" : "The optimizer used the balanced-conditions rule."}</p>
        <ul>
          {response.explanation.dominant_rule_ids.map((ruleId) => (
            <li key={ruleId}><code>{ruleId}</code><span>{explainRule(ruleId)}</span></li>
          ))}
        </ul>
      </div>
      <div className="search-note">{response.explanation.search_stats.ants} ants · {response.explanation.search_stats.iterations} iterations · {response.explanation.search_stats.valid_routes} valid route searches</div>
    </div>
  );
}
