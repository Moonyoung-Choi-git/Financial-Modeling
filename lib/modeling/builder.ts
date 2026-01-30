import prisma from '@/lib/db';

interface BuildOptions {
  ticker: string;
  years: number[];
  fsDivPriority?: string[]; // e.g. ['CFS', 'OFS']
}

/**
 * 주어진 옵션에 따라 3-Statement Model 데이터를 생성합니다.
 */
export async function buildThreeStatementModel(options: BuildOptions) {
  const { ticker, years } = options;
  // 기본 우선순위: 연결(CFS) -> 개별(OFS)
  const fsDivPriority = options.fsDivPriority || ['CFS', 'OFS'];

  // 1. 해당 기간의 모든 정제된 계정 데이터 조회
  const rawAccounts = await prisma.curatedFinFact.findMany({
    where: {
      stockCode: ticker,
      fiscalYear: { in: years },
    },
    orderBy: [
      { fiscalYear: 'asc' },
      { statementType: 'asc' },
      { ordering: 'asc' },
    ],
  });

  const modelData: Record<string, any> = {};

  // 2. 연도별 모델링 수행
  for (const year of years) {
    const accountsByYear = rawAccounts.filter((a) => a.fiscalYear === year);
    
    if (accountsByYear.length === 0) continue;

    // 2-1. FS Scope (연결/개별) 선택 로직
    // fsScope: CONSOLIDATED (CFS) or SEPARATE (OFS)
    let selectedFsScope = null;
    let targetAccounts: typeof rawAccounts = [];

    for (const div of fsDivPriority) {
      const scopeMapping: Record<string, string> = {
        'CFS': 'CONSOLIDATED',
        'OFS': 'SEPARATE'
      };
      const scope = scopeMapping[div];

      const filtered = accountsByYear.filter((a) => a.fsScope === scope);
      if (filtered.length > 0) {
        selectedFsScope = div; // Keep CFS/OFS for display
        targetAccounts = filtered;
        break; // 우선순위 높은 것이 발견되면 중단
      }
    }

    // 해당 연도에 적합한 데이터가 없으면 스킵
    if (!selectedFsScope || targetAccounts.length === 0) continue;

    // 2-2. Statement Type 처리 (CIS가 있으면 IS 대신 사용)
    const hasCIS = targetAccounts.some((a) => a.statementType === 'CIS');

    // 2-3. 포맷팅 헬퍼 함수
    const format = (type: string) => {
      return targetAccounts
        .filter((a) => a.statementType === type)
        .reduce((acc: any, curr) => {
          // 표준 코드가 있으면 사용, 없으면 한글 계정명 사용
          const key = curr.standardLineId || curr.accountNameKr;
          acc[key] = {
            name: curr.accountNameKr,
            value: Number(curr.amount), // Decimal -> Number 변환
            reportedName: curr.accountNameKr,
            standardLineId: curr.standardLineId,
            unit: curr.currency || 'KRW'
          };
          return acc;
        }, {});
    };

    // 2-4. 최종 데이터 구조화
    modelData[year] = {
      meta: {
        fsDiv: selectedFsScope,
        year: year,
        source: 'DART_OPEN_API',
      },
      BS: format('BS'),
      IS: format(hasCIS ? 'CIS' : 'IS'), // 포괄손익계산서 우선 적용
      CF: format('CF'),
    };
  }

  return modelData;
}