/**
 * Curate Transform Module (명세서 Section 4 - ETL/정규화 로직)
 *
 * Main transformation pipeline: Raw → Curated
 * - Normalization (숫자 파싱, 기간 정규화)
 * - Account Mapping (계정 매핑)
 * - Data quality checks
 */

import prisma from '../db';
import { normalizeFinancialRow } from './normalizer';
import { mapAccount, generateMappingCoverageReport } from './mapper';

// ============================================================================
// Types
// ============================================================================

export interface TransformJobParams {
  corpCode: string;
  bsnsYear: string;
  reprtCode: string;
  fsDiv: string;
}

export interface TransformJobResult {
  success: boolean;
  rowsProcessed: number;
  rowsCreated: number;
  rowsSkipped: number;
  parseErrors: number;
  unmappedRows: number;
  coveragePercent: number;
  duration: number;
  errors: string[];
}

// ============================================================================
// Main Transform Function
// ============================================================================

/**
 * Raw 재무제표 데이터를 Curated Facts로 변환
 *
 * 명세서 Section 4 전체 프로세스:
 * 1) Raw 데이터 조회
 * 2) 정규화 (숫자 파싱, 기간 정규화)
 * 3) 계정 매핑
 * 4) Curated Facts 저장
 * 5) 품질 체크
 */
export async function transformRawToCurated(params: TransformJobParams): Promise<TransformJobResult> {
  const startTime = Date.now();
  const { corpCode, bsnsYear, reprtCode, fsDiv } = params;

  console.log(
    `[Transform] Starting transformation: ${corpCode} ${bsnsYear} ${reprtCode} ${fsDiv}`
  );

  const stats = {
    rowsProcessed: 0,
    rowsCreated: 0,
    rowsSkipped: 0,
    parseErrors: 0,
    unmappedRows: 0,
  };

  const errors: string[] = [];

  try {
    // 1. Raw 데이터 조회
    const rawRows = await prisma.rawDartFnlttAllRow.findMany({
      where: {
        corpCode,
        bsnsYear,
        reprtCode,
        fsDiv,
      },
      include: {
        corpMaster: true,
        filing: true,
      },
    });

    console.log(`[Transform] Found ${rawRows.length} raw rows`);

    if (rawRows.length === 0) {
      return {
        success: true,
        rowsProcessed: 0,
        rowsCreated: 0,
        rowsSkipped: 0,
        parseErrors: 0,
        unmappedRows: 0,
        coveragePercent: 0,
        duration: Date.now() - startTime,
        errors: [],
      };
    }

    // 2. Entity 생성/조회 (corp_code 기반)
    const entityId = await ensureEntity(corpCode, rawRows[0].corpMaster.stockCode);

    // 3. 각 행 변환 및 저장
    for (const rawRow of rawRows) {
      stats.rowsProcessed++;

      try {
        // 3.1. 정규화
        const normalized = normalizeFinancialRow(
          {
            corpCode: rawRow.corpCode,
            bsnsYear: rawRow.bsnsYear,
            reprtCode: rawRow.reprtCode,
            fsDiv: rawRow.fsDiv,
            sjDiv: rawRow.sjDiv,
            accountNm: rawRow.accountNm,
            thstrmAmount: rawRow.thstrmAmount,
            thstrmAddAmount: rawRow.thstrmAddAmount,
            frmtrmAmount: rawRow.frmtrmAmount,
            currency: rawRow.currency,
            stockCode: rawRow.corpMaster.stockCode,
            accountId: rawRow.accountId,
            accountDetail: rawRow.accountDetail,
            rceptNo: rawRow.rceptNo,
            ord: rawRow.ord,
          },
          {
            preferQuarterly: true,
            sourcePriority: 10, // fnlttSinglAcntAll
          }
        );

        if (!normalized) {
          stats.rowsSkipped++;
          continue;
        }

        if (!normalized.parseSuccess) {
          stats.parseErrors++;
        }

        // 3.2. 계정 매핑
        const mappingResult = await mapAccount({
          accountSourceId: normalized.accountSourceId,
          accountNameKr: normalized.accountNameKr,
          accountDetailPath: normalized.accountDetailPath,
          statementType: normalized.statementType,
        });

        if (!mappingResult.standardLineId) {
          stats.unmappedRows++;
        }

        // 3.3. Curated Fact 저장 (Upsert)
        // Unique key로 중복 방지
        await prisma.curatedFinFact.upsert({
          where: {
            // Composite unique key 필요 (Prisma schema에 추가 필요)
            // 임시로 entityId + period + account로 구성
            id: generateFactId(normalized, mappingResult.standardLineId),
          },
          update: {
            amount: normalized.amount,
            standardLineId: mappingResult.standardLineId,
            currency: normalized.currency,
            asOfDate: normalized.asOfDate,
            flowStartDate: normalized.flowStartDate,
            flowEndDate: normalized.flowEndDate,
            ordering: normalized.ordering,
            sourceRceptNo: normalized.sourceRceptNo,
            sourcePriority: normalized.sourcePriority,
          },
          create: {
            id: generateFactId(normalized, mappingResult.standardLineId),
            entityId,
            corpCode: normalized.corpCode,
            stockCode: normalized.stockCode,
            periodType: normalized.periodType,
            fiscalYear: normalized.fiscalYear,
            fiscalQuarter: normalized.fiscalQuarter,
            reportCode: normalized.reportCode,
            fsScope: normalized.fsScope,
            statementType: normalized.statementType,
            accountSourceId: normalized.accountSourceId,
            accountNameKr: normalized.accountNameKr,
            accountDetailPath: normalized.accountDetailPath,
            standardLineId: mappingResult.standardLineId,
            amount: normalized.amount,
            currency: normalized.currency,
            asOfDate: normalized.asOfDate,
            flowStartDate: normalized.flowStartDate,
            flowEndDate: normalized.flowEndDate,
            ordering: normalized.ordering,
            sourceRceptNo: normalized.sourceRceptNo,
            sourcePriority: normalized.sourcePriority,
          },
        });

        stats.rowsCreated++;
      } catch (error: any) {
        console.error(`[Transform] Error processing row: ${rawRow.accountNm}`, error);
        errors.push(`${rawRow.accountNm}: ${error.message}`);
      }
    }

    // 4. 매핑 커버리지 리포트 생성
    let coveragePercent = 0;
    try {
      const coverageReport = await generateMappingCoverageReport({
        corpCode,
        fiscalYear: parseInt(bsnsYear),
        topN: 10,
      });

      coveragePercent = coverageReport.coveragePercent;

      console.log(`[Transform] Mapping coverage: ${coveragePercent.toFixed(2)}%`);
      console.log(`[Transform] Top unmapped accounts:`, coverageReport.topUnmappedAccounts.slice(0, 5));
    } catch (error: any) {
      console.error('[Transform] Failed to generate coverage report:', error);
    }

    const duration = Date.now() - startTime;

    console.log(`[Transform] ✅ Completed in ${duration}ms`);
    console.log(`[Transform] Stats:`, stats);

    return {
      success: true,
      ...stats,
      coveragePercent,
      duration,
      errors,
    };
  } catch (error: any) {
    console.error('[Transform] ❌ Transform failed:', error);

    return {
      success: false,
      rowsProcessed: stats.rowsProcessed,
      rowsCreated: stats.rowsCreated,
      rowsSkipped: stats.rowsSkipped,
      parseErrors: stats.parseErrors,
      unmappedRows: stats.unmappedRows,
      coveragePercent: 0,
      duration: Date.now() - startTime,
      errors: [...errors, error.message],
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Entity 생성/조회
 */
async function ensureEntity(corpCode: string, stockCode: string | null): Promise<string> {
  const entityId = `entity-${corpCode}`;

  // Check if exists
  const existing = await prisma.modelEntity.findUnique({
    where: { id: entityId },
  });

  if (existing) {
    return entityId;
  }

  // Get corp name
  const corp = await prisma.rawDartCorpMaster.findUnique({
    where: { corpCode },
  });

  // Create entity
  const entity = await prisma.modelEntity.create({
    data: {
      id: entityId,
      corpCode,
      stockCode,
      displayName: corp?.corpName || corpCode,
      defaultFsScope: 'CONSOLIDATED',
    },
  });

  return entity.id;
}

/**
 * Fact ID 생성 (Unique identifier)
 *
 * Format: {entityId}:{periodType}:{fiscalYear}:{fiscalQuarter}:{reportCode}:{fsScope}:{statementType}:{accountNameKr}
 */
function generateFactId(
  normalized: {
    entityId: string;
    periodType: string;
    fiscalYear: number;
    fiscalQuarter: number | null;
    reportCode: string;
    fsScope: string;
    statementType: string;
    accountNameKr: string;
  },
  standardLineId: string | null
): string {
  const parts = [
    normalized.entityId,
    normalized.periodType,
    normalized.fiscalYear,
    normalized.fiscalQuarter || 'null',
    normalized.reportCode,
    normalized.fsScope,
    normalized.statementType,
    normalized.accountNameKr.replace(/[^a-zA-Z0-9가-힣]/g, '_'),
  ];

  return parts.join(':');
}

// ============================================================================
// Batch Transform
// ============================================================================

/**
 * 다년도/다보고서 일괄 변환
 */
export async function batchTransformRawToCurated(params: {
  corpCode: string;
  years: number[];
  reportCodes?: string[];
  fsDivs?: string[];
}): Promise<{
  totalJobs: number;
  successJobs: number;
  failedJobs: number;
  results: TransformJobResult[];
}> {
  const { corpCode, years, reportCodes = ['11011'], fsDivs = ['CFS', 'OFS'] } = params;

  const results: TransformJobResult[] = [];
  let successJobs = 0;
  let failedJobs = 0;

  for (const year of years) {
    for (const reportCode of reportCodes) {
      for (const fsDiv of fsDivs) {
        try {
          const result = await transformRawToCurated({
            corpCode,
            bsnsYear: String(year),
            reprtCode: reportCode,
            fsDiv,
          });

          results.push(result);

          if (result.success) {
            successJobs++;
          } else {
            failedJobs++;
          }
        } catch (error: any) {
          console.error(`[Batch Transform] Failed ${year}-${reportCode}-${fsDiv}:`, error);
          failedJobs++;

          results.push({
            success: false,
            rowsProcessed: 0,
            rowsCreated: 0,
            rowsSkipped: 0,
            parseErrors: 0,
            unmappedRows: 0,
            coveragePercent: 0,
            duration: 0,
            errors: [error.message],
          });
        }
      }
    }
  }

  return {
    totalJobs: results.length,
    successJobs,
    failedJobs,
    results,
  };
}
