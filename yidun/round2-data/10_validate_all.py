#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""最终总校验：复跑全部证据链"""
import sys, os, json, random, string
BASE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,BASE)
from yd_crypto import *
from yd_pack import gen_cb_plain, xor_decode, build_check_payload, CB_CODE, CB_POS
from urllib.parse import urlparse, parse_qs

print('='*88); print('E0 常量自检'); print('='*88)
print(' 私有字母表 %d 字符 (unique %d), 含 "."= %s, 含 "7"= %s' % (len(ALPHABET), len(set(ALPHABET)), '.' in ALPHABET, '7' in ALPHABET))
print(' SBOX %d 字节 (unique %d, 双射= %s)' % (len(SBOX), len(set(SBOX)), len(set(SBOX))==256))
print(' ROUND_KEY=%r  SEED_KEY=%r  PADDING=%r' % (ROUND_KEY, SEED_KEY, PADDING))

print('='*88); print('E1/E2 SDK→Python'); print('='*88)
tot=ok=0
for fn in ('sdk_vectors.jsonl','sdk_vectors_rand.json'):
    p=os.path.join(BASE,fn)
    if not os.path.exists(p): continue
    vs = [json.loads(l) for l in open(p,encoding='utf8')] if fn.endswith('jsonl') else json.load(open(p,encoding='utf8'))
    for v in vs:
        tot+=1
        pl,meta=yd_aes_decrypt(v['cipher'])
        exp=v['plain']
        good = ((exp.endswith('...') and pl.startswith(exp[:-3])) or pl==exp) and meta['crc_ok']
        ok += good
print(' %d/%d 通过' % (ok,tot), '✅' if ok==tot else '❌')

print('='*88); print('E4 真实抓包全链路'); print('='*88)
D=json.load(open(os.path.join(BASE,'full_decode.json'),encoding='utf-8'))
for tag in D:
    tok=D[tag]['token']
    fields=D[tag]['fields']
    npts=len(fields['d']['decoded'])
    ext=fields['ext']['decoded']
    pv=fields['p']['decoded']
    cbmid=fields['cb']['mid']
    wm = ''.join(cbmid[i] for i in CB_POS)==CB_CODE
    xs=[int(x.split(',')[0]) for x in fields['d']['decoded']]
    ts=[int(x.split(',')[2]) for x in fields['d']['decoded']]
    consistent = ext.split(',')[1]==str(npts)
    print(' %-6s d点数=%-3d ext=%-6s 一致=%-5s | p=%-20r | x单调=%-5s | t单调=%-5s | cb水印=%s' % (
        tag, npts, ext, consistent, pv, all(xs[i]<=xs[i+1] for i in range(len(xs)-1)),
        all(ts[i]<=ts[i+1] for i in range(len(ts)-1)), wm))
    assert consistent and wm

print('='*88); print('E3 Py→SDK 由 yd_decrypt_node.js 单独执行（见 REPORT.md）'); print('='*88)

print('='*88); print('E5 协议直打端到端（本地构造 + 回读自校验）'); print('='*88)
tok='2a041cf5632744d68ced0787b79abdc7'
data=build_check_payload(tok, trace=[(4,0,132,1),(9,0,518,1),(14,0,543,1)], slide_pct='62.5', mouse_down=1)
allsame=True
for f,v in data.items():
    if f=='m': continue
    mid,meta=yd_aes_decrypt(v)
    dec=[xor_decode(tok,x) for x in mid.split(':')] if f=='d' else xor_decode(tok,mid)
    allsame &= meta['crc_ok']
    print('  %-4s chars=%-4d k=%-2d crc=%-5s → %r' % (f, len(v), meta['nblk'], meta['crc_ok'], dec))
cbp=gen_cb_plain()
cbc=yd_aes_encrypt(cbp)
m2,_=yd_aes_decrypt(cbc)
print('  cb   明文水印=%s 密文=%d字符' % (''.join(m2[i] for i in CB_POS)==CB_CODE, len(cbc)))
print(' >>> 通过 =', allsame)
