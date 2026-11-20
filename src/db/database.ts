import sqlite3 from 'sqlite3';
import { logger } from '../utils/logger';

export function setupDatabase(dbPath: string): sqlite3.Database {
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      logger.error('Failed to connect to SQLite database', { error: err.message });
      throw err;
    }
    logger.info(`✅ Connected to SQLite database at ${dbPath}`);
  });

  db.run('PRAGMA journal_mode = WAL;');
  db.run('PRAGMA foreign_keys = ON;');

  db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company TEXT,
      url TEXT UNIQUE NOT NULL,
      description TEXT,
      cover_letter TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS job_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_data TEXT NOT NULL, -- JSON stringified job payload
      status TEXT DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED, DEAD_LETTER
      attempts INTEGER DEFAULT 0,
      locked_until DATETIME DEFAULT NULL,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
}
