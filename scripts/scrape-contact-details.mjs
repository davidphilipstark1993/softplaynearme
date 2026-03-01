/**
 * Scrape contact details (including emails) from soft play websites
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse CSV
function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((h, idx) => { row[h] = values[idx]; });
      rows.push(row);
    }
  }
  return rows;
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    if (inQuotes) {
      if (char === '"' && nextChar === '"') { current += '"'; i++; }
      else if (char === '"') { inQuotes = false; }
      else { current += char; }
    } else {
      if (char === '"') { inQuotes = true; }
      else if (char === ',') { values.push(current); current = ''; }
      else { current += char; }
    }
  }
  values.push(current);
  return values;
}

// Extract emails from text
function extractEmails(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  // Filter out common false positives
  return [...new Set(matches)].filter(email =>
    !email.includes('example.com') &&
    !email.includes('domain.com') &&
    !email.includes('wixpress.com') &&
    !email.includes('sentry.io')
  );
}

// Fetch website and extract contact info
async function scrapeWebsite(url, name) {
  if (!url) return { emails: [], socialMedia: {} };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) return { emails: [], socialMedia: {} };

    const html = await response.text();
    const emails = extractEmails(html);

    // Try to find contact page
    const contactMatch = html.match(/href=["']([^"']*contact[^"']*)["']/i);
    if (contactMatch && emails.length === 0) {
      try {
        const contactUrl = new URL(contactMatch[1], url).href;
        const contactResponse = await fetch(contactUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
        });
        if (contactResponse.ok) {
          const contactHtml = await contactResponse.text();
          emails.push(...extractEmails(contactHtml));
        }
      } catch {}
    }

    // Extract social media
    const socialMedia = {};
    const fbMatch = html.match(/(?:facebook\.com|fb\.com)\/([a-zA-Z0-9.]+)/i);
    const igMatch = html.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
    const twMatch = html.match(/twitter\.com\/([a-zA-Z0-9_]+)/i);

    if (fbMatch) socialMedia.facebook = `https://facebook.com/${fbMatch[1]}`;
    if (igMatch) socialMedia.instagram = `https://instagram.com/${igMatch[1]}`;
    if (twMatch) socialMedia.twitter = `https://twitter.com/${twMatch[1]}`;

    return { emails: [...new Set(emails)], socialMedia };
  } catch (error) {
    console.log(`    Could not fetch: ${error.message}`);
    return { emails: [], socialMedia: {} };
  }
}

// Main
async function main() {
  const csvFile = path.join(__dirname, '..', 'hull-softplay-places.csv');

  console.log('Reading CSV...');
  const content = fs.readFileSync(csvFile, 'utf8');
  const venues = parseCSV(content);
  console.log(`Found ${venues.length} venues\n`);

  const results = [];

  for (const venue of venues) {
    console.log(`Scraping: ${venue.name}...`);

    const { emails, socialMedia } = await scrapeWebsite(venue.website, venue.name);

    results.push({
      name: venue.name,
      address: venue.formatted_address,
      postcode: venue.postcode,
      phone: venue.phone,
      website: venue.website,
      emails: emails,
      socialMedia: socialMedia,
      rating: venue.rating,
      reviews: venue.reviews_count,
      googleMaps: venue.google_maps_url
    });

    if (emails.length > 0) {
      console.log(`    Found emails: ${emails.join(', ')}`);
    }

    // Small delay
    await new Promise(r => setTimeout(r, 500));
  }

  // Save as JSON
  const jsonFile = path.join(__dirname, '..', 'hull-softplay-contacts.json');
  fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2));
  console.log(`\nSaved JSON: ${jsonFile}`);

  // Create detailed CSV
  const csvOutput = path.join(__dirname, '..', 'hull-softplay-full-contacts.csv');
  const csvHeaders = ['Name', 'Address', 'Postcode', 'Phone', 'Email(s)', 'Website', 'Facebook', 'Instagram', 'Rating', 'Reviews', 'Google Maps'];
  const csvRows = results.map(r => [
    r.name,
    r.address,
    r.postcode,
    r.phone,
    r.emails.join('; '),
    r.website,
    r.socialMedia.facebook || '',
    r.socialMedia.instagram || '',
    r.rating,
    r.reviews,
    r.googleMaps
  ].map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','));

  fs.writeFileSync(csvOutput, [csvHeaders.join(','), ...csvRows].join('\n'));
  console.log(`Saved CSV: ${csvOutput}`);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('CONTACT DETAILS SUMMARY');
  console.log('='.repeat(60) + '\n');

  for (const r of results) {
    console.log(`${r.name}`);
    console.log(`  Address: ${r.address}`);
    console.log(`  Phone: ${r.phone || 'N/A'}`);
    console.log(`  Email: ${r.emails.length > 0 ? r.emails.join(', ') : 'Not found'}`);
    console.log(`  Website: ${r.website || 'N/A'}`);
    if (r.socialMedia.facebook) console.log(`  Facebook: ${r.socialMedia.facebook}`);
    if (r.socialMedia.instagram) console.log(`  Instagram: ${r.socialMedia.instagram}`);
    console.log('');
  }
}

main().catch(console.error);
