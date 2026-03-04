import { NextRequest, NextResponse } from "next/server";
import { getOrbClient, CUSTOMERS } from "@/lib/orb";
import { v4 as uuidv4 } from "uuid";

// Configuration for event generation
const CONFIG = {
  plg: {
    customerId: CUSTOMERS.PLG,
    events: {
      ai_agent_tokens: {
        baseEventsPerDay: 150,
        properties: {
          agent_type: ["assistant", "coder", "researcher"],
          model: ["gpt-4", "claude", "llama"],
          region: ["us-east", "us-west", "eu-west", "asia-pacific"],
        },
        metrics: { tokens: { min: 100, max: 5000 } },
      },
      api_requests: {
        baseEventsPerDay: 200,
        properties: {
          endpoint: ["/v1/chat", "/v1/completions", "/v1/embeddings", "/v1/agents"],
          method: ["POST", "GET"],
          region: ["us-east", "us-west", "eu-west", "asia-pacific"],
        },
        metrics: { request_count: { min: 1, max: 10 } },
      },
      cloud_storage_gb_hours: {
        baseEventsPerDay: 20,
        properties: {
          storage_tier: ["hot", "warm", "cold"],
          region: ["us-east", "us-west", "eu-west", "asia-pacific"],
        },
        metrics: { gb_hours: { min: 0.5, max: 50.0 } },
      },
      compute_minutes: {
        baseEventsPerDay: 50,
        properties: {
          instance_type: ["gpu-small", "gpu-medium", "gpu-large", "cpu-standard"],
          region: ["us-east", "us-west", "eu-west", "asia-pacific"],
        },
        metrics: { minutes: { min: 1, max: 60 } },
      },
    },
    variance: 0.25,
    weekendFactor: 0.35,
  },
  enterprise: {
    customerId: CUSTOMERS.ENTERPRISE,
    events: {
      ai_agent_tokens: {
        baseEventsPerDay: 800,
        properties: {
          agent_type: ["assistant", "coder", "researcher"],
          model: ["gpt-4", "claude", "llama"],
          region: ["us-east", "us-west", "eu-west", "asia-pacific"],
          department: ["engineering", "data-science", "product", "operations"],
        },
        metrics: { tokens: { min: 500, max: 15000 } },
      },
      api_requests: {
        baseEventsPerDay: 1200,
        properties: {
          endpoint: ["/v1/chat", "/v1/completions", "/v1/embeddings", "/v1/agents", "/v1/batch"],
          method: ["POST", "GET"],
          region: ["us-east", "us-west", "eu-west", "asia-pacific"],
          department: ["engineering", "data-science", "product", "operations"],
        },
        metrics: { request_count: { min: 1, max: 50 } },
      },
      cloud_storage_gb_hours: {
        baseEventsPerDay: 100,
        properties: {
          storage_tier: ["hot", "warm", "cold"],
          region: ["us-east", "us-west", "eu-west", "asia-pacific"],
          department: ["engineering", "data-science", "product", "operations"],
        },
        metrics: { gb_hours: { min: 5.0, max: 500.0 } },
      },
      compute_minutes: {
        baseEventsPerDay: 300,
        properties: {
          instance_type: ["gpu-small", "gpu-medium", "gpu-large", "gpu-xlarge", "cpu-standard"],
          region: ["us-east", "us-west", "eu-west", "asia-pacific"],
          department: ["engineering", "data-science", "product", "operations"],
        },
        metrics: { minutes: { min: 5, max: 180 } },
      },
    },
    variance: 0.2,
    weekendFactor: 0.25,
  },
};

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function calculateDailyMultiplier(
  date: Date,
  variance: number,
  weekendFactor: number
): number {
  let multiplier = 1.0;

  // Weekend factor
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    multiplier *= weekendFactor;
  }

  // Random variance
  const varianceMultiplier = 1 + (Math.random() * 2 - 1) * variance;
  multiplier *= varianceMultiplier;

  return multiplier;
}

interface EventConfig {
  baseEventsPerDay: number;
  properties: Record<string, string[]>;
  metrics: Record<string, { min: number; max: number }>;
}

// Grace period window: generate timestamps within this many hours of now
// Orb's grace period is 12h; we stay safely under it
const GRACE_WINDOW_HOURS = 10;

// Pool of "hours ago" values with a business-hours-like distribution.
// Peak is 4-6h ago (mid-day relative to an 8 AM UTC cron run = ~2-4 AM-ish activity
// the previous evening), tapering off toward now and toward the oldest bucket.
const HOURS_AGO_POOL = [
  0, 0,           // 0-1h ago: low
  1, 1,           // 1-2h ago: low
  2, 2, 2,        // 2-3h ago: medium
  3, 3, 3, 3,     // 3-4h ago: medium-high
  4, 4, 4, 4,     // 4-5h ago: peak
  5, 5, 5, 5,     // 5-6h ago: peak
  6, 6, 6,        // 6-7h ago: medium-high
  7, 7, 7,        // 7-8h ago: medium
  8, 8,           // 8-9h ago: low
  9,              // 9-10h ago: very low
];

function generateEventsForCustomer(
  customerId: string,
  events: Record<string, EventConfig>,
  variance: number,
  weekendFactor: number
): Array<{
  event_name: string;
  external_customer_id: string;
  timestamp: string;
  idempotency_key: string;
  properties: Record<string, string | number>;
}> {
  const now = new Date();
  const multiplier = calculateDailyMultiplier(now, variance, weekendFactor);
  const generatedEvents: Array<{
    event_name: string;
    external_customer_id: string;
    timestamp: string;
    idempotency_key: string;
    properties: Record<string, string | number>;
  }> = [];

  for (const [eventName, config] of Object.entries(events)) {
    const numEvents = Math.max(1, Math.floor(config.baseEventsPerDay * multiplier));

    for (let i = 0; i < numEvents; i++) {
      // Generate timestamp within the past GRACE_WINDOW_HOURS hours so it is
      // always accepted by Orb's real-time ingest (no backfill needed).
      const hoursAgo = randomChoice(HOURS_AGO_POOL);
      const minutesAgo = hoursAgo * 60 + randomInt(0, 59);
      const secondsAgo = randomInt(0, 59);
      const timestamp = new Date(
        now.getTime() - (minutesAgo * 60 + secondsAgo) * 1000
      );

      const properties: Record<string, string | number> = {};

      // Add property values
      for (const [propName, propValues] of Object.entries(config.properties)) {
        properties[propName] = randomChoice(propValues);
      }

      // Add metric values
      for (const [metricName, range] of Object.entries(config.metrics)) {
        if (Number.isInteger(range.min) && Number.isInteger(range.max)) {
          properties[metricName] = randomInt(range.min, range.max);
        } else {
          properties[metricName] = randomFloat(range.min, range.max);
        }
      }

      generatedEvents.push({
        event_name: eventName,
        external_customer_id: customerId,
        timestamp: timestamp.toISOString(),
        idempotency_key: uuidv4(),
        properties,
      });
    }
  }

  return generatedEvents;
}

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orb = getOrbClient();

    // Generate events for PLG customer
    const plgEvents = generateEventsForCustomer(
      CONFIG.plg.customerId,
      CONFIG.plg.events,
      CONFIG.plg.variance,
      CONFIG.plg.weekendFactor
    );

    // Generate events for Enterprise customer
    const enterpriseEvents = generateEventsForCustomer(
      CONFIG.enterprise.customerId,
      CONFIG.enterprise.events,
      CONFIG.enterprise.variance,
      CONFIG.enterprise.weekendFactor
    );

    const allEvents = [...plgEvents, ...enterpriseEvents];

    // Send events in batches of 400
    const batchSize = 400;
    let totalSent = 0;

    for (let i = 0; i < allEvents.length; i += batchSize) {
      const batch = allEvents.slice(i, i + batchSize);
      await orb.events.ingest({ events: batch });
      totalSent += batch.length;
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${totalSent} events`,
      breakdown: {
        plg: plgEvents.length,
        enterprise: enterpriseEvents.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error sending events:", error);
    return NextResponse.json(
      { error: "Failed to send events", details: String(error) },
      { status: 500 }
    );
  }
}

// POST method for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
