#!/usr/bin/env python3
"""Bulk product photo importer for El-Khalil store.

Usage:
  python3 scripts/import_photos.py PATH [--apply] [--map map.csv] [--report out.csv]
PATH = folder or .zip of images. Files are named by barcode (e.g. 6221000003295.jpg)
or by product name (Arabic or English). Optional map.csv: filename,product_id (overrides matching).
Default is a dry run (no upload). --apply uploads (needs env KH_ADMIN_KEY).
Matched photos are resized to max 480px WebP (<140k chars) and stored with admin_photo_set.
Never touches prices or other data.
"""
import sys, os, re, io, json, csv, zipfile, base64, argparse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EG_URL = 'https://raw.githubusercontent.com/mahmoudfalous/eg-drugs/main/data/eg_drugs.json'
EG_CACHE = os.path.expanduser('~/.cache/eg_drugs.json')
EXT = ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp')
SW = set('مل جم جرام شراب اقراص قرص كبسول كبسولات حقن امبول امبولات علبة كيس شريط قطره نقط نقاط جل بخاخ مرهم فوار سيرنجه محلول لبوس مجم مجم وحده وحدة قطعه قطعة ml gm mg tab tabs cap caps syrup cream gel amp inj'.split())

def norm(s):
    s = re.sub('[\u064b-\u0652ـ]', '', s.lower()).translate(str.maketrans('أإآىةؤئ', 'اااي'+'هوي'))
    s = re.sub(r'[_\-.]+', ' ', s)
    nums = frozenset(re.findall(r'\d+', s))
    words = frozenset(t for t in re.findall(r'[^\W\d_]+', s) if t not in SW and len(t) > 1)
    return words, nums

def score(a, b):
    A, B = a[0] | a[1], b[0] | b[1]
    if not a[0] or not b[0]: return 0.0
    return len(A & B) / len(A | B)

def load_catalog():
    cat = json.load(open(os.path.join(ROOT, 'src', 'catalog-data.json'), encoding='utf-8'))
    items = [(c['i'], c['n'], norm(c['n'])) for c in cat]
    inv = {}
    for k, (_, _, (w, _)) in enumerate(items):
        for t in w: inv.setdefault(t, []).append(k)
    return items, inv

def load_eg():
    if not os.path.exists(EG_CACHE):
        os.makedirs(os.path.dirname(EG_CACHE), exist_ok=True)
        urllib.request.urlretrieve(EG_URL, EG_CACHE)
    eg = json.load(open(EG_CACHE, encoding='utf-8'))
    by = {}
    for x in eg:
        b = re.sub(r'\D', '', str(x.get('barcode') or ''))
        if len(b) >= 8: by.setdefault(b, []).append(x)
    return by

def match_name(name, items, inv, thr, margin=0.08):
    q = norm(name)
    cand = {}
    for t in q[0]:
        for k in inv.get(t, [])[:4000]: cand[k] = cand.get(k, 0) + 1
    top = sorted(cand.items(), key=lambda a: -a[1])[:40]
    res = sorted(((score(q, items[k][2]), items[k][0], items[k][1]) for k, _ in top), reverse=True)
    if not res or res[0][0] < thr: return None, 'no name match' + (f' (best {res[0][0]:.2f})' if res else '')
    nk = lambda t: norm(t)
    res = [r for i, r in enumerate(res) if i == 0 or nk(r[2]) != nk(res[0][2]) or r[0] < res[0][0]]
    if len(res) > 1 and res[1][0] >= res[0][0] - margin and res[1][1] != res[0][1]:
        return None, f'ambiguous: {res[0][2]} / {res[1][2]}'
    return res[0], ''

def to_webp(raw):
    im = Image.open(io.BytesIO(raw)); im = ImageOps.exif_transpose(im)
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA'); bg = Image.new('RGB', im.size, (255, 255, 255)); bg.paste(im, mask=im.split()[3]); im = bg
    else: im = im.convert('RGB')
    im.thumbnail((480, 480))
    for q in (78, 60, 45):
        b = io.BytesIO(); im.save(b, 'WEBP', quality=q)
        s = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
        if len(s) < 140000: return s
    return None

def read_files(path):
    if path.lower().endswith('.zip'):
        z = zipfile.ZipFile(path)
        for n in z.namelist():
            if n.lower().endswith(EXT) and '__MACOSX' not in n: yield os.path.basename(n), z.read(n)
    else:
        for d, _, fs in os.walk(path):
            for f in sorted(fs):
                if f.lower().endswith(EXT): yield f, open(os.path.join(d, f), 'rb').read()

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('path'); ap.add_argument('--apply', action='store_true')
    ap.add_argument('--map'); ap.add_argument('--report', default='import_report.csv'); a = ap.parse_args()
    items, inv = load_catalog(); ids = {i for i, _, _ in items}; eg = load_eg()
    over = {}
    if a.map:
        for r in csv.reader(open(a.map, encoding='utf-8')):
            if len(r) >= 2: over[r[0].strip()] = r[1].strip()
    rows, jobs, used = [], [], {}
    for fn, raw in read_files(a.path):
        stem = os.path.splitext(fn)[0]; pid = None; how = ''; why = ''
        if fn in over:
            pid, how = over[fn], 'map'
            if pid not in ids: pid, why = None, 'map id not in catalog'
        else:
            code = re.sub(r'[^\d]', '', stem.split('_')[0].split(' ')[0])
            if re.fullmatch(r'\d{8,14}', stem.split('_')[0].split(' ')[0]) or re.fullmatch(r'\d{8,14}', stem):
                recs = eg.get(code if code in eg else stem, [])
                if not recs: why = 'barcode not in drug dataset (rename file to product name or add to map)'
                for x in recs:
                    for nm in (x.get('arabic'), x.get('name')):
                        if not nm: continue
                        m, w = match_name(nm, items, inv, 0.6)
                        if m: pid, how = m[1], f'barcode->{nm[:40]}'; break
                    if pid: break
                if recs and not pid: why = 'barcode known but product not found in our catalog'
            else:
                m, why = match_name(stem, items, inv, 0.7)
                if m: pid, how = m[1], f'name {m[0]:.2f}'
        if pid and pid in used: why, pid = f'duplicate of {used[pid]}', None
        if pid:
            used[pid] = fn; jobs.append((fn, pid, raw))
        rows.append([fn, pid or '', dict(items_by := {i: n for i, n, _ in items}).get(pid, '') if pid else '', how, why])
    with open(a.report, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f); w.writerow(['file', 'product_id', 'product_name', 'how', 'unmatched_reason']); w.writerows(rows)
    print(f'files: {len(rows)}  matched: {len(jobs)}  unmatched: {len(rows) - len(jobs)}  report: {a.report}')
    if not a.apply: print('dry run: nothing uploaded (use --apply)'); return
    key = os.environ.get('KH_ADMIN_KEY'); env = open(os.path.join(ROOT, '.env.production')).read()
    url = re.search(r'VITE_SUPABASE_URL=(\S+)', env).group(1); anon = re.search(r'VITE_SUPABASE_ANON_KEY=(\S+)', env).group(1)
    if not key: sys.exit('set KH_ADMIN_KEY')
    def up(j):
        fn, pid, raw = j
        try:
            d = to_webp(raw)
            if not d: return fn, 'too big after resize'
            req = urllib.request.Request(url + '/rest/v1/rpc/admin_photo_set', data=json.dumps({'p_key': key, 'p_id': pid, 'p_data': d}).encode(),
                                         headers={'apikey': anon, 'Authorization': 'Bearer ' + anon, 'Content-Type': 'application/json'})
            r = json.loads(urllib.request.urlopen(req, timeout=30).read()); return fn, 'ok' if r is True else f'rejected {r}'
        except Exception as e: return fn, 'error ' + str(e)[:80]
    with ThreadPoolExecutor(4) as ex: out = list(ex.map(up, jobs))
    ok = sum(1 for _, s in out if s == 'ok'); print(f'uploaded: {ok}/{len(jobs)}')
    for fn, s in out:
        if s != 'ok': print('  fail', fn, s)

if __name__ == '__main__': main()
