import { Router, Request, Response, NextFunction } from 'express';
import { JobInput, JobService } from '../services/jobService';

export interface QueueService {
  enqueue(payload: JobInput): Promise<{ queueId: number }>;
}

export function createJobRoutes(
  queueService: QueueService,
  jobService: JobService,
  secretToken: string
): Router {
  const router = Router();

  router.use((req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const providedToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (req.headers['x-secret-token'] as string | undefined);

    if (!providedToken || providedToken !== secretToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return next();
  });

  router.post('/jobs/enqueue', async (req: Request, res: Response) => {
    try {
      const { title, company, url, description } = req.body as Partial<JobInput>;

      if (!title || !url) {
        return res.status(400).json({
          error: 'Both "title" and "url" are required.',
        });
      }

      const { queueId } = await queueService.enqueue({
        title: title.trim(),
        company: company?.trim() || 'Unknown',
        url: url.trim(),
        description: description?.trim() || '',
      });

      return res.status(202).json({
        queued: true,
        queueId,
        message: 'Job accepted into queue for asynchronous cover letter generation.',
      });
    } catch (err) {
      console.error('Failed to enqueue job:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/jobs', async (_req: Request, res: Response) => {
    try {
      const jobs = await jobService.getAllJobs();
      return res.json({ count: jobs.length, jobs });
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
