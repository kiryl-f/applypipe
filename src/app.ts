import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { setupDatabase } from './db/database';
import { createJobService } from './services/jobService';
import { createJobRoutes } from './routes/jobRoutes';
import { createQueueService } from './services/queueService';
import { logger } from './utils/logger';

const app = express();

app.use(helmet());
app.use(cors());

app.use(express.json({ limit: '10kb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
});
app.use('/api/', limiter);

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${duration}ms`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      ip: req.ip,
    });
  });
  next();
});

const db = setupDatabase(config.dbPath);

const queueService = createQueueService(db);
const jobService = createJobService(db);
const jobRoutes = createJobRoutes(queueService, jobService, config.secretToken);

app.use('/api', jobRoutes);

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack, url: req.originalUrl });
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(config.port, () => {
  logger.info(`🚀 ApplyPipe backend running on port ${config.port}`);
});
