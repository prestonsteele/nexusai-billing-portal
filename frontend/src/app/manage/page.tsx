"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format, parseISO, addYears } from "date-fns";
import { Plus, Trash2, Bell, RefreshCw, CreditCard, AlertTriangle, Check, DollarSign, PhoneCall, LayoutList } from "lucide-react";
import { ApiTooltip } from "@/components/ui/api-tooltip";
import { fetchWithCache } from "@/lib/cache";

interface TopUp {
  id: string;
  threshold: string;
  amount: string;
  per_unit_cost_basis: string;
  currency: string;
  status: string;
  expires_after: number | null;
  expires_after_unit: string | null;
}

interface Alert {
  id: string;
  type: string;
  enabled: boolean;
  thresholds: { value: number }[];
  created_at: string;
}

const PRESET_AMOUNTS = [20, 50, 100];
const MAX_CUSTOM_AMOUNT = 500;

export default function ManagePage() {
  const { customerId, customer } = useApp();
  const isEnterprise = customer === "ENTERPRISE";
  const [loading, setLoading] = useState(true);
  const [topUps, setTopUps] = useState<TopUp[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [creditBalance, setCreditBalance] = useState(0);

  // Plan state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [subscription, setSubscription] = useState<any>(null);

  // Add Credits state
  const [selectedPreset, setSelectedPreset] = useState<number | "custom" | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [addCreditsLoading, setAddCreditsLoading] = useState(false);
  const [addCreditsSuccess, setAddCreditsSuccess] = useState(false);

  // Top-Up form state
  const [topUpThreshold, setTopUpThreshold] = useState("");
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpCostBasis, setTopUpCostBasis] = useState("1.00");
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpDialogOpen, setTopUpDialogOpen] = useState(false);

  // Alert form state
  const [alertType, setAlertType] = useState("cost_exceeded");
  const [alertThreshold, setAlertThreshold] = useState("");
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);

  // Simulate alert popup state
  const [simulateDialogOpen, setSimulateDialogOpen] = useState(false);

  const formatUSD = (amount: number | string) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  // For unit rates that may be very small (e.g. $0.000001/token)
  const formatRate = (amount: number): string => {
    if (amount === 0) return "$0.00";
    if (amount >= 0.01) return formatUSD(amount);
    const decimals = Math.max(2, -Math.floor(Math.log10(amount)) + 1);
    return `$${parseFloat(amount.toFixed(decimals))}`;
  };

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [topUpsRes, alertsRes, creditsRes] = await Promise.all([
          fetch(`/api/customer/${customerId}/credits/top-ups`),
          fetch(`/api/customer/${customerId}/alerts`),
          fetch(`/api/customer/${customerId}/credits`),
        ]);

        const topUpsData = await topUpsRes.json();
        const alertsData = await alertsRes.json();
        const creditsData = await creditsRes.json();

        // Fetch subscription list to get the ID, then fetch full plan details
        const subsData = await fetchWithCache(`/api/customer/${customerId}/subscriptions`);
        if (Array.isArray(subsData) && subsData.length > 0) {
          const subId = subsData[0].id;
          const planData = await fetchWithCache(`/api/subscriptions/${subId}/plan`);
          setSubscription(planData);
        }

        setTopUps(Array.isArray(topUpsData) ? topUpsData : []);
        setAlerts(Array.isArray(alertsData) ? alertsData : []);

        if (Array.isArray(creditsData)) {
          const total = creditsData.reduce(
            (sum: number, credit: { balance: number }) => sum + (credit.balance || 0),
            0
          );
          setCreditBalance(total);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
      setLoading(false);
    }

    fetchData();
  }, [customerId]);

  // Get the amount to add based on selection
  const getAddAmount = (): number => {
    if (selectedPreset === "custom") {
      const amount = parseFloat(customAmount);
      return isNaN(amount) ? 0 : Math.min(amount, MAX_CUSTOM_AMOUNT);
    }
    return selectedPreset || 0;
  };

  // Add credits handler
  const handleAddCredits = async (amountOverride?: number) => {
    const amount = amountOverride ?? getAddAmount();
    if (amount <= 0) return;

    setAddCreditsLoading(true);
    setAddCreditsSuccess(false);
    try {
      // Default expiry is 1 year from now
      const expiryDate = format(addYears(new Date(), 1), "yyyy-MM-dd");

      const res = await fetch(`/api/customer/${customerId}/credits/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          description: "Credit purchase",
          expiry_date: expiryDate,
        }),
      });

      if (res.ok) {
        setAddCreditsSuccess(true);
        setSelectedPreset(null);
        setCustomAmount("");
        // Close simulate dialog if open
        setSimulateDialogOpen(false);
        // Refresh credit balance
        const creditsRes = await fetch(`/api/customer/${customerId}/credits`);
        const creditsData = await creditsRes.json();
        if (Array.isArray(creditsData)) {
          const total = creditsData.reduce(
            (sum: number, credit: { balance: number }) => sum + (credit.balance || 0),
            0
          );
          setCreditBalance(total);
        }
        setTimeout(() => setAddCreditsSuccess(false), 3000);
      }
    } catch (error) {
      console.error("Failed to add credits:", error);
    }
    setAddCreditsLoading(false);
  };

  // Create top-up handler
  const handleCreateTopUp = async () => {
    if (!topUpThreshold || !topUpAmount) return;

    setTopUpLoading(true);
    try {
      const res = await fetch(`/api/customer/${customerId}/credits/top-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threshold: topUpThreshold,
          amount: topUpAmount,
          per_unit_cost_basis: topUpCostBasis,
          currency: "USD",
          auto_collection: true,
          net_terms: 0,
        }),
      });

      if (res.ok) {
        setTopUpDialogOpen(false);
        setTopUpThreshold("");
        setTopUpAmount("");
        // Refresh top-ups
        const topUpsRes = await fetch(`/api/customer/${customerId}/credits/top-ups`);
        const topUpsData = await topUpsRes.json();
        setTopUps(Array.isArray(topUpsData) ? topUpsData : []);
      }
    } catch (error) {
      console.error("Failed to create top-up:", error);
    }
    setTopUpLoading(false);
  };

  // Delete top-up handler
  const handleDeleteTopUp = async (id: string) => {
    try {
      const res = await fetch(`/api/customer/${customerId}/credits/top-ups?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setTopUps(topUps.filter((t) => t.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete top-up:", error);
    }
  };

  // Create alert handler
  const handleCreateAlert = async () => {
    if (!alertThreshold) return;

    setAlertLoading(true);
    try {
      const res = await fetch(`/api/customer/${customerId}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: alertType,
          thresholds: [{ value: parseFloat(alertThreshold) }],
        }),
      });

      if (res.ok) {
        setAlertDialogOpen(false);
        setAlertThreshold("");
        // Refresh alerts
        const alertsRes = await fetch(`/api/customer/${customerId}/alerts`);
        const alertsData = await alertsRes.json();
        setAlerts(Array.isArray(alertsData) ? alertsData : []);
      }
    } catch (error) {
      console.error("Failed to create alert:", error);
    }
    setAlertLoading(false);
  };

  // Delete alert handler
  const handleDeleteAlert = async (id: string) => {
    try {
      const res = await fetch(`/api/customer/${customerId}/alerts?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setAlerts(alerts.filter((a) => a.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete alert:", error);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getPriceTypeLabel = (price: any): string => {
    if (price.price_type === "fixed_price") return "Fixed Fee";
    const modelLabels: Record<string, string> = {
      unit: "Per Unit",
      tiered: "Tiered",
      package: "Package",
      matrix: "Matrix",
      bulk: "Bulk",
      bps: "BPS",
      tiered_bps: "Tiered BPS",
      bulk_bps: "Bulk BPS",
      tiered_package: "Tiered Pkg",
    };
    const model = price.model_type ?? "";
    return modelLabels[model] ?? (model.replace(/_/g, " ") || "Usage");
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getPriceRate = (price: any): string => {
    const priceType: string = price.price_type ?? "";
    const modelType: string = price.model_type ?? "";

    // Fixed fee — price_type tells us it's fixed, model_type tells us the shape
    if (priceType === "fixed_price") {
      const amount = parseFloat(price.unit_config?.unit_amount ?? "0");
      const qty = price.fixed_price_quantity ?? 1;
      return `${formatUSD(amount * qty)} / ${price.cadence ?? "period"}`;
    }

    // Use model_type to determine rate shape (price_type is always "usage_price" for usage)
    if (modelType === "unit" && price.unit_config?.unit_amount) {
      return `${formatRate(parseFloat(price.unit_config.unit_amount))} / unit`;
    }

    if (modelType === "tiered") {
      const tiers = price.tiered_config?.tiers ?? [];
      if (tiers.length > 0) {
        const first = parseFloat(tiers[0]?.unit_amount ?? "0");
        return `From ${formatRate(first)} / unit · ${tiers.length} tier${tiers.length !== 1 ? "s" : ""}`;
      }
      return "Tiered";
    }

    if (modelType === "package" && price.package_config) {
      const amt = parseFloat(price.package_config.package_amount ?? "0");
      const size = Number(price.package_config.package_size ?? 1);
      return `${formatUSD(amt)} / ${size.toLocaleString()} units`;
    }

    if (modelType === "bulk") {
      const tiers = price.bulk_config?.tiers ?? [];
      if (tiers.length > 0) {
        const first = parseFloat(tiers[0]?.unit_amount ?? "0");
        return `From ${formatRate(first)} / unit · ${tiers.length} tier${tiers.length !== 1 ? "s" : ""}`;
      }
      return "Bulk";
    }

    if (modelType === "matrix") return "Matrix · varies by dimension";

    if (modelType === "bps" && price.bps_config?.bps) return `${price.bps_config.bps} bps`;

    if (modelType === "tiered_bps") {
      const tiers = price.tiered_bps_config?.tiers ?? [];
      return `Tiered BPS · ${tiers.length} tier${tiers.length !== 1 ? "s" : ""}`;
    }

    if (modelType === "tiered_package") {
      const tiers = price.tiered_package_config?.tiers ?? [];
      return `Tiered pkg · ${tiers.length} tier${tiers.length !== 1 ? "s" : ""}`;
    }

    if (modelType) return modelType.replace(/_/g, " ");
    return "—";
  };

  const CADENCE_LABELS: Record<string, string> = {
    monthly: "Monthly",
    annual: "Annual",
    quarterly: "Quarterly",
    one_time: "One-time",
    semi_annual: "Semi-annual",
  };

  const getAlertTypeBadge = (type: string) => {
    switch (type) {
      case "cost_exceeded":
        return <Badge className="bg-orange-100 text-orange-800">Cost</Badge>;
      case "usage_exceeded":
        return <Badge className="bg-blue-100 text-blue-800">Usage</Badge>;
      case "credit_balance_depleted":
        return <Badge className="bg-red-100 text-red-800">Depleted</Badge>;
      case "credit_balance_dropped":
        return <Badge className="bg-yellow-100 text-yellow-800">Balance Drop</Badge>;
      case "credit_balance_recovered":
        return <Badge className="bg-green-100 text-green-800">Recovered</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manage Billing</h1>
        <p className="text-muted-foreground">
          Add credits, configure auto top-ups, and manage spend alerts
        </p>
      </div>

      {/* Current Balance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Current Credit Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-10 w-32" />
          ) : (
            <div className={`text-3xl font-bold ${creditBalance > 0 ? "text-green-600" : "text-red-600"}`}>
              {formatUSD(creditBalance)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <LayoutList className="h-5 w-5" />
              Current Plan
            </CardTitle>
            <ApiTooltip
              method="GET"
              endpoint="/v1/subscriptions/{id}"
              description="Returns the full subscription object including plan details, all price intervals, billing cadence, and current period dates."
              details="Price intervals reflect every active charge on the subscription — fixed fees, usage-based prices, and any mid-period amendments. Useful for displaying transparent plan details to customers."
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : subscription ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="font-semibold">{subscription.plan?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={subscription.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                    {subscription.status}
                  </Badge>
                </div>
                {subscription.current_billing_period_start_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">Current Period</p>
                    <p className="text-sm">
                      {format(parseISO(subscription.current_billing_period_start_date), "MMM d")}
                      {" – "}
                      {subscription.current_billing_period_end_date
                        ? format(parseISO(subscription.current_billing_period_end_date), "MMM d, yyyy")
                        : "ongoing"}
                    </p>
                  </div>
                )}
              </div>
              {subscription.price_intervals?.length > 0 && (
                <div className="relative overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-2 text-left font-medium text-muted-foreground">Price</th>
                        <th className="pb-2 text-left font-medium text-muted-foreground">Type</th>
                        <th className="pb-2 text-left font-medium text-muted-foreground">Metric</th>
                        <th className="pb-2 text-left font-medium text-muted-foreground">Cadence</th>
                        <th className="pb-2 text-right font-medium text-muted-foreground">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {subscription.price_intervals.map((interval: any, i: number) => {
                        const price = interval.price;
                        if (!price) return null;
                        return (
                          <tr key={price.id ?? i}>
                            <td className="py-2.5 pr-4 font-medium">{price.name}</td>
                            <td className="py-2.5 pr-4">
                              <Badge variant="secondary" className="text-xs font-normal">
                                {getPriceTypeLabel(price)}
                              </Badge>
                            </td>
                            <td className="py-2.5 pr-4 text-muted-foreground">
                              {price.item?.name ?? price.billable_metric?.name ?? <span className="text-muted-foreground/40">—</span>}
                            </td>
                            <td className="py-2.5 pr-4 text-muted-foreground">
                              {CADENCE_LABELS[price.cadence] ?? price.cadence ?? "—"}
                            </td>
                            <td className="py-2.5 text-right tabular-nums">{getPriceRate(price)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center text-muted-foreground">
              No active subscription found
            </div>
          )}
        </CardContent>
      </Card>

      <div className="relative grid gap-8 lg:grid-cols-2">
        {isEnterprise && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-white/70 backdrop-blur-[2px]">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <PhoneCall className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-center px-6">
              <p className="font-semibold text-foreground">Contact your sales team</p>
              <p className="text-sm text-muted-foreground mt-1">
                Please contact your sales team if you would like to increase your credit package.
              </p>
            </div>
          </div>
        )}
        {/* Add Credits */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Credits
              </CardTitle>
              <ApiTooltip
                method="POST"
                endpoint="/v1/customers/{id}/credits/ledger_transactions"
                description="Creates a new credit grant for the customer with a specified amount, cost basis, and optional expiry date."
                details="Each grant creates an independent credit block. Credits are consumed in FIFO order and can have different per-unit cost bases — enabling tiered prepaid pricing across customer segments."
              />
            </div>
            <CardDescription>
              Purchase credits (expires in 1 year)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Preset amount buttons */}
            <div className="grid grid-cols-3 gap-2">
              {PRESET_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  variant={selectedPreset === amount ? "default" : "outline"}
                  className="h-12 text-lg"
                  onClick={() => {
                    setSelectedPreset(amount);
                    setCustomAmount("");
                  }}
                >
                  ${amount}
                </Button>
              ))}
            </div>

            {/* Custom amount */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  variant={selectedPreset === "custom" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPreset("custom")}
                >
                  Custom
                </Button>
                <span className="text-sm text-muted-foreground">
                  (max ${MAX_CUSTOM_AMOUNT})
                </span>
              </div>
              {selectedPreset === "custom" && (
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min="1"
                    max={MAX_CUSTOM_AMOUNT}
                    step="1"
                    placeholder="Enter amount"
                    value={customAmount}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (val > MAX_CUSTOM_AMOUNT) {
                        setCustomAmount(MAX_CUSTOM_AMOUNT.toString());
                      } else {
                        setCustomAmount(e.target.value);
                      }
                    }}
                    className="pl-8"
                  />
                </div>
              )}
            </div>

            <Button
              onClick={() => handleAddCredits()}
              disabled={addCreditsLoading || getAddAmount() <= 0}
              className="w-full"
            >
              {addCreditsLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : addCreditsSuccess ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {addCreditsSuccess
                ? "Credits Added!"
                : getAddAmount() > 0
                ? `Add ${formatUSD(getAddAmount())}`
                : "Select Amount"}
            </Button>
          </CardContent>
        </Card>

        {/* Auto Top-Ups */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Auto Top-Ups
                </CardTitle>
                <ApiTooltip
                  method="POST"
                  endpoint="/v1/customers/{id}/credits/top_up_transactions"
                  description="Configures automatic credit replenishment triggered when the customer's balance falls to or below a threshold amount."
                  details="Top-ups fire asynchronously via Orb's event system. Each rule specifies a threshold, top-up amount, and per-unit cost basis — ensuring uninterrupted service for prepaid customers."
                />
              </div>
              <CardDescription>
                Automatically add credits when balance drops
              </CardDescription>
            </div>
            <Dialog open={topUpDialogOpen} onOpenChange={setTopUpDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Auto Top-Up</DialogTitle>
                  <DialogDescription>
                    Configure automatic credit replenishment when balance falls below threshold
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Threshold (USD)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="100.00"
                      value={topUpThreshold}
                      onChange={(e) => setTopUpThreshold(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Trigger top-up when balance falls to or below this amount
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Top-Up Amount (USD)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="500.00"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Amount of credits to add when triggered
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Cost Basis (per unit)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="1.00"
                      value={topUpCostBasis}
                      onChange={(e) => setTopUpCostBasis(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTopUpDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTopUp} disabled={topUpLoading}>
                    {topUpLoading && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
                    Create Top-Up
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : topUps.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topUps.map((topUp) => (
                    <TableRow key={topUp.id}>
                      <TableCell>{formatUSD(topUp.threshold)}</TableCell>
                      <TableCell>{formatUSD(topUp.amount)}</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTopUp(topUp.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                No auto top-ups configured
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Spend Alerts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Spend Alerts
              </CardTitle>
              <ApiTooltip
                method="POST"
                endpoint="/v1/alerts"
                description="Creates webhook-triggered alerts when usage or costs cross configured thresholds."
                details="Supports cost_exceeded, usage_exceeded, credit_balance_dropped, credit_balance_depleted, and credit_balance_recovered events. Alerts fire in real time as Orb processes ingested events."
              />
            </div>
            <CardDescription>
              Get notified when usage or costs exceed thresholds
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {/* Simulate Alert Dialog */}
            <Dialog open={simulateDialogOpen} onOpenChange={setSimulateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Simulate
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                      <AlertTriangle className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <DialogTitle>Spend Alert</DialogTitle>
                      <DialogDescription>
                        Your usage has exceeded the threshold
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="py-6">
                  <div className="rounded-lg bg-orange-50 border border-orange-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Amount Spent</span>
                      <span className="text-2xl font-bold text-orange-600">$10.00</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Current Balance</span>
                      <span className={`font-semibold ${creditBalance > 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatUSD(creditBalance)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground pt-2 border-t">
                      You&apos;ve spent $10.00 on AI usage. Add credits to continue using the platform without interruption.
                    </p>
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={() => setSimulateDialogOpen(false)} className="w-full sm:w-auto">
                    Dismiss
                  </Button>
                  <Button
                    onClick={() => handleAddCredits(50)}
                    disabled={addCreditsLoading}
                    className="w-full sm:w-auto"
                  >
                    {addCreditsLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Add $50 Credits
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* New Alert Dialog */}
            <Dialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New Alert
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Spend Alert</DialogTitle>
                  <DialogDescription>
                    Configure alerts for cost or usage thresholds
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Alert Type</Label>
                    <Select value={alertType} onValueChange={setAlertType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cost_exceeded">Cost Exceeded</SelectItem>
                        <SelectItem value="usage_exceeded">Usage Exceeded</SelectItem>
                        <SelectItem value="credit_balance_dropped">Credit Balance Dropped</SelectItem>
                        <SelectItem value="credit_balance_depleted">Credit Balance Depleted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Threshold {alertType.includes("cost") || alertType.includes("credit") ? "(USD)" : "(units)"}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={alertType.includes("cost") || alertType.includes("credit") ? "100.00" : "10000"}
                      value={alertThreshold}
                      onChange={(e) => setAlertThreshold(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAlertDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateAlert} disabled={alertLoading}>
                    {alertLoading && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
                    Create Alert
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : alerts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Threshold(s)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>{getAlertTypeBadge(alert.type)}</TableCell>
                    <TableCell>
                      {alert.thresholds.map((t, i) => (
                        <span key={i}>
                          {alert.type.includes("cost") || alert.type.includes("credit")
                            ? formatUSD(t.value)
                            : t.value.toLocaleString()}
                          {i < alert.thresholds.length - 1 && ", "}
                        </span>
                      ))}
                    </TableCell>
                    <TableCell>
                      <Badge className={alert.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                        {alert.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(parseISO(alert.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAlert(alert.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              No spend alerts configured
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
