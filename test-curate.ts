/**
 * Curate Module Test Script
 *
 * 사용법:
 * npx tsx test-curate.ts [corpCode] [year] [reportCode] [fsDiv]
 *
 * 예:
 * npx tsx test-curate.ts 00126380 2023 11011 CFS
 */

import { transformRawToCurated, generateMappingCoverageReport } from './lib/curate';

async function main() {
  const args = process.argv.slice(2);

  const corpCode = args[0] || '00126380'; // 삼성전자
  const bsnsYear = args[1] || '2023';
  const reprtCode = args[2] || '11011';
  const fsDiv = args[3] || 'CFS';

  console.log('='.repeat(80));
  console.log('FMWP Curate Module Test');
  console.log('='.repeat(80));
  console.log(`Corp Code: ${corpCode}`);
  console.log(`Year: ${bsnsYear}`);
  console.log(`Report Code: ${reprtCode}`);
  console.log(`FS Div: ${fsDiv}`);
  console.log('='.repeat(80));

  try {
    // 1. Transform Raw → Curated
    console.log('\n[1/2] Transforming Raw → Curated...\n');

    const result = await transformRawToCurated({
      corpCode,
      bsnsYear,
      reprtCode,
      fsDiv,
    });

    console.log('\n✅ Transform Result:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Rows Processed: ${result.rowsProcessed}`);
    console.log(`  Rows Created: ${result.rowsCreated}`);
    console.log(`  Rows Skipped: ${result.rowsSkipped}`);
    console.log(`  Parse Errors: ${result.parseErrors}`);
    console.log(`  Unmapped Rows: ${result.unmappedRows}`);
    console.log(`  Coverage: ${result.coveragePercent.toFixed(2)}%`);
    console.log(`  Duration: ${result.duration}ms`);

    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors (${result.errors.length}):`);
      result.errors.slice(0, 5).forEach((err) => console.log(`  - ${err}`));
      if (result.errors.length > 5) {
        console.log(`  ... and ${result.errors.length - 5} more`);
      }
    }

    // 2. Generate Coverage Report
    console.log('\n[2/2] Generating Mapping Coverage Report...\n');

    const coverage = await generateMappingCoverageReport({
      corpCode,
      fiscalYear: parseInt(bsnsYear),
      topN: 10,
    });

    console.log('✅ Coverage Report:');
    console.log(`  Total Rows: ${coverage.totalRows}`);
    console.log(`  Mapped: ${coverage.mappedRows}`);
    console.log(`  Unmapped: ${coverage.unmappedRows}`);
    console.log(`  Coverage: ${coverage.coveragePercent.toFixed(2)}%`);

    console.log('\n  By Statement:');
    for (const [statementType, stats] of Object.entries(coverage.byStatement)) {
      console.log(`    ${statementType}: ${stats.mapped}/${stats.total} (${stats.coverage.toFixed(1)}%)`);
    }

    if (coverage.topUnmappedAccounts.length > 0) {
      console.log('\n  Top Unmapped Accounts:');
      coverage.topUnmappedAccounts.slice(0, 10).forEach((acc) => {
        console.log(`    [${acc.statementType}] ${acc.accountNm} (${acc.count}회)`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Test completed successfully!');
    console.log('='.repeat(80));

    process.exit(0);
  } catch (error: any) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ Test failed:');
    console.error('='.repeat(80));
    console.error(error);
    process.exit(1);
  }
}

main();
