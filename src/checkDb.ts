import { config } from './config';
import { setupDatabase } from './db/database.js';
import { createJobService } from './services/jobService.js';

function getTableNames(db: ReturnType<typeof setupDatabase>): Promise<string[]> {
  return new Promise((resolve, reject) => {
    db.all<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      (err, rows) => {
        if (err) reject(err);
        else resolve((rows ?? []).map((r) => r.name));
      }
    );
  });
}

function getQueueCounts(
  db: ReturnType<typeof setupDatabase>,
  tableName: string
): Promise<Array<{ status: string; count: number }>> {
  return new Promise((resolve, reject) => {
    db.all<{ status: string; count: number }>(
      `SELECT status, COUNT(*) AS count FROM "${tableName}" GROUP BY status ORDER BY status`,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows ?? []);
      }
    );
  });
}

async function main() {
  const db = setupDatabase(config.dbPath);
  const jobService = createJobService(db);

  const targetIdArg = process.argv[2];

  try {
    // 1. Discover actual table names in SQLite
    const tables = await getTableNames(db);
    console.log('\n=== SQLite Tables ===');
    console.log(tables.join(', ') || '(none)');

    const queueTable = tables.find((t) => t.toLowerCase().includes('queue'));
    if (queueTable) {
      const queueCounts = await getQueueCounts(db, queueTable);
      console.log(`\n=== Queue Status (${queueTable}) ===`);
      if (queueCounts.length === 0) {
        console.log('Queue is empty.');
      } else {
        console.table(queueCounts);
      }
    }

    // 2. Show saved jobs overview via jobService
    const jobs = await jobService.getAllJobs();
    console.log(`\n=== Saved Jobs (${jobs.length}) ===`);

    if (jobs.length === 0) {
      console.log('No jobs saved yet.');
      return;
    }

    console.table(
      jobs.map((job) => ({
        id: job.id,
        company: job.company,
        title: job.title,
        letterChars: (job as { coverLetter?: string; cover_letter?: string }).coverLetter?.length ??
          (job as { coverLetter?: string; cover_letter?: string }).cover_letter?.length ??
          0,
        url: job.url,
      }))
    );

    // 3. Print full cover letter for a specific job ID (defaults to first/latest job)
    const selectedJob = targetIdArg
      ? jobs.find((j) => String(j.id) === targetIdArg)
      : jobs[0];

    if (!selectedJob) {
      console.log(`\nNo saved job found with id=${targetIdArg}`);
      return;
    }

    const coverLetter =
      (selectedJob as { coverLetter?: string; cover_letter?: string }).coverLetter ??
      (selectedJob as { coverLetter?: string; cover_letter?: string }).cover_letter ??
      '';

    console.log(`\n=== Cover Letter Preview (id=${selectedJob.id}) ===`);
    console.log(`${selectedJob.company} — ${selectedJob.title}`);
    console.log(`URL: ${selectedJob.url}`);
    console.log('------------------------------------------------------------');
    console.log(coverLetter || '(empty cover letter)');
    console.log('------------------------------------------------------------\n');
  } finally {
    db.close((err) => {
      if (err) {
        console.error('Error closing SQLite database:', err);
        process.exit(1);
      }
    });
  }
}

main().catch((err) => {
  console.error('Failed to inspect database:', err);
  process.exit(1);
});
