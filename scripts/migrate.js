require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const password = process.env.SUPABASE_DB_PASSWORD || 'shreyansh9752';

  const client = new Client({
    host: 'db.sxycrtkgawrxyxzttftb.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: password,
    ssl: { rejectUnauthorized: false },
  });

  console.log('Connecting to Supabase PostgreSQL database...');
  await client.connect();
  console.log('Connected!');

  const sqlPath = path.join(__dirname, '../supabase/migrations/001_initial_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Executing 001_initial_schema.sql...');
  await client.query(sql);
  console.log('Schema migration completed successfully!');
  await client.end();
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
