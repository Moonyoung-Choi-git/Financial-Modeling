import { Worker } from 'bullmq';
import { redis } from './lib/redis';
import { processIngestionTask } from './lib/ingestion';
import { refineFinancialData } from './lib/refinement';
import { INGESTION_QUEUE_NAME } from './lib/queue';

console.log('[Worker] Starting ingestion worker...');

const worker = new Worker(
  INGESTION_QUEUE_NAME,
  async (job) => {
    console.log(`[Worker] Processing job ${job.id} (Task: ${job.data.taskId})`);
    const rawArchiveId = await processIngestionTask(job.data.taskId);

    if (rawArchiveId) {
      console.log(`[Worker] Starting refinement for archive ${rawArchiveId}...`);
      const count = await refineFinancialData(rawArchiveId);
      console.log(`[Worker] Refinement completed. ${count} accounts mapped.`);
    }
  },
  {
    connection: redis,
    concurrency: 5, // 동시에 처리할 작업 수
  }
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed!`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
});

console.log(`[Worker] Listening on queue: ${INGESTION_QUEUE_NAME}`);