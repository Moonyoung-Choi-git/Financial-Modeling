import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');
    const year = searchParams.get('year');

    if (!ticker || !year) {
      return NextResponse.json(
        { error: 'Missing required query parameters: ticker, year' },
        { status: 400 }
      );
    }

    const fiscalYear = parseInt(year, 10);

    // 1. DB에서 계정 데이터 조회
    const accounts = await prisma.financialAccount.findMany({
      where: {
        ticker: ticker,
        fiscalYear: fiscalYear,
      },
      orderBy: {
        standardAccountCode: 'asc',
      },
    });

    // 2. 데이터가 없는 경우 처리
    if (accounts.length === 0) {
      // 원본 데이터(Raw Data)가 있는지 확인
      const rawExists = await prisma.sourceRawMetaIndex.findFirst({
        where: { ticker, fiscalYear },
      });

      if (!rawExists) {
        return NextResponse.json(
          { error: `No raw data found for ticker ${ticker} and year ${year}.` },
          { status: 404 }
        );
      }
    }

    // 3. 3-Statement 형태로 변환
    const response = {
      IS: accounts.filter((a) => a.statementType === 'IS').map(formatAccount),
      BS: accounts.filter((a) => a.statementType === 'BS').map(formatAccount),
      CF: accounts.filter((a) => a.statementType === 'CF').map(formatAccount),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API/Financials/3st] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

function formatAccount(account: any) {
  return {
    id: account.id,
    standardAccountCode: account.standardAccountCode,
    standardAccountName: account.standardAccountName,
    reportedAccountName: account.reportedAccountName,
    value: account.value.toString(),
    unit: account.unit,
    statementType: account.statementType,
  };
}