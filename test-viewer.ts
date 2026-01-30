/**
 * Viewer Generation Test Script
 *
 * Tests the complete viewer pipeline:
 * 1. Get existing snapshot
 * 2. Generate viewer sheets
 * 3. Save to database
 * 4. Verify output
 */

import prisma from './lib/db';
import { buildSimpleModel } from './lib/modeling';
import { generateViewerSheets, saveViewerSheets } from './lib/viewer';

async function main() {
  console.log('='.repeat(80));
  console.log('FMWP Viewer Generation Test');
  console.log('='.repeat(80));

  try {
    // 1. Find the latest snapshot
    const snapshot = await prisma.modelSnapshot.findFirst({
      include: {
        entity: {
          select: {
            displayName: true,
            corpCode: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!snapshot) {
      console.log('\n❌ No snapshots found in database');
      console.log('💡 Run: npx tsx test-model.ts to create a snapshot first\n');
      process.exit(1);
    }

    console.log('\n✅ Found snapshot:');
    console.log(`   Entity: ${snapshot.entity?.displayName}`);
    console.log(`   Snapshot ID: ${snapshot.id}`);
    console.log(`   Engine: ${snapshot.calcEngineVersion}`);
    console.log(`   Created: ${snapshot.createdAt.toISOString()}`);
    console.log();

    // 2. Rebuild model to get ModelSnapshotOutput
    console.log('[1/3] Rebuilding model from entity...\n');

    const modelOutput = await buildSimpleModel({
      entityId: snapshot.entityId,
      baseYear: 2024,
      historicalYears: 5,
      forecastYears: 5,
    });

    console.log('✅ Model rebuilt successfully\n');

    // 3. Generate viewer sheets
    console.log('[2/3] Generating viewer sheets...\n');

    const startTime = Date.now();
    const viewerSheets = await generateViewerSheets(modelOutput);
    const genDuration = Date.now() - startTime;

    console.log(`✅ Generated ${viewerSheets.length} viewer sheets (${genDuration}ms)`);
    console.log();

    // Show sheet details
    console.log('📊 Viewer Sheets:');
    for (const sheet of viewerSheets) {
      console.log(`   ${sheet.sheetName}:`);
      console.log(`     - Grid: ${sheet.grid.rows} rows × ${sheet.grid.cols} cols`);
      console.log(`     - Cells: ${sheet.grid.cells.length}`);
      console.log(`     - Charts: ${sheet.charts?.length || 0}`);
    }
    console.log();

    // 4. Save to database
    console.log('[3/3] Saving viewer sheets to database...\n');

    const saveStartTime = Date.now();
    const saveResult = await saveViewerSheets({
      snapshotId: snapshot.id,
      sheets: viewerSheets,
    });
    const saveDuration = Date.now() - saveStartTime;

    if (!saveResult.success) {
      throw new Error(`Failed to save: ${saveResult.error}`);
    }

    console.log(`✅ Saved ${saveResult.sheetsCreated} sheets (${saveDuration}ms)\n`);

    // 5. Verify saved data
    const savedSheets = await prisma.modelViewerSheet.findMany({
      where: { snapshotId: snapshot.id },
      select: {
        sheetName: true,
        lastGeneratedAt: true,
        cacheHash: true,
      },
    });

    console.log('🔍 Database Verification:');
    console.log(`   Sheets in DB: ${savedSheets.length}`);
    for (const sheet of savedSheets) {
      console.log(`   - ${sheet.sheetName} (hash: ${sheet.cacheHash?.slice(0, 8)}...)`);
    }
    console.log();

    console.log('='.repeat(80));
    console.log('✅ Viewer generation test completed successfully!');
    console.log('='.repeat(80));
    console.log();
    console.log('💡 Next steps:');
    console.log(`   - View in browser: http://localhost:3000/viewer/${snapshot.id}`);
    console.log(`   - List all snapshots: http://localhost:3000/viewer`);
    console.log(`   - API endpoint: http://localhost:3000/api/viewer/${snapshot.id}`);
    console.log();

    await prisma.$disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ Test failed:');
    console.error('='.repeat(80));
    console.error(error);
    console.error();
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
