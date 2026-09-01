import { NextResponse } from "next/server";
import { LiveRoutingError } from "../../../../lib/maps/routing";
import { compareLiveRoutes } from "../../../../lib/routing/live-comparison";
import { InputValidationError, NoRouteError } from "../../../../lib/routing/service";

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
    const response = await compareLiveRoutes(body);
    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (error) {
    if (error instanceof InputValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof LiveRoutingError) {
      const status = error.message.startsWith("The live routing service")
        ? 502
        : error.message.startsWith("No drivable route")
          ? 409
          : 422;
      return NextResponse.json({ error: error.message }, { status });
    }
    if (error instanceof NoRouteError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Unable to calculate the route comparison" },
      { status: 500 },
    );
  }
}
