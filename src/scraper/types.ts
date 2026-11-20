export interface ScrapedJob {
  title: string;
  company?: string;
  url: string;
  description?: string;
  externalId?: string;
  postedAt?: string;
}

export interface ScrapeOptions {
  signal?: AbortSignal;
  keywords?: string[];
  limit?: number;
}

export interface JobScraper {
  readonly name: string;
  scrape(options?: ScrapeOptions): Promise<ScrapedJob[]>;
}
