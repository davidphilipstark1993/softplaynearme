"""Step 3: classify venue description styles and count claims the data does not support."""
import os
import json, re, collections, csv
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
os.makedirs(os.path.join(REPO, 'seo-data', 'adsense'), exist_ok=True)
V=json.load(open(f'{REPO}/data/generated/venues.json'))
inv={r['url']:r for r in csv.DictReader(open(f'{REPO}/seo-data/adsense/page-inventory.csv'))}
def path(v): return f"/soft-play/{v['townSlug']}/{v['slug']}"
GENERIC=[r'gives parents an indoor option', r'\bWell reviewed\b', r'Highly rated', r'Positively rated', r'operates as a', r'provides indoor children\'s play facilities',
 r'is one of [A-Z][\w\' ]+ options', r'A visitor summed it up', r'One recurring theme in visitor feedback', r'local families turn to', r'a fixture for local family',
 r'is a fairly typical', r'serves families across', r'catering to families looking for', r'Families in [A-Z]\w+ looking for', r'Whether it\'s a birthday',
 r'tend to visit .* for a couple of hours', r'established among families', r'Located in [A-Z]', r'Set in [A-Z]', r'built around supervised indoor play']
FACTUAL=[r'Details checked against', r'checked against Google', r'Its website (mentions|lists|says)', r'website lists', r'opened in \d{4}', r'for children aged \d']
VIS={'indoor','pub'}
c=collections.Counter(); cv=collections.Counter(); ex=collections.defaultdict(list); rows=[]
claims=collections.Counter(); cex=collections.defaultdict(list)
for v in V:
    d=v.get('description') or ''; t=v.get('venueType') or 'indoor'; vis=t in VIS
    g=sum(bool(re.search(p,d)) for p in GENERIC); f=sum(bool(re.search(p,d)) for p in FACTUAL)
    style='none' if not d else ('generic-template' if g>=1 and f==0 else ('factual-verified' if f>=1 and g==0 else ('mixed' if g and f else 'other/handwritten')))
    c[style]+=1; cv[style]+=vis
    if len(ex[style])<3: ex[style].append(path(v)+' :: '+d[:200].replace('\n',' '))
    def claim(k):
        claims[(k,vis)]+=1
        if len(cex[k])<5: cex[k].append(path(v)+f' [{t}] :: '+d[:180].replace('\n',' '))
    if re.search(r'£\s?\d',d) and v.get('priceFrom') is None and not v.get('pricingHint'): claim('states £ price, no price field shown')
    if re.search(r'\b(cheap|affordable|good value|reasonably priced|great value|budget)\b',d,re.I) and v.get('priceFrom') is None: claim('value/price judgement, no price data')
    if re.search(r'\b\d{1,2}(:\d\d)?\s?(am|pm)\b|open (every day|daily|seven days|7 days)|opens at',d,re.I) and not v.get('openingHoursText'): claim('states hours, no hours shown')
    if re.search(r'A visitor summed it up|recurring theme in visitor feedback|Visitors (often )?(mention|say|praise)|reviewers? (mention|say|praise)',d,re.I): claim('paraphrases/quotes Google reviews (review text not shown on page)')
    if re.search(r'\bindoor\b|soft play centre|play safely indoors|away from the weather',d,re.I) and (t in ('park-playground',) or re.search(r'play ?(area|ground)$|playground|\bpark\b$',v['name'],re.I)): claim('calls an outdoor playground indoor/soft play')
    if re.search(r'(soft play|indoor play) (centre|venue)',d,re.I) and t in ('mobile-hire','leisure-centre','family-attraction','trampoline-park','play-farm') and style=='generic-template': claim('generic "soft play centre" copy on non-soft-play type')
json.dump({'style_all':c,'style_visible':cv,'examples':ex,'claims':{f'{k} | visible={vis}':n for (k,vis),n in claims.items()},'claim_examples':cex},open(f'{REPO}/seo-data/adsense/copy-claims.json','w'),indent=1)
print('styles all',dict(c)); print('styles visible',dict(cv))
for k,e in ex.items(): print('##',k); [print('   ',x) for x in e]
for (k,vis),n in sorted(claims.items()): print(n, k, 'visible' if vis else 'hidden-type')
for k,e in cex.items(): print('##',k); [print('   ',x) for x in e[:3]]
