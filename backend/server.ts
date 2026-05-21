import pool from "./src/config/db";
console.log("server.ts is running")
async function createUser(name:string, email:string) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email)
     VALUES ($1, $2) RETURNING *`,
    [name, email] // values for $1, $2
  );
return rows[0]
}  
async function main() {
  const user = await createUser("test", "test");
  console.log(user);
  await pool.end(); // closes the connection so the process exits cleanly
}

main().catch(console.error);