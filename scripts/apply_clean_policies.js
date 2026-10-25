const { Client } = require('pg');

async function setCleanPolicies() {
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

  const sql = `
    -- 1. PROFILES: Anyone can view profiles, users can only update their own
    DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
    CREATE POLICY "profiles_select" ON public.profiles
      FOR SELECT TO public USING (true);

    DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
    CREATE POLICY "profiles_update_own" ON public.profiles
      FOR UPDATE TO authenticated
      USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

    -- 2. RIDES: Anyone can read rides (needed for lobby, join preview, home list)
    DROP POLICY IF EXISTS "rides_select_members" ON public.rides;
    DROP POLICY IF EXISTS "rides_select" ON public.rides;
    CREATE POLICY "rides_select" ON public.rides
      FOR SELECT TO public USING (true);

    DROP POLICY IF EXISTS "rides_insert" ON public.rides;
    CREATE POLICY "rides_insert" ON public.rides
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = creator_id);

    DROP POLICY IF EXISTS "rides_update_creator" ON public.rides;
    CREATE POLICY "rides_update_creator" ON public.rides
      FOR UPDATE TO authenticated
      USING (auth.uid() = creator_id OR public.is_ride_leader(id, auth.uid()))
      WITH CHECK (auth.uid() = creator_id OR public.is_ride_leader(id, auth.uid()));

    -- 3. RIDE MEMBERS: Anyone in the ride can view members
    DROP POLICY IF EXISTS "members_select" ON public.ride_members;
    CREATE POLICY "members_select" ON public.ride_members
      FOR SELECT TO public USING (true);

    DROP POLICY IF EXISTS "members_insert_self" ON public.ride_members;
    CREATE POLICY "members_insert_self" ON public.ride_members
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "members_update" ON public.ride_members;
    CREATE POLICY "members_update" ON public.ride_members
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id OR public.is_ride_leader(ride_id, auth.uid()))
      WITH CHECK (auth.uid() = user_id OR public.is_ride_leader(ride_id, auth.uid()));

    -- 4. RIDE MESSAGES: Read by all in ride, insert by authenticated user
    DROP POLICY IF EXISTS "messages_select" ON public.ride_messages;
    CREATE POLICY "messages_select" ON public.ride_messages
      FOR SELECT TO public USING (true);

    DROP POLICY IF EXISTS "messages_insert" ON public.ride_messages;
    CREATE POLICY "messages_insert" ON public.ride_messages
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);

    -- 5. Reload schema cache
    SELECT pg_notify('pgrst', 'reload schema');
  `;

  await client.query(sql);
  console.log('Clean RLS policies applied successfully!');

  const polRes = await client.query(`
    SELECT tablename, policyname, roles, cmd, qual 
    FROM pg_policies 
    WHERE schemaname = 'public'
    ORDER BY tablename, cmd;
  `);

  console.log('\nUpdated policies:');
  polRes.rows.forEach(r => console.log(`✓ [${r.tablename}] (${r.cmd}) ${r.policyname} -> ${r.roles}`));

  await client.end();
}

setCleanPolicies().catch(console.error);
