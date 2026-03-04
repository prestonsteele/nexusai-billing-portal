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

    const orb = getOrbClient();

    const costs = await orb.subscriptions.fetchCosts(subscriptionId, {
      view_mode: viewMode || "cumulative",
    });

    return NextResponse.json(costs);
  } catch (error) {
    console.error("Error fetching subscription costs:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription costs" },
      { status: 500 }
    );
  }
}
