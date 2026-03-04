"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/layout/AppShell";
import { UsageChart } from "@/components/charts/UsageChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { DateRangeSelector, getDateRange, type DateRangeOption } from "@/components/filters/DateRangeSelector";
import { fetchWithCache } from "@/lib/cache";

interface UsageDataPoint {
  date: string;
  [key: string]: string | number;
}

interface MetricUsage {
  metricName: string;
  totalQuantity: number;
  unit: string;
}

export default function UsagePage() {
  const { customerId } = useApp();
  const [loading, setLoading] = useState(true);
  const [usageData, setUsageData] = useState<UsageDataPoint[]>([]);
  const [metricTotals, setMetricTotals] = useState<MetricUsage[]>([]);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRangeOption>("30d");
  const metricDefaultSet = useRef(false);

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

  // Fetch usage data
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
        const metricMap: Record<string, { total: number; unit: string }> = {};

        if (data.data) {
          for (const metric of data.data) {
            const metricName = metric.billable_metric?.name || "Usage";
            const unit = metric.billable_metric?.event_name || "";

            if (!metricMap[metricName]) {
              metricMap[metricName] = { total: 0, unit };
            }

            if (metric.usage) {
              for (const usage of metric.usage) {
                const date = usage.timeframe_start?.split("T")[0];
                if (!date) continue;

                if (!processedData[date]) {
                  processedData[date] = { date };
                }

                const quantity = usage.quantity || 0;
                metricMap[metricName].total += quantity;

                // Filter by selected metric
                if (selectedMetric !== "all" && metricName !== selectedMetric) {
                  continue;
                }

                processedData[date][metricName] =
                  ((processedData[date][metricName] as number) || 0) + quantity;
              }
            }
          }
        }

        const sortedData = Object.values(processedData).sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const totals = Object.entries(metricMap).map(([name, data]) => ({
          metricName: name,
          totalQuantity: data.total,
          unit: data.unit,
        }));

        setUsageData(sortedData);
        setMetricTotals(totals);

        if (!metricDefaultSet.current && totals.length > 0) {
          metricDefaultSet.current = true;
          const tokenMetric = totals.find((m) =>
            m.metricName.toLowerCase().includes("token")
          );
          if (tokenMetric) setSelectedMetric(tokenMetric.metricName);
        }
      } catch (error) {
        console.error("Failed to fetch usage:", error);
      }
      setLoading(false);
    }

    fetchUsage();
  }, [subscriptionId, selectedMetric, dateRange]);

  // Get unique data keys for chart
  const dataKeys =
    usageData.length > 0
      ? Object.keys(usageData[0]).filter((k) => k !== "date")
      : ["Usage"];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usage</h1>
          <p className="text-muted-foreground">
            Detailed view of your resource consumption
          </p>
        </div>
        <DateRangeSelector value={dateRange} onChange={setDateRange} />
      </div>

      {/* Metric Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricTotals.map((metric) => (
          <Card key={metric.metricName}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.metricName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metric.totalQuantity.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">{metric.unit}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="chart" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chart">Chart View</TabsTrigger>
          <TabsTrigger value="table">Table View</TabsTrigger>
        </TabsList>

        <TabsContent value="chart" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
              <CardTitle>Usage Over Time</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Metric:</span>
                <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select metric" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Metrics</SelectItem>
                    {metricTotals.map((m) => (
                      <SelectItem key={m.metricName} value={m.metricName}>
                        {m.metricName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[400px] w-full" />
              ) : usageData.length > 0 ? (
                <UsageChart data={usageData} dataKeys={dataKeys} />
              ) : (
                <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                  No usage data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="table">
          <Card>
            <CardHeader>
              <CardTitle>Daily Usage Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[400px] w-full" />
              ) : usageData.length > 0 ? (
                <div className="relative overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        {dataKeys.map((key) => (
                          <TableHead key={key} className="text-right">
                            {key}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usageData.slice(-30).map((row) => (
                        <TableRow key={row.date}>
                          <TableCell className="font-medium">
                            {format(parseISO(row.date), "MMM d, yyyy")}
                          </TableCell>
                          {dataKeys.map((key) => (
                            <TableCell key={key} className="text-right">
                              {((row[key] as number) || 0).toLocaleString()}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                  No usage data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
