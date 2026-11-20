import { config } from './config';
import { setupDatabase } from './db/database';
import { createQueueService } from './services/queueService';
import { createJobService } from './services/jobService';
import { createAIService } from './services/aiService'; // 👈 Import factory
import { logger } from './utils/logger';

const WORKER_ID = `worker_${Math.random().toString(36).substring(2, 7)}`;
const POLL_INTERVAL_MS = 3000;

const db = setupDatabase(config.dbPath);
const queueService = createQueueService(db);
const jobService = createJobService(db);
const aiService = createAIService(config); // 👈 Instantiate via DI factory

let isRunning = true;

async function pollQueue() {
  logger.info(`[${WORKER_ID}] Worker started and polling for jobs...`);

  while (isRunning) {
    try {
      const item = await queueService.leaseNextJob(WORKER_ID);

      if (!item) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        continue;
      }

      logger.info(`[${WORKER_ID}] Processing queue item #${item.id}`);
      const jobData = JSON.parse(item.job_data);

      try {
        const dummyResume = "Experienced Backend Engineer skilled in TypeScript, Node.js, SQLite, and REST APIs.";

        const coverLetter = await aiService.generateCoverLetter(dummyResume, jobData.description || jobData.title);

        await jobService.saveJob({
          title: jobData.title,
          company: jobData.company || 'Unknown',
          url: jobData.url || `https://example.com/job-${Date.now()}`,
          description: jobData.description || '',
          cover_letter: coverLetter,
        });

        await queueService.completeJob(item.id);
        logger.info(`[${WORKER_ID}] Successfully processed queue item #${item.id}`);

      } catch (aiError: any) {
        logger.error(`[${WORKER_ID}] Failed processing queue item #${item.id}: ${aiError.message}`);
        await queueService.failJob(item.id, aiError.message);
      }

    } catch (err: any) {
      logger.error(`[${WORKER_ID}] Worker loop error: ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

process.on('SIGINT', () => {
  logger.info(`[${WORKER_ID}] Shutting down worker gracefully...`);
  isRunning = false;
  setTimeout(() => process.exit(0), 1000);
});

pollQueue();
