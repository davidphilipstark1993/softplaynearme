// Creates the newsletter subsystem tables (subscribers, newsletters, newsletter items,
// send log). Idempotent — safe to run repeatedly, matches the CREATE TABLE IF NOT EXISTS
// convention used by scripts/setupDatabase.js.
//
// Usage: node scripts/setup-newsletter-schema.mjs   (requires DATABASE_URL in the env)
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function setupNewsletterSchema() {
  const client = await pool.connect()
  try {
    console.log('Creating newsletter tables...\n')

    // Needed for gen_random_bytes() used as the unsubscribe_token default.
    await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`)

    // ── newsletter_subscribers ────────────────────────────────────────────────
    // One row per email. A subscriber can opt into the weekly newsletter and/or
    // the events & offers list independently (Phase 5 of the spec) without ever
    // creating a second account for the same address.
    await client.query(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        weekly_newsletter BOOLEAN NOT NULL DEFAULT true,
        events_activities BOOLEAN NOT NULL DEFAULT false,
        status VARCHAR(20) NOT NULL DEFAULT 'subscribed' CHECK (status IN ('pending', 'subscribed', 'unsubscribed')),
        source VARCHAR(100),
        unsubscribe_token VARCHAR(64) NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
        sendgrid_synced BOOLEAN NOT NULL DEFAULT false,
        sendgrid_contact_id VARCHAR(255),
        confirmed_at TIMESTAMPTZ,
        confirmation_token VARCHAR(64) UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
        confirmation_sent_at TIMESTAMPTZ,
        pending_weekly BOOLEAN NOT NULL DEFAULT false,
        pending_events BOOLEAN NOT NULL DEFAULT false,
        subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        unsubscribed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
    await client.query(`ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS sendgrid_synced BOOLEAN NOT NULL DEFAULT false;`)
    await client.query(`ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS sendgrid_contact_id VARCHAR(255);`)
    console.log('newsletter_subscribers table ready')

    // ── newsletters ──────────────────────────────────────────────────────────
    // One row per issue. "type" separates the weekly roundup from ad-hoc events
    // & offers emails so each can carry its own subject/content and be sent to
    // the matching subscriber segment. issue_number/slug back the public
    // archive pages (/newsletter, /newsletter/[slug]).
    await client.query(`
      CREATE TABLE IF NOT EXISTS newsletters (
        id SERIAL PRIMARY KEY,
        type VARCHAR(20) NOT NULL DEFAULT 'weekly' CHECK (type IN ('weekly', 'events')),
        issue_number INTEGER UNIQUE,
        slug VARCHAR(255) UNIQUE,
        week_of DATE,
        subject VARCHAR(255) NOT NULL,
        intro_html TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'ready_for_review', 'approved', 'sent', 'failed')),
        scheduled_send_at TIMESTAMPTZ,
        approved_at TIMESTAMPTZ,
        approved_by VARCHAR(100),
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
    // Idempotent add-columns, for a DB that already has the table from before
    // issue_number/slug existed.
    await client.query(`ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS issue_number INTEGER UNIQUE;`)
    await client.query(`ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE;`)
    console.log('newsletters table ready')

    // ── newsletter_items ─────────────────────────────────────────────────────
    // Content blocks within an issue: featured venues (linked by id to the real
    // venues table — never duplicated), family events, offers, news and useful
    // links. display_order controls the position in the rendered email.
    // `approved` is a per-item toggle, independent of the newsletter's overall
    // status — mirrors the "X/5 podcasts ready" per-item approval pattern the
    // rest of this system's workflow is modelled on.
    await client.query(`
      CREATE TABLE IF NOT EXISTS newsletter_items (
        id SERIAL PRIMARY KEY,
        newsletter_id INTEGER NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
        item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('venue', 'event', 'offer', 'news', 'link')),
        venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        url VARCHAR(500),
        image_url VARCHAR(500),
        city_slug VARCHAR(100),
        event_date DATE,
        approved BOOLEAN NOT NULL DEFAULT false,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
    await client.query(`ALTER TABLE newsletter_items ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT false;`)
    console.log('newsletter_items table ready')

    // ── newsletter_sends ─────────────────────────────────────────────────────
    // Send log. A partial unique index blocks two successful sends of the same
    // newsletter (duplicate-send protection); failed/skipped attempts can be
    // retried and each leaves its own row for auditing.
    await client.query(`
      CREATE TABLE IF NOT EXISTS newsletter_sends (
        id SERIAL PRIMARY KEY,
        newsletter_id INTEGER NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'skipped')),
        triggered_by VARCHAR(20) NOT NULL DEFAULT 'cron' CHECK (triggered_by IN ('cron', 'manual')),
        total_recipients INTEGER NOT NULL DEFAULT 0,
        sent_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
    console.log('newsletter_sends table ready')

    // Only one non-failed send per newsletter is allowed to exist at a time.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_sends_active_unique
        ON newsletter_sends(newsletter_id)
        WHERE status IN ('running', 'completed');
    `)

    // ── newsletter_events ────────────────────────────────────────────────────
    // SendGrid engagement/suppression events (opens, clicks, bounces,
    // unsubscribes) fed by the /api/webhooks/sendgrid signature-verified
    // webhook. Admin-only visibility.
    await client.query(`
      CREATE TABLE IF NOT EXISTS newsletter_events (
        id SERIAL PRIMARY KEY,
        newsletter_id INTEGER REFERENCES newsletters(id) ON DELETE CASCADE,
        event_type VARCHAR(30) NOT NULL
          CHECK (event_type IN ('open', 'click', 'bounce', 'unsubscribe', 'group_unsubscribe', 'spamreport')),
        email VARCHAR(255) NOT NULL,
        url VARCHAR(500),
        sendgrid_group_id INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
    console.log('newsletter_events table ready')

    await client.query(`CREATE INDEX IF NOT EXISTS idx_newsletter_events_newsletter_id ON newsletter_events(newsletter_id);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_newsletter_events_type ON newsletter_events(event_type);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_newsletters_issue_number ON newsletters(issue_number);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_newsletters_slug ON newsletters(slug);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status ON newsletter_subscribers(status);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_weekly ON newsletter_subscribers(weekly_newsletter) WHERE status = 'subscribed';`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_events ON newsletter_subscribers(events_activities) WHERE status = 'subscribed';`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_newsletters_status ON newsletters(status);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_newsletters_type_week ON newsletters(type, week_of);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_newsletter_items_newsletter_id ON newsletter_items(newsletter_id);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_newsletter_sends_newsletter_id ON newsletter_sends(newsletter_id);`)
    console.log('Indexes created!')

    console.log('\nNewsletter schema setup complete!')
  } catch (error) {
    console.error('Error:', error.message)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

setupNewsletterSchema()
