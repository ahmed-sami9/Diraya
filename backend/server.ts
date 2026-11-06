// First: every module below reads process.env when it loads.
import './src/config/loadEnv';

import app from './src/app';
import { connectDB } from './src/config/db';
import { EnvError, parseEnv } from './src/config/env';

async function start() {
  try {
    const env = parseEnv(process.env);
    const port = env.PORT ?? 3000;

    await connectDB();
    app.listen(port, () => {
      console.log(`server is listening on port ${port}`);
    });
  } catch (error) {
    // A settings problem needs its list, not a stack trace.
    console.error('startup crash:', error instanceof EnvError ? error.message : error);
    process.exit(1);
  }
}
start();
