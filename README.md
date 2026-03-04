# NexusAI Billing Portal

A demo billing portal for Orb (withorb.com) showcasing billing capabilities for different customer profiles.

## Overview

This project demonstrates how to build a customer-facing billing portal using Orb's API. It includes:

- **Two customer profiles**: PLG (self-serve) and Enterprise
- **Usage tracking and visualization**: Charts showing usage over time with grouping/pivot capabilities
- **Credit management**: View credit balances and ledger history
- **Invoice viewing**: List and detail views for invoices
- **Daily event ingestion**: Automated cron job to keep demo data fresh

## Project Structure

```
nexusai-billing-portal/
├── frontend/                    # Next.js billing portal
│   ├── src/
│   │   ├── app/                # App Router pages and API routes
│   │   │   ├── api/           # Orb API proxy routes
│   │   │   ├── credits/       # Credit balance page
│   │   │   ├── invoices/      # Invoice history page
│   │   │   └── usage/         # Detailed usage page
│   │   ├── components/        # React components
│   │   │   ├── charts/       # Recharts visualizations
│   │   │   ├── dashboard/    # Dashboard widgets
│   │   │   ├── filters/      # Grouping/filter selectors
│   │   │   ├── layout/       # App shell and navigation
│   │   │   └── ui/           # shadcn/ui components
│   │   ├── lib/              # Utilities and Orb client
│   │   └── types/            # TypeScript types
│   └── vercel.json           # Vercel cron configuration
├── backfill_nexusai_plg.py      # PLG customer backfill script
├── backfill_nexusai_enterprise.py # Enterprise customer backfill script
└── requirements.txt             # Python dependencies
```

## Customer Profiles

### PLG Customer: `acme_startup`
Self-serve customer with tiered subscription plans:
- **Pro** ($49/mo): 100K credits included
- **Plus** ($199/mo): 500K credits included
- **Premium** ($499/mo): 2M credits included

### Enterprise Customer: `global_corp`
Enterprise customer with complex contract including:
- Platform fee: $10,000/month
- Seat licenses: $50/seat/month
- Support tier: $2,500/month
- Committed usage: $25,000/month

## Event Types

Both customers generate the following usage events:

| Event Name | Properties |
|------------|-----------|
| `ai_agent_tokens` | `agent_type`, `model`, `region`, `tokens` |
| `api_requests` | `endpoint`, `method`, `region`, `request_count` |
| `cloud_storage_gb_hours` | `storage_tier`, `region`, `gb_hours` |
| `compute_minutes` | `instance_type`, `region`, `minutes` |

Enterprise customers have additional grouping keys: `department`, `cost_center`, `project_id`

## Setup

### Prerequisites
- Node.js 18+
- Python 3.9+
- Orb account with API key

### 1. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 2. Install Frontend Dependencies
```bash
cd frontend
npm install
```

### 3. Configure Environment
```bash
# Copy the example env file
cp frontend/.env.example frontend/.env.local

# Edit .env.local with your Orb API key
```

### 4. Run Backfill Scripts
Generate historical data for the demo customers:
```bash
export ORB_API_KEY="your_api_key"

# PLG customer (acme_startup)
python backfill_nexusai_plg.py

# Enterprise customer (global_corp)
python backfill_nexusai_enterprise.py
```

### 5. Start Development Server
```bash
cd frontend
npm run dev
```

Visit http://localhost:3000 to see the portal.

## Deployment (Vercel)

1. Push to GitHub
2. Import to Vercel
3. Add environment variables:
   - `ORB_API_KEY`: Your Orb API key
   - `CRON_SECRET`: A secret for cron job authentication (optional but recommended)
4. Deploy

The daily cron job (`/api/cron/send-events`) runs at 8:00 AM UTC to generate fresh events.

## API Routes

| Route | Description |
|-------|-------------|
| `GET /api/customer/[id]` | Fetch customer details |
| `GET /api/customer/[id]/subscriptions` | List customer subscriptions |
| `GET /api/customer/[id]/credits` | Get credit balances |
| `GET /api/customer/[id]/credits/ledger` | Get credit ledger entries |
| `GET /api/customer/[id]/invoices` | List customer invoices |
| `GET /api/subscriptions/[id]/usage` | Fetch subscription usage |
| `GET /api/subscriptions/[id]/costs` | Fetch subscription costs |
| `GET /api/invoices/[id]` | Fetch invoice details |
| `GET /api/cron/send-events` | Daily event ingestion cron |

## Features

### Dashboard
- Usage summary cards
- Usage over time chart with grouping pivot
- Cost breakdown visualization

### Usage Page
- Detailed usage by metric
- Table and chart views
- Filter by metric and group by dimension

### Credits Page
- Current credit balance
- Daily burn rate calculation
- Credit blocks with expiration
- Full ledger history

### Invoices Page
- Invoice list with status badges
- Detailed invoice view with line items
- PDF download links

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui
- **Charts**: Recharts
- **Backend**: Next.js API Routes
- **Orb SDK**: orb-billing (TypeScript/Python)
- **Deployment**: Vercel

## License

MIT
