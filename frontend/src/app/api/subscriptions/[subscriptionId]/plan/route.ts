import { NextRequest, NextResponse } from "next/server";
import { getOrbClient, ORB_CACHE_STABLE } from "@/lib/orb";
import { kvGet, kvSet } from "@/lib/kv-cache";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    const { subscriptionId } = await params;

    const kvKey = `orb:sub:${subscriptionId}:plan`;
    const cached = await kvGet(kvKey);
    if (cached) return NextResponse.json(cached);

    const orb = getOrbClient();

    // fetch() returns the full subscription including complete price_intervals
    // with all pricing model configs (unit_config, tiered_config, etc.)
    const subscription = await orb.subscriptions.fetch(subscriptionId, ORB_CACHE_STABLE);

    // Log price interval structure to help debug display issues
    if (subscription.price_intervals?.length) {
      const sample = subscription.price_intervals[0]?.price;
      console.log("[plan] first price sample:", JSON.stringify({
        price_type: sample?.price_type,
        billable_metric: sample?.billable_metric,
        unit_config: (sample as any)?.unit_config,
        package_config: (sample as any)?.package_config,
        tiered_config: (sample as any)?.tiered_config,
        fixed_price_quantity: (sample as any)?.fixed_price_quantity,
      }, null, 2));
    }

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
