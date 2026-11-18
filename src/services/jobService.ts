import sqlite3 from 'sqlite3';

export interface JobInput {
  title: string;
  company?: string;
  url: string;
  description?: string;
  cover_letter?: string;
}

export interface JobRecord extends JobInput {
  id: number;
  status: string;
  created_at: string;
}

export interface JobService {
  saveJob(jobData: JobInput): Promise<{ id: number }>;
  getAllJobs(): Promise<JobRecord[]>;
}

export function createJobService(db: sqlite3.Database): JobService {
  return {
    saveJob: (jobData: JobInput): Promise<{ id: number }> => {
      return new Promise((resolve, reject) => {
        const { title, company, url, description, cover_letter } = jobData;
        const query = `INSERT INTO jobs (title, company, url, description, cover_letter) VALUES (?, ?, ?, ?, ?)`;

        db.run(query, [title, company || null, url, description || null, cover_letter || null], function (err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        });
      });
    },

    getAllJobs: (): Promise<JobRecord[]> => {
      return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM jobs ORDER BY created_at DESC`, [], (err, rows) => {
          if (err) return reject(err);
          resolve(rows as JobRecord[]);
        });
      });
    },
  };
}
