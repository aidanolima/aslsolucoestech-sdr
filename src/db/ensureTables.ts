import { sql } from 'drizzle-orm';
import { db } from './index.ts';

export async function ensureTablesExist() {
  console.log('Ensuring tables exist...');
  
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY,
      instagram_id TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      full_name TEXT,
      niche TEXT,
      score INTEGER DEFAULT 0,
      pipeline_state TEXT NOT NULL DEFAULT 'discovered',
      channel_state TEXT NOT NULL DEFAULT 'browser_contact_pending',
      do_not_contact INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY,
      lead_id INTEGER REFERENCES leads(id),
      direction TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER DEFAULT (unixepoch()),
      variant TEXT
    );
  `);
  
  console.log('Tables checked/created.');
}
