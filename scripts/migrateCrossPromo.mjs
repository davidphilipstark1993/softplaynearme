/**
 * Migration: cross-promotion / advertising system
 *
 * Adds two tables (nothing existing is altered):
 *  - ads        — one row per advert, managed from /admin/ads
 *  - ad_events  — one row per impression or click, for /admin/ads analytics
 *
 * Distinct from venues.featured / featured_until (paid venue listings, see
 * migrateAdsAndLeads.mjs). Those promote venues inside the directory; this
 * promotes external sites and, later, third-party sponsors.
 *
 * Safe to run multiple times — CREATE ... IF NOT EXISTS throughout.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/migrateCrossPromo.mjs
 *   DATABASE_URL=... node scripts/migrateCrossPromo.mjs --seed   # also insert 3 draft house adverts
 */
import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const SEED = process.argv.includes('--seed')

async function migrate() {
  const client = await pool.connect()
  try {
    console.log('Running cross-promotion migration…\n')

    await client.query(`
      CREATE TABLE IF NOT EXISTS ads (
        id              SERIAL PRIMARY KEY,
        title           VARCHAR(120)  NOT NULL,
        description     VARCHAR(300)  NOT NULL DEFAULT '',
        cta_text        VARCHAR(40)   NOT NULL DEFAULT 'Learn more',
        destination_url TEXT          NOT NULL,
        image_url       TEXT,
        image_alt       VARCHAR(200)  NOT NULL DEFAULT '',
        -- 'house' = one of our own sites; 'sponsor' = a paying third party
        -- (rendered with a "Sponsored" label and rel="sponsored nofollow").
        advertiser_name VARCHAR(120)  NOT NULL DEFAULT 'Stark Business',
        advertiser_type VARCHAR(10)   NOT NULL DEFAULT 'house'
                        CHECK (advertiser_type IN ('house', 'sponsor')),
        utm_campaign    VARCHAR(80)   NOT NULL DEFAULT '',
        status          VARCHAR(10)   NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'active', 'archived')),
        starts_at       TIMESTAMPTZ,
        ends_at         TIMESTAMPTZ,
        priority        INTEGER       NOT NULL DEFAULT 0,
        -- placement keys from lib/ads/placements.ts, or 'all'
        placements      TEXT[]        NOT NULL DEFAULT '{}',
        -- empty = every city; otherwise only these city slugs
        city_slugs      TEXT[]        NOT NULL DEFAULT '{}',
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
      )
    `)
    console.log('  ✓ ads table')

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_ads_status_dates ON ads (status, starts_at, ends_at)`
    )
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ads_placements ON ads USING GIN (placements)`)
    console.log('  ✓ ads indexes')

    await client.query(`
      CREATE TABLE IF NOT EXISTS ad_events (
        id         BIGSERIAL PRIMARY KEY,
        ad_id      INTEGER     NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
        placement  VARCHAR(40) NOT NULL,
        event_type VARCHAR(12) NOT NULL CHECK (event_type IN ('impression', 'click')),
        page_path  VARCHAR(300),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_ad_events_ad_created ON ad_events (ad_id, created_at)`
    )
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_ad_events_created ON ad_events (created_at)`
    )
    console.log('  ✓ ad_events table + indexes')

    if (SEED) {
      const { rows } = await client.query(`SELECT count(*)::int AS n FROM ads`)
      if (rows[0].n === 0) {
        const seeds = [
          ['Listen True Crime', 'Gripping true crime podcast episodes, new cases every week. Perfect for when the kids are finally asleep.', 'Listen now', 'https://listentruecrime.com', 'listen-true-crime'],
          ['AI Founder Files', 'Real stories and practical lessons from founders building with AI.', 'Read the files', 'https://aifounderfiles.com', 'ai-founder-files'],
        ]
        for (const [title, description, cta, url, campaign] of seeds) {
          await client.query(
            `INSERT INTO ads (title, description, cta_text, destination_url, advertiser_name, utm_campaign, status, placements)
             VALUES ($1, $2, $3, $4, $1, $5, 'draft', ARRAY['all'])`,
            [title, description, cta, url, campaign]
          )
        }
        console.log('  ✓ seeded 2 draft house adverts (add artwork in /admin/ads, then activate)')
      } else {
        console.log('  – ads not empty, skipping seed')
      }
    }

    console.log('\n✅ Cross-promotion migration complete!')
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
