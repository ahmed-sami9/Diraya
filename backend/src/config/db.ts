import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'diraya_app_db',
  user: 'postgres',
  password: process.env.DB_PASSWORD,
});

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
