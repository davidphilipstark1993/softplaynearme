"""Crawl the locally running site (static-data build) and store per-page extracts.

Seeds: sitemap.xml, every venue path in the static export, every hub/filter path,
then BFS over internal links. Writes pages.jsonl (one JSON object per URL).
"""
import json, re, sys, os, threading, queue, urllib.request, urllib.error, http.client
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup

BASE = os.environ.get('CRAWL_BASE', 'http://localhost:3123')
SITE = 'https://www.softplaynearme.co.uk'
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, 'seo-data', 'adsense', 'crawl', 'pages.jsonl')
os.makedirs(os.path.dirname(OUT), exist_ok=True)

os.environ['no_proxy'] = 'localhost,127.0.0.1'
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect)

SKIP = re.compile(r'^/(api|admin|dashboard|verify-email|owner|_next|claim/|newsletter/preferences|newsletter/unsubscribed)')

def norm(path):
    u = urlparse(path)
    p = u.path.rstrip('/') or '/'
    if u.query:
        m = re.fullmatch(r'page=(\d+)', u.query)
        if m:
            return f'{p}?page={m.group(1)}'
        return None  # ignore other query variants
    return p

def fetch(path):
    req = urllib.request.Request(BASE + path, headers={'User-Agent': 'inventory-crawler'})
    try:
        r = opener.open(req, timeout=60)
        return r.status, dict(r.headers), r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        body = ''
        try: body = e.read().decode('utf-8', 'replace')
        except Exception: pass
        return e.code, dict(e.headers), body

BLOCK_TAGS = ['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'dt', 'dd', 'td', 'th', 'summary', 'figcaption', 'blockquote', 'span', 'a', 'div', 'button', 'label']

def extract(html):
    s = BeautifulSoup(html, 'lxml')
    robots = [m.get('content', '') for m in s.find_all('meta', attrs={'name': 'robots'})]
    can = s.find('link', rel='canonical')
    title = s.title.get_text(strip=True) if s.title else ''
    desc = s.find('meta', attrs={'name': 'description'})
    for t in s(['script', 'style', 'noscript', 'svg']):
        t.decompose()
    links = set()
    for a in s.find_all('a', href=True):
        h = a['href']
        if h.startswith(SITE): h = h[len(SITE):]
        if h.startswith('/') and not h.startswith('//'):
            links.add(h.split('#')[0])
    main = s.find('main')
    def lines(node):
        return [l.strip() for l in node.get_text('\n', strip=True).split('\n') if l.strip()] if node else []
    main_links = []
    if main:
        for a in main.find_all('a', href=True):
            h = a['href']
            if h.startswith(SITE): h = h[len(SITE):]
            main_links.append(h.split('#')[0])
    footer = s.find('footer')
    full_lines = lines(s.body) if s.body else []
    # whole-page component markers for repetition checks
    body_html = str(s.body) if s.body else ''
    return {
        'robots': robots, 'canonical': can.get('href') if can else None, 'title': title,
        'meta_description': desc.get('content') if desc else None,
        'has_main': bool(main), 'main_lines': lines(main if main else s.body),
        'footer_lines': lines(footer), 'full_lines': full_lines,
        'main_links': main_links, 'links': sorted(links),
        'h1': [h.get_text(' ', strip=True) for h in s.find_all('h1')],
        'newsletter_forms': len(re.findall(r'(?i)newsletter', body_html)),
    }

def seeds():
    out = set(['/', '/blog', '/soft-play', '/about', '/contact', '/privacy', '/pricing', '/search', '/add-venue',
               '/premium', '/newsletter', '/play-cafes', '/baby-soft-play', '/toddler-soft-play', '/sen-soft-play', '/soft-play-parties', '/llms.txt'])
    st, _, xml = fetch('/sitemap.xml')
    open(os.path.join(os.path.dirname(OUT), 'sitemap.xml'), 'w').write(xml)
    for loc in re.findall(r'<loc>([^<]+)</loc>', xml):
        out.add(loc.replace(SITE, '') or '/')
    vbt = json.load(open(f'{REPO}/data/generated/venuesByTown.json'))
    cities = json.load(open(f'{REPO}/data/cities.json'))
    cslugs = [c['slug'] for c in (cities if isinstance(cities, list) else cities.get('cities', []))]
    for town, e in vbt.items():
        out.add(f'/soft-play/{town}')
        for v in e['venues']:
            out.add(f'/soft-play/{town}/{v["slug"]}')
    for c in set(cslugs) | set(vbt):
        for f in ['toddler', 'birthday-parties', 'sen-friendly', 'open-now']:
            out.add(f'/soft-play/{c}/{f}')
    return {n for n in (norm(p) for p in out) if n}

seen = set()
lock = threading.Lock()
q = queue.Queue()
fout = open(OUT, 'w')

def worker(path):
    status, headers, body = fetch(path)
    rec = {'path': path, 'status': status, 'location': headers.get('Location') or headers.get('location'),
           'x_robots': headers.get('X-Robots-Tag') or headers.get('x-robots-tag')}
    if status == 200 and 'text/html' in (headers.get('Content-Type') or headers.get('content-type') or ''):
        rec.update(extract(body))
    new = []
    for l in rec.get('links', []):
        n = norm(l)
        if not n or SKIP.match(n) or n.startswith('/blog/') is False and False:
            continue
        if not (n == '/' or n.startswith('/soft-play') or n.startswith('/blog') or re.fullmatch(r'/[a-z0-9-]+', n)):
            continue
        new.append(n)
    loc = rec.get('location')
    if loc:
        n = norm(loc.replace(BASE, '').replace(SITE, ''))
        if n: new.append(n)
    with lock:
        fout.write(json.dumps(rec) + '\n')
        for n in new:
            if n not in seen:
                seen.add(n); q.put(n)

def main():
    for s in seeds():
        if s not in seen:
            seen.add(s); q.put(s)
    done = 0
    with ThreadPoolExecutor(12) as ex:
        futs = []
        while True:
            try:
                p = q.get(timeout=5)
            except queue.Empty:
                if all(f.done() for f in futs) and q.empty(): break
                continue
            futs.append(ex.submit(worker, p))
            futs = [f for f in futs if not f.done()] + []
            done += 1
            if done % 250 == 0:
                print(done, 'queued', q.qsize(), flush=True)
    fout.close()
    print('total', len(seen))

main()
