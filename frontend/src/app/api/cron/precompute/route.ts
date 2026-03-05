import { NextRequest, NextResponse } from "next/server";
import { getOrbClient, ORB_CACHE_LIVE, ORB_CACHE_STABLE } from "@/lib/orb";
import { kvSet, toDateKey } from "@/lib/kv-cache";

const CUSTOMER_IDS = ["acme_startup", "global_corp"];
const DATE_RANGES = [7, 30, 60, 90] as const;
const GROUP_BY_KEYS = ["region", "agent_type", "model", "department"] as const;

/** Same logic as getDateRange in DateRangeSelector.tsx */
function computeDateRange(days: number): { timeframeStart: string; timeframeEnd: string } {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);

  return { timeframeStart: start.toISOString(), timeframeEnd: end.toISOString() };
}

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized invocations
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orb = getOrbClient();
  const results: string[] = [];
  let errors = 0;

  for (const customerId of CUSTOMER_IDS) {
    try {
      // --- Customer lookup ---
      const customer = await orb.customers.fetchByExternalId(customerId, ORB_CACHE_STABLE);
      const internalId = customer.id;

      // --- Subscriptions ---
      const subscriptions = await orb.subscriptions.list(
        { external_customer_id: [customerId] },
        ORB_CACHE_STABLE
      );
      const statusOrder: Record<string, number> = { active: 0, upcoming: 1, ended: 2 };
      const sorted = [...subscriptions.data].sort(
        (a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
      );
      await kvSet(`orb:customer:${customerId}:subscriptions`, sorted);
      results.push(`${customerId}:subscriptions`);

      // --- Credits ---
      const credits = await orb.customers.credits.list(internalId, ORB_CACHE_LIVE);
      await kvSet(`orb:customer:${customerId}:credits`, credits.data);
      results.push(`${customerId}:credits`);

      // --- Credit Ledger ---
      const ledger = await orb.customers.credits.ledger.list(internalId, ORB_CACHE_LIVE);
      await kvSet(`orb:customer:${customerId}:ledger`, ledger.data);
      results.push(`${customerId}:ledger`);

      // --- Invoices ---
      const [issuedInvoices, draftInvoices] = await Promise.all([
        orb.invoices.list({ customer_id: internalId }, ORB_CACHE_STABLE),
        orb.invoices.list({ customer_id: internalId, status: ["draft"] }, ORB_CACHE_STABLE),
      ]);
      const allInvoices = [...issuedInvoices.data];
      for (const draft of draftInvoices.data) {
        if (!allInvoices.find((inv) => inv.id === draft.id)) allInvoices.push(draft);
      }
      allInvoices.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      await kvSet(`orb:customer:${customerId}:invoices`, allInvoices);
      results.push(`${customerId}:invoices`);

      // Per-subscription data
      for (const sub of sorted.slice(0, 1)) { // Only active subscription
        const subscriptionId = sub.id;

        // --- Plan ---
        const plan = await orb.subscriptions.fetch(subscriptionId, ORB_CACHE_STABLE);
        await kvSet(`orb:sub:${subscriptionId}:plan`, plan);
        results.push(`${subscriptionId}:plan`);

        // Resolve usage-based price IDs for grouped queries
        const usagePriceIds: string[] = [];
        if (plan.price_intervals) {
          for (const interval of plan.price_intervals) {
            const price = interval.price;
            if (price?.id && price.billable_metric) {
              usagePriceIds.push(price.id);
            }
          }
        }

        // Per date range
        for (const days of DATE_RANGES) {
          const { timeframeStart, timeframeEnd } = computeDateRange(days);
          const startKey = toDateKey(timeframeStart);
          const endKey = toDateKey(timeframeEnd);

          // --- Usage ---
          const usage = await orb.subscriptions.fetchUsage(
            subscriptionId,
            { granularity: "day", timeframe_start: timeframeStart, timeframe_end: timeframeEnd },
            ORB_CACHE_LIVE
          );
          await kvSet(`orb:sub:${subscriptionId}:usage:${startKey}:${endKey}`, usage);
          results.push(`${subscriptionId}:usage:${days}d`);

          // --- Costs ---
          const costs = await orb.subscriptions.fetchCosts(
            subscriptionId,
            { view_mode: "cumulative", timeframe_start: timeframeStart, timeframe_end: timeframeEnd },
            ORB_CACHE_LIVE
          );
          await kvSet(`orb:sub:${subscriptionId}:costs:${startKey}:${endKey}`, costs);
          results.push(`${subscriptionId}:costs:${days}d`);

          // --- Grouped usage (per groupBy key) ---
          if (usagePriceIds.length > 0) {
            for (const groupBy of GROUP_BY_KEYS) {
              // Skip department for PLG customer
              if (groupBy === "department" && customerId === "acme_startup") continue;

              const priceEvaluations = usagePriceIds.map((priceId) => ({
                price_id: priceId,
                grouping_keys: [groupBy],
              }));

              const evalResult = await orb.prices.evaluateMultiple(
                {
                  customer_id: internalId,
                  timeframe_start: timeframeStart,
                  timeframe_end: timeframeEnd,
                  price_evaluations: priceEvaluations,
                },
                ORB_CACHE_LIVE
              );

              const groupedData: Record<string, { quantity: number; amount: string }> = {};
              for (const priceResult of evalResult.data) {
                for (const group of priceResult.price_groups) {
                  const groupKey = group.grouping_values[0]?.toString() || "Other";
                  if (!groupedData[groupKey]) groupedData[groupKey] = { quantity: 0, amount: "0" };
                  groupedData[groupKey].quantity += group.quantity;
                  groupedData[groupKey].amount = (
                    parseFloat(groupedData[groupKey].amount) + parseFloat(group.amount)
                  ).toFixed(2);
                }
              }

              const groupedResponse = {
                data: Object.entries(groupedData).map(([key, value]) => ({
                  group: key,
                  quantity: value.quantity,
                  amount: value.amount,
                })),
              };

              await kvSet(
                `orb:sub:${subscriptionId}:grouped:${groupBy}:${startKey}:${endKey}`,
                groupedResponse
              );
              results.push(`${subscriptionId}:grouped:${groupBy}:${days}d`);
            }
          }
        }
      }
    } catch (err) {
      console.error(`Precompute failed for ${customerId}:`, err);
      errors++;
    }
  }

  console.log(`Precompute complete: ${results.length} keys warmed, ${errors} errors`);
  return NextResponse.json({ ok: true, warmed: results.length, errors, keys: results });
}
