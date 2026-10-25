const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: 'db.sxycrtkgawrxyxzttftb.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'shreyansh9752',
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  const res = await client.query(`
    SELECT policyname, roles, cmd, qual, with_check 
    FROM pg_policies 
    WHERE tablename = 'rides';
  `);

  console.log('Policies for rides:');
  res.rows.forEach(r => console.log(r));
  await client.end();
}

main().catch(console.error);
