import path from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from './schema';

export const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://norbill:norbill@localhost:5432/norbill';

export const pool = new Pool({ connectionString: DATABASE_URL });
export const db = drizzle(pool, { schema });

/** Both the database and a transaction handle expose the query builders used by the services. */
export type DbExecutor = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForDatabase(attempts = 60): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await pool.query('select 1');
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      console.log(`Database not ready yet (attempt ${attempt}/${attempts}), retrying in 1s`);
      await sleep(1000);
    }
  }
}

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: path.join(__dirname, '..', 'drizzle') });
}
