#!/usr/bin/env python3
"""DRY RUN: proposes category fixes for scripts/catalog-source.json. Writes a CSV, never edits the catalog.
Categories: 0 drugs, 1 care, 2 vitamins, 3 mother&child, 4 devices."""
import json, re, csv, sys, collections, os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cat = json.load(open(f'{R}/scripts/catalog-source.json', encoding='utf-8'))
NAMES = ['الأدوية', 'العناية', 'الفيتامينات', 'الأم والطفل', 'أجهزة طبية']
def norm(s): return re.sub('[\u064b-\u0652ـ]', '', s.lower()).replace('أ','ا').replace('إ','ا').replace('آ','ا').replace('ة','ه').replace('ى','ي')
WORD = {'روج','كحل','كاجل','ماك ','ريميل'}
def anyw(n, ws):
    for w in ws:
        if w in WORD:
            if re.search(r'(^|[\s+/-])' + re.escape(w.strip()) + r'(?=$|[\s+/-])', n): return w
        elif w in n: return w
    return None
DRUG = ['مجم','مج ','mg','mcg','ميكروجرام','وحده دوليه',' iu','اقراص','قرص','tab','caps','كبسول','حقن','فيال','vial','امبول','amp','لبوس','supp','inj','infusion','i.v','syrup','شراب','قطره','نقط','نقاط','دروبس','drops','محلول للحقن']
MAKE = ['احمر خدود','روج','ماسكارا','كحل','كاجل','مكياج','بودره مضغوطه','بودره وجه','بودره للوجه','طلاء اظافر','مانيكير','ايلاينر','فاونديشن','كونسيلر','ظلال','اي شادو','ايشادو','برايمر','هايلايتر','ارديه','makeup','lipstick','mascara','eyeliner','foundation','concealer','nail polish','احمر شفاه','قلم حواجب','ريميل','ماي بلين','ماك ']
PERS = ['شامبو','shampoo','بلسم','شاور جل','shower gel','صابون','غسول','مزيل عرق','deodorant','deod','معجون اسنان','فرشاه اسنان','معجون حلاقه','رغوه حلاقه','كولونيا','عطر','perfume','زيت شعر','ماسك شعر','hair mask','hair care','هير ماسك','صبغه شعر','ماسك للوجه','واقي شمس','صن بلوك','sunblock','سيروم','كريم تفتيح','لوشن','مرطب','بديل صابون','شمع ازاله','ازاله الشعر','مناديل مبلله']
BABY = ['ببرونه','حفاض','رضاع','سيريلاك','سيريلاك','بيبي','baby','اطفال','طفل','لبن اطفال','سماعه رضاعه','مصاصه','بزازه','شفاط مخاط','كلوت']
def target(n0, c):
    n = norm(n0)
    drug = anyw(n, DRUG); make = anyw(n, MAKE); pers = anyw(n, PERS); baby = anyw(n, BABY)
    if c == 0:
        if make and not drug: return 1, 'makeup keyword: ' + make
        if pers and not drug: return 1, 'personal-care keyword: ' + pers
        if baby and not drug: return 3, 'baby keyword: ' + baby
    elif c == 1:
        if (anyw(n, ['مجم','mg ']) or re.search(r'\bmg\b', n)) and not (make or pers or baby) and anyw(n, ['كريم','مرهم','جل','cream','gel','oint']):
            return 0, 'drug dose in a cream/gel: ' + (anyw(n, ['مجم','mg']) or 'mg')
        if baby and not drug and not make: return 3, 'baby keyword: ' + baby
    elif c == 2:
        if (pers or make) and not drug: return 1, 'care keyword (not a supplement form): ' + (pers or make)
    elif c == 4:
        if anyw(n, ['hair','هير','شامبو','ماسك شعر']): return 1, 'hair product: ' + anyw(n, ['hair','هير','شامبو','ماسك شعر'])
    elif c == 3:
        k = anyw(n, ['روج','ماسكارا','كحل','فاونديشن','كونسيلر','ظلال','ايلاينر'])
        if k and not baby: return 1, 'makeup keyword: ' + k
    return c, ''
out = []; mat = collections.Counter(); samples = collections.defaultdict(list)
for x in cat:
    t, why = target(x['n'], x['c'])
    if t != x['c']:
        out.append((x['i'], x['n'], x['c'], t, why)); mat[(x['c'], t)] += 1; samples[(x['c'], t)].append(x['n'])
with open(sys.argv[1] if len(sys.argv) > 1 else '/tmp/reclass_dryrun.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f); w.writerow(['id', 'name', 'current_category', 'proposed_category', 'current_name', 'proposed_name', 'reason'])
    for i, n, a, b, why in out: w.writerow([i, n, a, b, NAMES[a], NAMES[b], why])
print('total items', len(cat), 'proposed changes', len(out))
for (a, b), k in mat.most_common(): print(f'{NAMES[a]} -> {NAMES[b]}: {k}')
import random; random.seed(1)
for key in mat: print(NAMES[key[0]], '->', NAMES[key[1]], random.sample(samples[key], min(8, len(samples[key]))))
