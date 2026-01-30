/**
 * 3-Statement Modeling Types
 * Based on Specification Section 5
 */

import { Decimal } from '@prisma/client/runtime/library';

// ============================================================================
// Period & Timeline (명세서 Section 5.1)
// ============================================================================

/**
 * Period Index: 통일된 기간 인덱스
 * 0부터 시작, Historical은 음수도 가능
 * 예: -4, -3, -2, -1, 0(현재), 1, 2, 3, 4, 5
 */
export interface Period {
  index: number; // Period index
  fiscalYear: number;
  fiscalQuarter: number | null; // 1~4 or null (연간)
  periodType: 'ANNUAL' | 'QUARTER';
  isHistorical: boolean; // true면 실적, false면 예측
  label: string; // "FY2023", "Q1 2024"
}

/**
 * Model Timeline: 전체 기간 구성
 */
export interface ModelTimeline {
  periods: Period[];
  historicalCount: number; // Historical 기간 수
  forecastCount: number; // Forecast 기간 수
  baseYear: number; // 기준 연도
}

// ============================================================================
// Statement Lines (명세서 Section 5.2-5.5)
// ============================================================================

/**
 * Statement Line: IS/BS/CF의 각 라인
 */
export interface StatementLine {
  lineId: string; // IS.REVENUE, BS.CASH, CF.CFO 등
  displayName: string;
  statementType: 'IS' | 'BS' | 'CF';
  values: Map<number, Decimal>; // periodIndex → value
  unit: string; // KRW, 백만원 등
  displayOrder: number;
  provenance: 'SOURCE' | 'DERIVED' | 'PLUG'; // 출처
  calcMethod?: string; // 계산 방법 설명
}

/**
 * Statement: 재무제표 (IS/BS/CF)
 */
export interface Statement {
  statementType: 'IS' | 'BS' | 'CF';
  lines: StatementLine[];
  timeline: ModelTimeline;
}

// ============================================================================
// Assumptions (명세서 Section 5.3-5.4)
// ============================================================================

/**
 * Revenue Assumptions (명세서 Section 5.3)
 */
export interface RevenueAssumptions {
  method: 'GROWTH_RATE' | 'PRICE_VOLUME' | 'SEGMENT';

  // Growth Rate method
  growthRates?: Map<number, number>; // periodIndex → growth rate (0.05 = 5%)

  // Price × Volume method
  priceGrowth?: Map<number, number>;
  volumeGrowth?: Map<number, number>;

  // Segment method (향후 확장)
  segmentForecasts?: any;
}

/**
 * Cost Assumptions (명세서 Section 5.3)
 */
export interface CostAssumptions {
  cogs: {
    method: 'PERCENT_OF_REVENUE' | 'FIXED_PLUS_VARIABLE';
    percentOfRevenue?: Map<number, number>; // periodIndex → %
    fixedCost?: Decimal;
    variablePercent?: number;
  };

  sga: {
    method: 'PERCENT_OF_REVENUE' | 'ABSOLUTE';
    percentOfRevenue?: Map<number, number>;
    absoluteAmount?: Map<number, Decimal>;
  };
}

/**
 * Working Capital Assumptions (명세서 Section 5.4.1)
 */
export interface WorkingCapitalAssumptions {
  ar: {
    method: 'DSO' | 'PERCENT_OF_REVENUE';
    dso?: number; // Days Sales Outstanding
    percentOfRevenue?: number;
  };

  inventory: {
    method: 'DIO' | 'PERCENT_OF_COGS';
    dio?: number; // Days Inventory Outstanding
    percentOfCogs?: number;
  };

  ap: {
    method: 'DPO' | 'PERCENT_OF_COGS';
    dpo?: number; // Days Payable Outstanding
    percentOfCogs?: number;
  };
}

/**
 * Capex & Depreciation Assumptions (명세서 Section 5.4.2)
 */
export interface CapexAssumptions {
  method: 'PERCENT_OF_REVENUE' | 'ABSOLUTE' | 'GROWTH_LINKED';
  percentOfRevenue?: number;
  absoluteAmount?: Map<number, Decimal>;
  depreciationRate?: number; // 감가상각률 (예: 0.1 = 10년 내용연수)
}

/**
 * Debt Assumptions (명세서 Section 5.4.4)
 */
export interface DebtAssumptions {
  interestRate: number; // 0.05 = 5%
  minimumCash: Decimal; // 최소 현금 보유액
  cashSweepEnabled: boolean; // 잉여현금 부채 상환 여부
}

/**
 * Tax Assumptions (명세서 Section 5.3)
 */
export interface TaxAssumptions {
  effectiveTaxRate: number; // 0.22 = 22%
}

/**
 * Dividend Assumptions (명세서 Section 5.4.6)
 */
export interface DividendAssumptions {
  method: 'PAYOUT_RATIO' | 'ABSOLUTE';
  payoutRatio?: number; // 0.3 = 30%
  absoluteAmount?: Map<number, Decimal>;
}

/**
 * Model Assumptions: 전체 가정
 */
export interface ModelAssumptions {
  scenarioName: string; // Base, Bull, Bear
  revenue: RevenueAssumptions;
  costs: CostAssumptions;
  workingCapital: WorkingCapitalAssumptions;
  capex: CapexAssumptions;
  debt: DebtAssumptions;
  tax: TaxAssumptions;
  dividend: DividendAssumptions;
}

// ============================================================================
// Model Output (명세서 Section 3.4)
// ============================================================================

/**
 * Model Snapshot Input
 */
export interface ModelSnapshotInput {
  entityId: string;
  assumptionSetId?: string;
  timeline: ModelTimeline;
  assumptions: ModelAssumptions;
}

/**
 * Model Snapshot Output
 */
export interface ModelSnapshotOutput {
  snapshotId: string;
  incomeStatement: Statement;
  balanceSheet: Statement;
  cashFlowStatement: Statement;
  checks: ModelChecks;
  metadata: {
    createdAt: Date;
    calcEngineVersion: string;
    usedRceptNoList: string[];
    snapshotHash: string;
  };
}

/**
 * Model Checks (명세서 Section 5.2)
 */
export interface ModelChecks {
  bsBalanceCheck: {
    passed: boolean;
    error: Decimal; // Assets - (Liabilities + Equity)
    tolerance: Decimal;
  };

  cfTieOut: {
    passed: boolean;
    error: Decimal; // Ending Cash - (Beginning Cash + Net Change)
    tolerance: Decimal;
  };

  circularConvergence?: {
    converged: boolean;
    iterations: number;
    finalError: Decimal;
  };
}

// ============================================================================
// Builder Context (내부 사용)
// ============================================================================

/**
 * Model Builder Context: 모델 빌드 중 공유되는 컨텍스트
 */
export interface ModelBuilderContext {
  entityId: string;
  timeline: ModelTimeline;
  assumptions: ModelAssumptions;

  // Curated historical data
  historicalFacts: Map<string, Map<number, Decimal>>; // lineId → periodIndex → value

  // Calculated values (중간 계산 결과)
  calculated: {
    is: Map<string, Map<number, Decimal>>; // IS lines
    bs: Map<string, Map<number, Decimal>>; // BS lines
    cf: Map<string, Map<number, Decimal>>; // CF lines
    schedules: Map<string, any>; // Supporting schedules
  };
}
