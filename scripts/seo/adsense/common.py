"""Shared sentence-template normalisation for the AdSense content audit (see README.md)."""
import os
import json,re
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
venues=json.load(open(f'{REPO}/data/generated/venues.json'))
cities=json.load(open(f'{REPO}/data/cities.json'))
town_names={v['townSlug']:v['town'] for v in venues}|{c['slug']:c['name'] for c in cities}
# ── normalisation ─────────────────────────────────────────────────────────
def esc_alt(strings):
    s = sorted({x for x in strings if x and len(x) >= 3}, key=len, reverse=True)
    return re.compile('|'.join(re.escape(x) for x in s), re.I) if s else None

ADDR_RE = esc_alt([v['address'] for v in venues if v.get('address')])
VENUE_RE = esc_alt([v['name'] for v in venues])
TOWN_RE = esc_alt(list(town_names.values()) + [v['town'] for v in venues])
PC_RE = re.compile(r'\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b', re.I)
DATE_RE = re.compile(r'\b\d{1,2}(st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{0,4}\b', re.I)
NUM_RE = re.compile(r'£?\d[\d,.]*')

def template(s):
    if ADDR_RE: s = ADDR_RE.sub('ADDR', s)
    s = PC_RE.sub('PC', s)
    if VENUE_RE: s = VENUE_RE.sub('VENUE', s)
    if TOWN_RE: s = TOWN_RE.sub('CITY', s)
    s = DATE_RE.sub('DATE', s)
    s = NUM_RE.sub('N', s)
    s = re.sub(r'\s+', ' ', s).strip().lower()
    return s

