/**
 * Historical Data Loader
 * Curated Facts → Statement Lines (Historical)
 */

import prisma from '../db';
import { Decimal } from '@prisma/client/runtime/library';
import { Period } from './model-types';

// ============================================================================
// Historical Data Loading
// ============================================================================

/**
 * Load historical facts from curated_fin_facts
 * Returns: Map<standardLineId, Map<periodIndex, value>>
 */
export async function loadHistoricalFacts(
  entityId: string,
  periods: Period[]
): Promise<Map<string, Map<number, Decimal>>> {
  console.log(`[HistoricalLoader] Loading facts for ${entityId}, ${periods.length} periods`);

  // Filter historical periods only
  const historicalPeriods = periods.filter((p) => p.isHistorical);

  if (historicalPeriods.length === 0) {
    console.warn('[HistoricalLoader] No historical periods found');
    return new Map();
  }

  // Extract fiscal years
  const fiscalYears = [...new Set(historicalPeriods.map((p) => p.fiscalYear))];

  // Query curated facts
  const facts = await prisma.curatedFinFact.findMany({
    where: {
      entityId,
      fiscalYear: {
        in: fiscalYears,
      },
      standardLineId: {
        not: null, // Only mapped accounts
      },
      periodType: 'ANNUAL', // MVP: 연간만 지원
    },
    orderBy: [{ fiscalYear: 'asc' }, { ordering: 'asc' }],
  });

  console.log(`[HistoricalLoader] Found ${facts.length} curated facts`);

  // Build period lookup: fiscalYear → periodIndex
  const periodLookup = new Map<number, number>();
  for (const period of historicalPeriods) {
    if (period.periodType === 'ANNUAL') {
      periodLookup.set(period.fiscalYear, period.index);
    }
  }

  // Organize by standardLineId → periodIndex → value
  const result = new Map<string, Map<number, Decimal>>();

  for (const fact of facts) {
    if (!fact.standardLineId) continue;

    const periodIndex = periodLookup.get(fact.fiscalYear);
    if (periodIndex === undefined) continue;

    if (!result.has(fact.standardLineId)) {
      result.set(fact.standardLineId, new Map());
    }

    const lineValues = result.get(fact.standardLineId)!;
    lineValues.set(periodIndex, new Decimal(fact.amount));
  }

  console.log(`[HistoricalLoader] Loaded ${result.size} unique line items`);

  return result;
}

/**
 * Get historical value for a specific line and period
 */
export function getHistoricalValue(
  historicalFacts: Map<string, Map<number, Decimal>>,
  lineId: string,
  periodIndex: number
): Decimal | null {
  const lineValues = historicalFacts.get(lineId);
  if (!lineValues) return null;

  return lineValues.get(periodIndex) || null;
}

/**
 * Check if a line has historical data
 */
export function hasHistoricalData(
  historicalFacts: Map<string, Map<number, Decimal>>,
  lineId: string
): boolean {
  const lineValues = historicalFacts.get(lineId);
  return lineValues !== undefined && lineValues.size > 0;
}

/**
 * Get all available line IDs with historical data
 */
export function getAvailableLineIds(
  historicalFacts: Map<string, Map<number, Decimal>>
): string[] {
  return Array.from(historicalFacts.keys());
}

/**
 * Get historical coverage summary
 */
export function getHistoricalCoverageSummary(
  historicalFacts: Map<string, Map<number, Decimal>>,
  periods: Period[]
): {
  totalLines: number;
  byStatement: Record<string, number>;
  coverageByPeriod: Map<number, number>; // periodIndex → line count
} {
  const historicalPeriods = periods.filter((p) => p.isHistorical);
  const byStatement: Record<string, number> = {};
  const coverageByPeriod = new Map<number, number>();

  // Initialize
  for (const period of historicalPeriods) {
    coverageByPeriod.set(period.index, 0);
  }

  // Count
  for (const [lineId, lineValues] of historicalFacts.entries()) {
    // Extract statement type from lineId (IS.REVENUE → IS)
    const statementType = lineId.split('.')[0];
    byStatement[statementType] = (byStatement[statementType] || 0) + 1;

    // Count coverage by period
    for (const [periodIndex] of lineValues.entries()) {
      const current = coverageByPeriod.get(periodIndex) || 0;
      coverageByPeriod.set(periodIndex, current + 1);
    }
  }

  return {
    totalLines: historicalFacts.size,
    byStatement,
    coverageByPeriod,
  };
}
