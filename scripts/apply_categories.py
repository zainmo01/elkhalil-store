#!/usr/bin/env python3
"""Applies scripts/category_moves.csv to scripts/catalog-source.json, then re-splits src/catalog.
Original categories are kept in scripts/category_backup.json (id -> original c), created once.
Edit scripts/category_exclude.txt (one id per line) to reject moves; re-run to rebuild from the originals.
Revert everything: python3 scripts/apply_categories.py --revert   (or --revert ID ID ... for specific items)."""
import json, csv, os, sys, subprocess, collections
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = f'{R}/scripts'
cat = json.load(open(f'{S}/catalog-source.json', encoding='utf-8'))
bp = f'{S}/category_backup.json'
if not os.path.exists(bp):
    json.dump({x['i']: x['c'] for x in cat}, open(bp, 'w'), separators=(',', ':'))
orig = json.load(open(bp))
moves = {r['id']: int(r['proposed_category']) for r in csv.DictReader(open(f'{S}/category_moves.csv', encoding='utf-8-sig'))}
excl = {l.strip() for l in open(f'{S}/category_exclude.txt', encoding='utf-8') if l.strip() and not l.startswith('#')}
args = sys.argv[1:]
if args and args[0] == '--revert':
    ids = set(args[1:]) or None
    for x in cat:
        if ids is None or x['i'] in ids: x['c'] = orig[x['i']]
else:
    for x in cat:
        x['c'] = moves[x['i']] if x['i'] in moves and x['i'] not in excl else orig[x['i']]
json.dump(cat, open(f'{S}/catalog-source.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
subprocess.run(['python3', f'{S}/split_catalog.py'], check=True)
print('counts', dict(sorted(collections.Counter(x['c'] for x in cat).items())))
