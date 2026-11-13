// First: every module below reads process.env when it loads.
import './src/config/loadEnv';

import app from './src/app';
import { connectDB, pool } from './src/config/db';
import { EnvError, parseEnv } from './src/config/env';

async function start() {
  try {
    const env = parseEnv(process.env);
    const port = env.PORT ?? 3000;

    await connectDB();
    const server = app.listen(port, () => {
      console.log(`server is listening on port ${port}`);
    });

    // Hosts stop the old version with SIGTERM on every deploy. Let the requests
    // in progress finish and close the database, instead of cutting them off.
    let isShuttingDown = false;
    const shutDown = (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log(`${signal} received: shutting down`);

      server.close(async () => {
        await pool.end();
        process.exit(0);
      });

      // A stuck connection must not keep the old version alive forever.
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGTERM', () => shutDown('SIGTERM'));
    process.on('SIGINT', () => shutDown('SIGINT'));
  } catch (error) {
    // A settings problem needs its list, not a stack trace.
    console.error('startup crash:', error instanceof EnvError ? error.message : error);
    process.exit(1);
  }
}
start();
