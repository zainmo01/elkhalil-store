#!/usr/bin/env python3
"""Split scripts/catalog-source.json into src/catalog/head.json (first 400 + featured extras) and part-N.json (4000 each)."""
import json, os, glob
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cat = json.load(open(f'{R}/scripts/catalog-source.json', encoding='utf-8'))
os.makedirs(f'{R}/src/catalog', exist_ok=True)
for f in glob.glob(f'{R}/src/catalog/*.json'): os.remove(f)
HEAD = 400
FEAT = {'25561', '23144', '23024', '22268', '22134', '10313', '10314', '10316'}
dump = lambda o, p: open(p, 'w', encoding='utf-8').write(json.dumps(o, ensure_ascii=False, separators=(',', ':')))
dump({'items': cat[:HEAD], 'extra': [c for c in cat[HEAD:] if c['i'] in FEAT]}, f'{R}/src/catalog/head.json')
rest = cat[HEAD:]
for k in range(0, len(rest), 4000): dump(rest[k:k + 4000], f'{R}/src/catalog/part-{k // 4000 + 1}.json')
print(len(cat), 'items ->', len(glob.glob(f'{R}/src/catalog/*.json')), 'files')
