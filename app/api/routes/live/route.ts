import { NextResponse } from "next/server";
import {
  LiveRoutingError,
  parseLiveRouteInput,
  routeLiveLocations,
} from "../../../../lib/maps/routing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  try {
    const { origin, destination } = parseLiveRouteInput(body);
    const response = await routeLiveLocations(origin, destination);
    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (error) {
    if (error instanceof LiveRoutingError) {
      const status = error.message.startsWith("The live routing service")
        ? 502
        : error.message.startsWith("No drivable route")
          ? 409
          : 422;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json(
      { error: "Unable to calculate a live route" },
      { status: 500 },
    );
  }
}
