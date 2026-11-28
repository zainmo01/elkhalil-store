#!/usr/bin/env python3
"""DRY RUN: bulk percent discount plan for a category. Usage: discount_plan.py [pct=35] [cat=1] [out.csv]. Writes CSV only; never publishes."""
import json,csv,math,sys,os
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pct=float(sys.argv[1]) if len(sys.argv)>1 else 35
cat=int(sys.argv[2]) if len(sys.argv)>2 else 1
out=sys.argv[3] if len(sys.argv)>3 else '/downloads/discount_plan.csv'
KW=['احمر خدود','روج','ماسكارا','كحل','كاجل','مكياج','بودره','طلاء اظافر','مانيكير','ايلاينر','فاونديشن','كونسيلر','ظلال','ايشادو','برايمر','هايلايتر','makeup','lipstick','mascara','eyeliner','foundation','احمر شفاه','قلم حواجب','ريميل','ماي بلين','سيروم','عطر','كولونيا','perfume','مرطب','لوشن','ماسك','كريم']
def after(p):
    a=math.floor(p*(1-pct/100)*2+0.5)/2
    if a>=p: a=p-0.5
    return max(a,0.5)
items=[x for x in json.load(open(f'{R}/scripts/catalog-source.json',encoding='utf-8')) if x['c']==cat]
rows=[];odd=[]
for x in items:
    p=x['p']
    if p<2: odd.append(x); continue
    a=after(p); rows.append({'id':x['i'],'name':x['n'],'before':p,'after':a,'effective_pct':round((p-a)/p*100,1)})
with open(out,'w',encoding='utf-8-sig',newline='') as f:
    w=csv.DictWriter(f,fieldnames=['id','name','before','after','effective_pct']);w.writeheader();w.writerows(rows)
print(len(items),'in category;',len(rows),'planned;',len(odd),'skipped (price < 2)')
print('payload bytes',len(json.dumps([{'i':r['id'],'p':r['after'],'o':r['before']} for r in rows],separators=(',',':'))))
