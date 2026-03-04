"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/layout/AppShell";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { UsageChart } from "@/components/charts/UsageChart";
import { CostBreakdownChart } from "@/components/charts/CostBreakdownChart";
import { GroupBySelector } from "@/components/filters/GroupBySelector";
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

  // Available grouping keys based on customer type
  const availableKeys: GroupingKey[] =
    customer === "ENTERPRISE"
      ? ["region", "agent_type", "model", "department"]
      : ["region", "agent_type", "model"];

  // Fetch subscription
  useEffect(() => {
    async function fetchSubscription() {
      try {
        const res = await fetch(`/api/customer/${customerId}/subscriptions`);
        const data = await res.json();
        if (data.length > 0) {
          setSubscriptionId(data[0].id);
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
        const res = await fetch(`/api/subscriptions/${subscriptionId}/usage`);
        const data = await res.json();

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
      } catch (error) {
        console.error("Failed to fetch usage:", error);
      }
      setLoading(false);
    }

    fetchUsage();
  }, [subscriptionId]);

  // Fetch grouped usage data when groupBy changes
  useEffect(() => {
    if (!subscriptionId || groupBy === "none") {
      setGroupedUsageData([]);
      return;
    }

    async function fetchGroupedUsage() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/subscriptions/${subscriptionId}/usage-grouped?group_by=${groupBy}`
        );
        const data = await res.json();

        if (data.data) {
          setGroupedUsageData(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch grouped usage:", error);
      }
      setLoading(false);
    }

    fetchGroupedUsage();
  }, [subscriptionId, groupBy]);

  // Fetch costs
  useEffect(() => {
    if (!subscriptionId) return;

    async function fetchCosts() {
      try {
        const res = await fetch(`/api/subscriptions/${subscriptionId}/costs`);
        const data = await res.json();

        if (data.data && data.data.length > 0) {
          const costs = data.data[0];
          setStats((prev) => ({
            ...prev,
            currentPeriodCost: `$${parseFloat(costs.total || "0").toFixed(2)}`,
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
  }, [subscriptionId]);

  // Fetch credits
  useEffect(() => {
    async function fetchCredits() {
      try {
        const res = await fetch(`/api/customer/${customerId}/credits`);
        const data = await res.json();

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
        const res = await fetch(`/api/customer/${customerId}/invoices`);
        const data = await res.json();
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your billing and usage
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="AI Tokens Used"
          value={formatNumber(stats.aiTokens)}
          description="Current billing period"
          icon={Cpu}
        />
        <StatsCard
          title="Credit Balance"
          value={formatNumber(stats.creditBalance)}
          description="Available credits"
          icon={Coins}
        />
        <StatsCard
          title="Current Period Cost"
          value={stats.currentPeriodCost}
          description="Estimated charges"
          icon={TrendingUp}
        />
        <StatsCard
          title="Invoices"
          value={stats.invoiceCount.toString()}
          description="Total invoices"
          icon={Receipt}
        />
      </div>

      {/* Usage Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <CardTitle>Usage Over Time</CardTitle>
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
          <CardTitle>Cost Breakdown</CardTitle>
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
