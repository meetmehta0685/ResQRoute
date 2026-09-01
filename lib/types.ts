export type NodeId = string;
export type LngLat = [number, number];

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LiveLocation extends Coordinates {
  label: string;
  place_id?: string;
  provider?: string;
}

export interface GeocodeResult extends LiveLocation {
  id: string;
  type?: string;
}

export interface GeocodeResponse {
  provider: string;
  results: GeocodeResult[];
  attribution: string;
}

export interface GeoJsonLineString {
  type: "LineString";
  coordinates: LngLat[];
}

export interface LiveRouteOption {
  id: string;
  geometry: GeoJsonLineString;
  distance_m: number;
  duration_s: number;
  provider: string;
  is_alternative: boolean;
  is_detour?: boolean;
}

export interface LiveRouteResponse {
  provider: string;
  origin: LiveLocation;
  destination: LiveLocation;
  routes: LiveRouteOption[];
  fetched_at: string;
  attribution: string;
}

export interface RoadNode {
  id: NodeId;
  label: string;
  x: number;
  y: number;
}

export interface RoadEdge {
  id: string;
  from: NodeId;
  to: NodeId;
  distance_m: number;
  base_time_s: number;
  congestion: number;
  risk: number;
}

export interface GraphData {
  nodes: RoadNode[];
  edges: RoadEdge[];
}

export interface OptimizeInput {
  origin_id: NodeId;
  destination_id: NodeId;
  traffic_level: number;
  urgency: number;
  seed: number;
}

export interface RouteResult {
  algorithm: "shortest_time" | "fuzzy_aco";
  node_ids: NodeId[];
  edge_ids: string[];
  distance_m: number;
  base_time_s: number;
  fuzzy_cost_s: number;
  used_fallback: boolean;
  geometry?: GeoJsonLineString;
}

export interface SearchStats {
  seed: number;
  ants: number;
  iterations: number;
  valid_routes: number;
  used_fallback: boolean;
}

export interface OptimizationResponse {
  request: OptimizeInput;
  baseline: RouteResult;
  optimized: RouteResult;
  comparison: {
    base_time_delta_s: number;
    fuzzy_cost_delta_s: number;
  };
  explanation: {
    seed: number;
    dominant_rule_ids: string[];
    search_stats: SearchStats;
  };
}

export interface RouteComparisonResponse extends OptimizationResponse {
  provider: string;
  origin: LiveLocation;
  destination: LiveLocation;
  routes: LiveRouteOption[];
  fetched_at: string;
  attribution: string;
}
