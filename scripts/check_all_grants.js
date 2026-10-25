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

  const grants = await client.query(`
    SELECT grantee, table_name, privilege_type 
    FROM information_schema.role_table_grants 
    WHERE table_schema = 'public'
    ORDER BY table_name, grantee, privilege_type;
  `);

  console.log('Grants on public tables:');
  const grouped = {};
  grants.rows.forEach(r => {
    const key = `${r.table_name}:${r.grantee}`;
    grouped[key] = grouped[key] || [];
    grouped[key].push(r.privilege_type);
  });
  console.log(grouped);

  await client.end();
}

main().catch(console.error);
