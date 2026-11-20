import axios, { AxiosInstance } from 'axios';
import { JobScraper, ScrapedJob, ScrapeOptions } from '../types.js';

interface GreenhouseJob {
  id: number;
  title?: string;
  absolute_url?: string;
  updated_at?: string;
  content?: string;
  location?: {
    name?: string;
  };
}

interface GreenhouseBoardResponse {
  jobs?: GreenhouseJob[];
}

export interface GreenhouseScraperOptions {
  /** Greenhouse board slug (e.g., "vercel", "stripe", "cloudflare") */
  boardToken: string;
  /** Optional display name for the company; defaults to boardToken */
  companyName?: string;
  /** Request timeout in milliseconds; defaults to 10s */
  timeoutMs?: number;
  /** Optional axios instance (e.g., with shared interceptors); defaults to global axios */
  client?: AxiosInstance;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createGreenhouseScraper(
  config: GreenhouseScraperOptions
): JobScraper {
  const {
    boardToken,
    companyName = boardToken,
    timeoutMs = 10_000,
    client = axios,
  } = config;
  const endpoint = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(
    boardToken
  )}/jobs?content=true`;

  return {
    name: `greenhouse:${boardToken}`,

    async scrape(options: ScrapeOptions = {}): Promise<ScrapedJob[]> {
      const res = await client.get<GreenhouseBoardResponse>(endpoint, {
        timeout: timeoutMs,
        signal: options.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ApplyPipe/1.0',
        },
        validateStatus: () => true,
      });

      if (res.status < 200 || res.status >= 300) {
        throw new Error(
          `Greenhouse API (${boardToken}) failed with status ${res.status}`
        );
      }

      const data = res.data;
      const rawJobs = Array.isArray(data?.jobs) ? data.jobs : [];

      const normalizedKeywords = (options.keywords ?? [])
        .map((k) => k.toLowerCase().trim())
        .filter(Boolean);

      const results: ScrapedJob[] = [];

      for (const item of rawJobs) {
        if (!item.title || !item.absolute_url) continue;

        const title = item.title.trim();
        const description = item.content ? stripHtml(item.content) : '';

        if (normalizedKeywords.length > 0) {
          const haystack = `${title} ${description}`.toLowerCase();
          const matches = normalizedKeywords.some((kw) =>
            haystack.includes(kw)
          );
          if (!matches) continue;
        }

        results.push({
          title,
          company: companyName,
          url: item.absolute_url.trim(),
          description,
          externalId: String(item.id),
          postedAt: item.updated_at,
        });

        if (typeof options.limit === 'number' && results.length >= options.limit) {
          break;
        }
      }

      return results;
    },
  };
}
