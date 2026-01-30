/**
 * Model Building Test Script
 *
 * 사용법:
 * npx tsx test-model.ts [entityId] [baseYear] [historicalYears] [forecastYears]
 *
 * 예:
 * npx tsx test-model.ts <entity-id> 2024 5 5
 *
 * 전제조건:
 * - ModelEntity가 이미 존재해야 함
 * - Curated Facts가 해당 기업에 대해 로드되어 있어야 함
 */

import { buildSimpleModel, saveModelSnapshot } from './lib/modeling';
import prisma from './lib/db';

async function main() {
  const args = process.argv.slice(2);

  let entityId = args[0];
  const baseYear = args[1] ? parseInt(args[1]) : 2024;
  const historicalYears = args[2] ? parseInt(args[2]) : 5;
  const forecastYears = args[3] ? parseInt(args[3]) : 5;

  console.log('='.repeat(80));
  console.log('FMWP 3-Statement Model Builder Test');
  console.log('='.repeat(80));

  try {
    // If entityId not provided, find the first entity with curated facts
    if (!entityId) {
      console.log('No entityId provided, searching for entity with curated facts...\n');

      const entityWithFacts = await prisma.curatedFinFact.findFirst({
        where: {
          standardLineId: { not: null },
        },
        select: {
          entityId: true,
          entity: {
            select: {
              displayName: true,
              corpCode: true,
            },
          },
        },
      });

      if (!entityWithFacts) {
        throw new Error(
          'No curated facts found in database. Please run curate pipeline first.'
        );
      }

      entityId = entityWithFacts.entityId;
      console.log(`✅ Found entity: ${entityWithFacts.entity?.displayName} (${entityWithFacts.entity?.corpCode})`);
      console.log(`   Entity ID: ${entityId}\n`);
    } else {
      // Verify entity exists
      const entity = await prisma.modelEntity.findUnique({
        where: { id: entityId },
      });

      if (!entity) {
        throw new Error(`Entity not found: ${entityId}`);
      }

      console.log(`✅ Using entity: ${entity.displayName} (${entity.corpCode})`);
      console.log(`   Entity ID: ${entityId}\n`);
    }

    console.log(`Timeline: ${historicalYears} historical + ${forecastYears} forecast years`);
    console.log(`Base Year: ${baseYear}`);
    console.log('='.repeat(80));

    // Check available historical data
    const factCount = await prisma.curatedFinFact.count({
      where: {
        entityId,
        standardLineId: { not: null },
      },
    });

    console.log(`\n📊 Available Curated Facts: ${factCount} rows\n`);

    if (factCount === 0) {
      throw new Error('No curated facts found for this entity. Run curate pipeline first.');
    }

    // 1. Build Model
    console.log('[1/2] Building 3-Statement Model...\n');

    const startTime = Date.now();

    const modelOutput = await buildSimpleModel({
      entityId,
      baseYear,
      historicalYears,
      forecastYears,
    });

    const buildDuration = Date.now() - startTime;

    console.log('✅ Model Built Successfully!');
    console.log(`   Snapshot ID: ${modelOutput.snapshotId}`);
    console.log(`   Engine Version: ${modelOutput.metadata.calcEngineVersion}`);
    console.log(`   Build Duration: ${buildDuration}ms\n`);

    // Display statement line counts
    console.log('📊 Statement Summary:');
    console.log(`   Income Statement: ${modelOutput.incomeStatement.lines.length} lines`);
    console.log(`   Balance Sheet: ${modelOutput.balanceSheet.lines.length} lines`);
    console.log(`   Cash Flow: ${modelOutput.cashFlowStatement.lines.length} lines`);
    console.log(`   Total Periods: ${modelOutput.incomeStatement.timeline.periods.length}`);
    console.log(
      `   Historical: ${modelOutput.incomeStatement.timeline.historicalCount}, Forecast: ${modelOutput.incomeStatement.timeline.forecastCount}\n`
    );

    // Display sample values from IS
    console.log('📈 Sample Income Statement Values (Revenue):');
    const revenueLine = modelOutput.incomeStatement.lines.find(
      (l) => l.lineId === 'IS.REVENUE'
    );
    if (revenueLine) {
      for (const period of modelOutput.incomeStatement.timeline.periods) {
        const value = revenueLine.values.get(period.index);
        if (value) {
          console.log(`   ${period.label}: ${value.toFixed(0)} KRW`);
        }
      }
    }
    console.log();

    // Model Checks
    console.log('🔍 Model Integrity Checks:');
    const bsCheck = modelOutput.checks.bsBalanceCheck;
    const cfCheck = modelOutput.checks.cfTieOut;

    console.log(
      `   BS Balance Check: ${bsCheck.passed ? '✅ PASS' : '❌ FAIL'} (max error: ${bsCheck.error.toFixed(2)})`
    );
    console.log(
      `   CF Tie-out Check: ${cfCheck.passed ? '✅ PASS' : '❌ FAIL'} (max error: ${cfCheck.error.toFixed(2)})`
    );

    const allChecksPassed = bsCheck.passed && cfCheck.passed;
    console.log(`   Overall: ${allChecksPassed ? '✅ ALL CHECKS PASSED' : '⚠️  SOME CHECKS FAILED'}\n`);

    // 2. Save to Database
    console.log('[2/2] Saving Model Snapshot to Database...\n');

    const saveStartTime = Date.now();

    const saveResult = await saveModelSnapshot({
      entityId,
      snapshot: modelOutput,
    });

    const saveDuration = Date.now() - saveStartTime;

    if (!saveResult.success) {
      throw new Error(`Failed to save snapshot: ${saveResult.error}`);
    }

    console.log('✅ Model Snapshot Saved!');
    console.log(`   Snapshot ID: ${saveResult.snapshotId}`);
    console.log(`   Output Lines Saved: ${saveResult.linesCreated}`);
    console.log(`   Save Duration: ${saveDuration}ms\n`);

    // Verify saved data
    const savedSnapshot = await prisma.modelSnapshot.findUnique({
      where: { id: saveResult.snapshotId },
      include: {
        _count: {
          select: { outputLines: true },
        },
      },
    });

    console.log('🔍 Database Verification:');
    console.log(`   Snapshot Record: ${savedSnapshot ? '✅ Found' : '❌ Not Found'}`);
    console.log(`   Output Lines in DB: ${savedSnapshot?._count.outputLines || 0}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Test completed successfully!');
    console.log('='.repeat(80));
    console.log('\n💡 Next steps:');
    console.log('   - View the model in database: ModelSnapshot + ModelOutputLine tables');
    console.log('   - Query specific periods: SELECT * FROM model_output_lines WHERE snapshot_id = ...');
    console.log('   - Build viewer sheets: BuildViewerSheetsJob (Phase 4)\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ Test failed:');
    console.error('='.repeat(80));
    console.error(error);
    console.error('\n💡 Troubleshooting:');
    console.error('   - Make sure you have curated facts for this entity');
    console.error('   - Run: npx tsx test-curate.ts to generate curated facts');
    console.error('   - Check that baseYear matches available fiscal years in curated_fin_facts\n');
    process.exit(1);
  }
}

main();
