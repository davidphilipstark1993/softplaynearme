/**
 * Scrape venue websites for amenity information
 *
 * Usage: npm run scrape:amenities
 *
 * Fetches each venue's website and extracts:
 * - Toddler area / baby area
 * - Party packages
 * - Cafe / food options
 * - Parking information
 * - SEN friendly sessions
 * - Wheelchair access
 * - WiFi
 */

import pg from 'pg';

const { Pool } = pg;

// Configuration
const CONFIG = {
  databaseUrl: process.env.DATABASE_URL?.replace(/\\n$/, ''),
  batchSize: 5, // Process 5 venues at a time
  delayMs: 1000, // Delay between batches to avoid rate limiting
  timeoutMs: 10000, // Request timeout
  citySlug: process.argv[2] || null // Optional: filter by city
};

if (!CONFIG.databaseUrl) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

/**
 * Keywords to search for each amenity
 */
const AMENITY_KEYWORDS = {
  toddler_area: [
    'toddler', 'under 3', 'under 4', 'under-3', 'under-4', 'baby',
    'little ones', 'tots', 'infant', 'crawlers', '0-3', '0-4',
    'separate area', 'dedicated area', 'toddler zone', 'baby zone',
    'soft play area for younger', 'younger children'
  ],
  baby_area: [
    'baby', 'infant', 'under 1', 'under 2', 'sensory baby', 'baby play',
    'babies welcome', '0-1', '0-2', 'crawlers'
  ],
  parties: [
    'party', 'parties', 'birthday', 'celebration', 'party package',
    'party room', 'private hire', 'exclusive hire', 'book a party',
    'party booking', 'host a party'
  ],
  cafe: [
    'cafe', 'café', 'coffee', 'food', 'restaurant', 'snacks', 'refreshments',
    'kitchen', 'menu', 'meals', 'drinks', 'eat', 'dining', 'hot food',
    'sandwiches', 'lunch', 'breakfast'
  ],
  parking: [
    'parking', 'car park', 'free parking', 'on-site parking', 'park',
    'spaces', 'vehicle', 'accessible parking', 'parking available'
  ],
  sen_friendly: [
    'sen', 'special needs', 'sensory', 'autism', 'autistic', 'adhd',
    'additional needs', 'quiet session', 'sen session', 'inclusive',
    'disability', 'accessible', 'sen friendly', 'sensory friendly'
  ],
  wheelchair_access: [
    'wheelchair', 'disabled access', 'accessible', 'disability',
    'step-free', 'ramp', 'lift', 'mobility'
  ],
  free_wifi: [
    'wifi', 'wi-fi', 'free wifi', 'wireless', 'internet'
  ]
};

/**
 * Fetch a URL with timeout
 */
async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SoftPlayBot/1.0; +https://softplaynearme.co.uk)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    clearTimeout(timeout);
    return response;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Extract text content from HTML (basic extraction)
 */
function extractText(html) {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&#\d+;/g, ' ');
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text.toLowerCase();
}

/**
 * Check if text contains any of the keywords
 */
function containsKeywords(text, keywords) {
  const normalizedText = text.toLowerCase();
  for (const keyword of keywords) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Scrape a venue's website for amenities
 */
async function scrapeVenue(venue) {
  if (!venue.website) {
    return { success: false, reason: 'No website' };
  }

  let url = venue.website;
  if (!url.startsWith('http')) {
    url = 'https://' + url;
  }

  try {
    const response = await fetchWithTimeout(url, CONFIG.timeoutMs);

    if (!response.ok) {
      return { success: false, reason: `HTTP ${response.status}` };
    }

    const html = await response.text();
    const text = extractText(html);

    // Extract amenities
    const amenities = {};
    for (const [key, keywords] of Object.entries(AMENITY_KEYWORDS)) {
      amenities[key] = containsKeywords(text, keywords);
    }

    return {
      success: true,
      amenities,
      textLength: text.length
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, reason: 'Timeout' };
    }
    return { success: false, reason: err.message };
  }
}

/**
 * Update venue with scraped amenities
 */
async function updateVenueAmenities(client, venueId, amenities) {
  await client.query(`
    UPDATE venues SET
      toddler_area = $1,
      baby_area = $2,
      parties = $3,
      cafe = $4,
      parking = $5,
      sen_friendly = $6,
      wheelchair_access = $7,
      free_wifi = $8,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $9
  `, [
    amenities.toddler_area,
    amenities.baby_area,
    amenities.parties,
    amenities.cafe,
    amenities.parking,
    amenities.sen_friendly,
    amenities.wheelchair_access,
    amenities.free_wifi,
    venueId
  ]);
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main scraping function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('VENUE WEBSITE SCRAPER - AMENITY DETECTION');
  console.log('='.repeat(60));
  console.log();

  const pool = new Pool({
    connectionString: CONFIG.databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    // Get venues with websites
    let query = 'SELECT id, name, website, city_slug FROM venues WHERE website IS NOT NULL AND website != \'\'';
    const params = [];

    if (CONFIG.citySlug) {
      query += ' AND city_slug = $1';
      params.push(CONFIG.citySlug);
      console.log(`Filtering by city: ${CONFIG.citySlug}`);
    }

    query += ' ORDER BY city_slug, name';

    const result = await client.query(query, params);
    const venues = result.rows;

    console.log(`Found ${venues.length} venues with websites\n`);

    let processed = 0;
    let success = 0;
    let failed = 0;

    const results = {
      toddler_area: 0,
      baby_area: 0,
      parties: 0,
      cafe: 0,
      parking: 0,
      sen_friendly: 0,
      wheelchair_access: 0,
      free_wifi: 0
    };

    // Process in batches
    for (let i = 0; i < venues.length; i += CONFIG.batchSize) {
      const batch = venues.slice(i, i + CONFIG.batchSize);

      const promises = batch.map(async (venue) => {
        console.log(`  Scraping: ${venue.name} (${venue.city_slug})`);

        const scrapeResult = await scrapeVenue(venue);

        if (scrapeResult.success) {
          await updateVenueAmenities(client, venue.id, scrapeResult.amenities);

          // Count detected amenities
          for (const [key, detected] of Object.entries(scrapeResult.amenities)) {
            if (detected) results[key]++;
          }

          const detected = Object.entries(scrapeResult.amenities)
            .filter(([, v]) => v)
            .map(([k]) => k.replace('_', ' '))
            .join(', ');

          console.log(`    ✓ Found: ${detected || 'none detected'}`);
          return true;
        } else {
          console.log(`    ✗ Failed: ${scrapeResult.reason}`);
          return false;
        }
      });

      const batchResults = await Promise.all(promises);
      success += batchResults.filter(r => r).length;
      failed += batchResults.filter(r => !r).length;
      processed += batch.length;

      console.log(`  Progress: ${processed}/${venues.length}\n`);

      // Delay between batches
      if (i + CONFIG.batchSize < venues.length) {
        await sleep(CONFIG.delayMs);
      }
    }

    // Summary
    console.log('='.repeat(60));
    console.log('SCRAPING SUMMARY');
    console.log('='.repeat(60));
    console.log(`  Total venues: ${venues.length}`);
    console.log(`  Successful: ${success}`);
    console.log(`  Failed: ${failed}`);
    console.log();
    console.log('Amenities detected:');
    for (const [key, count] of Object.entries(results)) {
      console.log(`  ${key.replace('_', ' ')}: ${count} venues`);
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
