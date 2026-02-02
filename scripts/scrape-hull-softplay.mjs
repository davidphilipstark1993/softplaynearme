/**
 * Google Places API v1 Scraper for Soft Play Centres
 *
 * Usage: GOOGLE_PLACES_API_KEY=your_key npm run scrape:hull
 *
 * Outputs: hull-softplay-places.csv
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const CONFIG = {
  apiKey: process.env.GOOGLE_PLACES_API_KEY,
  location: { lat: 53.7457, lng: -0.3367 }, // Hull city centre
  radius: 15000, // 15km
  regionCode: 'GB',
  languageCode: 'en',
  queries: [
    'soft play',
    'soft play centre',
    'indoor play centre',
    'indoor playground',
    'kids play centre'
  ],
  fieldMask: [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.location',
    'places.rating',
    'places.userRatingCount',
    'places.websiteUri',
    'places.nationalPhoneNumber',
    'places.regularOpeningHours',
    'places.googleMapsUri',
    'places.types'
  ].join(','),
  outputFile: path.join(__dirname, '..', 'hull-softplay-places.csv')
};

// Validate API key
if (!CONFIG.apiKey) {
  console.error('ERROR: GOOGLE_PLACES_API_KEY environment variable is required');
  console.error('Usage: GOOGLE_PLACES_API_KEY=your_key npm run scrape:hull');
  process.exit(1);
}

/**
 * Call Google Places API v1 searchText
 */
async function searchPlaces(query) {
  const url = 'https://places.googleapis.com/v1/places:searchText';

  const body = {
    textQuery: query,
    locationBias: {
      circle: {
        center: {
          latitude: CONFIG.location.lat,
          longitude: CONFIG.location.lng
        },
        radius: CONFIG.radius
      }
    },
    regionCode: CONFIG.regionCode,
    languageCode: CONFIG.languageCode
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': CONFIG.apiKey,
      'X-Goog-FieldMask': CONFIG.fieldMask
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.places || [];
}

/**
 * Extract postcode from UK address using regex
 */
function extractPostcode(address) {
  if (!address) return '';
  // UK postcode regex
  const match = address.match(/[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}/i);
  return match ? match[0].toUpperCase() : '';
}

/**
 * Convert place to CSV row object
 */
function placeToRow(place) {
  const address = place.formattedAddress || '';
  const openingHours = place.regularOpeningHours || {};

  return {
    place_id: place.id || '',
    name: place.displayName?.text || '',
    formatted_address: address,
    postcode: extractPostcode(address),
    city: 'Hull',
    lat: place.location?.latitude || '',
    lng: place.location?.longitude || '',
    rating: place.rating || '',
    reviews_count: place.userRatingCount || '',
    website: place.websiteUri || '',
    phone: place.nationalPhoneNumber || '',
    google_maps_url: place.googleMapsUri || '',
    types: (place.types || []).join('|'),
    open_now: openingHours.openNow !== undefined ? openingHours.openNow : '',
    opening_hours_text: (openingHours.weekdayDescriptions || []).join(' | ')
  };
}

/**
 * Escape CSV field
 */
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Write results to CSV
 */
function writeCSV(places, outputPath) {
  const headers = [
    'place_id', 'name', 'formatted_address', 'postcode', 'city',
    'lat', 'lng', 'rating', 'reviews_count', 'website', 'phone',
    'google_maps_url', 'types', 'open_now', 'opening_hours_text'
  ];

  const rows = places.map(place => {
    const row = placeToRow(place);
    return headers.map(h => escapeCSV(row[h])).join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  fs.writeFileSync(outputPath, csv, 'utf8');
}

/**
 * Main scraper function
 */
async function main() {
  console.log('🔍 Google Places API Scraper - Soft Play in Hull\n');
  console.log(`Location: ${CONFIG.location.lat}, ${CONFIG.location.lng}`);
  console.log(`Radius: ${CONFIG.radius / 1000}km`);
  console.log(`Queries: ${CONFIG.queries.length}\n`);

  // Map to deduplicate by place_id
  const placesMap = new Map();
  const stats = [];

  for (const query of CONFIG.queries) {
    try {
      console.log(`Searching: "${query}"...`);
      const results = await searchPlaces(query);

      let newCount = 0;
      for (const place of results) {
        if (place.id && !placesMap.has(place.id)) {
          placesMap.set(place.id, place);
          newCount++;
        }
      }

      stats.push({ query, total: results.length, new: newCount });
      console.log(`  Found: ${results.length} results (${newCount} new unique)\n`);

      // Small delay to be nice to the API
      await new Promise(r => setTimeout(r, 200));
    } catch (error) {
      console.error(`  Error: ${error.message}\n`);
      stats.push({ query, total: 0, new: 0, error: error.message });
    }
  }

  // Convert to array
  const uniquePlaces = Array.from(placesMap.values());

  // Write CSV
  console.log('📝 Writing CSV...');
  writeCSV(uniquePlaces, CONFIG.outputFile);

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('SUMMARY');
  console.log('='.repeat(50));
  console.log('\nResults per query:');
  for (const stat of stats) {
    const status = stat.error ? `❌ ${stat.error}` : `✓ ${stat.total} found, ${stat.new} new`;
    console.log(`  "${stat.query}": ${status}`);
  }
  console.log(`\n✅ Total unique places: ${uniquePlaces.length}`);
  console.log(`📁 Output: ${CONFIG.outputFile}`);

  // Show sample of results
  if (uniquePlaces.length > 0) {
    console.log('\nSample results:');
    uniquePlaces.slice(0, 5).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.displayName?.text || 'Unknown'} - ${extractPostcode(p.formattedAddress)}`);
    });
    if (uniquePlaces.length > 5) {
      console.log(`  ... and ${uniquePlaces.length - 5} more`);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
