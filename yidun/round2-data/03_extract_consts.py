# -*- coding: utf-8 -*-
import json, os
BASE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(BASE)
s = open(os.path.join(ROOT, 'round2-static/deob-strings.js'), encoding='utf8').read()

def grab(name):
    key = '__%s__' % name
    i = s.find(key)
    while i != -1:
        j = s.find('=', i + len(key))
        if j == -1: return None
        k = j + 1
        while k < len(s) and s[k] in ' \t': k += 1
        q = s[k]
        if q in '"\'':
            e = s.find(q, k + 1)
            return s[k+1:e]
        i = s.find(key, i + 1)
    return None

consts = {}
for n in ['SBOX', 'ROUND_KEY', 'SEED_KEY', 'BASE64_ALPHABET', 'BASE64_PADDING']:
    v = grab(n); consts[n] = v
    print('%-18s len=%-5s  %s' % (n, len(v) if v else None, v if v and len(v)<=80 else (v[:80]+'...' if v else None)))
print()
print('ALPHABET unique:', len(set(consts['BASE64_ALPHABET'])) if consts['BASE64_ALPHABET'] else None)
print("'7' in ALPHABET:", '7' in (consts['BASE64_ALPHABET'] or ''))
print("'.' in ALPHABET:", '.' in (consts['BASE64_ALPHABET'] or ''))
json.dump(consts, open(os.path.join(BASE,'consts.json'),'w'), indent=1)
print('[saved] consts.json')
