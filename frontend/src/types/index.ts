// Types for Orb API responses

export interface UsageData {
  date: string;
  usage: number;
  groupingKey?: string;
  groupingValue?: string;
}

export interface DailyUsage {
  date: string;
  quantity: number;
}

export interface UsageByMetric {
  metricName: string;
  totalQuantity: number;
  dailyUsage: DailyUsage[];
}

export interface CreditBalance {
  id: string;
  balance: number;
  effectiveDate: string;
  expiryDate: string | null;
  perUnitCostBasis: string | null;
}

export interface CreditLedgerEntry {
  id: string;
  createdAt: string;
  entryType: string;
  amount: number;
  startingBalance: number;
  endingBalance: number;
  description: string | null;
  creditBlock: {
    id: string;
    expiryDate: string | null;
    perUnitCostBasis: string | null;
  };
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: string;
  subtotal: string;
  amountDue: string;
  createdAt: string;
  dueDate: string | null;
  invoicePdf: string | null;
  lineItems: InvoiceLineItem[];
  customer: {
    id: string;
    externalCustomerId: string;
    name: string;
  };
}

export interface InvoiceLineItem {
  id: string;
  name: string;
  quantity: number;
  subtotal: string;
  amount: string;
  grouping: Record<string, string> | null;
  startDate: string;
  endDate: string;
}

export interface Subscription {
  id: string;
  status: string;
  plan: {
    id: string;
    name: string;
  };
  customer: {
    id: string;
    externalCustomerId: string;
    name: string;
  };
  startDate: string;
  endDate: string | null;
  currentBillingPeriodStartDate: string;
  currentBillingPeriodEndDate: string;
}

export interface SubscriptionUsage {
  billableMetric: {
    id: string;
    name: string;
  };
  usage: {
    quantity: number;
    timeframeStart: string;
    timeframeEnd: string;
  }[];
  viewMode: string;
}

export interface SubscriptionCost {
  costs: {
    priceGroups: {
      groupingKey: string;
      groupingValue: string;
      secondaryGroupingKey: string | null;
      secondaryGroupingValue: string | null;
      total: string;
      prices: {
        name: string;
        subtotal: string;
        quantity: number;
      }[];
    }[];
    subtotal: string;
    total: string;
    timeframeStart: string;
    timeframeEnd: string;
  }[];
}

export interface Customer {
  id: string;
  externalCustomerId: string;
  name: string;
  email: string | null;
  createdAt: string;
  timezone: string;
  paymentProvider: string | null;
  balance: string;
}

export type CustomerType = "PLG" | "ENTERPRISE";
