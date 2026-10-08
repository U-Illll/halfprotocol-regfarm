#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""dx_probe_fields.py — 对模板 ac 的每个字段，暴力尝试 17 个 encrypt_* 解密，报告可读明文
（自逆函数直接重跑；非自逆函数用 256 值表求逆）
用法: python3 dx_probe_fields.py [ac_or_bin]
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import dx_ac as D  # noqa

SELFINV = {
    'enc_3519': D.enc_3519, 'enc_NxML': D.enc_NxML, 'enc_dx54': D.enc_dx54, 'enc_bhbX': D.enc_bhbX,
    'enc_43521': D.enc_43521, 'enc_72439': D.enc_72439, 'enc_5547': D.enc_5547,
    'enc_2372': D.enc_2372, 'enc_56737': D.enc_56737, 'enc_46317': D.enc_46317,
    'enc_621': D.enc_621, 'enc_3127_21473': D.enc_3127_21473,
}


def inv_bytewise(name, fn):
    """对逐字节函数构造逆表（假设 out[i] 只依赖 in[i]）"""
    tab = {}
    for b in range(256):
        r = fn(bytes([b]))[0]
        tab.setdefault(r, b)
    return bytes(tab.get(c, 0) for c in range(256))


def printable_ratio(b):
    if not b:
        return 0.0
    return sum(1 for c in b if 32 <= c < 127) / len(b)


def main():
    p = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'round2-hook/samples/run4/_ua_before.bin')
    raw = open(p, 'rb').read()
    if raw[:1] == b'5' or b'#' in raw[:12]:
        raw = D.dec_b64(raw.decode('latin1').split('#', 1)[1])
    fields = D.parse_tlv(raw)
    inv = {}
    for name, fn in (('enc_208', D.enc_208), ('enc_2_5', D.enc_2_5), ('enc_179', D.enc_179),
                     ('enc_121', D.enc_121), ('enc_237', D.enc_237)):
        inv['inv_' + name] = inv_bytewise(name, fn)
    cands = dict(SELFINV); cands.update(inv)
    print('fields=%d cands=%d' % (len(fields), len(cands)))
    for i, (ty, pl, tr) in enumerate(fields):
        if ty == 7 and i > 14:
            continue  # 轨迹点批量跳过
        best = []
        for name, fn in cands.items():
            try:
                pt = fn(pl)
            except Exception:
                continue
            best.append((printable_ratio(pt), name, pt))
        best.sort(key=lambda x: -x[0])
        head = best[0]
        extra = ''
        if len(best) > 1 and best[1][0] > 0.5:
            extra = ' | 2nd=%s r=%.2f %r' % (best[1][1], best[1][0], best[1][2][:60])
        print('#%-2d type=%-2d len=%-4d best=%s r=%.2f %r%s' % (
            i, ty, len(pl), head[1], head[0], head[2][:120], extra))


if __name__ == '__main__':
    main()
