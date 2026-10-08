# -*- coding: utf-8 -*-
import sys, json, os
BASE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,BASE)
from yd_crypto import *
S=json.load(open(os.path.join(BASE,'samples.json'),encoding='utf-8'))
rows=[]
for s in S['samples']:
    r=s['raw']; rb=b64_decode_private(r)
    t=0
    for ch in reversed(r):
        if ch==PADDING: t+=1
        else: break
    extra=''.join(sorted(set(r)-set(ALPHABET)-{PADDING})) or '∅'
    tag='drag1' if 'drag.json' in s['source'] else ('drag2' if 'drag2' in s['source'] else s['source'])
    rows.append(dict(tag=tag, field=s['field'], chars=len(r), mod4=len(r)%4, first=r[0], last=r[-1],
                     last2=r[-2:], last4=r[-4:], trail7=t, nbytes=len(rb), k=(len(rb)-4)//64,
                     extra=extra, in_alpha=all(c in ALPHABET or c==PADDING for c in r)))
rows.sort(key=lambda x:(x['tag'], ['d','m','p','f','ext','cb'].index(x['field'])))
hdr=['tag','field','chars','mod4','first','last','last2','last4','trail7','nbytes','k','extra']
print('| ' + ' | '.join(hdr) + ' |'); print('|'+'|'.join(['---']*len(hdr))+'|')
for r in rows:
    print('| ' + ' | '.join(str(r[h]) for h in hdr) + ' |')
print()
print('首字符集合 (%d 个不同): %s' % (len(set(r['first'] for r in rows)), ''.join(sorted(set(r['first'] for r in rows)))))
print('尾字符集合: %s' % sorted(set(r['last'] for r in rows)))
print('非字母表字符总数: %d' % sum(1 for r in rows if r['extra']!='∅'))
print('全部密文用到的字符总数: %d' % len(set().union(*[set(s['raw']) for s in S['samples']])))
print('字母表字符数: %d, padding: %r(不在字母表)' % (len(set(ALPHABET)), PADDING))
json.dump(rows, open(os.path.join(BASE,'stats_rows.json'),'w',encoding='utf-8'), ensure_ascii=False, indent=1)
