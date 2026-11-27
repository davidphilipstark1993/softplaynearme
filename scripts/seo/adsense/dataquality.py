"""Step 3-4: off-category candidates (tiered), duplicates, address/Maps gaps, copy-vs-data claims, field fill rates."""
import os
import json, re, math, collections, csv
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
os.makedirs(os.path.join(REPO, 'seo-data', 'adsense'), exist_ok=True)
V=json.load(open(f'{REPO}/data/generated/venues.json'))
P={}
for l in open(f'{REPO}/seo-data/adsense/crawl/pages.jsonl'):
    p=json.loads(l); P[p['path']]=p
inv={r['url']:r for r in csv.DictReader(open(f'{REPO}/seo-data/adsense/page-inventory.csv'))}
def path(v): return f"/soft-play/{v['townSlug']}/{v['slug']}"
def idx(v): return inv.get(path(v),{}).get('indexable')=='yes'
out={}
# ---- off-category
VIS={'indoor','pub'}
bytype=collections.Counter(); bytype_idx=collections.Counter()
for v in V:
    t=v.get('venueType') or 'indoor'; bytype[t]+=1; bytype_idx[t]+=idx(v)
out['venue_type_counts']={t:{'records':bytype[t],'indexable_pages':bytype_idx[t]} for t in bytype}
KW=[('bouncy/inflatable/hire',r'bouncy|inflatable|castle hire|\bhire\b|rental'),
    ('pub/inn/bar/hotel',r'\bpub\b|\binn\b|\barms\b|\btavern\b|\bbar\b|hotel|brewers fayre|beefeater|harvester|toby carvery|hungry horse|wacky warehouse'),
    ('shopping centre/retail',r'shopping cent|retail park|\bmall\b|toys? ?r|smyths|\bikea\b'),
    ('leisure/sports centre/gym/pool',r'leisure|sports? cent|\bgym\b|gymnastic|swim|pool|fitness|snowsport|bowl'),
    ('park/playground/outdoor',r'\bpark\b(?! ?(farm|play))|playground|play ground|play area$|recreation ground|\brec\b|country park|woods'),
    ('school/nursery/church/club',r'school|nursery|pre-?school|church|scout|library|community cent|village hall|\bclub\b|playgroup|toddler group'),
    ('trampoline',r'trampolin|jump|bounce'),('farm',r'\bfarm\b'),]
CATBAD=r'Bouncy castle hire|Party equipment rental|(?<!Indoor )[Pp]layground|(?<!Indoor )Park\b|Leisure Centre|Sports|Pub|Bowling|Shopping|Swimming|Gym|School|Nursery|Church|Community|Hotel|Restaurant|Theme park|Amusement park|Golf|Museum|Zoo'
flag=[]
for v in V:
    t=v.get('venueType') or 'indoor'
    if t not in VIS: continue
    name=v['name']; cat=v.get('category') or ''
    hits=[k for k,r in KW if re.search(r,name,re.I)]
    if re.search(CATBAD,cat,re.I): hits.append('places_category:'+cat)
    SP=r"soft ?play|play ?(centre|center|barn|caf[eé]|zone|town|world|land|house|village|hub|kingdom|factory|cove|den|planet)|wacky warehouse|indoor play|fuzzy ed|funhouse|fun house|jungle|kids'? ?(kingdom|zone)|monkey|playbarn|playtown|play ?ground indoor"
    spname=bool(re.search(SP,name,re.I)) or cat in ('Indoor Soft Play','Indoor playground')
    tier='review' if spname else 'high'
    if hits: flag.append({'path':path(v),'name':name,'category':cat,'venue_type':t,'why':';'.join(hits),'tier':tier,'indexable':idx(v),'rating':v.get('rating'),'reviews':v.get('reviewCount')})
out['visible_venues_flagged_off_category']=len(flag)
out['visible_flagged_by_tier']=collections.Counter(f['tier'] for f in flag)
out['visible_flagged_by_reason']=collections.Counter(r.split(':')[0] for f in flag for r in f['why'].split(';'))
with open(f'{REPO}/seo-data/adsense/off-category-candidates.csv','w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(flag[0].keys())); w.writeheader(); w.writerows(flag)
    for v in V:
        t=v.get('venueType') or 'indoor'
        if t not in VIS: w.writerow({'path':path(v),'name':v['name'],'category':v.get('category'),'venue_type':t,'why':'venue_type:'+t,'tier':'classified','indexable':idx(v),'rating':v.get('rating'),'reviews':v.get('reviewCount')})
# ---- duplicates
def hav(a,b):
    la,lo,lb,lob=map(float,(a['lat'],a['lng'],b['lat'],b['lng']))
    R=6371000; p1,p2=math.radians(la),math.radians(lb); dp=p2-p1; dl=math.radians(lob-lo)
    h=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(h))
def nname(s): return re.sub(r'[^a-z0-9]','',re.sub(r'\b(the|ltd|limited|soft ?play|centre|center|kids|childrens?|play)\b','',s.lower()))
pid=collections.defaultdict(list)
for v in V:
    if v.get('googlePlaceId'): pid[v['googlePlaceId']].append(v)
dup_pid=[g for g in pid.values() if len(g)>1]
pairs=[]
geo=[v for v in V if v.get('lat') and v.get('lng')]
for i,a in enumerate(geo):
    for b in geo[i+1:]:
        if abs(float(a['lat'])-float(b['lat']))>0.003: continue
        if a.get('googlePlaceId') and a.get('googlePlaceId')==b.get('googlePlaceId'): continue
        na,nb=nname(a['name']),nname(b['name'])
        if not na or not nb: continue
        if (na==nb or (len(na)>4 and (na in nb or nb in na))) and hav(a,b)<=200:
            pairs.append((a,b,round(hav(a,b))))
samecoord=collections.defaultdict(list)
for v in geo: samecoord[(round(float(v['lat']),5),round(float(v['lng']),5))].append(v)
out['duplicates']={'same_place_id_groups':len(dup_pid),'records_in_same_place_id_groups':sum(len(g) for g in dup_pid),
  'extra_records_same_place_id':sum(len(g)-1 for g in dup_pid),
  'same_name_within_200m_pairs':len(pairs),
  'identical_coordinates_groups':sum(1 for g in samecoord.values() if len(g)>1)}
with open(f'{REPO}/seo-data/adsense/duplicate-candidates.csv','w',newline='') as f:
    w=csv.writer(f); w.writerow(['rule','path_a','name_a','type_a','path_b','name_b','type_b','metres'])
    for g in dup_pid:
        for b in g[1:]: w.writerow(['same_place_id',path(g[0]),g[0]['name'],g[0].get('venueType'),path(b),b['name'],b.get('venueType'),''])
    for a,b,d in pairs: w.writerow(['same_name_200m',path(a),a['name'],a.get('venueType'),path(b),b['name'],b.get('venueType'),d])
    for g in samecoord.values():
        if len(g)>1:
            for b in g[1:]: w.writerow(['identical_coords',path(g[0]),g[0]['name'],g[0].get('venueType'),path(b),b['name'],b.get('venueType'),0])
# ---- addresses / maps
def blank(x): return not (x or '').strip() or (x or '').strip().lower() in ('null','undefined','none','n/a')
addr_null=[v for v in V if blank(v.get('address'))]
addr_pc_only=[v for v in V if not blank(v.get('address')) and re.fullmatch(r'\s*[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\s*',v['address'],re.I)]
addr_nostreet=[v for v in V if not blank(v.get('address')) and len(v['address'].split(','))==1 and not re.search(r'\d',v['address'])]
no_pc=[v for v in V if blank(v.get('postcode'))]
broken_maps=[v for v in V if not v.get('googlePlaceId') and not (v.get('lat') and v.get('lng')) and (blank(v.get('address')) or blank(v.get('postcode')))]
weak_maps=[v for v in V if not v.get('googlePlaceId') and not (v.get('lat') and v.get('lng'))]
out['addresses']={'address_null_or_blank':len(addr_null),'address_is_postcode_only':len(addr_pc_only),'address_single_token_no_number':len(addr_nostreet),
  'postcode_missing':len(no_pc),'no_place_id':sum(1 for v in V if not v.get('googlePlaceId')),'no_lat_lng':sum(1 for v in V if not (v.get('lat') and v.get('lng'))),
  'maps_link_broken(no id, no coords, missing address/postcode)':len(broken_maps),'maps_link_text_search_only(no id, no coords)':len(weak_maps),
  'mapsUrl_field_empty':sum(1 for v in V if blank(v.get('mapsUrl')))}
# rendered pages: hub cards with no address line? venue page Location blocks with 'undefined'/'null'
bad_render=collections.Counter()
for p in P.values():
    t=' '.join(p.get('main_lines') or [])
    for pat in ['undefined','null,',' null ','NaN','[object Object]']:
        if pat in t: bad_render[pat]+=1
out['rendered_literal_null_undefined_pages']=dict(bad_render)
# ---- copy referencing data we don't hold
issues=collections.Counter(); exam=collections.defaultdict(list)
for v in V:
    d=(v.get('description') or '')
    def add(k):
        issues[k]+=1
        if len(exam[k])<4: exam[k].append(path(v)+' :: '+d[:220])
    if re.search(r'£|\bprice|\bcost|\bcheap|afford',d,re.I) and v.get('priceFrom') is None and not v.get('pricingHint'): add('description_mentions_price_no_price_data')
    if re.search(r'\bopen(s|ing)?\b|\bhours\b|\bam\b|\bpm\b|weekday|weekend',d,re.I) and not v.get('openingHoursText'): add('description_mentions_hours_no_hours_data')
    if re.search(r'review|rated|\bstars?\b',d,re.I) and v.get('rating') is None: add('description_mentions_reviews_no_rating_data')
    if re.search(r'caf[eé]',d,re.I) and not v.get('cafe'): add('description_mentions_cafe_but_cafe_flag_false')
    if re.search(r'part(y|ies)',d,re.I) and not v.get('parties'): add('description_mentions_parties_but_parties_flag_false')
    if re.search(r'toddler|under[- ]?(3|5)s|babies|baby',d,re.I) and not (v.get('toddlerArea') or v.get('babyArea')): add('description_mentions_toddler_baby_but_flag_false')
    if re.search(r'\bSEN\b|sensory|autis|quiet session|additional needs',d,re.I) and not (v.get('senFriendly') or v.get('hasSenSessions')): add('description_mentions_sen_but_flag_false')
    if re.search(r'parking|car park',d,re.I) and not v.get('parking'): add('description_mentions_parking_but_flag_false')
# rendered venue page checks: title/meta claiming prices/hours/reviews
for v in V:
    p=P.get(path(v)); 
    if not p or p['status']!=200: continue
    meta=(p.get('title') or '')+' || '+(p.get('meta_description') or '')
    txt='\n'.join(p.get('main_lines') or [])
    def add(k,ex):
        issues[k]+=1
        if len(exam[k])<4: exam[k].append(path(v)+' :: '+ex[:220])
    if re.search(r'price|£|cost',meta,re.I) and v.get('priceFrom') is None and not v.get('pricingHint'): add('title_or_meta_mentions_prices_none_shown',meta)
    if re.search(r'opening hours|\bhours\b|open (today|now)',meta,re.I) and not v.get('openingHoursText'): add('title_or_meta_mentions_hours_none_shown',meta)
    if re.search(r'review|rated|★|stars',meta,re.I) and v.get('rating') is None: add('title_or_meta_mentions_reviews_none_shown',meta)
    if 'See opening hours below' in txt and not v.get('openingHoursText'): add('page_says_see_hours_below_but_none',txt[:100])
out['copy_vs_data']=dict(issues); out['copy_vs_data_examples']=exam
# ---- fill rates
FIELDS={
 'age_range':lambda v: False,'price':lambda v: v.get('priceFrom') is not None or bool(v.get('pricingHint')),
 'opening_hours':lambda v: bool(v.get('openingHoursText')),'sen_quiet_sessions':lambda v: bool(v.get('senFriendly') or v.get('hasSenSessions')),
 'cafe':lambda v: bool(v.get('cafe')),'parking':lambda v: bool(v.get('parking')),'party_packages':lambda v: bool(v.get('parties') or v.get('hasPartyRooms')),
 'toddler_area':lambda v: bool(v.get('toddlerArea')),'baby_area':lambda v: bool(v.get('babyArea')),'website':lambda v: bool(v.get('website')),'phone':lambda v: bool(v.get('phone')),
 'rating_review_count':lambda v: v.get('rating') is not None and bool(v.get('reviewCount')),'last_verified':lambda v: bool(v.get('lastVerified')),
 'photo':lambda v: bool(v.get('mainImageUrl')),'wheelchair':lambda v: bool(v.get('wheelchairAccess')),}
vis=[v for v in V if (v.get('venueType') or 'indoor') in VIS]
out['fill_rates_pct_visible_1135']={k:round(100*sum(1 for v in vis if f(v))/len(vis),1) for k,f in FIELDS.items()}
out['fill_rates_pct_all_records']={k:round(100*sum(1 for v in V if f(v))/len(V),1) for k,f in FIELDS.items()}
lv=collections.Counter(v.get('lastVerified','')[:7] for v in vis); out['last_verified_month_visible']=dict(sorted(lv.items()))
out['visible_with_website']=sum(1 for v in vis if v.get('website'))
out['visible_with_zero_facts_beyond_places']=sum(1 for v in vis if not any(FIELDS[k](v) for k in ['price','sen_quiet_sessions','cafe','parking','party_packages','toddler_area','baby_area','photo']))
json.dump(out,open(f'{REPO}/seo-data/adsense/data-quality.json','w'),indent=1,default=str)
print(json.dumps({k:v for k,v in out.items() if k!='copy_vs_data_examples'},indent=1,default=str))
for k,e in exam.items(): print('##',k); [print('   ',x) for x in e]
