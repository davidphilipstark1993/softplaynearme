"""Step 2: cluster venue descriptions and hub/filter intros + FAQs by sentence template."""
import os
"""Step 2: cluster venue descriptions and hub/filter intros + FAQs by sentence template."""
import json, re, collections, sys
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
os.makedirs(os.path.join(REPO, 'seo-data', 'adsense'), exist_ok=True)
sys.path.insert(0, os.path.dirname(__file__))
from common import template
venues=json.load(open(f'{REPO}/data/generated/venues.json'))
P=[json.loads(l) for l in open(f'{REPO}/seo-data/adsense/crawl/pages.jsonl')]
out={}
def split(text): return [s.strip() for s in re.split(r'(?<=[.!?])\s+(?=[A-Z£0-9])', text or '') if s.strip()]
def report(name, docs):
    # docs: list of list-of-sentences
    n=len(docs); per=collections.Counter(); whole=collections.Counter()
    for d in docs:
        tp=[template(s) for s in d]
        for t in set(tp): per[t]+=1
        whole[' || '.join(tp)]+=1
    tot_sent=sum(len(d) for d in docs)
    templ_sent=sum(1 for d in docs for s in d if per[template(s)]>=5)
    out[name]={'documents':n,'sentences':tot_sent,'distinct_sentence_templates':len(per),
      'templates_used_by_5plus':sum(1 for c in per.values() if c>=5),
      'pct_sentences_from_shared_templates':round(100*templ_sent/max(tot_sent,1),1),
      'distinct_whole_document_patterns':len(whole),
      'top_sentence_templates':[{'t':t,'docs':c,'pct':round(100*c/n,1)} for t,c in per.most_common(15)],
      'top_document_patterns':[{'t':t[:400],'docs':c,'pct':round(100*c/n,1)} for t,c in whole.most_common(8)]}
vis=[v for v in venues]
report('venue_descriptions_all', [split(v.get('description')) for v in venues if v.get('description')])
out['venue_descriptions_all']['venues_without_description']=sum(1 for v in venues if not v.get('description'))
def section(lines, start_pat, end_pats):
    on=False; got=[]
    for l in lines:
        if not on and re.search(start_pat,l): on=True; continue
        if on and any(re.search(e,l) for e in end_pats): break
        if on: got.append(l)
    return got
def joinlines(ls):
    t=''
    for l in ls: t += (' ' if t and not re.search(r'[.!?:]$',t) else ('\n' if t else '')) + l
    return [s for blk in t.split('\n') for s in split(blk)]
def ptype(path):
    m=re.match(r'/soft-play/([^/?]+)(.*)',path)
    if not m: return None
    r=m.group(2)
    return 'hub' if r=='' else ('filter' if r in ('/toddler','/birthday-parties','/sen-friendly') else None)
hub_intro=[];hub_faq=[];fil_intro=[];fil_faq=[]
for p in P:
    if p['status']!=200 or not p.get('main_lines'): continue
    if 'noindex' in ' '.join(p.get('robots') or []): continue
    t=ptype(p['path']); L=p['main_lines']
    if t=='hub':
        hub_intro.append(joinlines(section(L,r'^About Soft Play in$',[r'^Frequently Asked Questions$'])))
        hub_faq.append(joinlines(section(L,r'^Frequently Asked Questions$',[r'family guide$',r'^Subscribe$', r'^Get .*guide'])))
    elif t=='filter':
        fil_intro.append(joinlines(section(L,r'^(Tips for|About|Why )',[r'FAQs$',r'Frequently Asked'])))
        fil_faq.append(joinlines(section(L,r'(FAQs|Frequently Asked Questions)$',[r'^Soft Play in Nearby',r'^← All',r'^Subscribe$'])))
report('hub_intros_indexable',[d for d in hub_intro if d]); out['hub_intros_indexable']['hubs_with_no_intro_section']=sum(1 for d in hub_intro if not d)
report('hub_faqs_indexable',[d for d in hub_faq if d])
report('filter_intros_indexable',[d for d in fil_intro if d]); out['filter_intros_indexable']['filters_with_no_intro']=sum(1 for d in fil_intro if not d)
report('filter_faqs_indexable',[d for d in fil_faq if d])
json.dump(out,open(f'{REPO}/seo-data/adsense/boilerplate.json','w'),indent=1)
for k,v in out.items():
    print('==',k,{kk:vv for kk,vv in v.items() if not kk.startswith('top')})
    for x in v['top_sentence_templates'][:8]: print('   ',x['pct'],'%',x['t'][:150])
    for x in v['top_document_patterns'][:3]: print('  DOC',x['pct'],'%',x['t'][:250])
