# Prisma Error Prevention Guide

## Issue Summary

**Error**: `Cannot read properties of undefined (reading 'findMany'/'aggregate')`

**Root Cause**: Prisma Client was not being properly bundled/initialized in Next.js runtime due to:
1. Turbopack/Webpack bundling conflicts
2. Module resolution timing issues during HMR (Hot Module Replacement)
3. Missing serverExternalPackages configuration

---

## Solutions Implemented

### 1. Next.js Configuration ([next.config.ts](../next.config.ts))

Added Prisma to external packages to prevent bundling issues:

```typescript
const nextConfig: NextConfig = {
  // Prevent Prisma from being bundled
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('@prisma/client');
    }
    return config;
  },
  serverExternalPackages: ['@prisma/client', 'prisma'],
};
```

### 2. Enhanced Prisma Client Initialization ([lib/db.ts](../lib/db.ts))

- Added validation to ensure Prisma client is initialized
- Improved logging configuration for development
- Changed global variable name to avoid conflicts (`__prisma` instead of `prisma`)

### 3. Defensive Programming ([app/financials/[ticker]/page.tsx](../app/financials/[ticker]/page.tsx))

- Added null check before using Prisma
- Provides clear error message if Prisma fails to initialize

---

## Preventive Checklist

### After Schema Changes
- [ ] Run `npx prisma generate` to regenerate client types
- [ ] Run `npx prisma db push` or `npx prisma migrate dev` to sync database
- [ ] Restart Next.js dev server (`npm run dev`)

### After Environment Changes
- [ ] Verify `DATABASE_URL` in `.env` file
- [ ] Test database connection: `npx prisma db execute --schema=schema.prisma --stdin <<< "SELECT 1"`
- [ ] Restart Next.js dev server

### Development Best Practices
1. **Always regenerate Prisma client after schema changes**:
   ```bash
   npx prisma generate
   ```

2. **Check Prisma client is generated**:
   ```bash
   ls -la node_modules/.prisma/client
   ```

3. **Validate DATABASE_URL format**:
   ```
   postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA
   ```

4. **Clear Next.js cache if issues persist**:
   ```bash
   rm -rf .next
   npm run dev
   ```

5. **Use consistent import path**:
   ```typescript
   import prisma from '@/lib/db';  // ✅ Correct
   import { PrismaClient } from '@prisma/client';  // ❌ Don't instantiate directly
   ```

---

## Monitoring & Debugging

### Check if Prisma is working
Create a test file and run:

```typescript
import prisma from './lib/db';

async function test() {
  const result = await prisma.curatedFinFact.findFirst();
  console.log('Success:', result);
}

test();
```

Run: `npx tsx test.ts`

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `Cannot read properties of undefined` | Prisma not initialized | Check next.config.ts, regenerate client |
| `PrismaClient is unable to run in this browser environment` | Wrong runtime | Use Node.js runtime, not Edge |
| `Can't reach database server` | DATABASE_URL wrong | Check .env file |
| `prisma.xxx is not a function` | Client not generated | Run `npx prisma generate` |

---

## Emergency Recovery Steps

If Prisma errors persist:

1. **Stop dev server**
   ```bash
   pkill -f "next dev"
   ```

2. **Clean everything**
   ```bash
   rm -rf node_modules/.prisma
   rm -rf .next
   ```

3. **Reinstall and regenerate**
   ```bash
   npm install
   npx prisma generate
   ```

4. **Restart dev server**
   ```bash
   npm run dev
   ```

---

## Related Files

- [next.config.ts](../next.config.ts) - Prisma external packages config
- [lib/db.ts](../lib/db.ts) - Prisma client singleton
- [schema.prisma](../schema.prisma) - Database schema
- [.env]../.env) - Environment variables (DATABASE_URL)

---

**Last Updated**: 2026-01-30
**Maintainer**: Development Team
