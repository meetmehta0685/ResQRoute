import { NextResponse } from "next/server";
import { UnknownNodeError } from "../../../../lib/domain/graph";
import {
  InputValidationError,
  NoRouteError,
  optimizeRoute,
  parseOptimizeInput,
} from "../../../../lib/routing/service";

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
    const input = parseOptimizeInput(body);
    return NextResponse.json(optimizeRoute(input));
  } catch (error) {
    if (error instanceof InputValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof UnknownNodeError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof NoRouteError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Unable to calculate a route" },
      { status: 500 },
    );
  }
}
