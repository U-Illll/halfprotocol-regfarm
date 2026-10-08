#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""线C: 易盾密文样本收集 + 统计"""
import json, re, os, sys, math, collections
from urllib.parse import unquote, urlparse, parse_qs

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)          # agent-易盾
OUT = BASE

samples = []   # dict: source, field, raw

def add(src, field, raw):
    if raw:
        samples.append({'source': src, 'field': field, 'raw': raw})

def harvest_url(url, src):
    q = parse_qs(urlparse(url).query, keep_blank_values=True)
    if 'data' in q:
        try:
            d = json.loads(q['data'][0])
        except Exception as e:
            print('[!] data parse fail', src, e); return
        for k in ('d', 'm', 'p', 'f', 'ext'):
            add(src, k, d.get(k, ''))
    if 'cb' in q:
        add(src, 'cb', q['cb'][0])

# 1) JSON 网络日志
for fn in ('out/yd-net-drag.json', 'out/yd-net-drag2.json', 'out/yd-net-init.json'):
    p = os.path.join(ROOT, fn)
    if not os.path.exists(p): continue
    data = json.load(open(p, encoding='utf-8'))
    recs = data if isinstance(data, list) else data.get('records', [])
    for r in recs:
        u = r.get('url') or ''
        if 'api/v3/check' in u:
            harvest_url(u, fn)

# 2) request-full txt
for fn in ('out/artifacts/check-request-full.txt', 'out/artifacts/check2-request-full.txt'):
    p = os.path.join(ROOT, fn)
    if not os.path.exists(p): continue
    txt = open(p, encoding='utf-8').read()
    for line in txt.splitlines():
        if 'c.dun.163.com/api/v3/check' in line:
            harvest_url(line.strip(), fn)

# 3) data sample json
for fn in ('out/artifacts/check-data-sample.json', 'out/artifacts/check2-data-sample.json'):
    p = os.path.join(ROOT, fn)
    if not os.path.exists(p): continue
    d = json.load(open(p, encoding='utf-8'))
    for k in ('d', 'm', 'p', 'f', 'ext'):
        add(fn, k, d.get(k, ''))

# 去重
seen = set(); uniq = []
for s in samples:
    key = (s['field'], s['raw'])
    if key in seen or not s['raw']: continue
    seen.add(key); uniq.append(s)

print('=== 样本收集 ===')
print('原始条目 %d，去重后 %d' % (len(samples), len(uniq)))

ALPHA = "MB.CfHUzEeJpsuGkgNwhqiSaI4Fd9L6jYKZAxn1/Vml0c5rbXRP+8tD3QTO2vWyo"
PAD = '7'

rows = []
for s in uniq:
    r = s['raw']
    L = len(r)
    cs = set(r)
    extra = cs - set(ALPHA) - {PAD}
    padcount = 0
    for ch in reversed(r):
        if ch == PAD: padcount += 1
        else: break
    rows.append({
        'source': s['source'], 'field': s['field'], 'len': L,
        'first': r[0], 'last': r[-1], 'last2': r[-2:], 'last4': r[-4:],
        'trail_pad': padcount,
        'mod4': L % 4,
        'charset_out': ''.join(sorted(extra)),
        'in_alpha': all(c in ALPHA or c == PAD for c in r),
        'alpha_hit': len(cs & set(ALPHA)),
    })

hdr = ('source', 'field', 'len', 'mod4', 'first', 'last', 'last2', 'last4', 'trail_pad', 'charset_out', 'in_alpha', 'alpha_hit')
print()
print('| ' + ' | '.join(hdr) + ' |')
print('|' + '|'.join(['---'] * len(hdr)) + '|')
for r in sorted(rows, key=lambda x: (x['len'], x['field'])):
    print('| ' + ' | '.join(str(r[h]) for h in hdr) + ' |')

json.dump({'alpha': ALPHA, 'pad': PAD, 'samples': uniq, 'rows': rows},
          open(os.path.join(OUT, 'samples.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('\n[saved] samples.json  (%d 条)' % len(uniq))

# 全局字符集
allc = set()
for s in uniq: allc |= set(s['raw'])
print('\n全局字符集 (%d): %s' % (len(allc), ''.join(sorted(allc))))
print('不在 B 表且非 padding 的字符:', ''.join(sorted(allc - set(ALPHA) - {PAD})) or '(无)')
print('B 表中未被使用的字符:', ''.join(sorted(set(ALPHA) - allc)) or '(无)')
