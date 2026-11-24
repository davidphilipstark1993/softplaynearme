import json,collections,statistics,sys
r=[x for f in sys.argv[1:] for x in json.load(open(f)) if 'error' not in x]
S='https://www.softplaynearme.co.uk'
c=collections.Counter((x['status'],x.get('finalStatus')) for x in r); print('status',c)
bad=[x for x in r if x['status']!=200]; print('non200',[(x['path'],x['status'],x.get('chain')) for x in bad][:20])
noidx=[x['path'] for x in r if x.get('metaRobots') and 'noindex' in x['metaRobots']]; print('noindex',len(noidx),noidx[:10])
canon=[(x['path'],x.get('canonical')) for x in r if x['status']==200 and x.get('canonical')!=S+(x['path'] if x['path']!='/' else '')]; print('non-self canon',len(canon),canon[:10])
t=collections.Counter(x.get('title') for x in r if x['status']==200); d=[(k,v) for k,v in t.items() if v>1]; print('dup titles',len(d),d[:10])
h=collections.Counter(x.get('h1') for x in r if x['status']==200); d=[(k,v) for k,v in h.items() if v>1]; print('dup h1',len(d),d[:15])
print('no h1',[x['path'] for x in r if x['status']==200 and not x.get('h1')][:10])
print('multi h1',[x['path'] for x in r if x.get('h1Count',0)>1][:10])
print('invalid jsonld',[x['path'] for x in r if 'INVALID' in x.get('jsonLdTypes',[])][:10])
def typ(p):
  parts=p.split('?')[0].split('/')
  if p.startswith('/blog/'): return 'blog'
  if '?page=' in p: return 'hubpage'
  if '/area/' in p: return 'area'
  if len(parts)==4 and parts[3] in ('toddler','birthday-parties','sen-friendly','open-now'): return 'filter'
  if len(parts)==4: return 'venue'
  if len(parts)==3 and parts[1]=='soft-play': return 'hub'
  return 'other'
by=collections.defaultdict(list)
for x in r:
  if x['status']==200: by[typ(x['path'])].append(x)
for k,v in by.items():
  w=[x.get('words',0) for x in v]; print(k,len(v),'words med',statistics.median(w),'min',min(w))
  js=collections.Counter(tuple(sorted(set(x.get('jsonLdTypes',[])))) for x in v)
  for kk,vv in js.most_common(3): print('    ',vv,kk)
