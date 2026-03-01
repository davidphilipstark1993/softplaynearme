/**
 * Generate PDF of Soft Play Centres Contact Details
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';

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
      headers.forEach((h, idx) => {
        row[h] = values[idx];
      });
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

// Main
const csvFile = path.join(__dirname, '..', 'hull-softplay-places.csv');
const pdfFile = path.join(__dirname, '..', 'hull-softplay-contacts.pdf');

console.log('Reading CSV...');
const content = fs.readFileSync(csvFile, 'utf8');
const venues = parseCSV(content);

console.log(`Found ${venues.length} venues`);

// Create PDF
const doc = new PDFDocument({ margin: 50 });
doc.pipe(fs.createWriteStream(pdfFile));

// Title
doc.fontSize(24).font('Helvetica-Bold').text('Soft Play Centres', { align: 'center' });
doc.fontSize(16).font('Helvetica').text('Hull & Surrounding Areas', { align: 'center' });
doc.moveDown();
doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, { align: 'center' });
doc.fillColor('#000');
doc.moveDown(2);

// Line
doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#ccc');
doc.moveDown();

// Venues
venues.forEach((venue, index) => {
  // Check if we need a new page
  if (doc.y > 700) {
    doc.addPage();
  }

  // Venue name
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a1a1a');
  doc.text(`${index + 1}. ${venue.name}`);

  doc.fontSize(10).font('Helvetica').fillColor('#333');

  // Address
  if (venue.formatted_address) {
    doc.text(`Address: ${venue.formatted_address}`);
  }

  // Phone
  if (venue.phone) {
    doc.text(`Phone: ${venue.phone}`);
  }

  // Website
  if (venue.website) {
    doc.fillColor('#0066cc').text(`Website: ${venue.website}`, {
      link: venue.website,
      underline: true
    });
    doc.fillColor('#333');
  }

  // Rating
  if (venue.rating) {
    doc.text(`Rating: ${venue.rating}/5 (${venue.reviews_count || 0} reviews)`);
  }

  doc.moveDown(1.5);
});

// Footer
doc.moveDown(2);
doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#ccc');
doc.moveDown();
doc.fontSize(9).fillColor('#666').text(`Total venues: ${venues.length}`, { align: 'center' });
doc.text('Data sourced from Google Places API', { align: 'center' });

doc.end();

console.log(`\nPDF created: ${pdfFile}`);
