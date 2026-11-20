import { config } from './config/index';
import { setupDatabase } from './db/database.js';
import { createQueueService } from './services/queueService.js';
import { createJobService } from './services/jobService.js';
import { createGreenhouseScraper } from './scraper/sources/greenhouseScraper.js';
import { createScraperProducer } from './scraper/scraperProducer.js';

async function main() {
  // 1. Initialize shared SQLite connection once at the root
  const db = setupDatabase(config.dbPath);

  // 2. Wire services via manual DI
  const queueService = createQueueService(db);
  const jobService = createJobService(db);

  // 3. Build a set of already-saved job URLs to avoid duplicate AI runs
  const existingJobs = await jobService.getAllJobs();
  const seenUrls = new Set(existingJobs.map((job) => job.url.trim()));

  // 4. Configure target scrapers (easy to add more boards/sources here)
  const scrapers = [
    createGreenhouseScraper({ boardToken: 'cloudflare', companyName: 'Cloudflare' }),
    createGreenhouseScraper({ boardToken: 'vercel', companyName: 'Vercel' }),
  ];

  // 5. Wire the producer
  const producer = createScraperProducer(scrapers, queueService, {
    shouldEnqueue: (job) => {
      const normalizedUrl = job.url.trim();
      if (seenUrls.has(normalizedUrl)) {
        return false;
      }
      seenUrls.add(normalizedUrl);
      return true;
    },
    enqueueDelayMs: 50,
  });

  // 6. Execute scraping with optional keyword filtering & per-source cap
  const summaries = await producer.runAll({
    keywords: ['typescript', 'node', 'backend', 'distributed'],
    limit: 10,
  });

  console.log('Scraper run summary:');
  console.table(summaries);

  // 7. Close DB cleanly so the CLI process exits without hanging
  db.close((err) => {
    if (err) {
      console.error('Error closing SQLite database:', err);
      process.exit(1);
    }
  });
}

main().catch((err) => {
  console.error('Fatal scraper error:', err);
  process.exit(1);
});
