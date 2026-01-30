# ⚠️ CRITICAL: Schema-Code Mismatch

**Date**: 2026-01-30
**Severity**: HIGH
**Status**: Partially Fixed

---

## Summary

There is a **major architectural mismatch** between your Prisma schema and the application code. Multiple files reference Prisma models that **do not exist** in [schema.prisma](../schema.prisma).

---

## Fixed Models (Immediate Errors)

| Old Reference | Correct Model | Fixed In | Status |
|---------------|---------------|----------|---------|
| `prisma.financialAccount` | `prisma.curatedFinFact` | [lib/modeling/builder.ts](../lib/modeling/builder.ts) | ✅ Fixed |
| `prisma.corpCode` | `prisma.rawDartCorpMaster` | [lib/corp-code.ts](../lib/corp-code.ts) | ✅ Fixed |
| `prisma.corpCode` | `prisma.rawDartCorpMaster` | [lib/ingestion.ts](../lib/ingestion.ts:141) | ✅ Fixed |

---

## Remaining Schema Mismatches

### Files with Non-Existent Models

#### 1. [lib/ingestion.ts](../lib/ingestion.ts)

**Referenced Models (DO NOT EXIST):**
```typescript
prisma.fetchJob          // Line 14, 31, 34, 91, 103
prisma.sourceRawArchive  // Line 51
prisma.dataIntegrityLog  // Line 65
prisma.sourceRawMetaIndex // Line 78
prisma.dlqRecord         // Line 113
```

**Should Use (ACTUAL SCHEMA):**
```typescript
// For API calls and tracking:
prisma.rawDartApiCall
prisma.rawDartPayloadJson
prisma.rawDartPayloadBinary

// For corp codes:
prisma.rawDartCorpMaster ✅ Fixed at line 141

// For filings:
prisma.rawDartFiling

// For financial data:
prisma.rawDartFnlttAllRow
prisma.rawDartFnlttKeyRow
```

#### 2. [lib/refinement.ts](../lib/refinement.ts)

**Referenced Models (DO NOT EXIST):**
```typescript
prisma.sourceRawArchive    // Line 19
prisma.accountMappingRule  // Line 52
prisma.standardAccount     // Line 55
prisma.financialAccount    // Line 111, 115
```

**Should Use (ACTUAL SCHEMA):**
```typescript
prisma.rawDartApiCall           // For raw data source
prisma.rawDartPayloadJson       // For JSON payloads
prisma.curatedFinStandardCoa    // For standard chart of accounts
prisma.curatedFinAccountMapping // For mapping rules
prisma.curatedFinFact          // For refined financial data
```

#### 3. [app/api/raw/[id]/route.ts](../app/api/raw/[id]/route.ts)

**Referenced Models:** `sourceRawArchive`
**Should Use:** `rawDartApiCall` or `rawDartPayloadJson`

#### 4. [app/api/admin/integrity/summary/route.ts](../app/api/admin/integrity/summary/route.ts)

**Referenced Models:** `sourceRawArchive`
**Should Use:** `rawDartApiCall`

#### 5. [app/admin/raw/[id]/page.tsx](../app/admin/raw/[id]/page.tsx)

**Referenced Models:** `sourceRawArchive`
**Should Use:** `rawDartApiCall` or `rawDartPayloadJson`

---

## Impact Assessment

### What Works Now ✅

After the fixes applied today:
- **Data Display**: Income Statement, Balance Sheet, Cash Flow tabs display correctly
- **Builder**: `buildThreeStatementModel()` queries correct table
- **Corp Code Sync**: `syncCorpCodes()` uses correct model

### What Will Still Fail ❌

- **Auto-Ingestion**: `triggerAutoIngestion()` will fail when trying to save data
  - Calls `processIngestionTask()` which uses non-existent tables
  - Impact: Cannot automatically fetch missing data from DART API

- **Data Refinement**: `refineFinancialData()` will fail
  - Uses `sourceRawArchive`, `accountMappingRule`, `standardAccount`
  - Impact: Cannot process raw DART data into curated format

- **Admin Pages**: Admin interfaces for viewing raw data will fail
  - Impact: Cannot use admin UI to inspect ingested data

---

## Root Cause Analysis

### Two Schema Versions Detected

**Version 1 (Code)**: Legacy schema with tables like:
- `fetchJob`
- `sourceRawArchive`
- `dataIntegrityLog`
- `sourceRawMetaIndex`
- `accountMappingRule`
- `standardAccount`
- `financialAccount`
- `corpCode`

**Version 2 (Schema File)**: Current schema.prisma with tables like:
- `RawDartApiCall`
- `RawDartPayloadJson`
- `RawDartCorpMaster`
- `CuratedFinFact`
- `CuratedFinStandardCoa`
- `CuratedFinAccountMapping`

**Hypothesis**: The codebase was written for an older schema, then schema.prisma was redesigned without updating the code.

---

## Recommended Action Plan

### Phase 1: Immediate Workaround (Current Status)

✅ Fixed critical model references preventing page load
✅ Fixed data display in UI

### Phase 2: Disable Broken Features (Temporary)

To prevent runtime errors, consider disabling auto-ingestion temporarily:

```typescript
// In app/financials/[ticker]/page.tsx
// Comment out auto-ingestion until schema is aligned:

// if (isEmptyModel) {
//   try {
//     const ingested = await triggerAutoIngestion(ticker, years);
//     ...
//   } catch (retryError: any) {
//     ...
//   }
// }
```

### Phase 3: Full Schema Alignment (Required)

Choose ONE approach:

#### Option A: Update Code to Match Current Schema ⭐ RECOMMENDED

Refactor these files to use the current schema:
1. [lib/ingestion.ts](../lib/ingestion.ts) - Rewrite to use `RawDartApiCall`, `RawDartPayloadJson`
2. [lib/refinement.ts](../lib/refinement.ts) - Rewrite to use `CuratedFinAccountMapping`, `CuratedFinFact`
3. Update all admin pages and API routes

**Pros**:
- Schema.prisma appears well-designed with proper namespacing
- Matches specification v1.0 (2026-01-30)

**Cons**:
- Significant refactoring effort
- Need to understand new schema architecture

#### Option B: Rollback Schema to Match Code

Revert schema.prisma to include the old tables and update database.

**Pros**:
- Code works immediately

**Cons**:
- Lose new schema design
- May not match project requirements

---

## Immediate Next Steps

1. **Test Current Fixes**:
   ```bash
   rm -rf .next
   npm run dev
   ```
   Navigate to: `http://localhost:3000/financials/005930`
   - ✅ Should display without "Cannot read properties of undefined" errors
   - ✅ Data should show in all three tabs

2. **Avoid Auto-Ingestion**:
   - Only view existing data in database
   - Don't trigger data fetching for new tickers/years

3. **Plan Refactoring**:
   - Review current schema design
   - Decide on Option A (update code) vs Option B (revert schema)
   - Schedule refactoring work for ingestion/refinement layers

---

## Database Schema Reference

Current models in [schema.prisma](../schema.prisma):

**Raw DART Layer:**
- `RawDartApiCall`
- `RawDartPayloadJson`
- `RawDartPayloadBinary`
- `RawDartCorpMaster` ✅ Used correctly now
- `RawDartFiling`
- `RawDartFnlttAllRow`
- `RawDartFnlttKeyRow`

**Curated Finance Layer:**
- `CuratedFinStandardCoa`
- `CuratedFinAccountMapping`
- `CuratedFinFact` ✅ Used correctly now
- `CuratedFinRestatementTracker`

**Model Layer:**
- `ModelProject`
- `ModelEntity`
- `ModelAssumptionSet`
- `ModelSnapshot`
- `ModelOutputLine`
- `ModelSupportScheduleOutput`
- `ModelViewerSheet`

**Security/Audit:**
- `User`
- `AuditLog`

---

**Last Updated**: 2026-01-30
**Priority**: HIGH - Blocking auto-ingestion functionality
