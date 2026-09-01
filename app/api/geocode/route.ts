import { NextResponse } from "next/server";
import {
  activeGeocodingProvider,
  geocode,
  GeocodingInputError,
  GeocodingProviderError,
} from "../../../lib/maps/geocoding";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (query.trim().length < 3) {
    return NextResponse.json(
      { error: "Search for at least 3 characters" },
      { status: 422 },
    );
  }

  try {
    const response = await geocode(query);
    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    if (error instanceof GeocodingInputError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof GeocodingProviderError) {
      return NextResponse.json(
        { error: error.message, provider: activeGeocodingProvider() },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "Unable to search for that location" },
      { status: 500 },
    );
  }
}
