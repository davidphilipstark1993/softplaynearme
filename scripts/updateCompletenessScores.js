/**
 * Recompute completeness_score for all venues and print a report.
 *
 * Run after bulk imports or manual data updates:
 *   DATABASE_URL=... node scripts/updateCompletenessScores.js
 *
 * Scoring (max 100):
 *   name              10  (always present)
 *   address           10
 *   phone             10
 *   website           10
 *   description       15
 *   opening_hours     10
 *   price_from        10
 *   any facility flag 10
 *   images array      5
 *   email             5
 *   lat + lng         5
 */
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const NOINDEX_THRESHOLD = 20

async function updateScores() {
  const client = await pool.connect()
  try {
    console.log('Updating completeness scores…\n')

    // Ensure the column exists before running the update
    await client.query(`
      ALTER TABLE venues ADD COLUMN IF NOT EXISTS completeness_score SMALLINT DEFAULT 0
    `)

    await client.query(`
      UPDATE venues SET completeness_score = (
        (CASE WHEN name        IS NOT NULL AND name <> ''        THEN 10 ELSE 0 END) +
        (CASE WHEN address     IS NOT NULL AND address <> ''     THEN 10 ELSE 0 END) +
        (CASE WHEN phone       IS NOT NULL AND phone <> ''       THEN 10 ELSE 0 END) +
        (CASE WHEN website     IS NOT NULL AND website <> ''     THEN 10 ELSE 0 END) +
        (CASE WHEN description IS NOT NULL AND description <> '' THEN 15 ELSE 0 END) +
        (CASE WHEN opening_hours IS NOT NULL                     THEN 10 ELSE 0 END) +
        (CASE WHEN price_from  IS NOT NULL                       THEN 10 ELSE 0 END) +
        (CASE WHEN (cafe OR parking OR parties OR toddler_area OR
                    baby_area OR sen_friendly OR wheelchair_access)
              THEN 10 ELSE 0 END) +
        (CASE WHEN images IS NOT NULL AND array_length(images, 1) > 0 THEN 5 ELSE 0 END) +
        (CASE WHEN email IS NOT NULL AND email <> ''             THEN 5 ELSE 0 END) +
        (CASE WHEN lat IS NOT NULL AND lng IS NOT NULL           THEN 5 ELSE 0 END)
      ),
      updated_at = CURRENT_TIMESTAMP
    `)

    const { rows: stats } = await client.query(`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE completeness_score >= 60)     AS rich,
        COUNT(*) FILTER (WHERE completeness_score >= 20
                           AND completeness_score <  60)     AS partial,
        COUNT(*) FILTER (WHERE completeness_score < 20)      AS thin,
        ROUND(AVG(completeness_score))                       AS avg_score
      FROM venues
    `)

    const s = stats[0]
    console.log('─────────────────────────────────────')
    console.log(`Total venues  : ${s.total}`)
    console.log(`Rich  (≥60)   : ${s.rich}  ← indexed, high priority`)
    console.log(`Partial (20-59): ${s.partial}  ← indexed, standard priority`)
    console.log(`Thin  (<20)   : ${s.thin}  ← noindex + excluded from sitemap`)
    console.log(`Average score : ${s.avg_score}`)
    console.log('─────────────────────────────────────\n')

    // Print the 20 thinnest venues so you know what to prioritise
    const { rows: thinnest } = await client.query(`
      SELECT name, city_slug, slug, completeness_score
      FROM venues
      ORDER BY completeness_score ASC, name ASC
      LIMIT 20
    `)

    if (thinnest.length > 0) {
      console.log('20 venues most in need of enrichment:')
      thinnest.forEach((v, i) => {
        const flag = v.completeness_score < NOINDEX_THRESHOLD ? ' ⚠ noindex' : ''
        console.log(
          `  ${String(i + 1).padStart(2)}. [${v.completeness_score}] ${v.name} (${v.city_slug})${flag}`
        )
      })
    }

    console.log('\n✅ Done.')
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

updateScores()
