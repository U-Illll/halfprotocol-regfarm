#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""dx_dump_t12.py — dump 模板 type12 大 JSON（enc_5547 解密，前 2 字节为长度前缀）
用法: python3 dx_dump_t12.py [ac_or_bin] [--field N]
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import dx_ac as D  # noqa


def main():
    p = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'round2-hook/samples/run4/_ua_before.bin')
    fmt = 'json'
    if '--raw' in sys.argv:
        fmt = 'raw'
    raw = open(p, 'rb').read()
    if raw[:1] == b'5' or b'#' in raw[:12]:
        raw = D.dec_b64(raw.decode('latin1').split('#', 1)[1])
    for i, (ty, pl, tr) in enumerate(D.parse_tlv(raw)):
        if ty != 12:
            continue
        pt = D.enc_5547(pl)
        n = int.from_bytes(pt[0:2], 'big')
        js = pt[2:2 + n].decode('latin1')
        if fmt == 'raw':
            print(js)
            continue
        try:
            d = json.loads(js)
            print('field#%d type12 json keys=%d' % (i, len(d)))
            print(json.dumps(d, ensure_ascii=False, indent=1)[:6000])
        except Exception as e:
            print('field#%d type12 NOT-JSON (%s): %r' % (i, e, js[:500]))


if __name__ == '__main__':
    main()
