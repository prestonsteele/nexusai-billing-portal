"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/layout/AppShell";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { UsageChart } from "@/components/charts/UsageChart";
import { CostBreakdownChart } from "@/components/charts/CostBreakdownChart";
import { GroupBySelector } from "@/components/filters/GroupBySelector";
import { DateRangeSelector, getDateRange, type DateRangeOption } from "@/components/filters/DateRangeSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type GroupingKey } from "@/lib/orb";
import { fetchWithCache } from "@/lib/cache";
import { ApiTooltip } from "@/components/ui/api-tooltip";
import {
  Coins,
  Cpu,
  Receipt,
  TrendingUp,
} from "lucide-react";

interface UsageDataPoint {
  date: string;
  [key: string]: string | number;
}

interface CostDataPoint {
  name: string;
  value: number;
}

interface GroupedUsageData {
  group: string;
  quantity: number;
  amount: string;
}

interface MetricInfo {
  name: string;
  unit: string;
}

export default function DashboardPage() {
  const { customerId, customer } = useApp();
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupingKey | "none">("none");
  const [dateRange, setDateRange] = useState<DateRangeOption>("30d");
  const [usageData, setUsageData] = useState<UsageDataPoint[]>([]);
  const [allMetrics, setAllMetrics] = useState<MetricInfo[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>("all");
  const [metricUnits, setMetricUnits] = useState<Record<string, string>>({});
  const [groupedUsageData, setGroupedUsageData] = useState<GroupedUsageData[]>([]);
  const [costData, setCostData] = useState<CostDataPoint[]>([]);
  const [stats, setStats] = useState({
    aiTokens: 0,
    creditBalance: 0,
    currentPeriodCost: "$0.00",
    invoiceCount: 0,
  });
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const metricDefaultSet = useRef(false);

  // Available grouping keys based on customer type
  const availableKeys: GroupingKey[] =
    customer === "ENTERPRISE"
      ? ["region", "agent_type", "model", "department"]
      : ["region", "agent_type", "model"];

  // Fetch subscription
  useEffect(() => {
    async function fetchSubscription() {
      try {
        const data = await fetchWithCache(`/api/customer/${customerId}/subscriptions`);
        if (Array.isArray(data) && data.length > 0) {
          setSubscriptionId((data as { id: string }[])[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch subscription:", error);
      }
    }
    fetchSubscription();
  }, [customerId]);

  // Fetch usage data (time series)
  useEffect(() => {
    if (!subscriptionId) return;

    async function fetchUsage() {
      setLoading(true);
      try {
        const { timeframeStart, timeframeEnd } = getDateRange(dateRange);
        const data = await fetchWithCache(
          `/api/subscriptions/${subscriptionId}/usage?timeframe_start=${timeframeStart}&timeframe_end=${timeframeEnd}`
        );

        // Process usage data for chart
        const processedData: Record<string, UsageDataPoint> = {};
        const metrics: MetricInfo[] = [];
        const units: Record<string, string> = {};
        let aiTokensTotal = 0;

        if (data.data) {
          for (const metric of data.data) {
            const metricName = metric.billable_metric?.name || "Usage";
            const eventName = metric.billable_metric?.event_name || "";

            // Determine unit based on metric name
            let unit = "";
            if (metricName.toLowerCase().includes("token")) {
              unit = "tokens";
            } else if (metricName.toLowerCase().includes("request") || metricName.toLowerCase().includes("api")) {
              unit = "requests";
            } else if (metricName.toLowerCase().includes("storage") || metricName.toLowerCase().includes("gb")) {
              unit = "GB-hours";
            } else if (metricName.toLowerCase().includes("minute") || metricName.toLowerCase().includes("compute")) {
              unit = "minutes";
            }

            units[metricName] = unit;

            // Track unique metrics
            if (!metrics.find(m => m.name === metricName)) {
              metrics.push({ name: metricName, unit });
            }

            if (metric.usage) {
              for (const usage of metric.usage) {
                const date = usage.timeframe_start?.split("T")[0];
                if (!date) continue;

                if (!processedData[date]) {
                  processedData[date] = { date };
                }

                const quantity = usage.quantity || 0;
                processedData[date][metricName] =
                  ((processedData[date][metricName] as number) || 0) + quantity;

                // Track AI tokens specifically
                if (metricName.toLowerCase().includes("token")) {
                  aiTokensTotal += quantity;
                }
              }
            }
          }
        }

        const sortedData = Object.values(processedData).sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        setUsageData(sortedData);
        setAllMetrics(metrics);
        setMetricUnits(units);
        setStats((prev) => ({ ...prev, aiTokens: aiTokensTotal }));

        if (!metricDefaultSet.current && metrics.length > 0) {
          metricDefaultSet.current = true;
          const tokenMetric = metrics.find((m) =>
            m.name.toLowerCase().includes("token")
          );
          if (tokenMetric) setSelectedMetric(tokenMetric.name);
        }
      } catch (error) {
        console.error("Failed to fetch usage:", error);
      }
      setLoading(false);
    }

    fetchUsage();
  }, [subscriptionId, dateRange]);

  // Fetch grouped usage data when groupBy changes
  useEffect(() => {
    if (!subscriptionId || groupBy === "none") {
      setGroupedUsageData([]);
      return;
    }

    async function fetchGroupedUsage() {
      setLoading(true);
      try {
        const { timeframeStart, timeframeEnd } = getDateRange(dateRange);
        const data = await fetchWithCache(
          `/api/subscriptions/${subscriptionId}/usage-grouped?group_by=${groupBy}&timeframe_start=${timeframeStart}&timeframe_end=${timeframeEnd}`
        );

        if (data.data) {
          setGroupedUsageData(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch grouped usage:", error);
      }
      setLoading(false);
    }

    fetchGroupedUsage();
  }, [subscriptionId, groupBy, dateRange]);

  // Fetch costs
  useEffect(() => {
    if (!subscriptionId) return;

    async function fetchCosts() {
      try {
        const { timeframeStart, timeframeEnd } = getDateRange(dateRange);
        const data = await fetchWithCache(
          `/api/subscriptions/${subscriptionId}/costs?timeframe_start=${timeframeStart}&timeframe_end=${timeframeEnd}`
        );

        if (data.data && data.data.length > 0) {
          // Use the last entry — with cumulative view_mode it has the full period total
          const costs = data.data[data.data.length - 1];
          setStats((prev) => ({
            ...prev,
            currentPeriodCost: `$${parseFloat(costs.total || "0").toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          }));

          // Process cost breakdown by price
          const costBreakdown: CostDataPoint[] = [];
          if (costs.per_price_costs) {
            for (const priceCost of costs.per_price_costs) {
              if (parseFloat(priceCost.subtotal || "0") > 0) {
                costBreakdown.push({
                  name: priceCost.price?.name || "Unknown",
                  value: parseFloat(priceCost.subtotal || "0"),
                });
              }
            }
          }
          setCostData(costBreakdown.slice(0, 8)); // Top 8 costs
        }
      } catch (error) {
        console.error("Failed to fetch costs:", error);
      }
    }

    fetchCosts();
  }, [subscriptionId, dateRange]);

  // Fetch credits
  useEffect(() => {
    async function fetchCredits() {
      try {
        const data = await fetchWithCache(`/api/customer/${customerId}/credits`);

        if (Array.isArray(data)) {
          const totalBalance = data.reduce(
            (sum: number, credit: { balance: number }) => sum + (credit.balance || 0),
            0
          );
          setStats((prev) => ({ ...prev, creditBalance: totalBalance }));
        }
      } catch (error) {
        console.error("Failed to fetch credits:", error);
      }
    }

    fetchCredits();
  }, [customerId]);

  // Fetch invoices
  useEffect(() => {
    async function fetchInvoices() {
      try {
        const data = await fetchWithCache(`/api/customer/${customerId}/invoices`);
        if (Array.isArray(data)) {
          setStats((prev) => ({ ...prev, invoiceCount: data.length }));
        }
      } catch (error) {
        console.error("Failed to fetch invoices:", error);
      }
    }

    fetchInvoices();
  }, [customerId]);

  // Get data keys based on selected metric
  const dataKeys = usageData.length > 0
    ? selectedMetric === "all"
      ? Object.keys(usageData[0]).filter((k) => k !== "date")
      : [selectedMetric]
    : ["Usage"];

  // Filter usage data for selected metric
  const filteredUsageData = usageData.map((point) => {
    if (selectedMetric === "all") {
      return point;
    }
    return {
      date: point.date,
      [selectedMetric]: point[selectedMetric] || 0,
    };
  });

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  // Convert grouped usage data to cost breakdown chart format
  const groupedCostData: CostDataPoint[] = groupedUsageData.map((item) => ({
    name: item.group,
    value: parseFloat(item.amount),
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your billing and usage
          </p>
        </div>
        <DateRangeSelector value={dateRange} onChange={setDateRange} />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="AI Tokens Used"
          value={formatNumber(stats.aiTokens)}
          description="Current billing period"
          icon={Cpu}
          tooltip={
            <ApiTooltip
              method="GET"
              endpoint="/v1/subscriptions/{id}/usage"
              description="Aggregates total token consumption across all usage events ingested for the current billing period."
              details="Orb tallies usage in real time as events are ingested. The value here sums all metrics whose names contain 'token'."
            />
          }
        />
        <StatsCard
          title="Credit Balance"
          value={`$${stats.creditBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          description="Available credits"
          icon={Coins}
          tooltip={
            <ApiTooltip
              method="GET"
              endpoint="/v1/customers/{id}/credits"
              description="Sums the balance across all active credit blocks for the customer."
              details="Credits are consumed before converting usage to invoiced charges. Each credit block can have its own expiry date and per-unit cost basis."
            />
          }
        />
        <StatsCard
          title="Current Period Cost"
          value={stats.currentPeriodCost}
          description="Estimated charges"
          icon={TrendingUp}
          tooltip={
            <ApiTooltip
              method="GET"
              endpoint="/v1/subscriptions/{id}/costs"
              description="Returns the cumulative cost total for the current billing period across all prices on the subscription."
              details="Uses cumulative view_mode so the last data point always reflects the full period-to-date total. Updates as new events are ingested."
            />
          }
        />
        <StatsCard
          title="Invoices"
          value={stats.invoiceCount.toString()}
          description="Total invoices"
          icon={Receipt}
          tooltip={
            <ApiTooltip
              method="GET"
              endpoint="/v1/invoices"
              description="Returns the count of all invoices for this customer across all statuses: issued, draft, void, and paid."
              details="Draft invoices represent the current open billing period and are finalized automatically at period end."
              align="right"
            />
          }
        />
      </div>

      {/* Usage Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <CardTitle>Usage Over Time</CardTitle>
            <ApiTooltip
              method="GET"
              endpoint="/v1/subscriptions/{id}/usage"
              description="Returns time-series usage data per billable metric for the selected date range, bucketed by day."
              details="Supports filtering by timeframe and grouping by event properties. Ideal for visualizing consumption trends and building forecasts."
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Metric:</span>
            <Select value={selectedMetric} onValueChange={setSelectedMetric}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select metric" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Metrics</SelectItem>
                {allMetrics.map((m) => (
                  <SelectItem key={m.name} value={m.name}>
                    {m.name} {m.unit && `(${m.unit})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[350px] w-full" />
          ) : filteredUsageData.length > 0 ? (
            <UsageChart
              data={filteredUsageData}
              dataKeys={dataKeys}
              units={metricUnits}
              yAxisLabel={selectedMetric !== "all" ? metricUnits[selectedMetric] || "Usage" : "Usage"}
            />
          ) : (
            <div className="flex h-[350px] items-center justify-center text-muted-foreground">
              No usage data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost Breakdown with Group By */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Cost Breakdown</CardTitle>
            <ApiTooltip
              method="GET"
              endpoint="/v1/subscriptions/{id}/costs"
              description="Returns cost totals broken down by price, with periodic or cumulative view modes."
              details="When combined with group_by via /v1/prices/evaluate, costs can be attributed by dimension (region, model, team) — critical for enterprise chargeback reporting."
              align="right"
            />
          </div>
          <GroupBySelector
            value={groupBy}
            onChange={setGroupBy}
            availableKeys={availableKeys}
          />
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : groupBy !== "none" && groupedCostData.length > 0 ? (
            <CostBreakdownChart data={groupedCostData} />
          ) : costData.length > 0 ? (
            <CostBreakdownChart data={costData} />
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              No cost data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
