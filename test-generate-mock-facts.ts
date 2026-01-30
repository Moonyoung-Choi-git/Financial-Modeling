/**
 * Generate Mock Curated Facts for Testing
 *
 * Creates synthetic financial data for testing the modeling engine
 * without requiring DART API access
 */

import prisma from './lib/db';
import { Decimal } from '@prisma/client/runtime/library';

async function generateMockFacts() {
  console.log('='.repeat(80));
  console.log('Generating Mock Curated Facts for Testing');
  console.log('='.repeat(80));

  try {
    // Find or use existing entity
    let entity = await prisma.modelEntity.findFirst();

    if (!entity) {
      console.log('Creating test entity...');
      entity = await prisma.modelEntity.create({
        data: {
          id: 'test-entity-samsung',
          corpCode: '00126380',
          stockCode: '005930',
          displayName: '삼성전자 (Test Data)',
          defaultFsScope: 'CONSOLIDATED',
          fiscalYearEndMonth: 12,
        },
      });
      console.log('✅ Entity created:', entity.displayName);
    } else {
      console.log('✅ Using existing entity:', entity.displayName);
    }

    console.log('   Entity ID:', entity.id);
    console.log();

    // Generate 5 years of historical data (2020-2024)
    const years = [2020, 2021, 2022, 2023, 2024];
    const linesToGenerate = [
      // Income Statement
      { lineId: 'IS.REVENUE', values: [236806, 279600, 302231, 258940, 280000] },
      { lineId: 'IS.COGS', values: [126336, 135824, 186718, 161476, 175000] },
      { lineId: 'IS.GROSS_PROFIT', values: [110470, 143776, 115513, 97464, 105000] },
      { lineId: 'IS.SGA', values: [62902, 74096, 73988, 74101, 76000] },
      { lineId: 'IS.DA', values: [25000, 27000, 28000, 29000, 30000] },
      { lineId: 'IS.EBIT', values: [35568, 51680, 24525, 6363, 11000] },
      { lineId: 'IS.INTEREST_EXPENSE', values: [1500, 1200, 1000, 900, 800] },
      { lineId: 'IS.EBT', values: [34068, 50480, 23525, 5463, 10200] },
      { lineId: 'IS.TAXES', values: [7494, 11106, 5175, 1202, 2244] },
      { lineId: 'IS.NET_INCOME', values: [26574, 39374, 18350, 4261, 7956] },

      // Balance Sheet
      { lineId: 'BS.CASH', values: [25913, 32111, 24934, 27999, 35000] },
      { lineId: 'BS.AR', values: [33127, 41359, 42084, 35234, 38000] },
      { lineId: 'BS.INVENTORY', values: [22183, 28215, 41817, 47074, 45000] },
      { lineId: 'BS.OTHER_CA', values: [15000, 16000, 17000, 18000, 19000] },
      { lineId: 'BS.TOTAL_CA', values: [96223, 117685, 125835, 128307, 137000] },
      { lineId: 'BS.PPE_NET', values: [110385, 120744, 134733, 139505, 145000] },
      { lineId: 'BS.INTANGIBLES', values: [5000, 5500, 6000, 6500, 7000] },
      { lineId: 'BS.OTHER_NCA', values: [40000, 42000, 44000, 46000, 48000] },
      { lineId: 'BS.TOTAL_ASSETS', values: [251608, 285929, 310568, 320312, 337000] },
      { lineId: 'BS.AP', values: [7480, 8779, 12919, 14003, 15000] },
      { lineId: 'BS.OTHER_CL', values: [35000, 38000, 40000, 42000, 44000] },
      { lineId: 'BS.SHORT_DEBT', values: [8000, 7000, 6000, 5000, 4000] },
      { lineId: 'BS.TOTAL_CL', values: [50480, 53779, 58919, 61003, 63000] },
      { lineId: 'BS.LONG_DEBT', values: [15000, 14000, 13000, 12000, 11000] },
      { lineId: 'BS.OTHER_NCL', values: [10000, 11000, 12000, 13000, 14000] },
      { lineId: 'BS.TOTAL_LIABILITIES', values: [75480, 78779, 83919, 86003, 88000] },
      { lineId: 'BS.COMMON_STOCK', values: [897514, 897514, 897514, 897514, 897514] },
      { lineId: 'BS.RETAINED_EARNINGS', values: [-721386, -690364, -670865, -663205, -648514] },
      { lineId: 'BS.TOTAL_EQUITY', values: [176128, 207150, 226649, 234309, 249000] },

      // Cash Flow
      { lineId: 'CF.CFO', values: [51292, 60488, 47728, 28806, 35000] },
      { lineId: 'CF.CFI', values: [-35929, -45695, -50098, -42890, -45000] },
      { lineId: 'CF.CFF', values: [-13453, -9595, -5707, 17113, 15000] },
      { lineId: 'CF.NET_CHANGE', values: [1910, 5198, -8077, 3029, 5000] },
      { lineId: 'CF.BEGIN_CASH', values: [24003, 25913, 32111, 24934, 27999] },
      { lineId: 'CF.END_CASH', values: [25913, 32111, 24934, 27999, 35000] },
    ];

    console.log(`Generating facts for ${years.length} years...`);

    let totalCreated = 0;

    for (const line of linesToGenerate) {
      for (let i = 0; i < years.length; i++) {
        const year = years[i];
        const value = new Decimal(line.values[i]).times(1_000_000); // Convert to millions

        // Determine statement type
        const statementType = line.lineId.startsWith('IS.') ? 'IS' :
                             line.lineId.startsWith('BS.') ? 'BS' : 'CF';

        // Determine period dates
        const asOfDate = statementType === 'BS' ? new Date(year, 11, 31) : null;
        const flowStartDate = statementType !== 'BS' ? new Date(year, 0, 1) : null;
        const flowEndDate = statementType !== 'BS' ? new Date(year, 11, 31) : null;

        await prisma.curatedFinFact.upsert({
          where: {
            // Use a composite unique key simulation
            id: `mock-${entity.id}-${line.lineId}-${year}`,
          },
          create: {
            id: `mock-${entity.id}-${line.lineId}-${year}`,
            entityId: entity.id,
            corpCode: entity.corpCode,
            stockCode: entity.stockCode,
            periodType: 'ANNUAL',
            fiscalYear: year,
            fiscalQuarter: null,
            reportCode: '11011',
            fsScope: 'CONSOLIDATED',
            statementType,
            accountSourceId: null,
            accountNameKr: line.lineId,
            accountDetailPath: null,
            standardLineId: line.lineId,
            amount: value,
            currency: 'KRW',
            asOfDate,
            flowStartDate,
            flowEndDate,
            ordering: null,
            sourceRceptNo: null,
            sourcePriority: 10,
          },
          update: {
            amount: value,
          },
        });

        totalCreated++;
      }
    }

    console.log(`✅ Created ${totalCreated} curated facts`);
    console.log(`   Years: ${years.join(', ')}`);
    console.log(`   Lines per year: ${linesToGenerate.length}`);
    console.log();

    // Verify
    const factCount = await prisma.curatedFinFact.count({
      where: {
        entityId: entity.id,
        standardLineId: { not: null },
      },
    });

    console.log('🔍 Verification:');
    console.log(`   Total curated facts in DB: ${factCount}`);
    console.log(`   Entity ID: ${entity.id}`);
    console.log();

    console.log('='.repeat(80));
    console.log('✅ Mock data generation complete!');
    console.log('='.repeat(80));
    console.log();
    console.log('💡 Next steps:');
    console.log(`   npx tsx test-model.ts ${entity.id} 2024 5 5`);
    console.log();

    await prisma.$disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

generateMockFacts();
