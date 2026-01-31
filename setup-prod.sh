#!/bin/bash

echo "🚀 Production Database Setup"
echo "=============================="
echo ""
echo "This script will:"
echo "1. Push your Prisma schema to the production database"
echo "2. Add sample data for testing"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo ""
    echo "Please run this script with your Vercel POSTGRES_URL:"
    echo ""
    echo "  DATABASE_URL=\"your_postgres_url_here\" ./setup-prod.sh"
    echo ""
    echo "You can find your POSTGRES_URL in:"
    echo "  Vercel Dashboard → Settings → Environment Variables → POSTGRES_URL"
    echo ""
    exit 1
fi

echo "✓ Database URL is set"
echo ""

# Step 1: Push schema
echo "[Step 1/2] Pushing Prisma schema to production database..."
npx prisma db push --accept-data-loss

if [ $? -ne 0 ]; then
    echo "❌ Failed to push schema"
    exit 1
fi

echo "✓ Schema pushed successfully"
echo ""

# Step 2: Run setup script
echo "[Step 2/2] Adding sample data..."
npx tsx setup-production-db.ts

if [ $? -ne 0 ]; then
    echo "❌ Failed to add sample data"
    exit 1
fi

echo ""
echo "✅ Setup complete! Your production database is ready."
echo ""
echo "Next steps:"
echo "1. Go to your Vercel deployment"
echo "2. Visit the homepage"
echo "3. Navigate to /viewer to see your test snapshot"
echo ""
