import dotenv from 'dotenv';
dotenv.config(); // ✅ Run this first before importing other internal modules

import app from './src/app';
import { connectDB } from './src/config/db';

const port = process.env.PORT || 3000;

async function start() {
  try {
    await connectDB();
    app.listen(port, () => {
      console.log(`server is listening on port ${port}`);
    });
  } catch (error) {
    console.error('startup crash:', error);
    process.exit(1);
  }
}
start();
