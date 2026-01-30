/**
 * Test BuildModelSnapshotJob via Worker
 */

import { Queue, QueueEvents } from 'bullmq';
import { redis } from './lib/redis';

async function testWorkerModelJob() {
  console.log('='.repeat(80));
  console.log('Testing BuildModelSnapshotJob via Worker');
  console.log('='.repeat(80));

  const queue = new Queue('fmwp-ingestion', { connection: redis });
  const queueEvents = new QueueEvents('fmwp-ingestion', { connection: redis });

  try {
    console.log('Submitting job to worker queue...');

    const job = await queue.add('BuildModelSnapshotJob', {
      entityId: 'sample-entity-005930',
      baseYear: 2024,
      historicalYears: 5,
      forecastYears: 5,
    });

    console.log(`✅ Job submitted: ${job.id}`);
    console.log('   Waiting for completion...\n');

    // Wait for completion (max 30 seconds)
    const result = await job.waitUntilFinished(queueEvents, 30000);

    console.log('='.repeat(80));
    console.log('✅ Job Completed Successfully!');
    console.log('='.repeat(80));
    console.log('Result:');
    console.log(`  Snapshot ID: ${result.snapshotId}`);
    console.log(`  Lines Created: ${result.linesCreated}`);
    console.log(`  All Checks Pass: ${result.checksPass ? '✅ YES' : '⚠️  NO'}`);
    console.log();
    console.log('Checks Detail:');
    console.log(`  BS Balance Check: ${result.bsBalanceCheck.passed ? '✅ PASS' : '❌ FAIL'} (error: ${result.bsBalanceCheck.error})`);
    console.log(`  CF Tie-out: ${result.cfTieOut.passed ? '✅ PASS' : '❌ FAIL'} (error: ${result.cfTieOut.error})`);
    console.log('='.repeat(80));

    await queueEvents.close();
    await queue.close();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    await queueEvents.close();
    await queue.close();
    process.exit(1);
  }
}

testWorkerModelJob();
