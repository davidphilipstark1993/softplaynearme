/**
 * Migration: Enrichment fields
 *
 * Adds new columns to the venues table to support the content enrichment
 * system. Safe to run multiple times – uses ADD COLUMN IF NOT EXISTS.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/migrateEnrichment.js
 */
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function migrate() {
  const client = await pool.connect()
  try {
    console.log('Running enrichment migration…\n')

    const columns = [
      // Contact
      { name: 'email',               type: 'VARCHAR(255)',   default: null },

      // Venue classification
      { name: 'venue_type',          type: 'VARCHAR(50)',    default: "'indoor'" },
      { name: 'indoor_or_outdoor',   type: 'VARCHAR(20)',    default: "'indoor'" },

      // Age range (explicit integers, supplements age_ranges TEXT[])
      { name: 'age_range_min',       type: 'SMALLINT',       default: null },
      { name: 'age_range_max',       type: 'SMALLINT',       default: null },

      // Booking
      { name: 'accepts_walk_ins',    type: 'BOOLEAN',        default: 'true' },
      { name: 'prebooking_required', type: 'BOOLEAN',        default: 'false' },
      { name: 'membership_available',type: 'BOOLEAN',        default: 'false' },

      // Parking detail
      { name: 'free_parking',        type: 'BOOLEAN',        default: 'false' },

      // Narrative fields (owner or editor supplied)
      { name: 'what_to_expect',      type: 'TEXT',           default: null },
      { name: 'tips_before_visiting',type: 'TEXT',           default: null },

      // External ratings
      { name: 'google_rating',       type: 'DECIMAL(3,2)',   default: null },

      // Ownership / verification
      { name: 'claimed_by_owner',    type: 'BOOLEAN',        default: 'false' },
      { name: 'owner_submitted',     type: 'BOOLEAN',        default: 'false' },

      // SEO overrides (manual editors can set these; page falls back to generated)
      { name: 'seo_title',           type: 'VARCHAR(255)',   default: null },
      { name: 'meta_description',    type: 'VARCHAR(320)',   default: null },

      // Structured FAQ (JSONB array of {question, answer})
      { name: 'faq_json',            type: 'JSONB',          default: null },

      // Completeness score 0-100 (computed on write / nightly job)
      { name: 'completeness_score',  type: 'SMALLINT',       default: '0' },
    ]

    for (const col of columns) {
      const def = col.default !== null ? `DEFAULT ${col.default}` : ''
      try {
        await client.query(
          `ALTER TABLE venues ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} ${def}`
        )
        console.log(`  ✓ ${col.name}`)
      } catch (err) {
        console.warn(`  ⚠ ${col.name}: ${err.message}`)
      }
    }

    // Backfill completeness_score for existing rows so the noindex logic works
    // immediately after migration without a separate backfill run.
    console.log('\nBackfilling completeness_score for existing venues…')
    await client.query(`
      UPDATE venues SET completeness_score = (
        (CASE WHEN name       IS NOT NULL AND name <> ''    THEN 10 ELSE 0 END) +
        (CASE WHEN address    IS NOT NULL AND address <> '' THEN 10 ELSE 0 END) +
        (CASE WHEN phone      IS NOT NULL AND phone <> ''   THEN 10 ELSE 0 END) +
        (CASE WHEN website    IS NOT NULL AND website <> '' THEN 10 ELSE 0 END) +
        (CASE WHEN description IS NOT NULL AND description <> '' THEN 15 ELSE 0 END) +
        (CASE WHEN opening_hours IS NOT NULL THEN 10 ELSE 0 END) +
        (CASE WHEN price_from IS NOT NULL    THEN 10 ELSE 0 END) +
        (CASE WHEN (cafe OR parking OR parties OR toddler_area OR
                    baby_area OR sen_friendly OR wheelchair_access)
              THEN 10 ELSE 0 END) +
        (CASE WHEN images IS NOT NULL AND array_length(images, 1) > 0 THEN 10 ELSE 0 END) +
        (CASE WHEN email IS NOT NULL AND email <> '' THEN 5 ELSE 0 END)
      )
    `)
    console.log('  ✓ completeness_score backfilled')

    console.log('\n✅ Enrichment migration complete!')
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
