import { NextRequest, NextResponse } from "next/server";
import { getOrbClient, ORB_CACHE_LIVE } from "@/lib/orb";
import { kvGet, kvSet, toDateKey } from "@/lib/kv-cache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    const { subscriptionId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const groupBy = searchParams.get("group_by");
    const granularity = searchParams.get("granularity") || "day";
    const timeframeStart = searchParams.get("timeframe_start");
    const timeframeEnd = searchParams.get("timeframe_end");

    const kvKey = `orb:sub:${subscriptionId}:usage:${toDateKey(timeframeStart)}:${toDateKey(timeframeEnd)}`;
    const cached = await kvGet(kvKey);
    if (cached) return NextResponse.json(cached);

    const orb = getOrbClient();

    const usageParams: {
      granularity: "day";
      group_by?: string;
      timeframe_start?: string;
      timeframe_end?: string;
    } = {
      granularity: granularity as "day",
    };

    if (groupBy) usageParams.group_by = groupBy;
    if (timeframeStart) usageParams.timeframe_start = timeframeStart;
    if (timeframeEnd) usageParams.timeframe_end = timeframeEnd;

    const usage = await orb.subscriptions.fetchUsage(
      subscriptionId,
      usageParams,
      ORB_CACHE_LIVE
    );

    await kvSet(kvKey, usage);
    return NextResponse.json(usage);
  } catch (error) {
    console.error("Error fetching subscription usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription usage" },
      { status: 500 }
    );
  }
}
