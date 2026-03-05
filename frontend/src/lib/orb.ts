import Orb from "orb-billing";

// Cache options for read-only Orb API calls.
// Orb will return a cached response if the data was updated within the threshold.
export const ORB_CACHE_LIVE = {
  headers: { "Orb-Cache-Control": "cache", "Orb-Cache-Max-Age-Seconds": "300" },
} as const; // usage, costs, credits, ledger — changes as events are ingested

export const ORB_CACHE_STABLE = {
  headers: { "Orb-Cache-Control": "cache", "Orb-Cache-Max-Age-Seconds": "600" },
} as const; // subscriptions, invoices, customer lookups — rarely change

// Server-side Orb client
export function getOrbClient(): Orb {
  const apiKey = process.env.ORB_API_KEY;
  if (!apiKey) {
    throw new Error("ORB_API_KEY environment variable is required");
  }
  return new Orb({ apiKey });
}

// Customer IDs for our demo
export const CUSTOMERS = {
  PLG: "acme_startup",
  ENTERPRISE: "global_corp",
} as const;

export type CustomerType = keyof typeof CUSTOMERS;

// Grouping keys available for filtering
export const GROUPING_KEYS = {
  region: ["us-east", "us-west", "eu-west", "asia-pacific"],
  agent_type: ["assistant", "coder", "researcher"],
  model: ["gpt-4", "claude", "llama"],
  storage_tier: ["hot", "warm", "cold"],
  instance_type: ["gpu-small", "gpu-medium", "gpu-large", "cpu-standard"],
  // Enterprise-only
  department: ["engineering", "data-science", "product", "operations"],
} as const;

export type GroupingKey = keyof typeof GROUPING_KEYS;
