# -*- coding: utf-8 -*-
"""编码器判定：各层熵/结构检验"""
import sys, os, json, math, collections
BASE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,BASE)
from yd_crypto import *

def H_bytes(bs):
    if not bs: return 0.0
    c = collections.Counter(bs); n=len(bs)
    return -sum(v/n*math.log2(v/n) for v in c.values())
def H_str(s):
    return H_bytes([ord(c) for c in s])

S=json.load(open(os.path.join(BASE,'samples.json'),encoding='utf-8'))
D=json.load(open(os.path.join(BASE,'full_decode.json'),encoding='utf-8'))

print('%-6s %-6s %-8s %-9s %-9s %-9s %-9s %-9s' % ('field','chars','bytes','H(cipher)','H(raw)','H(mid)','H(final)','alphabet_src'))
print('-'*92)
for tag, tf in D.items():
    for f, info in tf['fields'].items():
        raw_s = None
        for s in S['samples']:
            if s['field']==f and ((tag=='drag1' and 'drag.json' in s['source']) or (tag=='drag2' and 'drag2' in s['source'])):
                raw_s = s['raw']; break
        if raw_s is None: continue
        rb = b64_decode_private(raw_s)
        mid = info.get('mid','')
        final = info.get('decoded')
        fs = json.dumps(final, ensure_ascii=False) if final is not None else ''
        print('%-6s %-6d %-8d %-9.4f %-9.4f %-9.4f %-9.4f %-9s' % (
            f, len(raw_s), len(rb), H_str(raw_s), H_bytes(rb), H_str(mid), H_str(fs) if fs else 0, 'custom64'))

print()
print('理论最大熵: 6 bit/char = %.4f ; 8 bit/byte = %.4f' % (6, 8))
print('随机密文串 H≈6.0；明文 H≈4.5 以下')
