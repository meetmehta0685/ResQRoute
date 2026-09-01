import type { GeocodeResponse, GeocodeResult } from "../types";
import { isValidLatitude, isValidLongitude, parseLngLat } from "./geo";

const MAX_QUERY_LENGTH = 120;
const DEFAULT_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const DEFAULT_CONTACT_URL = "http://localhost:3000";

export class GeocodingProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeocodingProviderError";
  }
}

export class GeocodingInputError extends GeocodingProviderError {
  constructor(message: string) {
    super(message);
    this.name = "GeocodingInputError";
  }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object";
}

function normalizedQuery(query: string): string {
  const value = query.trim().replace(/\s+/g, " ");
  if (value.length < 3) {
    throw new GeocodingInputError("Search for at least 3 characters");
  }
  if (value.length > MAX_QUERY_LENGTH) {
    throw new GeocodingInputError(
      `Search must be ${MAX_QUERY_LENGTH} characters or fewer`,
    );
  }
  return value;
}

function coordinateFromRecord(record: UnknownRecord): [number, number] | null {
  const geometry = isRecord(record.geometry) ? record.geometry : null;
  if (geometry?.type !== "Point") return null;
  return parseLngLat(geometry?.coordinates);
}

function parseMapTilerResults(payload: unknown): GeocodeResult[] {
  if (!isRecord(payload) || !Array.isArray(payload.features)) return [];

  return payload.features.flatMap((feature, index) => {
    if (!isRecord(feature)) return [];
    const coordinates = coordinateFromRecord(feature);
    if (!coordinates) return [];
    const properties = isRecord(feature.properties) ? feature.properties : null;
    const label =
      (typeof feature.place_name === "string" && feature.place_name) ||
      (typeof feature.text === "string" && feature.text) ||
      "Map location";
    const id =
      (typeof feature.id === "string" && feature.id) ||
      `maptiler-${index}-${coordinates.join("-")}`;
    const placeTypes = Array.isArray(feature.place_type) ? feature.place_type : null;
    const type =
      typeof properties?.category === "string"
        ? properties.category
        : typeof placeTypes?.[0] === "string"
          ? placeTypes[0]
          : undefined;
    return [
      {
        id,
        label,
        lat: coordinates[1],
        lng: coordinates[0],
        provider: "MapTiler",
        type,
      },
    ];
  });
}

function parseNominatimResults(payload: unknown): GeocodeResult[] {
  if (!Array.isArray(payload)) return [];

  return payload.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const lat = parseProviderCoordinate(item.lat);
    const lng = parseProviderCoordinate(item.lon);
    if (lat === null || lng === null || !isValidLatitude(lat) || !isValidLongitude(lng)) {
      return [];
    }
    const label =
      typeof item.display_name === "string" ? item.display_name : "Map location";
    const id =
      typeof item.place_id === "number" || typeof item.place_id === "string"
        ? String(item.place_id)
        : `nominatim-${index}-${lat}-${lng}`;
    return [
      {
        id,
        label,
        lat,
        lng,
        provider: "Nominatim / OpenStreetMap",
        type: typeof item.type === "string" ? item.type : undefined,
      },
    ];
  });
}

function parseProviderCoordinate(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function requestJson(
  url: string,
  headers: Record<string, string>,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      next: { revalidate: 86_400 },
    });
  } catch {
    throw new GeocodingProviderError("The geocoding service is unreachable");
  }
  if (!response.ok) {
    throw new GeocodingProviderError(
      `The geocoding service returned HTTP ${response.status}`,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new GeocodingProviderError(
      "The geocoding service returned invalid JSON",
    );
  }
}

let nominatimQueue: Promise<void> = Promise.resolve();
let nextNominatimRequestAt = 0;

function queueNominatimRequest<T>(operation: () => Promise<T>): Promise<T> {
  let release: () => void = () => undefined;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = nominatimQueue;
  nominatimQueue = next;

  return previous.then(async () => {
    const waitMs = Math.max(0, nextNominatimRequestAt - Date.now());
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    nextNominatimRequestAt = Date.now() + 1_000;
    try {
      return await operation();
    } finally {
      release();
    }
  });
}

async function geocodeWithMapTiler(query: string, apiKey: string) {
  const url = new URL(
    `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("limit", "5");
  url.searchParams.set("language", "en");
  const payload = await requestJson(url.toString(), {});
  return {
    provider: "MapTiler",
    results: parseMapTilerResults(payload),
    attribution: "Geocoding © MapTiler",
  } satisfies GeocodeResponse;
}

async function geocodeWithNominatim(query: string): Promise<GeocodeResponse> {
  const url = new URL(
    process.env.NOMINATIM_URL?.trim() || DEFAULT_NOMINATIM_URL,
  );
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "en");

  const contactUrl = process.env.APP_CONTACT_URL?.trim() || DEFAULT_CONTACT_URL;
  const userAgent = `ResQRoute/0.2 (+${contactUrl})`;
  const payload = await queueNominatimRequest(() =>
    requestJson(url.toString(), {
      Accept: "application/json",
      "User-Agent": userAgent,
    }),
  );
  return {
    provider: "Nominatim / OpenStreetMap",
    results: parseNominatimResults(payload),
    attribution: "Geocoding © OpenStreetMap contributors",
  };
}

export function activeGeocodingProvider(): string {
  const requested = process.env.GEOCODING_PROVIDER?.trim().toLowerCase();
  if (requested === "nominatim") return "Nominatim / OpenStreetMap";
  if (requested === "maptiler" || process.env.MAPTILER_API_KEY?.trim()) {
    return "MapTiler";
  }
  return "Nominatim / OpenStreetMap";
}

export async function geocode(query: string): Promise<GeocodeResponse> {
  const normalized = normalizedQuery(query);
  const apiKey = process.env.MAPTILER_API_KEY?.trim();
  const requested = process.env.GEOCODING_PROVIDER?.trim().toLowerCase();

  if (requested === "maptiler" || (apiKey && requested !== "nominatim")) {
    if (!apiKey) {
      throw new GeocodingProviderError(
        "MAPTILER_API_KEY is required when MapTiler geocoding is selected",
      );
    }
    return geocodeWithMapTiler(normalized, apiKey);
  }

  return geocodeWithNominatim(normalized);
}
