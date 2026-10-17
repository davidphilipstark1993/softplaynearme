/**
 * Import Soft Play venues from CSV to Neon PostgreSQL
 *
 * Usage: DATABASE_URL=your_url npm run import:hull
 *
 * Reads: hull-softplay-places.csv
 * Upserts to: venues table (by place_id)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { venueSlug } from './lib/venue-slug.mjs';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const CONFIG = {
  csvFile: path.join(__dirname, '..', 'hull-softplay-places.csv'),
  databaseUrl: process.env.DATABASE_URL
};

// Validate DATABASE_URL
if (!CONFIG.databaseUrl) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  console.error('Usage: DATABASE_URL=your_url npm run import:hull');
  process.exit(1);
}

// Check CSV exists
if (!fs.existsSync(CONFIG.csvFile)) {
  console.error(`ERROR: CSV file not found: ${CONFIG.csvFile}`);
  console.error('Run scrape:hull first to generate the CSV');
  process.exit(1);
}

/**
 * Generate the URL slug for a venue: the name only. The city is already in the
 * URL path (/soft-play/{city}/{slug}), so it is not repeated here — see
 * scripts/lib/venue-slug.mjs.
 */
function generateSlug(name, city) {
  return venueSlug(name, String(city).toLowerCase());
}

/**
 * Parse CSV file (handles quoted fields with commas)
 */
function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx];
      });
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Parse a single CSV line (handles quoted fields)
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  values.push(current);

  return values;
}

/**
 * Add place_id column if it doesn't exist
 */
async function ensurePlaceIdColumn(client) {
  // Check if column exists
  const checkResult = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'venues' AND column_name = 'place_id'
  `);

  if (checkResult.rows.length === 0) {
    console.log('Adding place_id column to venues table...');
    await client.query(`
      ALTER TABLE venues ADD COLUMN place_id VARCHAR(255) UNIQUE
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_venues_place_id ON venues(place_id)
    `);
    console.log('place_id column added!\n');
  }

  // Also add google_maps_url and opening_hours_text if missing
  const columnsToAdd = [
    { name: 'google_maps_url', type: 'VARCHAR(500)' },
    { name: 'opening_hours_text', type: 'TEXT' },
    { name: 'open_now', type: 'BOOLEAN' },
    { name: 'types', type: 'TEXT' },
    { name: 'reviews_count', type: 'INTEGER' }
  ];

  for (const col of columnsToAdd) {
    const exists = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'venues' AND column_name = $1
    `, [col.name]);

    if (exists.rows.length === 0) {
      console.log(`Adding ${col.name} column...`);
      await client.query(`ALTER TABLE venues ADD COLUMN ${col.name} ${col.type}`);
    }
  }
}

/**
 * Upsert a venue by place_id
 */
async function upsertVenue(client, row) {
  const slug = generateSlug(row.name, row.city);
  const citySlug = row.city.toLowerCase();

  // Parse opening hours if available
  let openingHoursJson = null;
  if (row.opening_hours_text) {
    // Store as simple text format in JSON
    openingHoursJson = JSON.stringify({ text: row.opening_hours_text });
  }

  const query = `
    INSERT INTO venues (
      place_id, name, slug, city_slug, address, postcode,
      lat, lng, rating, reviews_count, website, phone,
      google_maps_url, types, open_now, opening_hours_text, opening_hours,
      last_verified_at, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT (place_id) DO UPDATE SET
      name = EXCLUDED.name,
      address = EXCLUDED.address,
      postcode = EXCLUDED.postcode,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      rating = EXCLUDED.rating,
      reviews_count = EXCLUDED.reviews_count,
      website = EXCLUDED.website,
      phone = EXCLUDED.phone,
      google_maps_url = EXCLUDED.google_maps_url,
      types = EXCLUDED.types,
      open_now = EXCLUDED.open_now,
      opening_hours_text = EXCLUDED.opening_hours_text,
      opening_hours = EXCLUDED.opening_hours,
      last_verified_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id, place_id
  `;

  const values = [
    row.place_id,
    row.name,
    slug,
    citySlug,
    row.formatted_address,
    row.postcode || null,
    row.lat ? parseFloat(row.lat) : null,
    row.lng ? parseFloat(row.lng) : null,
    row.rating ? parseFloat(row.rating) : null,
    row.reviews_count ? parseInt(row.reviews_count) : null,
    row.website || null,
    row.phone || null,
    row.google_maps_url || null,
    row.types || null,
    row.open_now === 'true' ? true : row.open_now === 'false' ? false : null,
    row.opening_hours_text || null,
    openingHoursJson
  ];

  const result = await client.query(query, values);
  return result.rows[0];
}

/**
 * Main import function
 */
async function main() {
  console.log('📥 Import Soft Play venues to Neon PostgreSQL\n');

  // Read CSV
  console.log(`Reading: ${CONFIG.csvFile}`);
  const content = fs.readFileSync(CONFIG.csvFile, 'utf8');
  const rows = parseCSV(content);
  console.log(`Found ${rows.length} venues in CSV\n`);

  if (rows.length === 0) {
    console.log('No venues to import');
    return;
  }

  // Connect to database
  const pool = new Pool({
    connectionString: CONFIG.databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    // Ensure schema is ready
    await ensurePlaceIdColumn(client);

    // Import venues
    console.log('Importing venues...\n');
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        if (!row.place_id) {
          console.log(`  Skipping: ${row.name} (no place_id)`);
          continue;
        }

        // Check if exists
        const existing = await client.query(
          'SELECT id FROM venues WHERE place_id = $1',
          [row.place_id]
        );

        await upsertVenue(client, row);

        if (existing.rows.length > 0) {
          console.log(`  Updated: ${row.name}`);
          updated++;
        } else {
          console.log(`  Inserted: ${row.name}`);
          inserted++;
        }
      } catch (err) {
        console.error(`  Error importing ${row.name}: ${err.message}`);
        errors++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('IMPORT SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Inserted: ${inserted}`);
    console.log(`🔄 Updated: ${updated}`);
    if (errors > 0) {
      console.log(`❌ Errors: ${errors}`);
    }
    console.log(`\nTotal processed: ${inserted + updated + errors}`);

    // Show count in database
    const countResult = await client.query(
      "SELECT COUNT(*) FROM venues WHERE city_slug = 'hull'"
    );
    console.log(`\nTotal Hull venues in database: ${countResult.rows[0].count}`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
