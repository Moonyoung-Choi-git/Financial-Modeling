# Production Database Setup Guide

## Quick Setup (3 Steps)

### Step 1: Get Your Database URL from Vercel

1. Go to your Vercel dashboard
2. Click on your project: **financial-modeling-web-platform**
3. Go to **Settings** → **Environment Variables**
4. Find the variable named **`POSTGRES_URL`** (NOT `PRISMA_DATABASE_URL`)
5. Click on it and copy the full value

It should look like:
```
postgres://default:xxx@xxx-pooler.us-east-1.postgres.vercel-storage.com/verceldb
```

### Step 2: Run the Setup Script

Open your terminal in this directory and run:

```bash
DATABASE_URL="paste_your_postgres_url_here" ./setup-prod.sh
```

**Example:**
```bash
DATABASE_URL="postgres://default:abc123@ep-xxx.us-east-1.postgres.vercel-storage.com/verceldb" ./setup-prod.sh
```

### Step 3: Verify It Works

1. Go to your Vercel deployment URL
2. You should see the homepage working
3. Click "Integrity Dashboard" to see the admin panel
4. Visit `/viewer` to see your test snapshot
5. Click "View" on the snapshot to see the financial model

---

## What This Script Does

1. **Pushes your Prisma schema** to the production database (creates all tables)
2. **Adds sample data:**
   - 1 test project
   - 1 test entity (Samsung Electronics)
   - 1 model snapshot
   - Sample Income Statement, Balance Sheet, and Cash Flow data
   - Viewer sheets

---

## Troubleshooting

### Error: "DATABASE_URL environment variable is not set"

Make sure you're including `DATABASE_URL=` before the command:
```bash
DATABASE_URL="your_url" ./setup-prod.sh
```

### Error: "Permission denied"

Make the script executable:
```bash
chmod +x setup-prod.sh
```

### Error: "tsx: command not found"

Install tsx:
```bash
npm install -g tsx
```

Or use:
```bash
npx tsx setup-production-db.ts
```

### Error: "Prisma Client validation error"

Generate Prisma client first:
```bash
npx prisma generate
```

---

## Alternative: Manual Setup

If the script doesn't work, you can run the commands manually:

```bash
# 1. Set your database URL
export DATABASE_URL="your_postgres_url_here"

# 2. Push the schema
npx prisma db push --accept-data-loss

# 3. Add sample data
npx tsx setup-production-db.ts
```

---

## Next Steps After Setup

Once your database is set up with sample data, you can:

1. **Add real data** by running the OpenDART ingestion scripts
2. **Create more snapshots** using the modeling engine
3. **Customize the sample data** by editing `setup-production-db.ts`

---

## Need Help?

If you encounter any issues, check:
- The Vercel deployment logs (Deployments → click on deployment → Runtime Logs)
- Your Prisma schema is up to date
- The DATABASE_URL is correct (try connecting with psql or another tool)
