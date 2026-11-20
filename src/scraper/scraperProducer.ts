import { JobInput } from '../services/jobService.js';
import { JobScraper, ScrapedJob, ScrapeOptions } from './types.js';

export interface QueueProducer {
  enqueue(payload: JobInput): Promise<{ queueId: number }>;
}

export interface ScraperProducerOptions {
  shouldEnqueue?: (job: ScrapedJob) => Promise<boolean> | boolean;
  enqueueDelayMs?: number;
}

export interface ScraperRunSummary {
  scraper: string;
  fetched: number;
  enqueued: number;
  skipped: number;
  errors: number;
}

export function createScraperProducer(
  scrapers: readonly JobScraper[],
  queueService: QueueProducer,
  options: ScraperProducerOptions = {}
) {
  const shouldEnqueue = options.shouldEnqueue ?? (() => true);
  const enqueueDelayMs = options.enqueueDelayMs ?? 0;

  async function runScraper(
    scraper: JobScraper,
    scrapeOptions?: ScrapeOptions
  ): Promise<ScraperRunSummary> {
    const summary: ScraperRunSummary = {
      scraper: scraper.name,
      fetched: 0,
      enqueued: 0,
      skipped: 0,
      errors: 0,
    };

    const jobs = await scraper.scrape(scrapeOptions);
    summary.fetched = jobs.length;

    for (const job of jobs) {
      if (!job.title?.trim() || !job.url?.trim()) {
        summary.skipped += 1;
        continue;
      }

      const allowed = await shouldEnqueue(job);
      if (!allowed) {
        summary.skipped += 1;
        continue;
      }

      const payload: JobInput = {
        title: job.title.trim(),
        company: job.company?.trim() || 'Unknown',
        url: job.url.trim(),
        description: job.description?.trim() || '',
      };

      try {
        await queueService.enqueue(payload);
        summary.enqueued += 1;
      } catch (err) {
        summary.errors += 1;
        console.error(`[scraper:${scraper.name}] Failed to enqueue "${payload.title}":`, err);
      }

      if (enqueueDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, enqueueDelayMs));
      }
    }

    return summary;
  }

  async function runAll(scrapeOptions?: ScrapeOptions): Promise<ScraperRunSummary[]> {
    const summaries: ScraperRunSummary[] = [];

    for (const scraper of scrapers) {
      try {
        const summary = await runScraper(scraper, scrapeOptions);
        summaries.push(summary);
      } catch (err) {
        console.error(`[scraper:${scraper.name}] Scraper run failed:`, err);
        summaries.push({
          scraper: scraper.name,
          fetched: 0,
          enqueued: 0,
          skipped: 0,
          errors: 1,
        });
      }
    }

    return summaries;
  }

  return {
    runScraper,
    runAll,
  };
}
