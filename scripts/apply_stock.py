#!/usr/bin/env python3
"""Applies the pharmacy stock report (.xls) to the catalog: sell prices + availability.
- Items in the report: price = report sell price, a=1 (available), listed first.
- Items not in the report: price unchanged, no `a` (shown as غير متاح, cannot be added to cart).
- COST columns are never read.  Unmatched report codes are written to scripts/stock_unmatched.csv (not added).
Originals live in scripts/catalog-source.pre-stock.json. Edit scripts/stock_exclude.txt (one id per line) to keep an item's old
price and mark it available regardless of the report; re-run to rebuild. Full revert: python3 scripts/apply_stock.py --revert
Usage: apply_stock.py REPORT.xls | --revert"""
import json, sys, os, csv, shutil, subprocess, collections
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); S = f'{R}/scripts'
pre = f'{S}/catalog-source.pre-stock.json'; cur = f'{S}/catalog-source.json'
if not os.path.exists(pre): shutil.copy(cur, pre)
cat = json.load(open(pre, encoding='utf-8'))
excl = set(l.strip() for l in open(f'{S}/stock_exclude.txt', encoding='utf-8') if l.strip() and not l.startswith('#')) if os.path.exists(f'{S}/stock_exclude.txt') else set()
if sys.argv[1:] == ['--revert']:
    out = cat
else:
    import xlrd
    sh = xlrd.open_workbook(sys.argv[1]).sheet_by_index(0)
    rep = {}
    for r in range(9, sh.nrows):
        v = sh.row_values(r)  # only code (31), name (21), sell price (8) are read
        if v[31] == '' or v[21] == '': continue
        try: rep[str(int(float(v[31])))] = (float(v[8]), str(v[21]).strip())
        except Exception: pass
    ids = {x['i'] for x in cat}
    out_av, out_un = [], []
    for x in cat:
        y = dict(x)
        if x['i'] in rep and x['i'] not in excl:
            if rep[x['i']][0] > 0: y['p'] = round(rep[x['i']][0], 2)
            y['a'] = 1; out_av.append(y)
        elif x['i'] in excl: y['a'] = 1; out_av.append(y)
        else: out_un.append(y)
    # report items that the catalog doesn't have yet are added as available (id = report code). Category from
    # scripts/new_item_categories.json (hand-checked); anything missing there goes to الأدوية (0).
    newcat = json.load(open(f'{S}/new_item_categories.json')) if os.path.exists(f'{S}/new_item_categories.json') else {}
    added = [{'i': c, 'n': n, 'p': round(p, 2), 'c': int(newcat.get(c, 0)), 'a': 1} for c, (p, n) in rep.items() if c not in ids and p > 0 and c not in excl]
    out = out_av + added + out_un
    with open(f'{S}/stock_unmatched.csv', 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f); w.writerow(['code', 'name', 'sell_price'])
        for c, (p, n) in rep.items():
            if c not in ids: w.writerow([c, n, p])
    print('added new items', len(added)); print('report rows', len(rep), 'matched', sum(1 for c in rep if c in ids), 'unmatched', sum(1 for c in rep if c not in ids))
json.dump(out, open(cur, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
subprocess.run(['python3', f'{S}/split_catalog.py'], check=True)
old = {x['i']: x['p'] for x in cat}
old_ids = set(old)
print('available', sum(1 for x in out if x.get('a')), 'unavailable', sum(1 for x in out if not x.get('a')), 'prices changed', sum(1 for x in out if x['i'] in old and abs(x['p'] - old[x['i']]) > 0.001))
