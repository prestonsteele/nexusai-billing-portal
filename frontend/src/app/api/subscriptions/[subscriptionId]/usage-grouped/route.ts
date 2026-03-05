import { NextRequest, NextResponse } from "next/server";
import { getOrbClient, ORB_CACHE_LIVE, ORB_CACHE_STABLE } from "@/lib/orb";
import { kvGet, kvSet, toDateKey } from "@/lib/kv-cache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    const { subscriptionId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const groupBy = searchParams.get("group_by");
    const timeframeStartParam = searchParams.get("timeframe_start");
    const timeframeEndParam = searchParams.get("timeframe_end");

    if (!groupBy) {
      return NextResponse.json(
        { error: "group_by parameter is required" },
        { status: 400 }
      );
    }

    const kvKey = `orb:sub:${subscriptionId}:grouped:${groupBy}:${toDateKey(timeframeStartParam)}:${toDateKey(timeframeEndParam)}`;
    const cached = await kvGet(kvKey);
    if (cached) return NextResponse.json(cached);

    const orb = getOrbClient();

    // Get the subscription to resolve the customer ID and billing period fallback
    const subscription = await orb.subscriptions.fetch(subscriptionId, ORB_CACHE_STABLE);

    const customerId = subscription.customer.id;
    const timeframeStart =
      timeframeStartParam || subscription.current_billing_period_start_date;
    const timeframeEnd =
      timeframeEndParam || subscription.current_billing_period_end_date;

    if (!timeframeStart || !timeframeEnd) {
      return NextResponse.json(
        { error: "Could not determine timeframe" },
        { status: 400 }
      );
    }

    // Get usage-based prices from the subscription to evaluate
    const priceEvaluations = [];

    // Extract price IDs from the subscription's price intervals
    // Only include usage-based prices (those with a billable_metric)
    if (subscription.price_intervals) {
      for (const interval of subscription.price_intervals) {
        const price = interval.price;
        if (price?.id && price.billable_metric) {
          priceEvaluations.push({
            price_id: price.id,
            grouping_keys: [groupBy],
          });
        }
      }
    }

    if (priceEvaluations.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Evaluate prices with grouping
    const result = await orb.prices.evaluateMultiple(
      {
        customer_id: customerId,
        timeframe_start: timeframeStart,
        timeframe_end: timeframeEnd,
        price_evaluations: priceEvaluations,
      },
      ORB_CACHE_LIVE
    );

    // Process the results into a more usable format
    const groupedData: Record<string, { quantity: number; amount: string }> = {};

    for (const priceResult of result.data) {
      for (const group of priceResult.price_groups) {
        const groupKey = group.grouping_values[0]?.toString() || "Other";
        if (!groupedData[groupKey]) {
          groupedData[groupKey] = { quantity: 0, amount: "0" };
        }
        groupedData[groupKey].quantity += group.quantity;
        groupedData[groupKey].amount = (
          parseFloat(groupedData[groupKey].amount) + parseFloat(group.amount)
        ).toFixed(2);
      }
    }

    // Convert to array format
    const data = Object.entries(groupedData).map(([key, value]) => ({
      group: key,
      quantity: value.quantity,
      amount: value.amount,
    }));

    const response = { data };
    await kvSet(kvKey, response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching grouped usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch grouped usage" },
      { status: 500 }
    );
  }
}
