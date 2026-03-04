import { NextRequest, NextResponse } from "next/server";
import { getOrbClient } from "@/lib/orb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    const { subscriptionId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const viewMode = searchParams.get("view_mode") as "periodic" | "cumulative" | null;
    const timeframeStart = searchParams.get("timeframe_start");
    const timeframeEnd = searchParams.get("timeframe_end");

    const orb = getOrbClient();

    const costsParams: {
      view_mode: "periodic" | "cumulative";
      timeframe_start?: string;
      timeframe_end?: string;
    } = {
      view_mode: viewMode || "cumulative",
    };

    if (timeframeStart) costsParams.timeframe_start = timeframeStart;
    if (timeframeEnd) costsParams.timeframe_end = timeframeEnd;

    const costs = await orb.subscriptions.fetchCosts(subscriptionId, costsParams);

    return NextResponse.json(costs);
  } catch (error) {
    console.error("Error fetching subscription costs:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription costs" },
      { status: 500 }
    );
  }
}
