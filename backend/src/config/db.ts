import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Hosted databases close idle connections. pg removes the broken one and opens
// a new one when needed; without this listener the error would crash the server.
pool.on('error', (error) => {
  console.error('Idle database connection lost:', error.message);
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
