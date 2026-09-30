import { pool, runMigrations, waitForDatabase } from './db';
import { closeQueue } from './queue';
import { buildServer } from './server';

async function main(): Promise<void> {
  await waitForDatabase();
  await runMigrations();

  const app = buildServer();
  const port = Number(process.env.PORT ?? 4000);
  await app.listen({ port, host: '0.0.0.0' });

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down`);
    await app.close();
    await closeQueue();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
