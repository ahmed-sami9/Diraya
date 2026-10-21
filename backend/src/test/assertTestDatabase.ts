import { pool } from '../config/db';

// Tests create and delete data, so they must never touch a real database.
export async function assertTestDatabase() {
  const result = await pool.query<{ name: string }>('SELECT current_database() AS name');
  const name = result.rows[0]?.name ?? '';

  if (!name.includes('_test')) {
    throw new Error(`Refusing to run tests on "${name}". Use \`npm test\` (it uses .env.test).`);
  }
}
