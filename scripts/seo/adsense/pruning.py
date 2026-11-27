"""Step 7: count (and list) every URL each indexing rule touches. --gsc=Pages.csv adds clicks."""
import json, csv, math, collections, re, os, sys
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
os.makedirs(os.path.join(REPO, 'seo-data', 'adsense'), exist_ok=True); OUT=f'{REPO}/seo-data/adsense'
V=json.load(open(f'{REPO}/data/generated/venues.json'))
inv={r['url']:r for r in csv.DictReader(open(f'{OUT}/page-inventory.csv'))}
hubc=json.load(open(f'{REPO}/data/hub-centres.json'))
cities={c['slug'] for c in json.load(open(f'{REPO}/data/cities.json'))}
off={r['path']:r for r in csv.DictReader(open(f'{OUT}/off-category-candidates.csv'))}
dups=list(csv.DictReader(open(f'{OUT}/duplicate-candidates.csv')))
GSC=dict(a.split('=',1) for a in sys.argv[1:] if '=' in a).get('gsc')
clicks={}
if GSC:
    rows=list(csv.reader(open(GSC,encoding='utf-8-sig'))); h=[x.lower() for x in rows[0]]
    for r in rows[1:]: clicks[r[0].replace('https://www.softplaynearme.co.uk','').rstrip('/') or '/']=int(r[h.index('clicks')].replace(',',''))
def path(v): return f"/soft-play/{v['townSlug']}/{v['slug']}"
VIS={'indoor','pub'}
def genuine(v): return (v.get('venueType') or 'indoor') in VIS and off.get(path(v),{}).get('tier')!='high'
FACT=lambda v: any([v.get('priceFrom') is not None, bool(v.get('pricingHint')), v.get('cafe'), v.get('parking'), v.get('parties'), v.get('toddlerArea'), v.get('babyArea'),
                    v.get('senFriendly'), v.get('hasSenSessions'), v.get('hasPartyRooms'), v.get('wheelchairAccess'), v.get('hasOutdoorPlay')])
by=collections.defaultdict(list)
for v in V: by[v['townSlug']].append(v)
def gc(p): return clicks.get(p,0)
res={}; lists=collections.defaultdict(list)
# R1 filter pages
FMAP={'toddler':lambda v: v.get('toddlerArea') or v.get('babyArea'),'birthday-parties':lambda v: v.get('parties'),'sen-friendly':lambda v: v.get('senFriendly')}
for t in sorted(by):
    for f,fn in FMAP.items():
        u=f'/soft-play/{t}/{f}'; r=inv.get(u)
        if not r or r['indexable']!='yes': continue
        n=sum(1 for v in by[t] if genuine(v) and fn(v))
        if n<3: lists['R1_filter_lt3_genuine'].append((u,n,gc(u)))
# R2 hubs
def dist(a,b):
    A,B=hubc.get(a),hubc.get(b)
    if not A or not B: return 9e9
    return math.dist((A['lat'],A['lng']*math.cos(math.radians(A['lat']))),(B['lat'],B['lng']*math.cos(math.radians(A['lat']))))*111
gen_count={t:sum(1 for v in vs if genuine(v)) for t,vs in by.items()}
big=[t for t,n in gen_count.items() if n>=3]
for t in sorted(by):
    u=f'/soft-play/{t}'; r=inv.get(u)
    if not r or r['indexable']!='yes': continue
    n=gen_count[t]
    if n<3:
        near=min(big,key=lambda b: dist(t,b)); d=dist(t,near)
        lists['R2_hub_lt3_genuine'].append((u,n,gc(u),near if d<=25 else '(none within 25km: noindex only)',round(d,1) if d<1e6 else 'no centre'))
# R3 venue pages with no facts beyond Places (genuine venues only; off-cat handled by R4)
for v in V:
    u=path(v); r=inv.get(u)
    if not r or r['indexable']!='yes' or not genuine(v): continue
    if not FACT(v): lists['R3_venue_no_facts_beyond_places'].append((u,0,gc(u)))
# R4 off-category records
for u,o in off.items():
    r=inv.get(u,{})
    if o['tier']=='review': lists['R4_review_queue_visible_softplay_name'].append((u,o['why'],gc(u))); continue
    lists['R4_offcat_'+o['venue_type'].replace('indoor','visible-high')+'_'+('indexable' if r.get('indexable')=='yes' else 'already_noindex')].append((u,o['why'],gc(u)))
for d in dups: lists['R4_duplicate_pairs_'+d['rule']].append((d['path_b'],d['path_a'],gc(d['path_b'])))
summary={k:{'urls':len(v),'with_gsc_clicks':sum(1 for x in v if x[2]>0) if GSC else 'n/a (no GSC export here)'} for k,v in lists.items()}
summary['genuine_venues_total']=sum(1 for v in V if genuine(v))
summary['hub_genuine_size_distribution']=dict(collections.Counter(min(n,10) for t,n in gen_count.items()))
json.dump(summary,open(f'{OUT}/pruning-summary.json','w'),indent=1)
with open(f'{OUT}/pruning-candidates.csv','w',newline='') as f:
    w=csv.writer(f); w.writerow(['rule','url','detail','gsc_clicks','merge_target','km'])
    for k,v in lists.items():
        for x in v: w.writerow([k,x[0],x[1],x[2] if GSC else '',*(x[3:] if len(x)>3 else ['',''])])
print(json.dumps(summary,indent=1))
print([x for x in lists['R2_hub_lt3_genuine']][:60])
