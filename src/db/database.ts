import sqlite3 from 'sqlite3';
import path from 'path';

export function setupDatabase(dbFilePath: string): sqlite3.Database {
  const resolvedPath = path.resolve(dbFilePath);

  const db = new sqlite3.Database(resolvedPath, (err) => {
    if (err) {
      console.log('❌ Error connecting to SQLite database:', err.message);
      process.exit(1);
    }
    console.log(`✅ Connected to SQLite database at ${resolvedPath}`);
  });

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        company TEXT,
        url TEXT UNIQUE NOT NULL,
        description TEXT,
        cover_letter TEXT,
        status TEXT DEFAULT 'New',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  return db;
}
