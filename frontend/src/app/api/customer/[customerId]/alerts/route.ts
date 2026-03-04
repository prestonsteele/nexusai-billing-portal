import { NextRequest, NextResponse } from "next/server";
import { getOrbClient } from "@/lib/orb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const orb = getOrbClient();

    // Get the customer's subscription to list alerts by subscription
    const subscriptions = await orb.subscriptions.list({
      external_customer_id: [customerId],
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json([]);
    }

    const subscriptionId = subscriptions.data[0].id;

    // List existing alerts for this subscription
    const alerts = await orb.alerts.list({ subscription_id: subscriptionId });

    return NextResponse.json(alerts.data);
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const body = await request.json();
    const orb = getOrbClient();

    // Get the customer by external ID to get internal ID
    const customer = await orb.customers.fetchByExternalId(customerId);

    // First get the customer's subscription to get the subscription ID
    const subscriptions = await orb.subscriptions.list({
      external_customer_id: [customerId],
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json(
        { error: "No subscription found for customer" },
        { status: 400 }
      );
    }

    const subscriptionId = subscriptions.data[0].id;

    // Create an alert
    // Alert types: usage_exceeded, cost_exceeded, credit_balance_depleted, credit_balance_dropped, credit_balance_recovered
    const alert = await orb.alerts.createForSubscription(subscriptionId, {
      type: body.type || "cost_exceeded",
      thresholds: body.thresholds || [{ value: 100 }],
    });

    return NextResponse.json(alert);
  } catch (error) {
    console.error("Error creating alert:", error);
    return NextResponse.json(
      { error: "Failed to create alert" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const body = await request.json();
    const orb = getOrbClient();

    if (!body.alert_id) {
      return NextResponse.json(
        { error: "Alert ID is required" },
        { status: 400 }
      );
    }

    // Update alert thresholds
    const alert = await orb.alerts.update(body.alert_id, {
      thresholds: body.thresholds,
    });

    return NextResponse.json(alert);
  } catch (error) {
    console.error("Error updating alert:", error);
    return NextResponse.json(
      { error: "Failed to update alert" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const alertId = searchParams.get("id");

    if (!alertId) {
      return NextResponse.json(
        { error: "Alert ID is required" },
        { status: 400 }
      );
    }

    const orb = getOrbClient();

    // Disable the alert
    await orb.alerts.disable(alertId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disabling alert:", error);
    return NextResponse.json(
      { error: "Failed to disable alert" },
      { status: 500 }
    );
  }
}
