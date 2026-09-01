import type { GraphData, OptimizationResponse, RouteResult } from "../lib/types";

interface RouteCanvasProps {
  graph: GraphData;
  response: OptimizationResponse | null;
}

function routePoints(graph: GraphData, route: RouteResult): string {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  return route.node_ids
    .map((nodeId) => nodesById.get(nodeId))
    .filter((node): node is GraphData["nodes"][number] => Boolean(node))
    .map((node) => `${node.x * 100},${100 - node.y * 100}`)
    .join(" ");
}

function edgePoints(graph: GraphData, edgeId: string) {
  const edge = graph.edges.find((candidate) => candidate.id === edgeId);
  const from = graph.nodes.find((node) => node.id === edge?.from);
  const to = graph.nodes.find((node) => node.id === edge?.to);
  if (!from || !to) return null;
  return {
    x1: from.x * 100,
    y1: 100 - from.y * 100,
    x2: to.x * 100,
    y2: 100 - to.y * 100,
  };
}

export function RouteCanvas({ graph, response }: RouteCanvasProps) {
  return (
    <div className="map-frame">
      <div className="map-header">
        <div>
          <span className="section-label">Network view</span>
          <strong>{response ? "Route comparison" : "Ready for a route request"}</strong>
        </div>
        <span className="map-scale">Fixture graph / 6 nodes / 6 edges</span>
      </div>
      <div className="map-stage">
        <svg
          className="route-canvas"
          viewBox="0 0 100 100"
          role="img"
          aria-label="Emergency road network with baseline and optimized route overlays"
        >
          <defs>
            <pattern id="map-grid" width="5" height="5" patternUnits="userSpaceOnUse">
              <path d="M 5 0 L 0 0 0 5" fill="none" stroke="currentColor" strokeWidth="0.08" />
            </pattern>
            <marker id="arrow-neutral" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#9ba9ae" />
            </marker>
            <marker id="arrow-baseline" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#0b3b78" />
            </marker>
            <marker id="arrow-optimized" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#ed5b3b" />
            </marker>
          </defs>
          <rect width="100" height="100" fill="url(#map-grid)" className="map-grid" />
          <g className="network-edges" aria-hidden="true">
            {graph.edges.map((edge) => {
              const points = edgePoints(graph, edge.id);
              if (!points) return null;
              return (
                <line
                  key={edge.id}
                  {...points}
                  className="network-edge"
                  markerEnd="url(#arrow-neutral)"
                />
              );
            })}
          </g>
          {response && (
            <>
              <polyline
                points={routePoints(graph, response.baseline)}
                className="route-line route-line-baseline"
                markerEnd="url(#arrow-baseline)"
              />
              <polyline
                points={routePoints(graph, response.optimized)}
                className="route-line route-line-optimized"
                markerEnd="url(#arrow-optimized)"
              />
              <g className="route-edge-tags" aria-hidden="true">
                {response.optimized.edge_ids.map((edgeId) => {
                  const points = edgePoints(graph, edgeId);
                  if (!points) return null;
                  const x = (points.x1 + points.x2) / 2;
                  const y = (points.y1 + points.y2) / 2;
                  return (
                    <circle key={edgeId} cx={x} cy={y} r="1.05" className="optimized-node" />
                  );
                })}
              </g>
            </>
          )}
          <g className="network-nodes">
            {graph.nodes.map((node) => {
              const x = node.x * 100;
              const y = 100 - node.y * 100;
              const isEndpoint = node.id === "HOSPITAL" || node.id === "INCIDENT";
              return (
                <g key={node.id}>
                  <circle cx={x} cy={y} r={isEndpoint ? "2.1" : "1.5"} className={isEndpoint ? "network-node endpoint" : "network-node"} />
                  <text x={x} y={y - 3.5} className="node-label" textAnchor="middle">
                    {node.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        <div className="map-legend" aria-label="Route legend">
          <span><i className="legend-swatch legend-baseline" />Shortest time</span>
          <span><i className="legend-swatch legend-optimized" />Fuzzy + ACO</span>
          <span><i className="legend-swatch legend-network" />Road network</span>
        </div>
      </div>
    </div>
  );
}
