#!/usr/bin/env python3
"""
Backfill script for NexusAI PLG customer (acme_startup).

Generates 60 days of historical usage data for a self-serve customer
with realistic patterns including weekday peaks, weekend dips, and gradual growth.

Usage:
    1. Create a .env file with ORB_API_KEY=your_api_key
    2. python backfill_nexusai_plg.py
"""

import argparse
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()
import random
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import orb

# Customer Configuration
EXTERNAL_CUSTOMER_ID = "acme_startup"
ORG_NAME = "NexusAI"

# Event types and their configurations
EVENT_CONFIGS = {
    "ai_agent_tokens": {
        "base_daily_events": 150,  # Number of events per day
        "properties": {
            "agent_type": ["assistant", "coder", "researcher"],
            "model": ["gpt-4", "claude", "llama"],
            "region": ["us-east", "us-west", "eu-west", "asia-pacific"],
        },
        "metrics": {
            "tokens": {"min": 100, "max": 5000},  # tokens per event
        },
    },
    "api_requests": {
        "base_daily_events": 200,
        "properties": {
            "endpoint": ["/v1/chat", "/v1/completions", "/v1/embeddings", "/v1/agents"],
            "method": ["POST", "GET"],
            "region": ["us-east", "us-west", "eu-west", "asia-pacific"],
        },
        "metrics": {
            "request_count": {"min": 1, "max": 10},
        },
    },
    "cloud_storage_gb_hours": {
        "base_daily_events": 20,
        "properties": {
            "storage_tier": ["hot", "warm", "cold"],
            "region": ["us-east", "us-west", "eu-west", "asia-pacific"],
        },
        "metrics": {
            "gb_hours": {"min": 0.5, "max": 50.0},
        },
    },
    "compute_minutes": {
        "base_daily_events": 50,
        "properties": {
            "instance_type": ["gpu-small", "gpu-medium", "gpu-large", "cpu-standard"],
            "region": ["us-east", "us-west", "eu-west", "asia-pacific"],
        },
        "metrics": {
            "minutes": {"min": 1, "max": 60},
        },
    },
}

# Data generation parameters
BACKFILL_DAYS = 60  # Generate 60 days of historical data
DAILY_VARIANCE = 0.25  # ±25% daily variance
WEEKEND_FACTOR = 0.35  # Weekends have 35% of weekday usage
WEEKLY_GROWTH_RATE = 0.05  # 5% week-over-week growth
BATCH_SIZE = 400  # Orb recommends batches of up to 500
RATE_LIMIT_EVENTS_PER_MINUTE = 2000  # Orb rate limit
BATCH_DELAY_SECONDS = 15  # Delay between batches to stay under rate limit


def get_orb_client() -> orb.Orb:
    """Initialize and return the Orb client."""
    api_key = os.environ.get("ORB_API_KEY")
    if not api_key:
        raise ValueError("ORB_API_KEY environment variable is required")
    return orb.Orb(api_key=api_key)


def calculate_daily_multiplier(date: datetime) -> float:
    """
    Calculate a multiplier for daily usage based on:
    - Day of week (weekend vs weekday)
    - Weekly growth trend
    - Random variance
    """
    # Base multiplier starts at 1.0
    multiplier = 1.0

    # Weekend factor
    if date.weekday() >= 5:  # Saturday = 5, Sunday = 6
        multiplier *= WEEKEND_FACTOR

    # Weekly growth - calculate weeks from start date
    weeks_ago = (datetime.now(timezone.utc) - date).days / 7
    growth_factor = (1 + WEEKLY_GROWTH_RATE) ** (-weeks_ago)
    multiplier *= growth_factor

    # Random daily variance
    variance = random.uniform(1 - DAILY_VARIANCE, 1 + DAILY_VARIANCE)
    multiplier *= variance

    return multiplier


def generate_event(
    event_name: str,
    config: dict[str, Any],
    timestamp: datetime,
) -> dict[str, Any]:
    """Generate a single event with random properties and metrics."""
    # Select random property values
    properties = {}
    for prop_name, prop_values in config["properties"].items():
        properties[prop_name] = random.choice(prop_values)

    # Generate metric values
    for metric_name, metric_range in config["metrics"].items():
        if isinstance(metric_range["min"], float):
            properties[metric_name] = round(
                random.uniform(metric_range["min"], metric_range["max"]), 2
            )
        else:
            properties[metric_name] = random.randint(
                metric_range["min"], metric_range["max"]
            )

    return {
        "event_name": event_name,
        "external_customer_id": EXTERNAL_CUSTOMER_ID,
        "timestamp": timestamp.isoformat(),
        "idempotency_key": str(uuid.uuid4()),
        "properties": properties,
    }


def generate_events_for_day(date: datetime) -> list[dict[str, Any]]:
    """Generate all events for a single day."""
    events = []
    multiplier = calculate_daily_multiplier(date)

    for event_name, config in EVENT_CONFIGS.items():
        # Calculate number of events for this day
        num_events = int(config["base_daily_events"] * multiplier)
        num_events = max(1, num_events)  # At least 1 event

        for _ in range(num_events):
            # Random timestamp within the day (business hours weighted)
            hour = random.choices(
                range(24),
                weights=[
                    1, 1, 1, 1, 1, 2,  # 0-5: low
                    3, 5, 8, 10, 10, 9,  # 6-11: ramping up
                    8, 10, 10, 9, 8, 6,  # 12-17: peak then declining
                    4, 3, 2, 2, 1, 1,  # 18-23: evening decline
                ],
            )[0]
            minute = random.randint(0, 59)
            second = random.randint(0, 59)

            timestamp = date.replace(
                hour=hour, minute=minute, second=second, microsecond=0
            )
            events.append(generate_event(event_name, config, timestamp))

    return events


def generate_all_events(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> list[dict[str, Any]]:
    """Generate all events for the backfill period."""
    all_events = []
    if end_date is None:
        end_date = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
    if start_date is None:
        start_date = end_date - timedelta(days=BACKFILL_DAYS)

    print(f"Generating events from {start_date.date()} to {end_date.date()}")

    current_date = start_date
    while current_date < end_date:
        day_events = generate_events_for_day(current_date)
        all_events.extend(day_events)
        current_date += timedelta(days=1)

    return all_events


def send_events_batch(client: orb.Orb, events: list[dict[str, Any]]) -> None:
    """Send a batch of events to Orb."""
    client.events.ingest(
        events=events,
        backfill_id=None,  # Will be set when using backfill API
    )


def create_backfill(client: orb.Orb, events: list[dict[str, Any]]) -> None:
    """Create backfills and send all events. Splits into 30-day chunks due to Orb API limits."""
    if not events:
        print("No events to send")
        return

    # Find the time range of events
    timestamps = [datetime.fromisoformat(e["timestamp"].replace("Z", "+00:00")) for e in events]
    min_time = min(timestamps)
    max_time = max(timestamps)

    print(f"Total events to send: {len(events)}")
    print(f"Full time range: {min_time.isoformat()} to {max_time.isoformat()}")

    # Split events into 30-day chunks (Orb limits backfills to 31 days)
    chunk_days = 30
    current_start = min_time
    chunk_num = 0

    while current_start < max_time:
        chunk_num += 1
        chunk_end = current_start + timedelta(days=chunk_days)
        if chunk_end > max_time + timedelta(hours=1):
            chunk_end = max_time + timedelta(hours=1)

        # Filter events for this chunk
        chunk_events = [
            e for e in events
            if current_start <= datetime.fromisoformat(e["timestamp"].replace("Z", "+00:00")) < chunk_end
        ]

        if not chunk_events:
            current_start = chunk_end
            continue

        print(f"\n--- Backfill chunk {chunk_num} ---")
        print(f"Time range: {current_start.isoformat()} to {chunk_end.isoformat()}")
        print(f"Events in chunk: {len(chunk_events)}")

        # Create the backfill for this chunk
        backfill = client.events.backfills.create(
            timeframe_start=current_start.isoformat(),
            timeframe_end=chunk_end.isoformat(),
            customer_id=None,
            external_customer_id=EXTERNAL_CUSTOMER_ID,
            replace_existing_events=True,
        )

        print(f"Created backfill: {backfill.id}")

        # Send events in batches
        total_batches = (len(chunk_events) + BATCH_SIZE - 1) // BATCH_SIZE
        for i in range(0, len(chunk_events), BATCH_SIZE):
            batch = chunk_events[i : i + BATCH_SIZE]
            batch_num = i // BATCH_SIZE + 1

            # Retry logic for rate limiting
            max_retries = 3
            for retry in range(max_retries):
                try:
                    client.events.ingest(
                        events=batch,
                        backfill_id=backfill.id,
                    )
                    break
                except orb.TooManyRequests as e:
                    if retry < max_retries - 1:
                        wait_time = 60 * (retry + 1)  # Wait 60s, 120s, 180s
                        print(f"Rate limited, waiting {wait_time}s before retry...")
                        time.sleep(wait_time)
                    else:
                        raise e

            print(f"Sent batch {batch_num}/{total_batches} ({len(batch)} events)")

            # Wait between batches to stay under rate limit
            if batch_num < total_batches:
                time.sleep(BATCH_DELAY_SECONDS)

        # Close the backfill
        client.events.backfills.close(backfill.id)
        print(f"Closed backfill: {backfill.id}")

        current_start = chunk_end
        time.sleep(1)  # Brief pause between chunks


def print_event_summary(events: list[dict[str, Any]]) -> None:
    """Print a summary of generated events."""
    print("\n=== Event Summary ===")

    # Count by event type
    event_counts: dict[str, int] = {}
    for event in events:
        name = event["event_name"]
        event_counts[name] = event_counts.get(name, 0) + 1

    for name, count in sorted(event_counts.items()):
        print(f"  {name}: {count:,} events")

    print(f"\nTotal events: {len(events):,}")

    # Show date range
    timestamps = sorted(e["timestamp"] for e in events)
    print(f"Date range: {timestamps[0][:10]} to {timestamps[-1][:10]}")


def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Backfill NexusAI PLG customer events")
    parser.add_argument("--yes", "-y", action="store_true", help="Skip confirmation prompt")
    parser.add_argument(
        "--start-date",
        type=str,
        help="Start date (inclusive) in YYYY-MM-DD format. Defaults to 60 days ago.",
    )
    parser.add_argument(
        "--end-date",
        type=str,
        help="End date (exclusive) in YYYY-MM-DD format. Defaults to today.",
    )
    args = parser.parse_args()

    # Parse optional date range
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    if args.start_date:
        start_date = datetime.strptime(args.start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    if args.end_date:
        end_date = datetime.strptime(args.end_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)

    print(f"=== NexusAI PLG Backfill Script ===")
    print(f"Customer: {EXTERNAL_CUSTOMER_ID}")
    print(f"Organization: {ORG_NAME}")
    print()

    # Initialize client
    client = get_orb_client()
    print("Connected to Orb API")

    # Generate events
    print("\nGenerating events...")
    events = generate_all_events(start_date=start_date, end_date=end_date)
    print_event_summary(events)

    # Confirm before sending
    if not args.yes:
        print("\n" + "=" * 40)
        response = input("Send events to Orb? (yes/no): ").strip().lower()
        if response != "yes":
            print("Aborted.")
            return

    # Create backfill and send events
    print("\nSending events to Orb...")
    create_backfill(client, events)

    print("\n=== Backfill Complete ===")
    print("Check the Orb dashboard to verify events are appearing.")


if __name__ == "__main__":
    main()
