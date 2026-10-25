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
    SELECT tablename, policyname, roles, cmd, qual, with_check 
    FROM pg_policies 
    WHERE schemaname = 'public'
    ORDER BY tablename, cmd;
  `);

  console.log('All public policies:');
  res.rows.forEach(r => console.log(`[${r.tablename}] (${r.cmd}) ${r.policyname} -> qual: ${r.qual} | with_check: ${r.with_check}`));

  await client.end();
}

main().catch(console.error);
