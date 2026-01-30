/**
 * DART Financial Statement Fetcher (명세서 Section 2.4 - 재무제표 수집)
 *
 * Key Features:
 * - fnlttSinglAcnt (주요계정) - Quick validation
 * - fnlttSinglAcntAll (전체 재무제표) - Model generation source
 * - Row-level storage in raw_dart_fnltt_all_row (핵심!)
 * - Support for quarterly reports (thstrm_amount vs thstrm_add_amount)
 */

import { getDartClient } from './client';
import {
  DartFnlttKeyParams,
  DartFnlttKeyResponse,
  DartFnlttAllParams,
  DartFnlttAllResponse,
  DartNoDataError,
} from './types';
import prisma from '../db';

// ============================================================================
// fnlttSinglAcnt (주요계정) - 명세서 Section 2.4.2
// ============================================================================

/**
 * 주요계정 수집 (사전 검증/스캐폴딩용)
 */
export async function fetchFinancialKey(params: DartFnlttKeyParams): Promise<{
  rowCount: number;
  hasBs: boolean;
  hasIs: boolean;
}> {
  console.log(`[DART Financial Key] Fetching key accounts: ${params.corp_code} ${params.bsns_year} ${params.reprt_code}`);

  const client = getDartClient();

  try {
    const response = await client.get<DartFnlttKeyResponse>('/fnlttSinglAcnt.json', params);

    if (!response.list || response.list.length === 0) {
      console.warn('[DART Financial Key] No key accounts found');
      return { rowCount: 0, hasBs: false, hasIs: false };
    }

    let hasBs = false;
    let hasIs = false;

    // Store in raw_dart_fnltt_key_rows
    for (const item of response.list) {
      if (item.sj_div === 'BS') hasBs = true;
      if (item.sj_div === 'IS') hasIs = true;

      await prisma.rawDartFnlttKeyRow.upsert({
        where: {
          corpCode_bsnsYear_reprtCode_sjDiv_accountNm_ord: {
            corpCode: params.corp_code,
            bsnsYear: params.bsns_year,
            reprtCode: params.reprt_code,
            sjDiv: item.sj_div,
            accountNm: item.account_nm,
            ord: item.ord || '0',
          },
        },
        update: {
          thstrmNm: item.thstrm_nm,
          thstrmAmount: item.thstrm_amount,
          frmtrmNm: item.frmtrm_nm,
          frmtrmAmount: item.frmtrm_amount,
          bfefrmtrmNm: item.bfefrmtrm_nm,
          bfefrmtrmAmount: item.bfefrmtrm_amount,
        },
        create: {
          corpCode: params.corp_code,
          bsnsYear: params.bsns_year,
          reprtCode: params.reprt_code,
          rceptNo: item.rcept_no || null,
          sjDiv: item.sj_div,
          accountNm: item.account_nm,
          thstrmNm: item.thstrm_nm,
          thstrmAmount: item.thstrm_amount,
          frmtrmNm: item.frmtrm_nm,
          frmtrmAmount: item.frmtrm_amount,
          bfefrmtrmNm: item.bfefrmtrm_nm,
          bfefrmtrmAmount: item.bfefrmtrm_amount,
          ord: item.ord || null,
        },
      });
    }

    console.log(`[DART Financial Key] ✅ Stored ${response.list.length} key account rows (BS: ${hasBs}, IS: ${hasIs})`);

    return {
      rowCount: response.list.length,
      hasBs,
      hasIs,
    };

  } catch (error: any) {
    if (error instanceof DartNoDataError) {
      console.warn('[DART Financial Key] No data available (013)');
      return { rowCount: 0, hasBs: false, hasIs: false };
    }
    throw error;
  }
}

// ============================================================================
// fnlttSinglAcntAll (전체 재무제표) - 명세서 Section 2.4.1 (핵심!)
// ============================================================================

/**
 * 전체 재무제표 수집 및 행 단위 저장
 *
 * 명세서 Section 2.4.1 요구사항:
 * - BS/IS/CIS/CF/SCE 전 라인 수집
 * - 분/반기: thstrm_amount (3개월) vs thstrm_add_amount (누적)
 * - 통화/숫자 포맷 보존 (정규화는 curate 단계에서)
 * - 정렬순서(ord)와 계정 계층(account_detail) 보존
 */
export async function fetchFinancialAll(params: DartFnlttAllParams): Promise<{
  rowCount: number;
  statementCounts: Record<string, number>; // BS: 100, IS: 50, etc
  rceptNo?: string;
}> {
  console.log(`[DART Financial All] Fetching full statements: ${params.corp_code} ${params.bsns_year} ${params.reprt_code} ${params.fs_div}`);

  const client = getDartClient();

  try {
    const response = await client.get<DartFnlttAllResponse>('/fnlttSinglAcntAll.json', params);

    if (!response.list || response.list.length === 0) {
      console.warn('[DART Financial All] No data found (013)');
      return { rowCount: 0, statementCounts: {} };
    }

    const statementCounts: Record<string, number> = {};
    let rceptNo: string | undefined;

    // Store in raw_dart_fnltt_all_rows (핵심 원천 테이블!)
    for (const item of response.list) {
      if (!rceptNo && item.rcept_no) {
        rceptNo = item.rcept_no;
      }

      const sjDiv = item.sj_div || 'UNKNOWN';
      statementCounts[sjDiv] = (statementCounts[sjDiv] || 0) + 1;

      try {
        await prisma.rawDartFnlttAllRow.upsert({
          where: {
            corpCode_bsnsYear_reprtCode_fsDiv_sjDiv_accountId_accountNm_accountDetail_ord: {
              corpCode: params.corp_code,
              bsnsYear: params.bsns_year,
              reprtCode: params.reprt_code,
              fsDiv: params.fs_div,
              sjDiv,
              accountId: item.account_id || '',
              accountNm: item.account_nm,
              accountDetail: item.account_detail || '',
              ord: item.ord || '0',
            },
          },
          update: {
            sjNm: item.sj_nm,
            thstrmNm: item.thstrm_nm,
            thstrmAmount: item.thstrm_amount,
            thstrmAddAmount: item.thstrm_add_amount,
            frmtrmNm: item.frmtrm_nm,
            frmtrmAmount: item.frmtrm_amount,
            frmtrmAddAmount: item.frmtrm_add_amount,
            frmtrmQNm: item.frmtrm_q_nm,
            frmtrmQAmount: item.frmtrm_q_amount,
            bfefrmtrmNm: item.bfefrmtrm_nm,
            bfefrmtrmAmount: item.bfefrmtrm_amount,
            currency: item.currency,
          },
          create: {
            corpCode: params.corp_code,
            bsnsYear: params.bsns_year,
            reprtCode: params.reprt_code,
            fsDiv: params.fs_div,
            rceptNo: item.rcept_no || null,
            sjDiv,
            sjNm: item.sj_nm,
            accountId: item.account_id,
            accountNm: item.account_nm,
            accountDetail: item.account_detail,
            thstrmNm: item.thstrm_nm,
            thstrmAmount: item.thstrm_amount,
            thstrmAddAmount: item.thstrm_add_amount,
            frmtrmNm: item.frmtrm_nm,
            frmtrmAmount: item.frmtrm_amount,
            frmtrmAddAmount: item.frmtrm_add_amount,
            frmtrmQNm: item.frmtrm_q_nm,
            frmtrmQAmount: item.frmtrm_q_amount,
            bfefrmtrmNm: item.bfefrmtrm_nm,
            bfefrmtrmAmount: item.bfefrmtrm_amount,
            ord: item.ord,
            currency: item.currency,
          },
        });
      } catch (error: any) {
        console.error(`[DART Financial All] Error storing row: ${error.message}`);
      }
    }

    console.log(`[DART Financial All] ✅ Stored ${response.list.length} rows:`, statementCounts);

    return {
      rowCount: response.list.length,
      statementCounts,
      rceptNo,
    };

  } catch (error: any) {
    if (error instanceof DartNoDataError) {
      console.warn('[DART Financial All] No data available (013)');
      return { rowCount: 0, statementCounts: {} };
    }
    throw error;
  }
}

// ============================================================================
// Batch Operations (명세서 Section 2.4 - 최소 수집 범위)
// ============================================================================

/**
 * 다년도 재무제표 일괄 수집
 *
 * 명세서 요구사항:
 * - 최소 5~10개년 연간
 * - 최근 분기까지 구성 가능
 * - 연결(CFS) 우선, 없으면 개별(OFS) fallback
 */
export async function fetchMultiYearFinancials(params: {
  corpCode: string;
  years: number[]; // e.g., [2019, 2020, 2021, 2022, 2023]
  reportCodes?: string[]; // 11011(사업), 11012(반기), 11013(1Q), 11014(3Q)
  fsDivs?: ('CFS' | 'OFS')[]; // 기본: ['CFS', 'OFS']
}): Promise<{
  totalRows: number;
  yearStats: Record<string, { rows: number; statements: string[] }>;
}> {
  const reportCodes = params.reportCodes || ['11011']; // 기본: 사업보고서만
  const fsDivs = params.fsDivs || ['CFS', 'OFS'];

  const stats = {
    totalRows: 0,
    yearStats: {} as Record<string, { rows: number; statements: string[] }>,
  };

  for (const year of params.years) {
    for (const reportCode of reportCodes) {
      for (const fsDiv of fsDivs) {
        try {
          const result = await fetchFinancialAll({
            corp_code: params.corpCode,
            bsns_year: String(year),
            reprt_code: reportCode,
            fs_div: fsDiv,
          });

          if (result.rowCount > 0) {
            const key = `${year}-${reportCode}-${fsDiv}`;
            stats.yearStats[key] = {
              rows: result.rowCount,
              statements: Object.keys(result.statementCounts),
            };
            stats.totalRows += result.rowCount;

            console.log(`[DART Multi-Year] ${key}: ${result.rowCount} rows`);
          }
        } catch (error: any) {
          console.error(`[DART Multi-Year] Failed ${year}-${reportCode}-${fsDiv}: ${error.message}`);
        }
      }
    }
  }

  console.log(`[DART Multi-Year] ✅ Total collected: ${stats.totalRows} rows across ${Object.keys(stats.yearStats).length} combinations`);

  return stats;
}

/**
 * 분기 보고서 수집 (누적 처리 로직 포함)
 *
 * 명세서 Section 2.4.1 요구사항:
 * - thstrm_amount = 당기 3개월
 * - thstrm_add_amount = 누적 (YTD)
 * - 모델링에서는 "분기 흐름" 필요 시 누적을 이용해 역산
 */
export async function fetchQuarterlyFinancials(params: {
  corpCode: string;
  year: number;
  quarters: number[]; // [1, 2, 3, 4]
  fsDiv?: 'CFS' | 'OFS';
}): Promise<{
  totalRows: number;
  quarterStats: Record<number, { rows: number; hasAccumulated: boolean }>;
}> {
  const fsDiv = params.fsDiv || 'CFS';
  const reportCodeMap: Record<number, string> = {
    1: '11013', // 1분기
    2: '11012', // 반기
    3: '11014', // 3분기
    4: '11011', // 사업보고서 (연간)
  };

  const stats = {
    totalRows: 0,
    quarterStats: {} as Record<number, { rows: number; hasAccumulated: boolean }>,
  };

  for (const quarter of params.quarters) {
    const reportCode = reportCodeMap[quarter];

    if (!reportCode) {
      console.warn(`[DART Quarterly] Invalid quarter: ${quarter}`);
      continue;
    }

    try {
      const result = await fetchFinancialAll({
        corp_code: params.corpCode,
        bsns_year: String(params.year),
        reprt_code: reportCode,
        fs_div: fsDiv,
      });

      if (result.rowCount > 0) {
        // Check if accumulated amounts exist
        const hasAccumulated = await checkAccumulatedAmounts(params.corpCode, String(params.year), reportCode, fsDiv);

        stats.quarterStats[quarter] = {
          rows: result.rowCount,
          hasAccumulated,
        };
        stats.totalRows += result.rowCount;

        console.log(`[DART Quarterly] Q${quarter} ${params.year}: ${result.rowCount} rows (accumulated: ${hasAccumulated})`);
      }
    } catch (error: any) {
      console.error(`[DART Quarterly] Failed Q${quarter} ${params.year}: ${error.message}`);
    }
  }

  return stats;
}

/**
 * 누적 금액 존재 여부 확인 (분기/반기)
 */
async function checkAccumulatedAmounts(
  corpCode: string,
  bsnsYear: string,
  reprtCode: string,
  fsDiv: string
): Promise<boolean> {
  const sample = await prisma.rawDartFnlttAllRow.findFirst({
    where: {
      corpCode,
      bsnsYear,
      reprtCode,
      fsDiv,
      thstrmAddAmount: {
        not: null,
      },
    },
  });

  return !!sample;
}
