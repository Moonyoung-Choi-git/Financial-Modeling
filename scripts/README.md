# DART Data Import Scripts

## Overview

This directory contains scripts to **pre-load all financial data from DART OpenAPI** into your Prisma database, so users get instant results when they click "Analyze".

## Architecture

### Before (Slow ❌):
```
User clicks "Analyze"
  → Call DART API (slow!)
  → Wait for response
  → Show data
```

### After (Fast ✅):
```
Background Job: Import ALL DART data → Store in Database
User clicks "Analyze"
  → Query Database (instant!)
  → Show data
```

---

## Scripts

### 1. `batch-import-dart-data.ts`

**Purpose:** Download financial data for all companies and store in database.

**Usage:**

```bash
# Import all companies, last 3 years
npx tsx scripts/batch-import-dart-data.ts

# Import only KOSPI companies
npx tsx scripts/batch-import-dart-data.ts --market KOSPI

# Import specific years
npx tsx scripts/batch-import-dart-data.ts --years 2022,2023,2024

# Test with 10 companies
npx tsx scripts/batch-import-dart-data.ts --limit 10

# Re-import everything (don't skip existing)
npx tsx scripts/batch-import-dart-data.ts --no-skip
```

**Options:**
- `--market KOSPI|KOSDAQ|KONEX` - Import only specific market
- `--limit N` - Limit to N companies (for testing)
- `--years 2021,2022,2023` - Specific years to import
- `--no-skip` - Re-import existing data (default: skip)

**What it does:**
1. Syncs company list from DART
2. For each company:
   - Downloads financial statements (Annual + Quarterly)
   - Stores in `raw_dart_fnltt_all_rows` table
3. Shows progress and summary

**Estimated time:**
- 10 companies: ~5 minutes
- 100 companies: ~1 hour
- All KOSPI/KOSDAQ (~2000 companies): ~8-10 hours

---

## Step-by-Step Setup

### Step 1: Test with Small Dataset

```bash
# Import 10 companies to test
npx tsx scripts/batch-import-dart-data.ts --limit 10 --years 2023,2024
```

### Step 2: Verify Data in Database

Check your Prisma Studio or database:
- `raw_dart_corp_master` - Should have ~2500 companies
- `raw_dart_fnltt_all_rows` - Should have financial data

### Step 3: Import Full Dataset

```bash
# Import all KOSPI companies (recommended to start)
npx tsx scripts/batch-import-dart-data.ts --market KOSPI --years 2022,2023,2024
```

### Step 4: Set Up Periodic Updates

**Option A: Cron job (Linux/Mac)**

```bash
# Edit crontab
crontab -e

# Add this line (runs every Sunday at 2 AM)
0 2 * * 0 cd /path/to/project && DATABASE_URL="your_db_url" npx tsx scripts/batch-import-dart-data.ts
```

**Option B: Vercel Cron Jobs**

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/import-dart-data",
      "schedule": "0 2 * * 0"
    }
  ]
}
```

Then create `/api/cron/import-dart-data/route.ts` that calls the import script.

---

## Database Tables

### Raw Data Tables:
- `raw_dart_corp_master` - Company master list
- `raw_dart_fnltt_all_rows` - All financial line items (detailed)
- `raw_dart_fnltt_key_rows` - Key metrics only

### Curated Data Tables:
- `curated_fin_facts` - Cleaned, standardized facts
- `curated_fin_account_map` - Account mapping/categorization

### Model Tables:
- `model_snapshots` - Built financial models
- `model_output_lines` - 3-statement output

---

## Monitoring

### Check Progress

```bash
# Watch the import in real-time
npx tsx scripts/batch-import-dart-data.ts --limit 50 | tee import.log
```

### Check Database Size

```sql
-- PostgreSQL
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Troubleshooting

### Error: "DART API rate limit exceeded"

The script includes 200ms delays between requests. If you still hit rate limits:
- Increase the delay in the script (line with `setTimeout`)
- Run with `--limit` to import in batches

### Error: "Out of memory"

For large imports:
- Run with `--limit` and import in batches
- Increase Node.js memory: `NODE_OPTIONS="--max-old-space-size=4096" npx tsx ...`

### Error: "Database connection timeout"

- Check your DATABASE_URL is correct
- Ensure database is accessible
- For Vercel Postgres, use connection pooling URL

---

## Next Steps

After importing data:

1. **Update `/financials/[ticker]` page** to query database instead of DART API
2. **Run curate script** to transform raw data to standardized format
3. **Build financial models** from curated data
4. **Set up periodic updates** to keep data fresh

---

## Cost Considerations

### DART API
- Free tier: 10,000 requests/day
- This script respects rate limits (200ms delay)
- Full import uses ~8,000-12,000 requests

### Database Storage
- ~100MB per 100 companies (raw data)
- ~1-2GB for all KOSPI/KOSDAQ companies
- Vercel Postgres: Free tier includes 256MB

### Recommendations
- Start with `--market KOSPI` (~700 companies)
- Use `--limit 100` for testing
- Compress old data periodically
