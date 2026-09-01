import { explainRule } from "../lib/algorithms/fuzzy";
import { sameRouteGeometry } from "../lib/maps/route-display";
import type { RouteComparisonResponse, RouteResult } from "../lib/types";

interface LiveRouteMetricsProps {
  response: RouteComparisonResponse | null;
  trafficLevel: number;
  urgency: number;
}

function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

function formatDistance(meters: number): string {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

function formatDelta(seconds: number): string {
  if (Math.abs(seconds) < 0.5) return "Same";
  const sign = seconds > 0 ? "+" : "";
  return `${sign}${formatDuration(Math.abs(seconds))}`;
}

function routeTitle(route: RouteResult): string {
  return route.algorithm === "fuzzy_aco" ? "Emergency route" : "Normal route";
}

function routeMethod(route: RouteResult): string {
  return route.algorithm === "fuzzy_aco"
    ? "Fuzzy + ACO · conditions-aware"
    : "Dijkstra · shortest drive time";
}

function RouteOption({ route }: { route: RouteResult }) {
  const isOptimized = route.algorithm === "fuzzy_aco";
  return (
    <div className={`live-route-option ${isOptimized ? "route-option-optimized" : "route-option-baseline"}`}>
      <div className="route-block-heading">
        <span className={isOptimized ? "route-dot optimized" : "route-dot baseline"} />
        <div className="route-option-title">
          <strong>{routeTitle(route)}</strong>
          <span>{routeMethod(route)}</span>
        </div>
        {route.used_fallback && <span className="fallback-badge">Fallback</span>}
      </div>
      <div className="metric-grid live-metric-grid">
        <div><span>Drive time</span><strong>{formatDuration(route.base_time_s)}</strong></div>
        <div><span>Distance</span><strong>{formatDistance(route.distance_m)}</strong></div>
        <div><span>Model cost</span><strong>{formatDuration(route.fuzzy_cost_s)}</strong></div>
      </div>
    </div>
  );
}

export function LiveRouteMetrics({ response, trafficLevel, urgency }: LiveRouteMetricsProps) {
  if (!response) {
    return (
      <div className="results-empty">
        <span className="section-label">Route comparison</span>
        <strong>Two route strategies will appear here.</strong>
        <p>Select a starting point and incident location, answer the operating questions, and compare Dijkstra with fuzzy + ACO.</p>
        <div className="results-preview-legend" aria-label="Route strategy preview">
          <span><i className="legend-swatch legend-baseline" />Normal · Dijkstra</span>
          <span><i className="legend-swatch legend-optimized" />Emergency · Fuzzy + ACO</span>
        </div>
      </div>
    );
  }

  const sameCandidate = response.baseline.edge_ids[0] === response.optimized.edge_ids[0];
  const routesOverlap = sameRouteGeometry(
    response.baseline.geometry,
    response.optimized.geometry,
  );
  const usedDetourCandidate = response.routes.some((route) => route.is_detour);

  return (
    <div className="live-results-content">
      <div className="result-status">
        <span className="status-dot" />2 routes compared
        <span>{response.provider}</span>
      </div>
      <div className="live-location-summary">
        <div><span>Starting point</span><strong>{response.origin.label}</strong></div>
        <div><span>Incident location</span><strong>{response.destination.label}</strong></div>
      </div>
      <div className="condition-summary" aria-label="Route conditions used">
        <div><span>Traffic</span><strong>{Math.round(trafficLevel * 100)}%</strong></div>
        <div><span>Emergency</span><strong>{Math.round(urgency * 100)}%</strong></div>
      </div>
      <div className="route-options" aria-label="Compared route strategies">
        <RouteOption route={response.baseline} />
        <RouteOption route={response.optimized} />
      </div>
      {(sameCandidate || routesOverlap) && (
        <p className="route-match-note">
          {routesOverlap
            ? "Both strategies use the same corridor under these conditions. The solid coral emergency route is layered beneath the dark-blue dashed Dijkstra route so both remain visible."
            : "Both strategies selected the same live candidate under these conditions. Increase traffic or compare a different pair to reveal a fuzzy + ACO reroute."}
        </p>
      )}
      {usedDetourCandidate && (
        <p className="route-source-note">The provider returned one route, so a bounded detour candidate was requested for the comparison.</p>
      )}
      <div className="comparison-block">
        <span className="section-label">Emergency route effect</span>
        <div className="comparison-row"><span>Drive time vs normal</span><strong>{formatDelta(response.comparison.base_time_delta_s)}</strong></div>
        <div className="comparison-row"><span>Fuzzy cost vs normal</span><strong>{formatDelta(response.comparison.fuzzy_cost_delta_s)}</strong></div>
      </div>
      <div className="explanation-block">
        <span className="section-label">Why fuzzy + ACO changed it</span>
        <p>{response.explanation.dominant_rule_ids.length ? "The conditions model responded most to these signals:" : "The conditions model used a balanced-conditions rule."}</p>
        <ul>
          {response.explanation.dominant_rule_ids.map((ruleId) => (
            <li key={ruleId}><code>{ruleId}</code><span>{explainRule(ruleId)}</span></li>
          ))}
        </ul>
      </div>
      <div className="search-note">{response.routes.length} live candidates · {response.explanation.search_stats.ants} ants · {response.explanation.search_stats.iterations} iterations</div>
      <div className="live-source-note">
        <span className="section-label">Provider trace</span>
        <p>{response.attribution}</p>
        <small>Fetched {new Date(response.fetched_at).toLocaleTimeString()}</small>
      </div>
    </div>
  );
}
