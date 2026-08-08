#!/usr/bin/env node
// Regenerates data/cities-basic.json — a trimmed {slug, name, county} view of
// data/cities.json (which also carries long intro paragraphs and FAQs per
// city, ~142KB total). lib/cityBasics.ts is the only thing that should ever
// import cities-basic.json, and it exists specifically so client components
// that just need the city list (e.g. SearchForm's autocomplete) don't pull
// the full 142KB of editorial content into the browser bundle.
//
// Run this whenever data/cities.json changes.
//
//   node scripts/build-cities-basic.mjs

import { readFileSync, writeFileSync } from 'fs'

const cities = JSON.parse(readFileSync('data/cities.json', 'utf-8'))
const basic = cities.map((c) => ({ slug: c.slug, name: c.name, county: c.county }))
writeFileSync('data/cities-basic.json', JSON.stringify(basic, null, 2) + '\n')
console.log(`Wrote ${basic.length} cities to data/cities-basic.json`)
