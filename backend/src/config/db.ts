import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const connectDB = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('Connected to PostgreSQL');
  } catch (err: any) {
    console.error(' Database Connection failed:', err.message);
    process.exit(1); // Stop the app if DB fails
  }
};

export { pool };
