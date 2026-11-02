/**
 * Import Soft Play venues from master CSV to Neon PostgreSQL
 *
 * Usage: npm run import:master
 *
 * Reads: data/softplay_master_populated.csv
 * Upserts to: venues table
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
  csvFile: path.join(__dirname, '..', 'data', 'softplay_master_populated.csv'),
  databaseUrl: process.env.DATABASE_URL?.replace(/\\n$/, '') // Remove trailing \n if present
};

// Validate DATABASE_URL
if (!CONFIG.databaseUrl) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

// Check CSV exists
if (!fs.existsSync(CONFIG.csvFile)) {
  console.error(`ERROR: CSV file not found: ${CONFIG.csvFile}`);
  process.exit(1);
}

/**
 * Map town names to city slugs
 */
const CITY_SLUG_MAP = {
  'hull': 'hull',
  'bridlington': 'bridlington',
  'leeds': 'leeds',
  'york': 'york',
  'beverley': 'beverley',
  'sheffield': 'sheffield',
  'bradford': 'bradford',
  'harrogate': 'harrogate',
  'scarborough': 'scarborough',
  'doncaster': 'doncaster',
  'rotherham': 'rotherham',
  'wakefield': 'wakefield',
};

/**
 * Generate URL-safe slug from name
 */
function generateSlug(name, citySlug) {
  // Name only. The URL is already /soft-play/{city}/{slug}, and `city` here is the
  // CSV's search town, not necessarily where the venue is, so appending it produced
  // slugs like party-and-play-glasgow for a Birmingham venue. See scripts/lib/venue-slug.mjs.
  return venueSlug(name, citySlug);
}

/**
 * Extract postcode from address (UK format)
 */
function extractPostcode(address) {
  if (!address) return null;
  const match = address.match(/([A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2})/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Extract coordinates from Google Maps URL
 */
function extractCoordinates(googleMapsUrl) {
  if (!googleMapsUrl) return { lat: null, lng: null };

  // Try to extract from !3d and !4d parameters
  const latMatch = googleMapsUrl.match(/!3d(-?\d+\.?\d*)/);
  const lngMatch = googleMapsUrl.match(/!4d(-?\d+\.?\d*)/);

  if (latMatch && lngMatch) {
    return {
      lat: parseFloat(latMatch[1]),
      lng: parseFloat(lngMatch[1])
    };
  }

  // Try @lat,lng format
  const atMatch = googleMapsUrl.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    return {
      lat: parseFloat(atMatch[1]),
      lng: parseFloat(atMatch[2])
    };
  }

  return { lat: null, lng: null };
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
    if (values.length >= headers.length - 1) { // Allow for missing trailing columns
      const row = {};
      headers.forEach((h, idx) => {
        row[h.trim()] = values[idx]?.trim() || '';
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
        i++;
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
 * Ensure required columns exist
 */
async function ensureColumns(client) {
  const columnsToAdd = [
    { name: 'google_maps_url', type: 'VARCHAR(1000)' },
    { name: 'notes', type: 'TEXT' },
    { name: 'category', type: 'VARCHAR(255)' },
    { name: 'rating', type: 'DECIMAL(3,2)' },
    { name: 'reviews_count', type: 'INTEGER' }
  ];

  for (const col of columnsToAdd) {
    const exists = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'venues' AND column_name = $1
    `, [col.name]);

    if (exists.rows.length === 0) {
      console.log(`  Adding ${col.name} column...`);
      await client.query(`ALTER TABLE venues ADD COLUMN ${col.name} ${col.type}`);
    }
  }
}

/**
 * Upsert a venue
 */
async function upsertVenue(client, row) {
  const town = row['Town'] || '';
  const name = row['Venue Name'] || '';
  const category = row['Category'] || '';
  const address = row['Full Address'] || '';
  const phone = row['Phone Number'] || '';
  const website = row['Website URL'] || '';
  const googleMapsUrl = row['Google Maps URL'] || '';
  const notes = row['Notes'] || '';

  if (!name || !town) {
    return { skipped: true, reason: 'Missing name or town' };
  }

  const citySlug = CITY_SLUG_MAP[town.toLowerCase()] || town.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const slug = generateSlug(name, citySlug);
  const postcode = extractPostcode(address);
  const { lat, lng } = extractCoordinates(googleMapsUrl);

  // Check if venue exists by name and city_slug (more reliable than just slug)
  const existing = await client.query(
    'SELECT id FROM venues WHERE city_slug = $1 AND (slug = $2 OR name ILIKE $3)',
    [citySlug, slug, name]
  );

  if (existing.rows.length > 0) {
    // Update existing venue
    await client.query(`
      UPDATE venues SET
        address = COALESCE(NULLIF($1, ''), address),
        postcode = COALESCE(NULLIF($2, ''), postcode),
        lat = COALESCE($3, lat),
        lng = COALESCE($4, lng),
        phone = COALESCE(NULLIF($5, ''), phone),
        website = COALESCE(NULLIF($6, ''), website),
        google_maps_url = COALESCE(NULLIF($7, ''), google_maps_url),
        notes = COALESCE(NULLIF($8, ''), notes),
        category = COALESCE(NULLIF($9, ''), category),
        last_verified_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
    `, [address, postcode, lat, lng, phone, website, googleMapsUrl, notes, category, existing.rows[0].id]);

    return { updated: true, id: existing.rows[0].id };
  } else {
    // Insert new venue
    const result = await client.query(`
      INSERT INTO venues (
        name, slug, city_slug, address, postcode,
        lat, lng, phone, website, google_maps_url,
        notes, category, last_verified_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (city_slug, slug) DO UPDATE SET
        address = COALESCE(NULLIF(EXCLUDED.address, ''), venues.address),
        postcode = COALESCE(NULLIF(EXCLUDED.postcode, ''), venues.postcode),
        lat = COALESCE(EXCLUDED.lat, venues.lat),
        lng = COALESCE(EXCLUDED.lng, venues.lng),
        phone = COALESCE(NULLIF(EXCLUDED.phone, ''), venues.phone),
        website = COALESCE(NULLIF(EXCLUDED.website, ''), venues.website),
        google_maps_url = COALESCE(NULLIF(EXCLUDED.google_maps_url, ''), venues.google_maps_url),
        notes = COALESCE(NULLIF(EXCLUDED.notes, ''), venues.notes),
        category = COALESCE(NULLIF(EXCLUDED.category, ''), venues.category),
        last_verified_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [name, slug, citySlug, address, postcode, lat, lng, phone, website, googleMapsUrl, notes, category]);

    return { inserted: true, id: result.rows[0].id };
  }
}

/**
 * Main import function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('SOFT PLAY MASTER CSV IMPORT');
  console.log('='.repeat(60));
  console.log();

  // Read CSV
  console.log(`Reading: ${CONFIG.csvFile}`);
  const content = fs.readFileSync(CONFIG.csvFile, 'utf8');
  const rows = parseCSV(content);
  console.log(`Found ${rows.length} venues in CSV\n`);

  if (rows.length === 0) {
    console.log('No venues to import');
    return;
  }

  // Show sample of data
  console.log('Sample row:');
  console.log(JSON.stringify(rows[0], null, 2));
  console.log();

  // Connect to database
  const pool = new Pool({
    connectionString: CONFIG.databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    // Ensure schema is ready
    console.log('Checking database schema...');
    await ensureColumns(client);
    console.log();

    // Import venues
    console.log('Importing venues...\n');
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    const cityCounts = {};

    for (const row of rows) {
      try {
        const result = await upsertVenue(client, row);

        const town = row['Town'] || 'unknown';
        cityCounts[town] = (cityCounts[town] || 0) + 1;

        if (result.skipped) {
          console.log(`  Skipped: ${row['Venue Name']} (${result.reason})`);
          skipped++;
        } else if (result.updated) {
          console.log(`  Updated: ${row['Venue Name']} (${town})`);
          updated++;
        } else if (result.inserted) {
          console.log(`  Inserted: ${row['Venue Name']} (${town})`);
          inserted++;
        }
      } catch (err) {
        console.error(`  Error importing ${row['Venue Name']}: ${err.message}`);
        errors++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`  Inserted: ${inserted}`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Skipped: ${skipped}`);
    if (errors > 0) {
      console.log(`  Errors: ${errors}`);
    }
    console.log(`\nTotal processed: ${inserted + updated + skipped + errors}`);

    console.log('\nVenues by city:');
    for (const [city, count] of Object.entries(cityCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${city}: ${count}`);
    }

    // Show total count in database
    const countResult = await client.query('SELECT city_slug, COUNT(*) as count FROM venues GROUP BY city_slug ORDER BY count DESC');
    console.log('\nDatabase totals by city:');
    for (const row of countResult.rows) {
      console.log(`  ${row.city_slug}: ${row.count}`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
