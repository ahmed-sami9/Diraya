import {Pool} from "pg"
import dotenv from "dotenv"
dotenv.config()

const pool = new Pool({
  host: "localhost",
  port: 5432,
  database: "diraya_app_db",
  user: "postgres",
  password: "Abcd1910@@@@@",
});

// test the connection immediately
pool.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch((err) => console.error("❌ Connection failed:", err.message));

export default pool;
// dotenv.config()
// const connectionString = process.env.DATABASE_URL
// const pool = new Pool({
//     connectionString: connectionString
// })

// export default pool