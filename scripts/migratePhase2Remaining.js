/**
 * Migration: Phase 2 remaining fields
 *
 * Adds the facility booleans and text fields that were specified in the
 * original Phase 2 data model but not included in migrateEnrichment.js.
 *
 * Safe to run multiple times — uses ADD COLUMN IF NOT EXISTS.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/migratePhase2Remaining.js
 */
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function migrate() {
  const client = await pool.connect()
  try {
    console.log('Running Phase 2 remaining migration…\n')

    const columns = [
      // Short description (≤150 chars) for cards/meta; distinct from full description
      { name: 'description_short',  type: 'VARCHAR(500)',   default: null },

      // Additional facility booleans
      { name: 'sensory_area',       type: 'BOOLEAN',        default: 'false' },
      { name: 'role_play_area',     type: 'BOOLEAN',        default: 'false' },
      { name: 'party_rooms',        type: 'BOOLEAN',        default: 'false' },
      { name: 'toilets',            type: 'BOOLEAN',        default: 'true'  },
      { name: 'baby_change',        type: 'BOOLEAN',        default: 'false' },
      { name: 'disabled_access',    type: 'BOOLEAN',        default: 'false' },

      // Narrative visitor info fields
      { name: 'session_info',       type: 'TEXT',           default: null },
      { name: 'peak_times',         type: 'TEXT',           default: null },

      // Stored Google review count (separate from on-site review count)
      { name: 'review_count',       type: 'INTEGER',        default: '0' },

      // Local area intro — city-specific paragraph for SEO
      { name: 'local_area_intro',   type: 'TEXT',           default: null },
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

    // toilets defaults to true as the vast majority of venues have them,
    // but we mark it explicitly so the FacilitiesGrid can display it.
    // Venues that genuinely have no toilet facilities can be set to false.

    console.log('\n✅ Phase 2 remaining migration complete!')
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
