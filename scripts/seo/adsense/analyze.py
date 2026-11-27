"""AdSense low-value-content audit, Phase 1 (read-only).

Inputs : a crawl of the running site (pages.jsonl from crawl.py), the static export
         (data/generated/venues.json), data/cities.json, and optionally a GSC
         Performance "Pages" export (--gsc=path/to/Pages.csv) for the clicks cross-check.
Outputs: seo-data/adsense/page-inventory.csv and summary JSON files next to it.

Definitions (also in the report):
  main content      text inside <main> (header, nav, footer, cookie banners excluded)
  segment           a sentence, or a short UI line, inside <main>
  template form     the segment with venue names, addresses, town names, postcodes,
                    numbers and dates replaced by tokens (VENUE, ADDR, CITY, PC, N, DATE)
  shared (exact)    the exact segment appears on >= 1 other page of the same type
  templated         the template form appears on >= 5 pages of the same type
  unique words      words in segments that are not templated
  shared_pct        templated segments (>= 4 words) / all segments (>= 4 words)
"""
import json, re, sys, csv, collections, math, os

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUTDIR = f'{REPO}/seo-data/adsense'
os.makedirs(OUTDIR, exist_ok=True)
args = dict(a.lstrip('-').split('=', 1) for a in sys.argv[1:] if '=' in a)
PAGES = args.get('pages', f'{OUTDIR}/crawl/pages.jsonl')
GSC = args.get('gsc')
PREFIX = args.get('prefix', '')  # e.g. "after-" for the Phase H rerun

P = [json.loads(l) for l in open(PAGES)]
venues = json.load(open(f'{REPO}/data/generated/venues.json'))
cities = json.load(open(f'{REPO}/data/cities.json'))
city_names = {c['slug']: c['name'] for c in cities}
by_key = {(v['townSlug'], v['slug']): v for v in venues}
town_names = {v['townSlug']: v['town'] for v in venues} | city_names

# ── page type ─────────────────────────────────────────────────────────────
FILTERS = ('/toddler', '/birthday-parties', '/sen-friendly')
def ptype(path):
    if path == '/': return 'home'
    if path == '/blog': return 'blog-index'
    if path.startswith('/blog/'): return 'blog'
    if path == '/soft-play': return 'soft-play-index'
    m = re.match(r'/soft-play/([^/?]+)(.*)', path)
    if m:
        rest = m.group(2)
        if rest == '': return 'city-hub'
        if rest.startswith('?page='): return 'city-hub-page'
        if rest in FILTERS: return 'filter'
        if rest == '/open-now': return 'filter-open-now'
        if rest.startswith('/area/'): return 'area-hub'
        return 'venue'
    if path in ('/toddler-soft-play', '/sen-soft-play', '/soft-play-parties', '/baby-soft-play', '/play-cafes'):
        return 'category-hub'
    return 'static'

def is_indexable(p):
    if p['status'] != 200: return False
    r = ' '.join(p.get('robots') or []) + ' ' + (p.get('x_robots') or '')
    if 'noindex' in r: return False
    can = p.get('canonical')
    if can:
        cpath = can.replace('https://www.softplaynearme.co.uk', '') or '/'
        if cpath.rstrip('/') != p['path'].rstrip('/') and cpath != p['path']:
            return False  # canonicalised elsewhere
    return True

# sitemap membership (from the crawl seeds: re-read sitemap.xml saved alongside)
sitemap = set()
smp = args.get('sitemap', f'{OUTDIR}/crawl/sitemap.xml')
if os.path.exists(smp):
    for loc in re.findall(r'<loc>([^<]+)</loc>', open(smp).read()):
        sitemap.add(loc.replace('https://www.softplaynearme.co.uk', '') or '/')

sys.path.insert(0, os.path.dirname(__file__))
from common import template  # noqa: E402

def segments(lines):
    # Rejoin inline fragments (React splits text around <a>, <strong>, numbers),
    # then split into sentences.
    text, out = '', []
    for l in lines:
        if not text: text = l
        elif re.search(r'[.!?:]$', text) or (l[:1].isupper() and len(l.split()) >= 3 and len(text.split()) >= 3):
            out.append(text); text = l
        else:
            text += ' ' + l
    if text: out.append(text)
    segs = []
    for block in out:
        for s in re.split(r'(?<=[.!?])\s+(?=[A-Z£0-9])', block):
            s = s.strip()
            if s: segs.append(s)
    return segs

# ── per page ──────────────────────────────────────────────────────────────
pages = [p for p in P if p['status'] == 200 and p.get('main_lines') is not None and not p['path'].endswith('.txt')]
for p in pages:
    p['type'] = ptype(p['path'])
    p['segs'] = segments(p['main_lines'])
    p['tpl'] = [template(s) for s in p['segs']]

exact_by_type = collections.defaultdict(collections.Counter)
tpl_by_type = collections.defaultdict(collections.Counter)
for p in pages:
    for s in set(p['segs']): exact_by_type[p['type']][s] += 1
    for t in set(p['tpl']): tpl_by_type[p['type']][t] += 1

TPL_MIN = 5
def wc(s): return len(re.findall(r"[A-Za-z£0-9][\w'’£.-]*", s))

VENUE_FIELDS = {
    'age_range': lambda v: False,  # not in schema/export at all
    'price': lambda v: v.get('priceFrom') is not None or bool(v.get('pricingHint')),
    'opening_hours': lambda v: bool(v.get('openingHoursText')),
    'sen_or_quiet_sessions': lambda v: bool(v.get('senFriendly') or v.get('hasSenSessions')),
    'cafe': lambda v: bool(v.get('cafe')),
    'parking': lambda v: bool(v.get('parking')),
    'party_packages': lambda v: bool(v.get('parties') or v.get('hasPartyRooms')),
    'toddler_area': lambda v: bool(v.get('toddlerArea') or v.get('babyArea')),
    'website': lambda v: bool(v.get('website')),
    'phone': lambda v: bool(v.get('phone')),
    'rating_reviews': lambda v: v.get('rating') is not None and bool(v.get('reviewCount')),
    'last_verified': lambda v: bool(v.get('lastVerified')),
    'photo': lambda v: bool(v.get('mainImageUrl')),
    'address': lambda v: bool((v.get('address') or '').strip()),
}
NON_PLACES_FIELDS = ['age_range', 'price', 'sen_or_quiet_sessions', 'cafe', 'parking', 'party_packages', 'toddler_area', 'photo']

gsc = {}
if GSC and os.path.exists(GSC):
    rows = list(csv.reader(open(GSC, encoding='utf-8-sig')))
    hdr = [h.lower() for h in rows[0]]
    ui, ci, ii = 0, hdr.index('clicks'), hdr.index('impressions')
    for r in rows[1:]:
        path = r[ui].replace('https://www.softplaynearme.co.uk', '').rstrip('/') or '/'
        gsc[path] = (int(r[ci].replace(',', '')), int(r[ii].replace(',', '')))

def venue_links(p):
    out = set()
    for h in p.get('main_links', []):
        m = re.fullmatch(r'/soft-play/([^/?]+)/([^/?]+)', h)
        if m and '/' + m.group(2) not in FILTERS + ('/open-now',) and m.group(2) != 'area':
            out.add(h)
    return out

rows = []
for p in sorted(P, key=lambda x: x['path']):
    t = ptype(p['path'])
    row = {'url': p['path'], 'page_type': t, 'status': p['status'], 'indexable': 'yes' if is_indexable(p) else 'no',
           'in_sitemap': 'yes' if p['path'] in sitemap else 'no', 'robots': ' '.join(p.get('robots') or []),
           'canonical': (p.get('canonical') or '').replace('https://www.softplaynearme.co.uk', '')}
    if 'segs' in p:
        segs, tpls = p['segs'], p['tpl']
        main_words = sum(wc(s) for s in segs)
        uniq = sum(wc(s) for s, tp in zip(segs, tpls) if tpl_by_type[t][tp] < TPL_MIN)
        # page-specific: exact text on fewer than TPL_MIN pages (venue names and distances
        # count, unlike the template measure, which tokenises them away)
        exact_uniq = sum(wc(s) for s in segs if exact_by_type[t][s] < TPL_MIN)
        long = [(s, tp) for s, tp in zip(segs, tpls) if wc(s) >= 4]
        exact = sum(1 for s, _ in long if exact_by_type[t][s] > 1)
        templ = sum(1 for _, tp in long if tpl_by_type[t][tp] >= TPL_MIN)
        row.update(main_words=main_words, unique_main_words=uniq, page_specific_words=exact_uniq,
                   pct_sentences_shared_exact=round(100 * exact / len(long), 1) if long else '',
                   pct_sentences_templated=round(100 * templ / len(long), 1) if long else '')
        p['_uniq'], p['_templ_pct'] = uniq, (100 * templ / len(long) if long else 0)
    if t in ('city-hub', 'city-hub-page', 'filter', 'filter-open-now', 'area-hub', 'category-hub', 'home'):
        row['venues_listed'] = len(venue_links(p)) if 'segs' in p else ''
    if t == 'venue':
        m = re.fullmatch(r'/soft-play/([^/]+)/([^/]+)', p['path'])
        v = by_key.get((m.group(1), m.group(2))) if m else None
        if v:
            filled = [k for k, f in VENUE_FIELDS.items() if f(v)]
            row.update(venue_type=v.get('venueType') or '', category=v.get('category') or '',
                       fields_populated=len(filled), fields_list='|'.join(filled),
                       facts_beyond_places=sum(1 for k in filled if k in NON_PLACES_FIELDS))
    if gsc:
        c = gsc.get(p['path'].split('?')[0])
        row['gsc_clicks'], row['gsc_impressions'] = (c if c else (0, 0))
    rows.append(row)

cols = ['url', 'page_type', 'status', 'indexable', 'in_sitemap', 'robots', 'canonical', 'main_words', 'unique_main_words', 'page_specific_words',
        'pct_sentences_shared_exact', 'pct_sentences_templated', 'venues_listed', 'venue_type', 'category',
        'fields_populated', 'facts_beyond_places', 'fields_list'] + (['gsc_clicks', 'gsc_impressions'] if gsc else [])
with open(f'{OUTDIR}/{PREFIX}page-inventory.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore')
    w.writeheader(); w.writerows(rows)

# ── summaries ─────────────────────────────────────────────────────────────
summary = {}
for t in sorted({r['page_type'] for r in rows}):
    rs = [r for r in rows if r['page_type'] == t and r['status'] == 200 and r.get('main_words') != None and 'main_words' in r]
    idx = [r for r in rows if r['page_type'] == t and r['indexable'] == 'yes']
    def med(xs):
        xs = sorted(xs); return xs[len(xs) // 2] if xs else None
    summary[t] = {
        'urls': sum(1 for r in rows if r['page_type'] == t), 'status_200': len(rs), 'indexable': len(idx),
        'in_sitemap': sum(1 for r in rows if r['page_type'] == t and r['in_sitemap'] == 'yes'),
        'median_main_words': med([r['main_words'] for r in rs]),
        'median_unique_words_indexable': med([r['unique_main_words'] for r in idx if 'unique_main_words' in r]),
        'median_page_specific_words_indexable': med([r['page_specific_words'] for r in idx if 'page_specific_words' in r]),
        'mean_pct_templated_indexable': round(sum(r.get('pct_sentences_templated') or 0 for r in idx) / len(idx), 1) if idx else None,
        'mean_pct_shared_exact_indexable': round(sum(r.get('pct_sentences_shared_exact') or 0 for r in idx) / len(idx), 1) if idx else None,
    }
json.dump(summary, open(f'{OUTDIR}/{PREFIX}summary-by-type.json', 'w'), indent=1)

# top templates per type (boilerplate measure)
tops = {}
for t in ['venue', 'city-hub', 'filter', 'blog']:
    n = sum(1 for p in pages if p['type'] == t)
    long = [(tp, c) for tp, c in tpl_by_type[t].items() if len(tp.split()) >= 4]
    templated = [(tp, c) for tp, c in long if c >= TPL_MIN]
    tops[t] = {'pages': n, 'distinct_segments_ge4w': len(long), 'templates_on_5plus_pages': len(templated),
               'top': [{'template': tp, 'pages': c, 'pct_pages': round(100 * c / n, 1)} for tp, c in sorted(templated, key=lambda x: -x[1])[:40]]}
json.dump(tops, open(f'{OUTDIR}/{PREFIX}templates-by-type.json', 'w'), indent=1)
print(json.dumps(summary, indent=1))
