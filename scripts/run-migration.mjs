import fs from 'fs';
import pg from 'pg';

const file = process.argv[2];
if (!file) {
  console.log('Use: node --env-file=.env.local scripts/run-migration.mjs db/migrations/FILE.sql');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.log('DATABASE_URL was not found. Check the setting name in .env.local and tell Claude.');
  process.exit(1);
}

const sql = fs.readFileSync(file, 'utf8');
const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  const before = await client.query('select count(*)::int as n from reports');
  console.log('Connected. Reports in the database before:', before.rows[0].n);

  await client.query(sql);
  console.log('Migration applied.');

  const cols = await client.query(
    "select column_name from information_schema.columns where table_name = 'reports' and column_name in ('phash','phash_chunks','dup_status','case_id') order by 1"
  );
  console.log('New columns present:', cols.rows.map((r) => r.column_name).join(', '));
  const t = await client.query("select to_regclass('public.duplicate_attempts') as t");
  console.log('duplicate_attempts table:', t.rows[0].t ? 'present' : 'MISSING');

  const after = await client.query('select count(*)::int as n from reports');
  console.log('Reports in the database after:', after.rows[0].n);
} catch (e) {
  console.log('FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
