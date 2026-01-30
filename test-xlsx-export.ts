/**
 * XLSX Export Test Script
 *
 * Tests Excel export functionality
 */

import prisma from './lib/db';
import { exportToXlsx } from './lib/viewer';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('='.repeat(80));
  console.log('FMWP XLSX Export Test');
  console.log('='.repeat(80));

  try {
    // Find latest snapshot
    const snapshot = await prisma.modelSnapshot.findFirst({
      include: {
        entity: {
          select: { displayName: true, corpCode: true },
        },
        _count: {
          select: { viewerSheets: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!snapshot) {
      console.log('\n❌ No snapshots found');
      console.log('💡 Run: npx tsx test-model.ts\n');
      process.exit(1);
    }

    if (snapshot._count.viewerSheets === 0) {
      console.log(`\n⚠️  Snapshot ${snapshot.id} has no viewer sheets`);
      console.log('💡 Run: npx tsx test-viewer.ts\n');
      process.exit(1);
    }

    console.log('\n✅ Found snapshot with viewer sheets:');
    console.log(`   Entity: ${snapshot.entity?.displayName}`);
    console.log(`   Snapshot ID: ${snapshot.id.slice(0, 24)}...`);
    console.log(`   Viewer Sheets: ${snapshot._count.viewerSheets}`);
    console.log();

    // Export to XLSX
    console.log('Exporting to XLSX...\n');

    const startTime = Date.now();
    const result = await exportToXlsx({
      snapshotId: snapshot.id,
      includeSheets: ['IS', 'BS', 'CF', 'Summary', 'Checks'],
      includeFormulas: false,
      includeFormatting: true,
      companyName: snapshot.entity?.displayName || 'Financial Model',
    });

    const duration = Date.now() - startTime;

    if (!result.success) {
      throw new Error(`Export failed: ${result.error}`);
    }

    console.log(`✅ XLSX export successful (${duration}ms)`);
    console.log(`   File name: ${result.fileName}`);
    console.log(`   Buffer size: ${result.buffer?.length.toLocaleString()} bytes`);
    console.log();

    // Save to disk
    const outputDir = '/tmp';
    const outputPath = join(outputDir, result.fileName);

    if (result.buffer) {
      writeFileSync(outputPath, result.buffer);
      console.log(`💾 Saved to: ${outputPath}`);
    }

    console.log();
    console.log('='.repeat(80));
    console.log('✅ XLSX export test completed successfully!');
    console.log('='.repeat(80));
    console.log();
    console.log('💡 Next steps:');
    console.log(`   - Open file: ${outputPath}`);
    console.log(`   - API download: http://localhost:3000/api/export/${snapshot.id}`);
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
