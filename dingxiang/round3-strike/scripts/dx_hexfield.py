#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""dx_hexfield.py — 解密指定字段并输出 hex + 可读化（用于分析 getMM/getMD 等记录结构）
用法: python3 dx_hexfield.py <idx>[,idx2...] [ac_or_bin]
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import dx_ac as D  # noqa

FN = {8: D.enc_dx54, 9: D.enc_2372, 7: D.enc_3127_21473, 12: D.enc_5547, 10: D.enc_121,
      3: D.enc_NxML, 2: D.enc_3519, 16: D.enc_43521, 14: D.enc_72439, 13: D.enc_3127_21473}

idx = [int(x) for x in sys.argv[1].split(',')]
p = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'round2-hook/samples/run4/_ua_before.bin')
raw = open(p, 'rb').read()
if raw[:1] == b'5' or b'#' in raw[:12]:
    raw = D.dec_b64(raw.decode('latin1').split('#', 1)[1])
fields = D.parse_tlv(raw)
for i in idx:
    ty, pl, tr = fields[i]
    fn = FN.get(ty)
    print('--- field#%d type=%d len=%d' % (i, ty, len(pl)))
    print('cipher:', pl.hex())
    if fn:
        pt = fn(pl)
        print('plain :', pt.hex())
        print('repr  :', repr(pt[:160]))
        if ty == 10 or ty == 3:
            if len(pt) > 4:
                print('  hdr4=%s (BE u32=%d) body=%s' % (pt[:4].hex(), int.from_bytes(pt[:4], 'big'), repr(pt[4:80])))
