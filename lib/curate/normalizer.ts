/**
 * Data Normalization Module (명세서 Section 4.1 - 공통 정규화)
 *
 * Key Functions:
 * - 숫자 파싱: "9,999,999,999" → NUMERIC
 * - null/빈문자 처리
 * - 기간 구분: BS(시점) vs IS/CF(기간)
 * - 분/반기 처리: thstrm_amount (3개월) vs thstrm_add_amount (누적)
 */

import { Decimal } from '@prisma/client/runtime/library';

// ============================================================================
// Types
// ============================================================================

export interface ParsedAmount {
  value: Decimal | null;
  originalString: string;
  isNegative: boolean;
  parseSuccess: boolean;
  parseError?: string;
}

export interface NormalizedPeriod {
  periodType: 'ANNUAL' | 'QUARTER' | 'YTD' | 'HALF_YEAR';
  fiscalYear: number;
  fiscalQuarter: number | null; // 1~4 or null
  asOfDate: Date | null; // BS 시점
  flowStartDate: Date | null; // IS/CF 시작일
  flowEndDate: Date | null; // IS/CF 종료일
}

export interface RawFinancialRow {
  corpCode: string;
  bsnsYear: string; // YYYY
  reprtCode: string; // 11011, 11012, 11013, 11014
  fsDiv: string; // CFS, OFS
  sjDiv: string; // BS, IS, CIS, CF, SCE
  accountNm: string;
  thstrmAmount?: string | null;
  thstrmAddAmount?: string | null; // 누적 (분기)
  frmtrmAmount?: string | null;
  currency?: string | null;
}

// ============================================================================
// Section 4.1.1: 숫자 파싱 (명세서 요구사항)
// ============================================================================

/**
 * 문자열 금액을 NUMERIC으로 변환
 *
 * 명세서 요구사항:
 * - 콤마(,) 제거
 * - 괄호 (xxx) → 음수
 * - 공백 제거
 * - 단위 문자 제거 (원, 천원 등)
 * - null/""/"-" → null
 */
export function parseAmount(amountStr: string | null | undefined): ParsedAmount {
  const originalString = amountStr || '';

  // null/빈문자 처리
  if (!amountStr || amountStr.trim() === '' || amountStr.trim() === '-') {
    return {
      value: null,
      originalString,
      isNegative: false,
      parseSuccess: true,
    };
  }

  try {
    let cleaned = amountStr.trim();

    // 괄호 처리 (음수)
    const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
    if (isNegative) {
      cleaned = cleaned.slice(1, -1).trim();
    }

    // 콤마 제거
    cleaned = cleaned.replace(/,/g, '');

    // 공백 제거
    cleaned = cleaned.replace(/\s+/g, '');

    // 단위 문자 제거 (원, 천원, 백만원, 억원 등)
    cleaned = cleaned.replace(/(원|천원|백만원|억원|KRW|USD|만|천|백만|억)$/gi, '');

    // 숫자 파싱
    const numValue = parseFloat(cleaned);

    if (isNaN(numValue)) {
      return {
        value: null,
        originalString,
        isNegative: false,
        parseSuccess: false,
        parseError: `Cannot parse: "${cleaned}" from "${amountStr}"`,
      };
    }

    // 음수 처리
    const finalValue = isNegative ? -numValue : numValue;

    return {
      value: new Decimal(finalValue),
      originalString,
      isNegative,
      parseSuccess: true,
    };
  } catch (error: any) {
    return {
      value: null,
      originalString,
      isNegative: false,
      parseSuccess: false,
      parseError: error.message,
    };
  }
}

// ============================================================================
// Section 4.1.2: 기간 정규화 (명세서 요구사항)
// ============================================================================

/**
 * 보고서 코드와 사업연도를 기반으로 기간 정보 생성
 *
 * 명세서 요구사항:
 * - BS: 시점 금액 → as_of_date
 * - IS/CIS/CF: 기간 금액 → flow_start_date, flow_end_date
 * - 분/반기: thstrm_amount (3개월) vs thstrm_add_amount (누적)
 */
export function normalizePeriod(
  bsnsYear: string,
  reprtCode: string,
  sjDiv: string
): NormalizedPeriod {
  const year = parseInt(bsnsYear);

  // 보고서 코드에 따른 기간 타입
  // 11011: 사업보고서 (연간)
  // 11012: 반기보고서
  // 11013: 1분기보고서
  // 11014: 3분기보고서

  let periodType: 'ANNUAL' | 'QUARTER' | 'YTD' | 'HALF_YEAR';
  let fiscalQuarter: number | null = null;
  let asOfDate: Date | null = null;
  let flowStartDate: Date | null = null;
  let flowEndDate: Date | null = null;

  switch (reprtCode) {
    case '11011': // 사업보고서 (연간)
      periodType = 'ANNUAL';
      fiscalQuarter = null;

      if (sjDiv === 'BS') {
        // BS: 시점 (12월 31일)
        asOfDate = new Date(year, 11, 31); // 월은 0-based
      } else {
        // IS/CF: 기간 (1월 1일 ~ 12월 31일)
        flowStartDate = new Date(year, 0, 1);
        flowEndDate = new Date(year, 11, 31);
      }
      break;

    case '11013': // 1분기보고서
      periodType = 'QUARTER';
      fiscalQuarter = 1;

      if (sjDiv === 'BS') {
        asOfDate = new Date(year, 2, 31); // 3월 31일
      } else {
        flowStartDate = new Date(year, 0, 1);
        flowEndDate = new Date(year, 2, 31);
      }
      break;

    case '11012': // 반기보고서
      periodType = 'HALF_YEAR';
      fiscalQuarter = 2;

      if (sjDiv === 'BS') {
        asOfDate = new Date(year, 5, 30); // 6월 30일
      } else {
        flowStartDate = new Date(year, 0, 1);
        flowEndDate = new Date(year, 5, 30);
      }
      break;

    case '11014': // 3분기보고서
      periodType = 'QUARTER';
      fiscalQuarter = 3;

      if (sjDiv === 'BS') {
        asOfDate = new Date(year, 8, 30); // 9월 30일
      } else {
        flowStartDate = new Date(year, 0, 1);
        flowEndDate = new Date(year, 8, 30);
      }
      break;

    default:
      // Fallback: 연간으로 처리
      periodType = 'ANNUAL';
      fiscalQuarter = null;
      if (sjDiv === 'BS') {
        asOfDate = new Date(year, 11, 31);
      } else {
        flowStartDate = new Date(year, 0, 1);
        flowEndDate = new Date(year, 11, 31);
      }
  }

  return {
    periodType,
    fiscalYear: year,
    fiscalQuarter,
    asOfDate,
    flowStartDate,
    flowEndDate,
  };
}

// ============================================================================
// Section 4.1.3: 분/반기 금액 처리 (명세서 Section 2.4.1)
// ============================================================================

/**
 * 분/반기 보고서의 IS/CIS 금액 선택
 *
 * 명세서 요구사항:
 * - thstrm_amount: 당기 3개월 (분기 흐름)
 * - thstrm_add_amount: 누적 (YTD)
 * - 모델링에서는 "분기 흐름"을 기본으로 사용
 */
export function selectQuarterlyAmount(
  row: RawFinancialRow,
  preferQuarterly: boolean = true
): {
  amount: string | null;
  isAccumulated: boolean;
} {
  const { reprtCode, sjDiv, thstrmAmount, thstrmAddAmount } = row;

  // BS는 항상 시점 금액 (thstrm_amount)
  if (sjDiv === 'BS') {
    return {
      amount: thstrmAmount || null,
      isAccumulated: false,
    };
  }

  // IS/CIS/CF의 경우
  // 분기/반기 보고서 (11012, 11013, 11014)
  if (['11012', '11013', '11014'].includes(reprtCode)) {
    if (preferQuarterly) {
      // 분기 흐름 우선 (thstrm_amount)
      return {
        amount: thstrmAmount || thstrmAddAmount || null,
        isAccumulated: !thstrmAmount && !!thstrmAddAmount,
      };
    } else {
      // 누적 우선 (thstrm_add_amount)
      return {
        amount: thstrmAddAmount || thstrmAmount || null,
        isAccumulated: !!thstrmAddAmount,
      };
    }
  }

  // 연간 보고서 (11011)는 항상 thstrm_amount
  return {
    amount: thstrmAmount || null,
    isAccumulated: false,
  };
}

// ============================================================================
// Section 4.1.4: 통화 정규화
// ============================================================================

/**
 * 통화 코드 정규화
 *
 * 명세서: currency 필드 유지 + 프로젝트 기본통화로 환산(환산은 옵션; 기본은 원통화 유지)
 */
export function normalizeCurrency(currency: string | null | undefined): string {
  if (!currency || currency.trim() === '') {
    return 'KRW'; // 기본값
  }

  const cleaned = currency.trim().toUpperCase();

  // 한글 통화명 처리
  if (cleaned === '원' || cleaned === 'KRW' || cleaned === '한국원') {
    return 'KRW';
  }

  if (cleaned === 'USD' || cleaned === '달러' || cleaned === '미국달러') {
    return 'USD';
  }

  // 기타
  return cleaned;
}

// ============================================================================
// Section 4.1.5: 통합 정규화 함수
// ============================================================================

export interface NormalizedFinancialRow {
  // Identity
  corpCode: string;
  stockCode: string | null;
  entityId: string; // corp_code 기반 생성 필요

  // Period
  periodType: 'ANNUAL' | 'QUARTER' | 'YTD' | 'HALF_YEAR';
  fiscalYear: number;
  fiscalQuarter: number | null;
  reportCode: string;
  fsScope: 'CONSOLIDATED' | 'SEPARATE';

  // Statement & Account
  statementType: string; // BS, IS, CIS, CF, SCE
  accountSourceId: string | null; // DART account_id
  accountNameKr: string;
  accountDetailPath: string | null;

  // Amount
  amount: Decimal;
  currency: string;

  // Dates
  asOfDate: Date | null;
  flowStartDate: Date | null;
  flowEndDate: Date | null;

  // Source
  ordering: number | null;
  sourceRceptNo: string | null;
  sourcePriority: number; // ALL=10, KEY=20

  // Metadata
  isAccumulated: boolean;
  parseSuccess: boolean;
  parseError: string | null;
}

/**
 * Raw 재무제표 행을 Curated Fact로 변환
 */
export function normalizeFinancialRow(
  raw: RawFinancialRow & {
    stockCode?: string | null;
    accountId?: string | null;
    accountDetail?: string | null;
    rceptNo?: string | null;
    ord?: string | null;
  },
  options: {
    preferQuarterly?: boolean;
    sourcePriority?: number;
  } = {}
): NormalizedFinancialRow | null {
  const { preferQuarterly = true, sourcePriority = 10 } = options;

  // 1. 금액 선택 (분기 vs 누적)
  const { amount: amountStr, isAccumulated } = selectQuarterlyAmount(raw, preferQuarterly);

  if (!amountStr) {
    // 금액이 없으면 skip
    return null;
  }

  // 2. 숫자 파싱
  const parsed = parseAmount(amountStr);

  if (!parsed.parseSuccess || parsed.value === null) {
    // 파싱 실패 시에도 기록 (데이터 품질 모니터링용)
    console.warn(
      `[Normalizer] Parse failed: ${raw.corpCode} ${raw.bsnsYear} ${raw.accountNm}: ${parsed.parseError}`
    );
  }

  // 3. 기간 정규화
  const period = normalizePeriod(raw.bsnsYear, raw.reprtCode, raw.sjDiv);

  // 4. 통화 정규화
  const currency = normalizeCurrency(raw.currency);

  // 5. fs_scope 매핑
  const fsScope = raw.fsDiv === 'CFS' ? 'CONSOLIDATED' : 'SEPARATE';

  // 6. entityId 생성 (corpCode 기반)
  const entityId = `entity-${raw.corpCode}`;

  // 7. ordering 파싱
  const ordering = raw.ord ? parseInt(raw.ord) : null;

  return {
    corpCode: raw.corpCode,
    stockCode: raw.stockCode || null,
    entityId,

    periodType: period.periodType,
    fiscalYear: period.fiscalYear,
    fiscalQuarter: period.fiscalQuarter,
    reportCode: raw.reprtCode,
    fsScope,

    statementType: raw.sjDiv,
    accountSourceId: raw.accountId || null,
    accountNameKr: raw.accountNm,
    accountDetailPath: raw.accountDetail || null,

    amount: parsed.value || new Decimal(0),
    currency,

    asOfDate: period.asOfDate,
    flowStartDate: period.flowStartDate,
    flowEndDate: period.flowEndDate,

    ordering,
    sourceRceptNo: raw.rceptNo || null,
    sourcePriority,

    isAccumulated,
    parseSuccess: parsed.parseSuccess,
    parseError: parsed.parseError || null,
  };
}
