import { Router, Request, Response, NextFunction } from 'express';
import { JobService } from '../services/jobService';

export function createJobRoutes(jobService: JobService, secretToken: string): Router {
  const router = Router();

  // Authentication middleware for incoming pipeline data
  const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${secretToken}`) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
    next();
  };

  // POST: Receive a scraped job and its generated cover letter
  router.post('/jobs', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await jobService.saveJob(req.body);
      res.status(201).json({ message: 'Job saved successfully', ...result });
    } catch (err: any) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        res.status(409).json({ message: 'Job already exists in database.' });
        return;
      }
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  // GET: Fetch all saved jobs for a dashboard or review
  router.get('/jobs', async (_req: Request, res: Response): Promise<void> => {
    try {
      const jobs = await jobService.getAllJobs();
      res.json({ jobs });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  return router;
}
