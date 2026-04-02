import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_Xci4hHOpqG1f@ep-noisy-silence-abqebbn6.eu-west-2.aws.neon.tech/neondb?sslmode=require',
});

try {
  // Query 1: Venue counts per city
  console.log('=== Query 1: Venue Counts Per City ===\n');
  const result1 = await pool.query(
    'SELECT city_slug, city, COUNT(*) as count FROM venues GROUP BY city_slug, city ORDER BY count DESC'
  );
  console.table(result1.rows);

  // Query 2: Venues with descriptions
  console.log('\n=== Query 2: Venues with Descriptions (avg completeness score) ===\n');
  const result2 = await pool.query(
    'SELECT city_slug, city, COUNT(*) as count, AVG(completeness_score) as avg_score FROM venues WHERE description IS NOT NULL AND description != \'\' GROUP BY city_slug, city ORDER BY count DESC'
  );
  console.table(result2.rows);

  process.exit(0);
} catch (error) {
  console.error('Database error:', error.message);
  process.exit(1);
} finally {
  await pool.end();
}
