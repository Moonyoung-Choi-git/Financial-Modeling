/**
 * Simple 3-Statement Model Builder (MVP)
 *
 * MVP Scope:
 * - Historical data only (from Curated Facts)
 * - Basic IS/BS/CF structure
 * - Simple forecast (flat projection from last historical)
 * - Basic checks (BS Balance, CF Tie-out)
 *
 * Full forecast engine는 Phase 3.5로 연기
 */

import { Decimal } from '@prisma/client/runtime/library';
import {
  ModelTimeline,
  Statement,
  StatementLine,
  ModelChecks,
  ModelSnapshotOutput,
} from './model-types';
import { loadHistoricalFacts, getHistoricalValue } from './historical-loader';
import { buildTimeline } from './timeline-builder';
import prisma from '../db';
import { createHash } from 'crypto';

// ============================================================================
// Main Builder Function
// ============================================================================

export interface SimpleModelInput {
  entityId: string;
  baseYear: number; // 가장 최근 historical 연도
  historicalYears: number; // 5
  forecastYears: number; // 5
}

export async function buildSimpleModel(
  input: SimpleModelInput
): Promise<ModelSnapshotOutput> {
  const { entityId, baseYear, historicalYears, forecastYears } = input;

  console.log('[SimpleBuilder] Building model for', entityId);
  console.log(
    `[SimpleBuilder] Timeline: ${historicalYears} historical + ${forecastYears} forecast years`
  );

  // 1. Build timeline
  const timeline = buildTimeline({
    baseYear,
    historicalYears,
    forecastYears,
    periodType: 'ANNUAL',
  });

  console.log(`[SimpleBuilder] Created timeline with ${timeline.periods.length} periods`);

  // 2. Load historical facts
  const historicalFacts = await loadHistoricalFacts(entityId, timeline.periods);

  console.log(`[SimpleBuilder] Loaded ${historicalFacts.size} historical line items`);

  // 3. Build statements
  const incomeStatement = buildIncomeStatement(timeline, historicalFacts);
  const balanceSheet = buildBalanceSheet(timeline, historicalFacts);
  const cashFlowStatement = buildCashFlowStatement(timeline, historicalFacts);

  // 4. Run checks
  const checks = runModelChecks(balanceSheet, cashFlowStatement, timeline);

  // 5. Get metadata
  const entity = await prisma.modelEntity.findUnique({
    where: { id: entityId },
  });

  const usedRceptNoList: string[] = []; // TODO: Track from curated facts

  const snapshotHash = generateSnapshotHash({
    entityId,
    baseYear,
    historicalYears,
    forecastYears,
    dataHash: Array.from(historicalFacts.keys()).join(','),
  });

  const snapshotId = `snapshot-${Date.now()}-${snapshotHash.slice(0, 8)}`;

  return {
    snapshotId,
    incomeStatement,
    balanceSheet,
    cashFlowStatement,
    checks,
    metadata: {
      createdAt: new Date(),
      calcEngineVersion: '0.1.0-mvp',
      usedRceptNoList,
      snapshotHash,
    },
  };
}

// ============================================================================
// Statement Builders
// ============================================================================

/**
 * Build Income Statement (MVP)
 */
function buildIncomeStatement(
  timeline: ModelTimeline,
  historicalFacts: Map<string, Map<number, Decimal>>
): Statement {
  const lines: StatementLine[] = [];

  // IS lines from Standard COA (명세서 부록 B)
  const isLineIds = [
    'IS.REVENUE',
    'IS.COGS',
    'IS.GROSS_PROFIT',
    'IS.SGA',
    'IS.DA',
    'IS.EBIT',
    'IS.INTEREST_EXPENSE',
    'IS.EBT',
    'IS.TAXES',
    'IS.NET_INCOME',
  ];

  let displayOrder = 0;

  for (const lineId of isLineIds) {
    const values = new Map<number, Decimal>();

    for (const period of timeline.periods) {
      if (period.isHistorical) {
        // Historical: get from facts
        const historicalValue = getHistoricalValue(historicalFacts, lineId, period.index);
        if (historicalValue) {
          values.set(period.index, historicalValue);
        }
      } else {
        // Forecast: MVP - flat projection from last historical
        const lastHistoricalIndex = timeline.historicalCount - 1;
        const lastValue = values.get(lastHistoricalIndex);
        if (lastValue) {
          values.set(period.index, lastValue); // Simple: repeat last value
        }
      }
    }

    lines.push({
      lineId,
      displayName: getLineDisplayName(lineId),
      statementType: 'IS',
      values,
      unit: 'KRW',
      displayOrder: displayOrder++,
      provenance: 'SOURCE',
    });
  }

  return {
    statementType: 'IS',
    lines,
    timeline,
  };
}

/**
 * Build Balance Sheet (MVP)
 */
function buildBalanceSheet(
  timeline: ModelTimeline,
  historicalFacts: Map<string, Map<number, Decimal>>
): Statement {
  const lines: StatementLine[] = [];

  // BS lines from Standard COA
  const bsLineIds = [
    // Assets
    'BS.CASH',
    'BS.AR',
    'BS.INVENTORY',
    'BS.OTHER_CA',
    'BS.TOTAL_CA',
    'BS.PPE_NET',
    'BS.INTANGIBLES',
    'BS.OTHER_NCA',
    'BS.TOTAL_ASSETS',
    // Liabilities
    'BS.AP',
    'BS.OTHER_CL',
    'BS.SHORT_DEBT',
    'BS.TOTAL_CL',
    'BS.LONG_DEBT',
    'BS.OTHER_NCL',
    'BS.TOTAL_LIABILITIES',
    // Equity
    'BS.COMMON_STOCK',
    'BS.RETAINED_EARNINGS',
    'BS.TOTAL_EQUITY',
  ];

  let displayOrder = 0;

  for (const lineId of bsLineIds) {
    const values = new Map<number, Decimal>();

    for (const period of timeline.periods) {
      if (period.isHistorical) {
        const historicalValue = getHistoricalValue(historicalFacts, lineId, period.index);
        if (historicalValue) {
          values.set(period.index, historicalValue);
        }
      } else {
        // Forecast: MVP - flat projection
        const lastHistoricalIndex = timeline.historicalCount - 1;
        const lastValue = values.get(lastHistoricalIndex);
        if (lastValue) {
          values.set(period.index, lastValue);
        }
      }
    }

    lines.push({
      lineId,
      displayName: getLineDisplayName(lineId),
      statementType: 'BS',
      values,
      unit: 'KRW',
      displayOrder: displayOrder++,
      provenance: 'SOURCE',
    });
  }

  return {
    statementType: 'BS',
    lines,
    timeline,
  };
}

/**
 * Build Cash Flow Statement (MVP)
 */
function buildCashFlowStatement(
  timeline: ModelTimeline,
  historicalFacts: Map<string, Map<number, Decimal>>
): Statement {
  const lines: StatementLine[] = [];

  // CF lines from Standard COA
  const cfLineIds = [
    'CF.CFO',
    'CF.CFI',
    'CF.CFF',
    'CF.NET_CHANGE',
    'CF.BEGIN_CASH',
    'CF.END_CASH',
  ];

  let displayOrder = 0;

  for (const lineId of cfLineIds) {
    const values = new Map<number, Decimal>();

    for (const period of timeline.periods) {
      if (period.isHistorical) {
        const historicalValue = getHistoricalValue(historicalFacts, lineId, period.index);
        if (historicalValue) {
          values.set(period.index, historicalValue);
        }
      } else {
        // Forecast: MVP - flat projection
        const lastHistoricalIndex = timeline.historicalCount - 1;
        const lastValue = values.get(lastHistoricalIndex);
        if (lastValue) {
          values.set(period.index, lastValue);
        }
      }
    }

    lines.push({
      lineId,
      displayName: getLineDisplayName(lineId),
      statementType: 'CF',
      values,
      unit: 'KRW',
      displayOrder: displayOrder++,
      provenance: 'SOURCE',
    });
  }

  return {
    statementType: 'CF',
    lines,
    timeline,
  };
}

// ============================================================================
// Model Checks (명세서 Section 5.2)
// ============================================================================

function runModelChecks(
  balanceSheet: Statement,
  cashFlowStatement: Statement,
  timeline: ModelTimeline
): ModelChecks {
  const tolerance = new Decimal(1); // 1원 이내 허용

  // BS Balance Check: Assets = Liabilities + Equity
  let bsCheckPassed = true;
  let maxBsError = new Decimal(0);

  const totalAssets = balanceSheet.lines.find((l) => l.lineId === 'BS.TOTAL_ASSETS');
  const totalLiabilities = balanceSheet.lines.find((l) => l.lineId === 'BS.TOTAL_LIABILITIES');
  const totalEquity = balanceSheet.lines.find((l) => l.lineId === 'BS.TOTAL_EQUITY');

  if (totalAssets && totalLiabilities && totalEquity) {
    for (const period of timeline.periods) {
      const assets = totalAssets.values.get(period.index) || new Decimal(0);
      const liabilities = totalLiabilities.values.get(period.index) || new Decimal(0);
      const equity = totalEquity.values.get(period.index) || new Decimal(0);

      const error = assets.minus(liabilities.plus(equity)).abs();

      if (error.gt(tolerance)) {
        bsCheckPassed = false;
      }

      if (error.gt(maxBsError)) {
        maxBsError = error;
      }
    }
  }

  // CF Tie-out: Ending Cash = Beginning Cash + Net Change
  let cfCheckPassed = true;
  let maxCfError = new Decimal(0);

  const netChange = cashFlowStatement.lines.find((l) => l.lineId === 'CF.NET_CHANGE');
  const beginCash = cashFlowStatement.lines.find((l) => l.lineId === 'CF.BEGIN_CASH');
  const endCash = cashFlowStatement.lines.find((l) => l.lineId === 'CF.END_CASH');

  if (netChange && beginCash && endCash) {
    for (const period of timeline.periods) {
      const nc = netChange.values.get(period.index) || new Decimal(0);
      const bc = beginCash.values.get(period.index) || new Decimal(0);
      const ec = endCash.values.get(period.index) || new Decimal(0);

      const expected = bc.plus(nc);
      const error = ec.minus(expected).abs();

      if (error.gt(tolerance)) {
        cfCheckPassed = false;
      }

      if (error.gt(maxCfError)) {
        maxCfError = error;
      }
    }
  }

  return {
    bsBalanceCheck: {
      passed: bsCheckPassed,
      error: maxBsError,
      tolerance,
    },
    cfTieOut: {
      passed: cfCheckPassed,
      error: maxCfError,
      tolerance,
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getLineDisplayName(lineId: string): string {
  // Simple mapping (실제로는 DB에서 조회)
  const mapping: Record<string, string> = {
    'IS.REVENUE': 'Revenue',
    'IS.COGS': 'Cost of Goods Sold',
    'IS.GROSS_PROFIT': 'Gross Profit',
    'IS.SGA': 'SG&A',
    'IS.DA': 'Depreciation & Amortization',
    'IS.EBIT': 'EBIT',
    'IS.INTEREST_EXPENSE': 'Interest Expense',
    'IS.EBT': 'EBT',
    'IS.TAXES': 'Income Tax Expense',
    'IS.NET_INCOME': 'Net Income',

    'BS.CASH': 'Cash & Cash Equivalents',
    'BS.AR': 'Accounts Receivable',
    'BS.INVENTORY': 'Inventory',
    'BS.OTHER_CA': 'Other Current Assets',
    'BS.TOTAL_CA': 'Total Current Assets',
    'BS.PPE_NET': 'PP&E (Net)',
    'BS.INTANGIBLES': 'Intangible Assets',
    'BS.OTHER_NCA': 'Other Non-Current Assets',
    'BS.TOTAL_ASSETS': 'Total Assets',
    'BS.AP': 'Accounts Payable',
    'BS.OTHER_CL': 'Other Current Liabilities',
    'BS.SHORT_DEBT': 'Short-term Debt',
    'BS.TOTAL_CL': 'Total Current Liabilities',
    'BS.LONG_DEBT': 'Long-term Debt',
    'BS.OTHER_NCL': 'Other Non-Current Liabilities',
    'BS.TOTAL_LIABILITIES': 'Total Liabilities',
    'BS.COMMON_STOCK': 'Common Stock',
    'BS.RETAINED_EARNINGS': 'Retained Earnings',
    'BS.TOTAL_EQUITY': 'Total Equity',

    'CF.CFO': 'Cash Flow from Operations',
    'CF.CFI': 'Cash Flow from Investing',
    'CF.CFF': 'Cash Flow from Financing',
    'CF.NET_CHANGE': 'Net Change in Cash',
    'CF.BEGIN_CASH': 'Beginning Cash',
    'CF.END_CASH': 'Ending Cash',
  };

  return mapping[lineId] || lineId;
}

function generateSnapshotHash(data: any): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify(data));
  return hash.digest('hex');
}
