/**
 * Production Database Setup Script
 * This script will:
 * 1. Create the database schema
 * 2. Add sample data for testing
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting production database setup...\n');

  // Step 1: Create a test project
  console.log('[1/5] Creating test project...');
  const project = await prisma.modelProject.upsert({
    where: { id: 'test-project-001' },
    update: {},
    create: {
      id: 'test-project-001',
      name: 'Demo Financial Model',
      createdBy: 'admin',
    },
  });
  console.log(`✓ Project created: ${project.name}\n`);

  // Step 2: Create a test entity (company)
  console.log('[2/5] Creating test entity (Samsung Electronics)...');
  const entity = await prisma.modelEntity.upsert({
    where: { id: 'test-entity-samsung' },
    update: {},
    create: {
      id: 'test-entity-samsung',
      projectId: project.id,
      corpCode: '00126380',
      stockCode: '005930',
      displayName: 'Samsung Electronics',
      fiscalYearEndMonth: 12,
      defaultFsScope: 'CONSOLIDATED',
    },
  });
  console.log(`✓ Entity created: ${entity.displayName}\n`);

  // Step 3: Create an assumption set
  console.log('[3/5] Creating assumption set...');
  const assumptionSet = await prisma.modelAssumptionSet.upsert({
    where: { id: 'test-assumptions-001' },
    update: {},
    create: {
      id: 'test-assumptions-001',
      entityId: entity.id,
      scenarioName: 'Base',
      inputsJson: {
        revenueGrowthRate: 0.05,
        cogsPct: 0.60,
        opexPct: 0.20,
        taxRate: 0.25,
      },
      createdBy: 'admin',
    },
  });
  console.log(`✓ Assumption set created: ${assumptionSet.scenarioName}\n`);

  // Step 4: Create a model snapshot
  console.log('[4/5] Creating model snapshot...');
  const snapshot = await prisma.modelSnapshot.upsert({
    where: { id: 'test-snapshot-001' },
    update: {},
    create: {
      id: 'test-snapshot-001',
      entityId: entity.id,
      assumptionSetId: assumptionSet.id,
      usedRceptNoList: ['20231114000001'],
      calcEngineVersion: 'v1.0.0',
      snapshotHash: 'test-hash-001',
    },
  });
  console.log(`✓ Snapshot created: ${snapshot.id}\n`);

  // Step 5: Create sample output lines (Income Statement, Balance Sheet, Cash Flow)
  console.log('[5/5] Creating sample financial statement data...');

  const outputLines = [
    // Income Statement
    { statementType: 'IS', standardLineId: 'revenue', periodIndex: 0, value: '1000000', displayOrder: 1 },
    { statementType: 'IS', standardLineId: 'revenue', periodIndex: 1, value: '1100000', displayOrder: 1 },
    { statementType: 'IS', standardLineId: 'cogs', periodIndex: 0, value: '600000', displayOrder: 2 },
    { statementType: 'IS', standardLineId: 'cogs', periodIndex: 1, value: '650000', displayOrder: 2 },
    { statementType: 'IS', standardLineId: 'gross_profit', periodIndex: 0, value: '400000', displayOrder: 3 },
    { statementType: 'IS', standardLineId: 'gross_profit', periodIndex: 1, value: '450000', displayOrder: 3 },
    { statementType: 'IS', standardLineId: 'operating_income', periodIndex: 0, value: '200000', displayOrder: 4 },
    { statementType: 'IS', standardLineId: 'operating_income', periodIndex: 1, value: '230000', displayOrder: 4 },
    { statementType: 'IS', standardLineId: 'net_income', periodIndex: 0, value: '150000', displayOrder: 5 },
    { statementType: 'IS', standardLineId: 'net_income', periodIndex: 1, value: '175000', displayOrder: 5 },

    // Balance Sheet
    { statementType: 'BS', standardLineId: 'total_assets', periodIndex: 0, value: '2000000', displayOrder: 1 },
    { statementType: 'BS', standardLineId: 'total_assets', periodIndex: 1, value: '2200000', displayOrder: 1 },
    { statementType: 'BS', standardLineId: 'total_liabilities', periodIndex: 0, value: '1200000', displayOrder: 2 },
    { statementType: 'BS', standardLineId: 'total_liabilities', periodIndex: 1, value: '1300000', displayOrder: 2 },
    { statementType: 'BS', standardLineId: 'total_equity', periodIndex: 0, value: '800000', displayOrder: 3 },
    { statementType: 'BS', standardLineId: 'total_equity', periodIndex: 1, value: '900000', displayOrder: 3 },

    // Cash Flow
    { statementType: 'CF', standardLineId: 'operating_cf', periodIndex: 0, value: '180000', displayOrder: 1 },
    { statementType: 'CF', standardLineId: 'operating_cf', periodIndex: 1, value: '200000', displayOrder: 1 },
    { statementType: 'CF', standardLineId: 'investing_cf', periodIndex: 0, value: '-50000', displayOrder: 2 },
    { statementType: 'CF', standardLineId: 'investing_cf', periodIndex: 1, value: '-60000', displayOrder: 2 },
    { statementType: 'CF', standardLineId: 'financing_cf', periodIndex: 0, value: '-30000', displayOrder: 3 },
    { statementType: 'CF', standardLineId: 'financing_cf', periodIndex: 1, value: '-40000', displayOrder: 3 },
  ];

  for (const line of outputLines) {
    await prisma.modelOutputLine.create({
      data: {
        snapshotId: snapshot.id,
        statementType: line.statementType,
        standardLineId: line.standardLineId,
        periodIndex: line.periodIndex,
        fiscalYear: 2023 + line.periodIndex,
        periodType: 'ANNUAL',
        value: line.value,
        displayOrder: line.displayOrder,
        isHistorical: true,
        provenance: 'SOURCE',
      },
    });
  }
  console.log(`✓ Created ${outputLines.length} output lines\n`);

  // Create viewer sheets
  console.log('Creating viewer sheets...');
  const sheets = ['IS', 'BS', 'CF', 'Summary'];
  for (const sheetName of sheets) {
    await prisma.modelViewerSheet.upsert({
      where: {
        snapshotId_sheetName: {
          snapshotId: snapshot.id,
          sheetName,
        },
      },
      update: {},
      create: {
        snapshotId: snapshot.id,
        sheetName,
        gridJson: { rows: [], cols: [], cells: [] },
      },
    });
  }
  console.log(`✓ Created ${sheets.length} viewer sheets\n`);

  console.log('✅ Production database setup complete!\n');
  console.log('You can now:');
  console.log('1. Visit your homepage');
  console.log('2. Click "Integrity Dashboard" to see the admin panel');
  console.log('3. Visit /viewer to see the snapshot');
  console.log(`4. Visit /viewer/${snapshot.id} to see the financial model\n`);
}

main()
  .catch((e) => {
    console.error('❌ Error during setup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
