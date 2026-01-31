/**
 * Quick script to check what market values exist in the database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking market distribution in database...\n');

  // Get all unique corpCls values
  const markets = await prisma.rawDartCorpMaster.groupBy({
    by: ['corpCls'],
    _count: {
      corpCls: true,
    },
    where: {
      stockCode: { not: null },
    },
  });

  console.log('Market Distribution (Listed Companies Only):');
  console.log('===========================================');

  for (const market of markets) {
    const label =
      market.corpCls === 'Y' ? 'KOSPI' :
      market.corpCls === 'K' ? 'KOSDAQ' :
      market.corpCls === 'N' ? 'KONEX' :
      market.corpCls === 'E' ? 'OTHER' :
      'UNKNOWN';

    console.log(`${label.padEnd(10)} (${market.corpCls}): ${market._count.corpCls} companies`);
  }

  console.log('\n');

  // Sample companies from each market
  console.log('Sample Companies:');
  console.log('=================');

  for (const market of markets) {
    const samples = await prisma.rawDartCorpMaster.findMany({
      where: {
        corpCls: market.corpCls,
        stockCode: { not: null },
      },
      select: {
        corpName: true,
        stockCode: true,
        corpCls: true,
      },
      take: 3,
    });

    console.log(`\n${market.corpCls}:`);
    for (const company of samples) {
      console.log(`  - ${company.corpName} (${company.stockCode})`);
    }
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
