import type {
  LiveLocation,
  LiveRouteOption,
  LiveRouteResponse,
} from "../types";
import { isValidLatitude, isValidLongitude, parseLngLat } from "./geo";

const DEFAULT_ROUTING_URL = "https://router.project-osrm.org";

export class LiveRoutingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveRoutingError";
  }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object";
}

function parseLocation(value: unknown, field: string): LiveLocation {
  if (!isRecord(value)) {
    throw new LiveRoutingError(`${field} must be an object`);
  }
  const label = typeof value.label === "string" ? value.label.trim() : "";
  if (!label || label.length > 200) {
    throw new LiveRoutingError(`${field}.label is required`);
  }
  if (!isValidLatitude(value.lat) || !isValidLongitude(value.lng)) {
    throw new LiveRoutingError(`${field} must contain valid coordinates`);
  }
  return {
    label,
    lat: value.lat,
    lng: value.lng,
    ...(typeof value.place_id === "string" ? { place_id: value.place_id } : {}),
    ...(typeof value.provider === "string" ? { provider: value.provider } : {}),
  };
}

export function parseLiveRouteInput(value: unknown): {
  origin: LiveLocation;
  destination: LiveLocation;
} {
  if (!isRecord(value)) {
    throw new LiveRoutingError("Request body must be an object");
  }
  const origin = parseLocation(value.origin, "origin");
  const destination = parseLocation(value.destination, "destination");
  if (origin.lat === destination.lat && origin.lng === destination.lng) {
    throw new LiveRoutingError("Origin and destination must be different");
  }
  return { origin, destination };
}

function parseLiveRoutes(payload: unknown): LiveRouteOption[] {
  if (!isRecord(payload) || payload.code !== "Ok" || !Array.isArray(payload.routes)) {
    return [];
  }

  const parsedRoutes = payload.routes.flatMap((route) => {
    if (!isRecord(route)) return [];
    const geometry = isRecord(route.geometry) ? route.geometry : null;
    const rawCoordinates = geometry?.coordinates;
    if (geometry?.type !== "LineString" || !Array.isArray(rawCoordinates)) {
      return [];
    }
    const coordinates = rawCoordinates.map((coordinate) => parseLngLat(coordinate));
    if (coordinates.some((coordinate) => coordinate === null)) return [];
    const validCoordinates = coordinates as [number, number][];
    const distance = route.distance;
    const duration = route.duration;
    if (
      validCoordinates.length < 2 ||
      typeof distance !== "number" ||
      typeof duration !== "number" ||
      !Number.isFinite(distance) ||
      !Number.isFinite(duration) ||
      distance <= 0 ||
      duration <= 0
    ) {
      return [];
    }
    return [
      {
        geometry: { type: "LineString" as const, coordinates: validCoordinates },
        distance_m: distance,
        duration_s: duration,
        provider: "OSRM",
      },
    ];
  });

  return parsedRoutes.map((route, index) => ({
    ...route,
    id: `osrm-route-${index + 1}`,
    is_alternative: index > 0,
  }));
}

function detourWaypoints(
  origin: LiveLocation,
  destination: LiveLocation,
): LiveLocation[] {
  const midpointLat = (origin.lat + destination.lat) / 2;
  const midpointLng = (origin.lng + destination.lng) / 2;
  const longitudeScale = Math.max(
    Math.cos((midpointLat * Math.PI) / 180),
    0.35,
  );
  const deltaX = (destination.lng - origin.lng) * longitudeScale;
  const deltaY = destination.lat - origin.lat;
  const length = Math.hypot(deltaX, deltaY);
  if (length < 0.002) return [];

  const offset = Math.min(0.06, Math.max(0.006, length * 0.18));
  const perpendicularX = (-deltaY / length) * offset;
  const perpendicularY = (deltaX / length) * offset;
  return [
    {
      label: "Detour waypoint",
      lat: midpointLat + perpendicularY,
      lng: midpointLng + perpendicularX / longitudeScale,
    },
    {
      label: "Detour waypoint",
      lat: midpointLat - perpendicularY,
      lng: midpointLng - perpendicularX / longitudeScale,
    },
  ].filter(
    (waypoint) => isValidLatitude(waypoint.lat) && isValidLongitude(waypoint.lng),
  );
}

function sameGeometry(first: LiveRouteOption, second: LiveRouteOption): boolean {
  return JSON.stringify(first.geometry.coordinates) === JSON.stringify(second.geometry.coordinates);
}

async function requestDetourCandidate(
  baseUrl: string,
  origin: LiveLocation,
  destination: LiveLocation,
  primaryRoute: LiveRouteOption,
): Promise<LiveRouteOption | null> {
  const candidates: LiveRouteOption[] = [];
  for (const waypoint of detourWaypoints(origin, destination)) {
    const coordinates = [origin, waypoint, destination]
      .map((location) => `${location.lng},${location.lat}`)
      .join(";");
    const url = new URL(
      `/route/v1/driving/${coordinates}`,
      `${baseUrl.replace(/\/$/, "")}/`,
    );
    url.searchParams.set("alternatives", "false");
    url.searchParams.set("overview", "full");
    url.searchParams.set("geometries", "geojson");
    url.searchParams.set("steps", "false");

    try {
      const response = await fetch(url, { next: { revalidate: 30 } });
      if (!response.ok) continue;
      const payload: unknown = await response.json();
      const candidate = parseLiveRoutes(payload)[0];
      if (!candidate || sameGeometry(primaryRoute, candidate)) continue;
      candidates.push({
        ...candidate,
        id: "osrm-detour-route",
        is_alternative: true,
        is_detour: true,
      });
    } catch {
      continue;
    }
  }
  return candidates.sort(
    (first, second) =>
      first.duration_s - second.duration_s || first.distance_m - second.distance_m,
  )[0] ?? null;
}

export async function routeLiveLocations(
  origin: LiveLocation,
  destination: LiveLocation,
): Promise<LiveRouteResponse> {
  const baseUrl =
    process.env.ROUTING_PROVIDER_URL?.trim() || DEFAULT_ROUTING_URL;
  const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = new URL(
    `/route/v1/driving/${coordinates}`,
    `${baseUrl.replace(/\/$/, "")}/`,
  );
  url.searchParams.set("alternatives", "true");
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "false");

  let response: Response;
  try {
    response = await fetch(url, { next: { revalidate: 30 } });
  } catch {
    throw new LiveRoutingError("The live routing service is unreachable");
  }
  if (!response.ok) {
    throw new LiveRoutingError(
      `The live routing service returned HTTP ${response.status}`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new LiveRoutingError(
      "The live routing service returned invalid JSON",
    );
  }
  const routes = parseLiveRoutes(payload);
  if (routes.length === 0) {
    const code = isRecord(payload) && typeof payload.code === "string" ? payload.code : "NoRoute";
    throw new LiveRoutingError(
      code === "NoRoute"
        ? "No drivable route was found between these locations"
        : "The live routing service returned no usable route",
    );
  }

  if (routes.length === 1) {
    const detour = await requestDetourCandidate(
      baseUrl,
      origin,
      destination,
      routes[0],
    );
    if (detour) routes.push(detour);
  }

  return {
    provider: "OSRM",
    origin,
    destination,
    routes,
    fetched_at: new Date().toISOString(),
    attribution: "Routing © OSRM contributors · Map data © OpenStreetMap contributors",
  };
}
