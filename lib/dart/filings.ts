/**
 * DART Filings Sync (명세서 Section 2.3 - 공시 목록/접수번호 수집)
 *
 * Fetches filing list from DART 'list' API
 * - Filters by corp_code and date range
 * - Supports last_reprt_at=Y for final reports only
 * - Tracks restatements (정정공시)
 */

import { getDartClient } from './client';
import { DartListParams, DartListResponse, DartFilingItem, DartNoDataError } from './types';
import prisma from '../db';

/**
 * 공시 목록 수집 및 DB 저장
 *
 * @param params - 조회 파라미터
 * @returns 수집된 공시 수
 */
export async function syncFilings(params: {
  corpCode: string;
  startDate: string; // YYYYMMDD
  endDate: string; // YYYYMMDD
  lastReportOnly?: boolean; // 최종보고서만 (정정 제외)
  reportTypes?: string[]; // A001(정기공시), A002(주요사항보고), 등
}): Promise<{
  total: number;
  added: number;
  updated: number;
}> {
  console.log(`[DART Filings] Syncing filings for ${params.corpCode} (${params.startDate} ~ ${params.endDate})`);

  const stats = {
    total: 0,
    added: 0,
    updated: 0,
  };

  const client = getDartClient();

  try {
    // Build request params
    const requestParams: DartListParams = {
      corp_code: params.corpCode,
      bgn_de: params.startDate,
      end_de: params.endDate,
      last_reprt_at: params.lastReportOnly ? 'Y' : 'N',
      page_count: 100, // max per page
    };

    let pageNo = 1;
    let hasMore = true;

    while (hasMore) {
      requestParams.page_no = pageNo;

      try {
        const response = await client.get<DartListResponse>('/list.json', requestParams);

        if (!response.list || response.list.length === 0) {
          hasMore = false;
          break;
        }

        // Process filings
        for (const item of response.list) {
          try {
            // Filter by report types if specified
            if (params.reportTypes && params.reportTypes.length > 0) {
              if (!params.reportTypes.includes(item.pblntf_ty || '')) {
                continue;
              }
            }

            // Upsert filing
            const existing = await prisma.rawDartFiling.findUnique({
              where: { rceptNo: item.rcept_no },
            });

            if (existing) {
              // Update if needed
              await prisma.rawDartFiling.update({
                where: { rceptNo: item.rcept_no },
                data: {
                  reportNm: item.report_nm,
                  flrNm: item.flr_nm,
                  rm: item.rm || null,
                  isFinal: params.lastReportOnly ?? true,
                },
              });
              stats.updated++;
            } else {
              // Insert new
              await prisma.rawDartFiling.create({
                data: {
                  rceptNo: item.rcept_no,
                  corpCode: item.corp_code,
                  stockCode: item.stock_code || null,
                  rceptDt: item.rcept_dt,
                  reportNm: item.report_nm,
                  flrNm: item.flr_nm,
                  rm: item.rm || null,
                  pblntfTy: item.pblntf_ty || 'UNKNOWN',
                  pblntfDetailTy: item.pblntf_detail_ty || null,
                  isFinal: params.lastReportOnly ?? true,
                },
              });
              stats.added++;
            }

            stats.total++;
          } catch (error: any) {
            console.error(`[DART Filings] Error processing filing ${item.rcept_no}: ${error.message}`);
          }
        }

        // Check if there are more pages
        if (response.list.length < 100) {
          hasMore = false;
        } else {
          pageNo++;
        }

      } catch (error: any) {
        if (error instanceof DartNoDataError) {
          console.log('[DART Filings] No more data available');
          hasMore = false;
        } else {
          throw error;
        }
      }
    }

    console.log(`[DART Filings] ✅ Synced ${stats.total} filings (${stats.added} new, ${stats.updated} updated)`);

    return stats;

  } catch (error: any) {
    console.error('[DART Filings] ❌ Sync failed:', error);
    throw error;
  }
}

/**
 * 특정 기업의 정기공시(사업보고서/분기/반기) 목록 조회
 */
export async function getRegularFilings(params: {
  corpCode: string;
  years: number[]; // e.g., [2020, 2021, 2022, 2023, 2024]
  reportCodes?: string[]; // 11011(사업), 11012(반기), 11013(1Q), 11014(3Q)
}): Promise<DartFilingItem[]> {
  const filings: DartFilingItem[] = [];

  for (const year of params.years) {
    const startDate = `${year}0101`;
    const endDate = `${year}1231`;

    await syncFilings({
      corpCode: params.corpCode,
      startDate,
      endDate,
      lastReportOnly: true,
      reportTypes: ['A001'], // 정기공시
    });
  }

  // Query from DB
  const dbFilings = await prisma.rawDartFiling.findMany({
    where: {
      corpCode: params.corpCode,
      isFinal: true,
      pblntfTy: 'A001',
      reportNm: {
        in: [
          '사업보고서',
          '반기보고서',
          '분기보고서',
        ],
      },
    },
    orderBy: {
      rceptDt: 'desc',
    },
  });

  return dbFilings.map(f => ({
    corp_code: f.corpCode,
    corp_name: '',
    stock_code: f.stockCode || undefined,
    report_nm: f.reportNm,
    rcept_no: f.rceptNo,
    flr_nm: f.flrNm,
    rcept_dt: f.rceptDt,
    rm: f.rm || undefined,
    pblntf_ty: f.pblntfTy,
    pblntf_detail_ty: f.pblntfDetailTy || undefined,
  }));
}

/**
 * 정정공시 탐지 및 추적
 */
export async function detectRestatements(corpCode: string, fiscalYear: number): Promise<{
  hasRestatement: boolean;
  latestRceptNo?: string;
  previousRceptNo?: string;
}> {
  // 같은 연도의 동일 보고서 유형에 대해 여러 rcept_no가 있는지 확인
  const filings = await prisma.rawDartFiling.findMany({
    where: {
      corpCode,
      rceptDt: {
        gte: `${fiscalYear}0101`,
        lte: `${fiscalYear}1231`,
      },
      reportNm: {
        contains: '사업보고서',
      },
    },
    orderBy: {
      rceptDt: 'desc',
    },
  });

  if (filings.length > 1) {
    // 정정 발생
    return {
      hasRestatement: true,
      latestRceptNo: filings[0].rceptNo,
      previousRceptNo: filings[1].rceptNo,
    };
  }

  return {
    hasRestatement: false,
    latestRceptNo: filings[0]?.rceptNo,
  };
}
