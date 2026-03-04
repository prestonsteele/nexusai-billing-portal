import Orb from "orb-billing";

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
