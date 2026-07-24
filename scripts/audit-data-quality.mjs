import { readFileSync, writeFileSync } from 'fs';

const venues = JSON.parse(readFileSync('data/generated/venues.json', 'utf-8'));
const vbt = JSON.parse(readFileSync('data/generated/venuesByTown.json', 'utf-8'));
const cities = JSON.parse(readFileSync('data/cities.json', 'utf-8'));
const skipped = JSON.parse(readFileSync('data/import-raw-skipped.json', 'utf-8'));

// ── Postcode area -> plausible city slugs (multiple areas can serve one city; one area can span several declared cities) ──
const POSTCODE_TO_CITIES = {
  AB: ['aberdeen'], IV: ['inverness'],
  B: ['birmingham'], BL: ['bolton'], BN: ['brighton'], BS: ['bristol'],
  BD: ['bradford'], HX: ['halifax'], HD: ['huddersfield'],
  CF: ['cardiff'], SA: ['swansea'],
  CO: ['colchester'], IP: ['ipswich'],
  DN: ['doncaster'], S: ['sheffield', 'barnsley'],
  EH: ['edinburgh'], G: ['glasgow'],
  FY: ['blackpool'], PR: ['bolton'],
  HU: ['hull'], YO: ['york', 'bridlington'],
  L: ['liverpool'], M: ['manchester'],
  LE: ['leicester'], LN: ['lincoln'], NG: ['nottingham'],
  LS: ['leeds'],
  LO: ['london'], E: ['london'], EC: ['london'], N: ['london'], NW: ['london'],
  SE: ['london'], SW: ['london'], W: ['london'], WC: ['london'],
  NE: ['newcastle'], SR: ['sunderland'],
  NR: ['norwich'],
  PO: ['portsmouth'], SO: ['southend'],
  SS: ['southend'],
  ST: ['stoke'],
  TN: ['hastings'],
  TS: [],
  HU_EAST_RIDING: ['hull', 'beverley'],
};
// Beverley is East Riding but shares HU postcode area with Hull
POSTCODE_TO_CITIES.HU = ['hull', 'beverley'];

const CITY_SLUGS = new Set(cities.map((c) => c.slug));

function extractPostcodeArea(pc) {
  if (!pc) return null;
  const m = String(pc).trim().toUpperCase().match(/^([A-Z]{1,2})(\d[A-Z\d]?)\s*\d[A-Z]{2}$/);
  return m ? m[1] : null;
}

function isValidPostcode(pc) {
  if (!pc) return null; // treat empty as "no postcode" not "invalid"
  return /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(String(pc).trim());
}

// ── Category heuristics ──────────────────────────────────────────────
const NOT_SOFT_PLAY_CATEGORY_HIGH = [
  'aquarium', 'bowling alley', 'escape room', 'rock climbing gym', 'climbing gym',
  'climbing wall', 'toy shop', 'toy store', 'golf course', 'adventure golf',
  'mini golf', 'shopping centre', 'shopping mall', 'swimming pool', 'water park',
  'cinema', 'movie theater', 'museum', 'zoo', 'farm shop', 'garden centre',
  'party equipment rental', 'event planner', 'wedding venue', 'pub', 'bar',
  'hotel', 'church', 'community centre', 'sports complex', 'gym', 'fitness centre',
  'car park', 'supermarket', 'department store',
];
const AMBIGUOUS_CATEGORY_MEDIUM = [
  'leisure centre', 'events venue', 'amusement park', 'trampoline park',
  'indoor golf course', 'family entertainment center', 'arcade',
  'party planner', 'inflatable', 'bouncy castle',
];
const NAME_KEYWORDS_HIGH = [
  /\bbowling\b/i, /\bbowl\b/i, /\bescape room/i, /\bclimbing\b/i, /\baquarium\b/i,
  /\btoys?\b.*(store|superstore|shop)/i, /\badventure golf\b/i, /\bmini golf\b/i,
  /\bface paint/i, /\bbouncy castles?\b/i, /\binflatables?\b/i,
  /\bcinema\b/i, /\bmuseum\b/i, /\bzoo\b/i,
];
const NAME_KEYWORDS_MEDIUM = [
  /\btrampoline\b/i, /\bfarm\b/i, /\bpool(s)?\b/i, /\bswimming\b/i,
  /\bshopping (centre|mall|park)\b/i, /\bquay\b/i, /\bretail park\b/i,
];

function classifyCategory(v) {
  const cat = (v.category || '').toLowerCase();
  const name = v.name || '';
  const hits = [];
  for (const kw of NOT_SOFT_PLAY_CATEGORY_HIGH) {
    if (cat.includes(kw)) hits.push({ level: 'HIGH', reason: `category="${v.category}"` });
  }
  for (const kw of AMBIGUOUS_CATEGORY_MEDIUM) {
    if (cat.includes(kw)) hits.push({ level: 'MEDIUM', reason: `category="${v.category}"` });
  }
  for (const rx of NAME_KEYWORDS_HIGH) {
    if (rx.test(name)) hits.push({ level: 'HIGH', reason: `name matches /${rx.source}/` });
  }
  for (const rx of NAME_KEYWORDS_MEDIUM) {
    if (rx.test(name)) hits.push({ level: 'MEDIUM', reason: `name matches /${rx.source}/` });
  }
  if (hits.length === 0) return null;
  const level = hits.some((h) => h.level === 'HIGH') ? 'HIGH' : 'MEDIUM';
  return { level, reasons: [...new Set(hits.map((h) => h.reason))] };
}

// ── Broken-data checks ────────────────────────────────────────────────
function brokenDataChecks(v) {
  const issues = [];
  const addr = v.address || '';
  if (/(^|\s)(null|nan|·)(\s|$)/i.test(addr) || /null/i.test(addr)) {
    issues.push({ field: 'address', issue: 'literal null/nan/· token', value: addr });
  }
  if (/\b(am|pm)\b.*(opens|closed|closes)|closed,\s*·|opens\s+\d/i.test(addr)) {
    issues.push({ field: 'address', issue: 'opening-hours text leaked into address', value: addr });
  }
  if (v.postcode && isValidPostcode(v.postcode) === false) {
    issues.push({ field: 'postcode', issue: 'invalid postcode format', value: v.postcode });
  }
  if (v.mapsUrl && /null/i.test(v.mapsUrl)) {
    issues.push({ field: 'mapsUrl', issue: 'contains "null"', value: v.mapsUrl });
  }
  if (v.description && /information verified from the venue website for/i.test(v.description)) {
    issues.push({ field: 'description', issue: 'leaked template QA string', value: v.description.slice(0, 150) });
  }
  if (v.notes && /information verified from the venue website for/i.test(v.notes)) {
    issues.push({ field: 'notes', issue: 'leaked template QA string', value: v.notes.slice(0, 150) });
  }
  if (!addr || !addr.trim()) {
    issues.push({ field: 'address', issue: 'empty address', value: addr });
  }
  return issues;
}

// ── Postcode / city mismatch ──────────────────────────────────────────
function checkCity(v) {
  if (!v.postcode || !v.postcode.trim()) return { status: 'NO_POSTCODE' };
  const area = extractPostcodeArea(v.postcode);
  if (!area) return { status: 'UNPARSEABLE', area: null };
  const expected = POSTCODE_TO_CITIES[area];
  if (!expected) return { status: 'UNKNOWN_AREA', area };
  if (expected.includes(v.townSlug)) return { status: 'OK', area };
  return { status: 'MISMATCH', area, expectedCities: expected };
}

// ── Run over venues.json ──────────────────────────────────────────────
const results = {
  miscategorized: [],
  wrongCity: [],
  brokenData: [],
  noPostcode: [],
  cityCoverage: {},
};

for (const v of venues) {
  const cat = classifyCategory(v);
  if (cat) {
    results.miscategorized.push({
      name: v.name, slug: v.slug, town: v.townSlug, category: v.category,
      website: v.website, postcode: v.postcode, confidence: cat.level, reasons: cat.reasons,
    });
  }
  const cityCheck = checkCity(v);
  if (cityCheck.status === 'MISMATCH') {
    results.wrongCity.push({
      name: v.name, slug: v.slug, assignedTo: v.townSlug, postcode: v.postcode,
      postcodeArea: cityCheck.area, expectedCities: cityCheck.expectedCities, address: v.address,
    });
  } else if (cityCheck.status === 'NO_POSTCODE') {
    results.noPostcode.push({ name: v.name, slug: v.slug, town: v.townSlug, address: v.address });
  }
  const broken = brokenDataChecks(v);
  if (broken.length) {
    results.brokenData.push({ name: v.name, slug: v.slug, town: v.townSlug, issues: broken });
  }
}

// city coverage summary
const declaredSlugs = cities.map((c) => c.slug).sort();
const venuesJsonSlugs = new Set(venues.map((v) => v.townSlug));
const vbtSlugs = new Set(Object.keys(vbt));
results.cityCoverage = {
  declared: declaredSlugs,
  inVenuesJson: [...venuesJsonSlugs].sort(),
  inVenuesByTown: [...vbtSlugs].sort(),
  declaredButMissingFromBoth: declaredSlugs.filter((s) => !venuesJsonSlugs.has(s) && !vbtSlugs.has(s)),
  declaredButMissingFromVenuesJson: declaredSlugs.filter((s) => !venuesJsonSlugs.has(s)),
  inVenuesJsonButNotDeclared: [...venuesJsonSlugs].filter((s) => !CITY_SLUGS.has(s)).sort(),
};

// ── Duplicate detection ────────────────────────────────────────────────
function normDomain(url) {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch { return null; }
}
function normPhone(p) {
  if (!p) return null;
  const digits = String(p).replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : null; // last 9 digits, drop leading 0/country code
}
function normName(n) {
  return (n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// NOTE: matching on website domain ALONE is unreliable — many venues are
// franchise locations (e.g. every "Wacky Warehouse" pub play-area shares
// wackywarehouse.co.uk) that are genuinely different physical premises.
// Phone number is a much stronger same-premises signal since it's specific
// to one location. Domain match is only used as a HIGH-confidence signal
// when paired with a phone match or near-identical name.
const byPhone = {};
for (const v of venues) {
  const p = normPhone(v.phone);
  if (p) { (byPhone[p] ??= []).push(v); }
}
const duplicates = [];
for (const [p, list] of Object.entries(byPhone)) {
  if (list.length > 1) {
    const byTown = {};
    for (const v of list) (byTown[v.townSlug] ??= []).push(v);
    for (const [town, group] of Object.entries(byTown)) {
      if (group.length > 1) {
        const names = group.map((v) => normName(v.name));
        const nameSimilar = names.some((a, i) => names.some((b, j) => i !== j && (a.includes(b) || b.includes(a))));
        duplicates.push({
          matchType: 'phone',
          key: p,
          town,
          confidence: nameSimilar ? 'HIGH' : 'MEDIUM',
          venues: group.map((v) => ({ name: v.name, slug: v.slug, website: v.website })),
        });
      }
    }
  }
}
// fuzzy name match within same town (same normalized name substring)
const byTownAll = {};
for (const v of venues) (byTownAll[v.townSlug] ??= []).push(v);
const fuzzyDupes = [];
for (const [town, list] of Object.entries(byTownAll)) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = normName(list[i].name), b = normName(list[j].name);
      if (a.length > 4 && b.length > 4 && (a.includes(b) || b.includes(a)) && list[i].slug !== list[j].slug) {
        fuzzyDupes.push({ town, a: { name: list[i].name, slug: list[i].slug }, b: { name: list[j].name, slug: list[j].slug } });
      }
    }
  }
}

results.duplicates = duplicates;
results.fuzzyNameDuplicates = fuzzyDupes;

writeFileSync('data/_audit_findings.json', JSON.stringify(results, null, 2));
console.log('miscategorized:', results.miscategorized.length);
console.log('wrongCity:', results.wrongCity.length);
console.log('brokenData:', results.brokenData.length);
console.log('noPostcode:', results.noPostcode.length);
console.log('duplicates (domain/phone groups):', results.duplicates.length);
console.log('fuzzyNameDuplicates:', results.fuzzyNameDuplicates.length);
console.log('cityCoverage:', JSON.stringify(results.cityCoverage, null, 2));
