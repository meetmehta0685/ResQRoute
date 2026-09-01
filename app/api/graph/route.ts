import { NextResponse } from "next/server";
import { GRAPH_DATA } from "../../../lib/data/graph";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(GRAPH_DATA);
}
