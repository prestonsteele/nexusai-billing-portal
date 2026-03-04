"use client";

import { useEffect, useState, useMemo } from "react";
import { useApp } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO, subDays, startOfDay } from "date-fns";
import { getDateRange } from "@/components/filters/DateRangeSelector";
import { fetchWithCache } from "@/lib/cache";
import { Coins, TrendingDown, Calendar, AlertCircle } from "lucide-react";

interface CreditBlock {
  id: string;
  balance: number;
  effective_date: string;
  expiry_date: string | null;
  per_unit_cost_basis: string | null;
  status: string;
}

interface LedgerEntry {
  id: string;
  created_at: string;
  entry_type: string;
  amount: number;
  starting_balance: number;
  ending_balance: number;
  description: string | null;
  credit_block: {
    id: string;
    expiry_date: string | null;
  };
}

interface DailyUsageData {
  date: string;
  usage: number;
}

interface UsageDataPoint {
  date: string;
  amount: number;
}

export default function CreditsPage() {
  const { customerId } = useApp();
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<CreditBlock[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<UsageDataPoint[]>([]);

  // Format currency in USD
  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Fetch subscription first
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

  // Fetch credits and ledger
  useEffect(() => {
    async function fetchCredits() {
      setLoading(true);
      try {
        const [creditsData, ledgerData] = await Promise.all([
          fetchWithCache(`/api/customer/${customerId}/credits`),
          fetchWithCache(`/api/customer/${customerId}/credits/ledger`),
        ]);

        setCredits(Array.isArray(creditsData) ? creditsData : []);
        setLedger(Array.isArray(ledgerData) ? ledgerData : []);
      } catch (error) {
        console.error("Failed to fetch credits:", error);
      }
      setLoading(false);
    }

    fetchCredits();
  }, [customerId]);

  // Fetch usage data to distribute ledger totals across actual usage days
  useEffect(() => {
    if (!subscriptionId) return;

    async function fetchUsageForDistribution() {
      try {
        const { timeframeStart, timeframeEnd } = getDateRange("30d");
        const usageDataRaw = await fetchWithCache(
          `/api/subscriptions/${subscriptionId}/usage?timeframe_start=${timeframeStart}&timeframe_end=${timeframeEnd}`
        );

        // Calculate total usage quantity across all metrics and per day
        let totalQuantity = 0;
        const dailyQuantities: Record<string, number> = {};

        if (usageDataRaw.data) {
          for (const metric of usageDataRaw.data) {
            if (metric.usage) {
              for (const usage of metric.usage) {
                const date = usage.timeframe_start?.split("T")[0];
                if (!date) continue;

                const quantity = usage.quantity || 0;
                totalQuantity += quantity;

                if (!dailyQuantities[date]) {
                  dailyQuantities[date] = 0;
                }
                dailyQuantities[date] += quantity;
              }
            }
          }
        }

        // Convert to array with proportional amounts (will be scaled by ledger total later)
        const sortedData = Object.entries(dailyQuantities)
          .map(([date, quantity]) => ({
            date,
            amount: totalQuantity > 0 ? quantity / totalQuantity : 0,
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setUsageData(sortedData);
      } catch (error) {
        console.error("Failed to fetch usage data:", error);
      }
    }

    fetchUsageForDistribution();
  }, [subscriptionId]);

  const totalBalance = credits.reduce((sum, c) => sum + (c.balance || 0), 0);

  const expiringCredits = credits.filter((c) => {
    if (!c.expiry_date) return false;
    const expiry = new Date(c.expiry_date);
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);
    return expiry <= thirtyDays && c.balance > 0;
  });

  // Calculate total credits decremented from ledger
  const totalLedgerDecrements = useMemo(() => {
    return ledger
      .filter((entry) => entry.entry_type === "decrement" || entry.amount < 0)
      .reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
  }, [ledger]);

  // Calculate burn rate: total ledger decrements / days with usage data
  const daysWithUsage = usageData.filter((d) => d.amount > 0).length;
  const dailyBurnRate = daysWithUsage > 0 ? totalLedgerDecrements / daysWithUsage : 0;

  // Calculate daily usage data - distribute ledger total across usage days
  const dailyUsageData = useMemo(() => {
    const data: DailyUsageData[] = [];
    const today = startOfDay(new Date());

    // Create buckets for last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = subDays(today, i);
      data.push({
        date: format(date, "MMM d"),
        usage: 0,
      });
    }

    // Distribute ledger total proportionally across days based on usage patterns
    usageData.forEach((entry) => {
      try {
        const entryDate = startOfDay(parseISO(entry.date));
        const daysAgo = Math.floor(
          (today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysAgo >= 0 && daysAgo < 30) {
          const index = 29 - daysAgo;
          if (index >= 0 && index < data.length) {
            // Scale the proportion by total ledger decrements
            data[index].usage += entry.amount * totalLedgerDecrements;
          }
        }
      } catch (e) {
        // Skip invalid dates
      }
    });

    return data;
  }, [usageData, totalLedgerDecrements]);

  const getEntryTypeBadge = (type: string, amount: number) => {
    // Some systems use amount sign instead of entry_type
    if (type === "increment" || (amount > 0 && type !== "decrement")) {
      return <Badge className="bg-green-100 text-green-800">Grant</Badge>;
    }
    if (type === "decrement" || amount < 0) {
      return <Badge className="bg-blue-100 text-blue-800">Usage</Badge>;
    }
    switch (type) {
      case "expiration_change":
        return <Badge className="bg-yellow-100 text-yellow-800">Expiration</Badge>;
      case "credit_block_expiry":
        return <Badge className="bg-orange-100 text-orange-800">Expired</Badge>;
      case "void":
      case "void_initiated":
        return <Badge className="bg-red-100 text-red-800">Void</Badge>;
      case "amendment":
        return <Badge className="bg-purple-100 text-purple-800">Amendment</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Credits</h1>
        <p className="text-muted-foreground">
          Manage your credit balance and view ledger history (USD)
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className={`text-2xl font-bold ${totalBalance > 0 ? "text-green-600" : ""}`}>
                {formatUSD(totalBalance)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Available credits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Daily Burn Rate</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">
                {formatUSD(dailyBurnRate)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">USD per day (30d avg)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Credit Blocks</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{credits.length}</div>
            )}
            <p className="text-xs text-muted-foreground">Active credit grants</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">
                {formatUSD(expiringCredits.reduce((sum, c) => sum + c.balance, 0))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Expires in 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Burn Rate Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Credit Usage (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : (
            <div style={{ background: "#FBF8F0", borderRadius: "8px", padding: "8px 4px 4px" }}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyUsageData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  interval={4}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => `$${value}`}
                  className="text-muted-foreground"
                />
                <Tooltip
                  formatter={(value) => [formatUSD(Number(value) || 0), "Usage"]}
                  contentStyle={{
                    backgroundColor: "#130F0B",
                    borderColor: "#E4E1D8",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(19,15,11,0.2)",
                    padding: "8px 12px",
                  }}
                  labelStyle={{
                    color: "rgba(251,248,240,0.9)",
                    fontWeight: "500",
                    marginBottom: "4px",
                  }}
                  itemStyle={{
                    color: "#FBF8F0",
                  }}
                />
                <Bar
                  dataKey="usage"
                  fill="#8884d8"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Blocks */}
      <Card>
        <CardHeader>
          <CardTitle>Credit Blocks</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : credits.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Balance (USD)</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Cost Basis</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credits.map((credit) => (
                  <TableRow key={credit.id}>
                    <TableCell className="font-medium">
                      {formatUSD(credit.balance)}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(credit.effective_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {credit.expiry_date
                        ? format(parseISO(credit.expiry_date), "MMM d, yyyy")
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      {credit.per_unit_cost_basis
                        ? `$${credit.per_unit_cost_basis}/unit`
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={credit.balance > 0 ? "default" : "secondary"}
                      >
                        {credit.balance > 0 ? "Active" : "Depleted"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              No credit blocks found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Ledger */}
      <Card>
        <CardHeader>
          <CardTitle>Credit Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : ledger.length > 0 ? (
            <div className="relative overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount (USD)</TableHead>
                    <TableHead className="text-right">Balance After</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.slice(0, 50).map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        {format(parseISO(entry.created_at), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>{getEntryTypeBadge(entry.entry_type, entry.amount)}</TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          entry.amount >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {entry.amount >= 0 ? "+" : ""}
                        {formatUSD(entry.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatUSD(entry.ending_balance)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {entry.description || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex h-[400px] items-center justify-center text-muted-foreground">
              No ledger entries found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
