import express from 'express';
import cors from 'cors';
import { config } from './config';
import { setupDatabase } from './db/database';
import { createJobService } from './services/jobService';
import { createJobRoutes } from './routes/jobRoutes';

const app = express();
app.use(express.json());
app.use(cors());

const db = setupDatabase(config.dbPath);
const jobService = createJobService(db);
const jobRoutes = createJobRoutes(jobService, config.secretToken);

app.use('/api', jobRoutes);

app.listen(config.port, () => {
  console.log(`🚀 ApplyPipe backend running on port ${config.port}`);
});
