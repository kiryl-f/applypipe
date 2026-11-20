import sqlite3 from 'sqlite3';
import { logger } from '../utils/logger';

export interface QueueItem {
  id: number;
  job_data: string;
  status: string;
  attempts: number;
}

export interface QueueService {
  enqueue(jobData: any): Promise<{ queueId: number }>;
  leaseNextJob(workerId: string): Promise<QueueItem | null>;
  completeJob(queueId: number): Promise<void>;
  failJob(queueId: number, errorMessage: string, maxAttempts?: number): Promise<void>;
}

export function createQueueService(db: sqlite3.Database): QueueService {
  return {
    enqueue: (jobData: any): Promise<{ queueId: number }> => {
      return new Promise((resolve, reject) => {
        const query = `INSERT INTO job_queue (job_data) VALUES (?)`;
        db.run(query, [JSON.stringify(jobData)], function (err) {
          if (err) return reject(err);
          logger.debug('Job enqueued successfully', { queueId: this.lastID });
          resolve({ queueId: this.lastID });
        });
      });
    },

    leaseNextJob: (workerId: string): Promise<QueueItem | null> => {
      return new Promise((resolve, reject) => {
        db.serialize(() => {
          db.run('BEGIN TRANSACTION', (err) => {
            if (err) return reject(err);

            const findQuery = `
              SELECT id, job_data, status, attempts
              FROM job_queue
              WHERE status = 'PENDING'
                 OR (status = 'PROCESSING' AND locked_until < datetime('now'))
              ORDER BY created_at ASC
              LIMIT 1
            `;

            db.get(findQuery, [], (err, row: any) => {
              if (err) {
                db.run('ROLLBACK');
                return reject(err);
              }

              if (!row) {
                db.run('ROLLBACK');
                return resolve(null);
              }

              const updateQuery = `
                UPDATE job_queue
                SET status = 'PROCESSING',
                    attempts = attempts + 1,
                    locked_until = datetime('now', '+60 seconds')
                WHERE id = ?
              `;

              db.run(updateQuery, [row.id], (updateErr) => {
                if (updateErr) {
                  db.run('ROLLBACK');
                  return reject(updateErr);
                }

                db.run('COMMIT', (commitErr) => {
                  if (commitErr) return reject(commitErr);
                  logger.debug(`Worker ${workerId} leased queue item`, { queueId: row.id });
                  resolve(row as QueueItem);
                });
              });
            });
          });
        });
      });
    },

    completeJob: (queueId: number): Promise<void> => {
      return new Promise((resolve, reject) => {
        const query = `UPDATE job_queue SET status = 'COMPLETED', locked_until = NULL WHERE id = ?`;
        db.run(query, [queueId], (err) => {
          if (err) return reject(err);
          logger.debug('Queue item marked completed', { queueId });
          resolve();
        });
      });
    },

    failJob: (queueId: number, errorMessage: string, maxAttempts = 3): Promise<void> => {
      return new Promise((resolve, reject) => {
        db.get(`SELECT attempts FROM job_queue WHERE id = ?`, [queueId], (err, row: any) => {
          if (err) return reject(err);

          const attempts = row ? row.attempts : 0;
          const newStatus = attempts >= maxAttempts ? 'DEAD_LETTER' : 'PENDING';

          const updateQuery = `
            UPDATE job_queue
            SET status = ?,
                error_message = ?,
                locked_until = NULL
            WHERE id = ?
          `;

          db.run(updateQuery, [newStatus, errorMessage, queueId], (updateErr) => {
            if (updateErr) return reject(updateErr);
            logger.warn(`Queue item failed and routed to ${newStatus}`, { queueId, attempts, error: errorMessage });
            resolve();
          });
        });
      });
    },
  };
}
