/**
 * Generate comprehensive PDF of Soft Play Contact Details
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read JSON data
const jsonFile = path.join(__dirname, '..', 'hull-softplay-contacts.json');
const venues = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

// Clean up emails (remove false positives)
function cleanEmails(emails) {
  return emails.filter(e =>
    e.includes('@') &&
    !e.includes('.png') &&
    !e.includes('.jpg') &&
    !e.includes('@2x') &&
    !e.includes('mysite.com') &&
    !e.includes('example@') &&
    e.length < 50
  );
}

const pdfFile = path.join(__dirname, '..', 'hull-softplay-full-contacts.pdf');
const doc = new PDFDocument({ margin: 40, size: 'A4' });
doc.pipe(fs.createWriteStream(pdfFile));

// Title page
doc.fontSize(28).font('Helvetica-Bold').text('Soft Play Centres', { align: 'center' });
doc.fontSize(18).font('Helvetica').text('Hull & Surrounding Areas', { align: 'center' });
doc.moveDown();
doc.fontSize(14).text('Complete Contact Directory', { align: 'center' });
doc.moveDown(2);
doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, { align: 'center' });
doc.text(`Total Venues: ${venues.length}`, { align: 'center' });
doc.fillColor('#000');
doc.moveDown(4);

// Summary table
doc.fontSize(12).font('Helvetica-Bold').text('Quick Reference:');
doc.moveDown(0.5);
doc.fontSize(9).font('Helvetica');

let emailCount = 0;
venues.forEach(v => {
  const emails = cleanEmails(v.emails);
  if (emails.length > 0) emailCount++;
});

doc.text(`• Venues with email addresses found: ${emailCount}`);
doc.text(`• Venues with phone numbers: ${venues.filter(v => v.phone).length}`);
doc.text(`• Venues with websites: ${venues.filter(v => v.website).length}`);

doc.addPage();

// Detailed listings
doc.fontSize(16).font('Helvetica-Bold').text('Detailed Contact Information');
doc.moveDown();
doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#333');
doc.moveDown();

venues.forEach((venue, index) => {
  // Check if we need a new page
  if (doc.y > 700) {
    doc.addPage();
  }

  const emails = cleanEmails(venue.emails);

  // Venue header
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a365d');
  doc.text(`${index + 1}. ${venue.name}`);

  doc.fontSize(9).font('Helvetica').fillColor('#333');

  // Address
  doc.font('Helvetica-Bold').text('Address: ', { continued: true });
  doc.font('Helvetica').text(venue.address || 'N/A');

  // Postcode
  doc.font('Helvetica-Bold').text('Postcode: ', { continued: true });
  doc.font('Helvetica').text(venue.postcode || 'N/A');

  // Phone
  doc.font('Helvetica-Bold').text('Phone: ', { continued: true });
  doc.font('Helvetica').text(venue.phone || 'N/A');

  // Email
  doc.font('Helvetica-Bold').text('Email: ', { continued: true });
  if (emails.length > 0) {
    doc.font('Helvetica').fillColor('#0066cc').text(emails.join(', '));
  } else {
    doc.font('Helvetica').fillColor('#999').text('Not found - use contact form on website');
  }
  doc.fillColor('#333');

  // Website
  doc.font('Helvetica-Bold').text('Website: ', { continued: true });
  if (venue.website) {
    doc.font('Helvetica').fillColor('#0066cc').text(venue.website, { link: venue.website });
  } else {
    doc.font('Helvetica').fillColor('#999').text('N/A');
  }
  doc.fillColor('#333');

  // Social Media
  if (venue.socialMedia.facebook || venue.socialMedia.instagram) {
    doc.font('Helvetica-Bold').text('Social: ', { continued: true });
    doc.font('Helvetica');
    const social = [];
    if (venue.socialMedia.facebook && !venue.socialMedia.facebook.includes('/p') && !venue.socialMedia.facebook.includes('/tr') && !venue.socialMedia.facebook.includes('/sharer')) {
      social.push('Facebook');
    }
    if (venue.socialMedia.instagram && !venue.socialMedia.instagram.includes('/v')) {
      social.push('Instagram');
    }
    doc.text(social.length > 0 ? social.join(', ') : 'See website');
  }

  // Rating
  if (venue.rating) {
    doc.font('Helvetica-Bold').text('Google Rating: ', { continued: true });
    doc.font('Helvetica').text(`${venue.rating}/5 (${venue.reviews || 0} reviews)`);
  }

  doc.moveDown(1.2);

  // Separator line
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#eee');
  doc.moveDown(0.8);
});

// Email list page
doc.addPage();
doc.fontSize(16).font('Helvetica-Bold').fillColor('#1a365d').text('Email Addresses for Outreach');
doc.moveDown();
doc.fontSize(10).font('Helvetica').fillColor('#666');
doc.text('Copy-paste ready list of all email addresses found:');
doc.moveDown();
doc.fillColor('#333');

const allEmails = [];
venues.forEach(v => {
  const emails = cleanEmails(v.emails);
  emails.forEach(e => {
    if (!allEmails.includes(e)) {
      allEmails.push(e);
      doc.font('Helvetica-Bold').text(v.name + ': ', { continued: true });
      doc.font('Helvetica').fillColor('#0066cc').text(e);
      doc.fillColor('#333');
    }
  });
});

doc.moveDown(2);
doc.fontSize(10).font('Helvetica-Bold').text('All emails (comma separated):');
doc.moveDown(0.5);
doc.fontSize(9).font('Helvetica').fillColor('#0066cc');
doc.text(allEmails.join(', '), { width: 515 });

// Footer
doc.moveDown(3);
doc.fillColor('#666').fontSize(8);
doc.text('Data sourced from Google Places API and company websites', { align: 'center' });
doc.text('Some venues may have contact forms instead of published email addresses', { align: 'center' });

doc.end();

console.log(`PDF created: ${pdfFile}`);
console.log(`\nEmails found: ${allEmails.length}`);
console.log('\nEmail list for copy/paste:');
console.log(allEmails.join(', '));
