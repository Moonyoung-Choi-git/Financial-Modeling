/**
 * Account Mapping Engine (명세서 Section 4.2 - 계정 매핑)
 *
 * Key Features:
 * - DART account_nm → Standard COA 매핑
 * - 규칙 기반 (정규식 매칭)
 * - 우선순위 처리
 * - 매핑 커버리지 리포트
 */

import prisma from '../db';

// ============================================================================
// Types
// ============================================================================

export interface MappingRule {
  id: string;
  accountSourceId: string | null; // DART account_id (exact match)
  accountNameKr: string | null; // regex pattern
  accountDetailPath: string | null;
  statementType: string | null;
  standardLineId: string;
  confidenceScore: number;
  priority: number;
  mappingVersion: number;
}

export interface MappingResult {
  standardLineId: string | null;
  matchedRule: MappingRule | null;
  confidenceScore: number;
  matchMethod: 'ACCOUNT_ID' | 'NAME_EXACT' | 'NAME_REGEX' | 'UNMAPPED';
}

export interface MappingCoverageReport {
  totalRows: number;
  mappedRows: number;
  unmappedRows: number;
  coveragePercent: number;
  byStatement: Record<string, { total: number; mapped: number; coverage: number }>;
  topUnmappedAccounts: Array<{
    accountNm: string;
    statementType: string;
    count: number;
  }>;
}

// ============================================================================
// Section 4.2.1: 매핑 룰 로드 (캐시)
// ============================================================================

let mappingRulesCache: MappingRule[] | null = null;
let mappingRulesCacheTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * 매핑 룰 로드 (캐시 사용)
 */
async function loadMappingRules(): Promise<MappingRule[]> {
  const now = Date.now();

  if (mappingRulesCache && now - mappingRulesCacheTime < CACHE_TTL) {
    return mappingRulesCache;
  }

  const rules = await prisma.curatedFinAccountMapping.findMany({
    orderBy: [{ priority: 'asc' }, { confidenceScore: 'desc' }],
  });

  mappingRulesCache = rules.map((r) => ({
    id: r.id,
    accountSourceId: r.accountSourceId,
    accountNameKr: r.accountNameKr,
    accountDetailPath: r.accountDetailPath,
    statementType: r.statementType,
    standardLineId: r.standardLineId,
    confidenceScore: r.confidenceScore,
    priority: r.priority,
    mappingVersion: r.mappingVersion,
  }));

  mappingRulesCacheTime = now;

  return mappingRulesCache;
}

/**
 * 매핑 룰 캐시 무효화
 */
export function invalidateMappingCache(): void {
  mappingRulesCache = null;
}

// ============================================================================
// Section 4.2.2: 계정 매핑 로직 (명세서 단계별)
// ============================================================================

/**
 * 계정 매핑 실행
 *
 * 명세서 Section 4.2 단계:
 * 1) 표준계정ID(account_id) 존재 시: 1차 매핑 (가장 신뢰)
 * 2) statement_type + account_nm exact 매핑
 * 3) statement_type + account_nm regex 매핑
 * 4) account_detail 경로 기반 매핑
 * 5) 미매핑 → UNMAPPED
 */
export async function mapAccount(params: {
  accountSourceId: string | null;
  accountNameKr: string;
  accountDetailPath: string | null;
  statementType: string;
}): Promise<MappingResult> {
  const { accountSourceId, accountNameKr, accountDetailPath, statementType } = params;

  const rules = await loadMappingRules();

  // 1) account_id exact match (가장 신뢰도 높음)
  if (accountSourceId) {
    const rule = rules.find(
      (r) => r.accountSourceId === accountSourceId && r.statementType === statementType
    );

    if (rule) {
      return {
        standardLineId: rule.standardLineId,
        matchedRule: rule,
        confidenceScore: rule.confidenceScore,
        matchMethod: 'ACCOUNT_ID',
      };
    }
  }

  // 2) account_nm exact match + statement_type
  const exactMatch = rules.find(
    (r) =>
      r.accountNameKr === accountNameKr &&
      (r.statementType === statementType || r.statementType === null)
  );

  if (exactMatch) {
    return {
      standardLineId: exactMatch.standardLineId,
      matchedRule: exactMatch,
      confidenceScore: exactMatch.confidenceScore,
      matchMethod: 'NAME_EXACT',
    };
  }

  // 3) account_nm regex match + statement_type
  for (const rule of rules) {
    if (!rule.accountNameKr) continue;

    // regex 패턴 시도
    try {
      const regex = new RegExp(rule.accountNameKr);

      if (regex.test(accountNameKr)) {
        // statement_type 체크
        if (rule.statementType === null || rule.statementType === statementType) {
          return {
            standardLineId: rule.standardLineId,
            matchedRule: rule,
            confidenceScore: rule.confidenceScore * 0.9, // regex는 신뢰도 약간 낮춤
            matchMethod: 'NAME_REGEX',
          };
        }
      }
    } catch (error) {
      // Invalid regex pattern - skip
      continue;
    }
  }

  // 4) account_detail 경로 기반 매핑 (TODO: 확장)
  // 현재는 구현 생략

  // 5) 미매핑
  return {
    standardLineId: null,
    matchedRule: null,
    confidenceScore: 0,
    matchMethod: 'UNMAPPED',
  };
}

// ============================================================================
// Section 4.2.3: 일괄 매핑
// ============================================================================

/**
 * Raw 데이터를 일괄 매핑하여 Curated Facts 생성
 */
export async function batchMapAccounts(params: {
  corpCode: string;
  bsnsYear: string;
  reprtCode: string;
  fsDiv: string;
}): Promise<{
  mappedCount: number;
  unmappedCount: number;
  totalCount: number;
  unmappedAccounts: Array<{ accountNm: string; statementType: string }>;
}> {
  const { corpCode, bsnsYear, reprtCode, fsDiv } = params;

  // Raw 데이터 조회
  const rawRows = await prisma.rawDartFnlttAllRow.findMany({
    where: {
      corpCode,
      bsnsYear,
      reprtCode,
      fsDiv,
    },
  });

  let mappedCount = 0;
  let unmappedCount = 0;
  const unmappedAccounts: Array<{ accountNm: string; statementType: string }> = [];

  for (const row of rawRows) {
    const result = await mapAccount({
      accountSourceId: row.accountId || null,
      accountNameKr: row.accountNm,
      accountDetailPath: row.accountDetail || null,
      statementType: row.sjDiv,
    });

    if (result.standardLineId) {
      mappedCount++;
    } else {
      unmappedCount++;
      unmappedAccounts.push({
        accountNm: row.accountNm,
        statementType: row.sjDiv,
      });
    }
  }

  return {
    mappedCount,
    unmappedCount,
    totalCount: rawRows.length,
    unmappedAccounts,
  };
}

// ============================================================================
// Section 4.2.4: 매핑 커버리지 리포트 (명세서 요구사항)
// ============================================================================

/**
 * 매핑 커버리지 리포트 생성
 *
 * 명세서 Section 4.2 산출물:
 * - 매핑 커버리지 리포트 (기업별/연도별)
 * - 누락 상위 Top N 계정 추천
 */
export async function generateMappingCoverageReport(params: {
  corpCode: string;
  fiscalYear: number;
  topN?: number;
}): Promise<MappingCoverageReport> {
  const { corpCode, fiscalYear, topN = 20 } = params;

  // Raw 데이터 조회 (모든 보고서 코드/fs_div)
  const rawRows = await prisma.rawDartFnlttAllRow.findMany({
    where: {
      corpCode,
      bsnsYear: String(fiscalYear),
    },
  });

  const totalRows = rawRows.length;
  let mappedRows = 0;
  let unmappedRows = 0;

  const byStatement: Record<string, { total: number; mapped: number; coverage: number }> = {};
  const unmappedAccountsMap: Map<string, { accountNm: string; statementType: string; count: number }> =
    new Map();

  for (const row of rawRows) {
    const statementType = row.sjDiv;

    // Initialize statement stats
    if (!byStatement[statementType]) {
      byStatement[statementType] = { total: 0, mapped: 0, coverage: 0 };
    }
    byStatement[statementType].total++;

    // Map account
    const result = await mapAccount({
      accountSourceId: row.accountId || null,
      accountNameKr: row.accountNm,
      accountDetailPath: row.accountDetail || null,
      statementType,
    });

    if (result.standardLineId) {
      mappedRows++;
      byStatement[statementType].mapped++;
    } else {
      unmappedRows++;

      // Track unmapped accounts
      const key = `${statementType}:${row.accountNm}`;
      const existing = unmappedAccountsMap.get(key);

      if (existing) {
        existing.count++;
      } else {
        unmappedAccountsMap.set(key, {
          accountNm: row.accountNm,
          statementType,
          count: 1,
        });
      }
    }
  }

  // Calculate coverage by statement
  for (const [statementType, stats] of Object.entries(byStatement)) {
    stats.coverage = stats.total > 0 ? (stats.mapped / stats.total) * 100 : 0;
  }

  // Top N unmapped accounts
  const topUnmappedAccounts = Array.from(unmappedAccountsMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);

  return {
    totalRows,
    mappedRows,
    unmappedRows,
    coveragePercent: totalRows > 0 ? (mappedRows / totalRows) * 100 : 0,
    byStatement,
    topUnmappedAccounts,
  };
}

// ============================================================================
// Section 4.2.5: 매핑 룰 추가 (관리 UI용)
// ============================================================================

/**
 * 새 매핑 룰 추가
 */
export async function addMappingRule(params: {
  accountNameKr: string;
  standardLineId: string;
  statementType?: string | null;
  priority?: number;
  confidenceScore?: number;
}): Promise<MappingRule> {
  const {
    accountNameKr,
    standardLineId,
    statementType = null,
    priority = 10,
    confidenceScore = 1.0,
  } = params;

  const rule = await prisma.curatedFinAccountMapping.create({
    data: {
      accountNameKr,
      standardLineId,
      statementType,
      priority,
      confidenceScore,
      mappingVersion: 1,
    },
  });

  // 캐시 무효화
  invalidateMappingCache();

  return {
    id: rule.id,
    accountSourceId: rule.accountSourceId,
    accountNameKr: rule.accountNameKr,
    accountDetailPath: rule.accountDetailPath,
    statementType: rule.statementType,
    standardLineId: rule.standardLineId,
    confidenceScore: rule.confidenceScore,
    priority: rule.priority,
    mappingVersion: rule.mappingVersion,
  };
}
