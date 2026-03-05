import { NextRequest, NextResponse } from "next/server";
import { getOrbClient, ORB_CACHE_STABLE } from "@/lib/orb";
import { kvGet, kvSet } from "@/lib/kv-cache";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    const { subscriptionId } = await params;

    // Skip KV cache so logging always fires during debugging
    const kvKey = `orb:sub:${subscriptionId}:plan`;
    const orb = getOrbClient();

    const subscription = await orb.subscriptions.fetch(subscriptionId, ORB_CACHE_STABLE);

    // Dump ALL fields of every price so we can see what Orb actually returns
    subscription.price_intervals?.forEach((interval, i) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = interval.price as any;
      console.log(`[plan] price[${i}] ALL KEYS:`, Object.keys(p ?? {}));
      console.log(`[plan] price[${i}]:`, JSON.stringify(p, null, 2));
    });

    await kvSet(kvKey, subscription);
    return NextResponse.json(subscription);
  } catch (error) {
    console.error("Error fetching subscription plan:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription plan" },
      { status: 500 }
    );
  }
}
