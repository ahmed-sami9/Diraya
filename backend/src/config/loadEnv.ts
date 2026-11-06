import dotenv from 'dotenv';

// The only file that reads .env. Tests never import it, so they see only .env.test.
dotenv.config({ quiet: true });
