const { Client } = require('pg');

async function run() {
  const client = new Client({
    host: 'db.sxycrtkgawrxyxzttftb.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'shreyansh9752',
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to PostgreSQL...');

  const tables = ['profiles', 'rides', 'ride_members', 'ride_messages', 'emergency_events', 'ride_history'];

  for (const table of tables) {
    // Drop all existing policies
    const res = await client.query(
      `SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = $1;`,
      [table]
    );
    for (const row of res.rows) {
      await client.query(`DROP POLICY IF EXISTS "${row.policyname}" ON public.${table};`);
      console.log(`Dropped policy ${row.policyname} on ${table}`);
    }

    // Enable RLS and create universal open policy for public (covers both anon & authenticated)
    await client.query(`
      ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "${table}_universal_access" ON public.${table}
        FOR ALL TO public
        USING (true)
        WITH CHECK (true);
    `);

    // Grant full SQL permissions
    await client.query(`
      GRANT ALL ON public.${table} TO anon, authenticated, public, service_role;
    `);
    console.log(`✓ Configured permissive policy and grants for ${table}`);
  }

  // Grant sequence usage
  await client.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, public, service_role;`);
  
  // Reload PostgREST schema cache
  await client.query(`SELECT pg_notify('pgrst', 'reload schema');`);

  console.log('\nAll policies updated and PostgREST schema cache reloaded!');

  // Verify
  const pols = await client.query(`
    SELECT tablename, policyname, cmd, roles 
    FROM pg_policies 
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);
  console.log('\nCurrent policies in public schema:');
  pols.rows.forEach(p => console.log(`- [${p.tablename}] (${p.cmd}) ${p.policyname} -> ${p.roles}`));

  await client.end();
}

run().catch(console.error);
