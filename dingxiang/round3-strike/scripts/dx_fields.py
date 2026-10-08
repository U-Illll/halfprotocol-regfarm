#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""dx_fields.py — 5949 版 greenseer 字段编解码库（字段号 → encrypt_* 函数，源码级）
来源: round2-static/out/greenseer.deob.js L1641-1755（18 个函数完整实现）
      L950-L1135: app(<type>, encrypt_xxx(plain)) 调用点 → 字段号映射
说明: 多数函数自逆（out[i] 只依赖位置或前一个输出）；type6/4/10 是逐字节映射，需逆表。
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dx_ac as D  # noqa


def _x(o):
    return o if isinstance(o, bytes) else o.encode('latin1')


# ---- 18 个函数（5949 源码逐字复刻） ----
def e_8(o):    # encrypt_rwj3ccrr01kuh9spnerm  key="dx54gFRTbvc" 循环 XOR（自逆）
    key = b"dx54gFRTbvc"; r = bytearray(); s = 0
    for ch in _x(o):
        r.append((ch ^ key[s]) & 255); s += 1
        if s >= len(key):
            s = 0
    return bytes(r)


def e_15(o):   # encrypt_v6z3zw469kdzfxxha55r  a=72439; c=ch^a; a=c; out=c（自逆）
    r = bytearray(); a = 72439
    for ch in _x(o):
        c = ch ^ a; a = c; r.append(c & 255)
    return bytes(r)


def e_16(o):   # encrypt_2eg33kdtkgouos5mfayu  u=621; f=(ch^u)&255; u=f; out=f（自逆）
    r = bytearray(); u = 621
    for ch in _x(o):
        f = (ch ^ u) & 255; u = f; r.append(f)
    return bytes(r)


def e_6(o):    # encrypt_ibnwwnx75wveeknf0y8v  f=208,s=4: c=208^ch; out=(c>>4)^ch（逐字节）
    return bytes(((((208 ^ ch) >> 4) ^ ch) & 255) for ch in _x(o))


def e_18(o):   # encrypt_43xivvl7s7518db0j0ku  key="bhbXy6HJSaj67jk" 循环 XOR（自逆）
    key = b"bhbXy6HJSaj67jk"
    return bytes((ch ^ key[i % len(key)]) & 255 for i, ch in enumerate(_x(o)))


def e_4(o):    # encrypt_h2u66y2r9xpl77ycn0w5_tpyrcne  f=(ch-2)&255; out=((f>>5)+(f<<3))&255（逐字节）
    return bytes(((((ch - 2) & 255) >> 5) + (((ch - 2) & 255) << 3)) & 255 for ch in _x(o))


def e_14(o):   # encrypt_p1tyxdx8rojx2fimmsva  c=43521; s=ch^c; c=c*i%256+24351; out=s（自逆）
    r = bytearray(); c = 43521
    for i, ch in enumerate(_x(o)):
        s = ch ^ c; c = c * i % 256 + 24351; r.append(s & 255)
    return bytes(r)


def e_1(o):    # encrypt_bj7bnzly9ld4zfko9l8o_tpyrcne  c=2319; s=ch^c; c=c*i%256+20630; out=s（自逆）
    r = bytearray(); c = 2319
    for i, ch in enumerate(_x(o)):
        s = ch ^ c; c = c * i % 256 + 20630; r.append(s & 255)
    return bytes(r)


def e_9(o):    # encrypt_vxhi06x40ro3adppqbb6  a=2372; c=ch^a; a+=2; out=c（自逆）
    r = bytearray(); a = 2372
    for ch in _x(o):
        c = ch ^ a; a += 2
        if a >= 2147483647:
            a = 2372
        r.append(c & 255)
    return bytes(r)


def e_10(o):   # encrypt_chiq6w9cbvngmakl6wg8  f=121^ch; out=(f>>6)^ch（逐字节）
    return bytes(((((121 ^ ch) >> 6) ^ ch) & 255) for ch in _x(o))


def e_3(o):    # encrypt_sgwdkctstvny9q3p1248  key="NxMLsN8Ng7lA" 步长3（自逆）
    key = b"NxMLsN8Ng7lA"; r = bytearray(); c = 32
    for ch in _x(o):
        c = (c + 3) % len(key); r.append((ch ^ key[c]) & 255)
    return bytes(r)


def e_13(o):   # encrypt_55nnt3ep9qwjkbpkcaj8_tpyrcne  i=46317; u=ch^i; i=u; out=u（自逆）
    r = bytearray(); i = 46317
    for ch in _x(o):
        u = ch ^ i; i = u; r.append(u & 255)
    return bytes(r)


def e_2(o):    # encrypt_6dknua3bfnwbgs6k2ueg  i=3519; u=ch^i; i=u; out=u（自逆）
    r = bytearray(); i = 3519
    for ch in _x(o):
        u = ch ^ i; i = u; r.append(u & 255)
    return bytes(r)


def e_17(o):   # encrypt_mjb470o7onmk7vtmtksp  out=(237^ch)>>8 ^ ch = ch（恒等）
    return bytes(ch & 255 for ch in _x(o))


def e_5(o):    # encrypt_d8nrtkn0j3gzw2bmq6xf  c=56737; s=ch^c; c=s; out=s（自逆）
    r = bytearray(); c = 56737
    for ch in _x(o):
        s = ch ^ c; c = s; r.append(s & 255)
    return bytes(r)


def e_7(o):    # encrypt_6bqrb1fro5sh7yffzg85  f=3127; f=f*i%256+21473; out=ch^f（自逆）
    r = bytearray(); f = 3127
    for i, ch in enumerate(_x(o)):
        f = f * i % 256 + 21473; r.append((ch ^ f) & 255)
    return bytes(r)


def e_12(o):   # encrypt_vzigbys1175r5o30bywo  u=5547; f=ch^u; u=u*i%256+22424; out=f（自逆）
    r = bytearray(); u = 5547
    for i, ch in enumerate(_x(o)):
        f = ch ^ u; u = u * i % 256 + 22424; r.append(f & 255)
    return bytes(r)


FIELD_ENC = {
    1: e_1, 2: e_2, 3: e_3, 4: e_4, 5: e_5, 6: e_6, 7: e_7, 8: e_8,
    9: e_9, 10: e_10, 11: e_13, 12: e_12, 13: e_13, 14: e_14, 15: e_15,
    16: e_16, 17: e_17, 18: e_18,
}
SELF_INV = {8, 18, 14, 1, 9, 3, 7, 12, 17}
BYTEWISE = {6, 4, 10}
# 链式 XOR：out_i = ch_i ^ state_{i-1}; state_i = out_i; state_0 = K（需真逆）
CHAIN_K = {15: 72439, 16: 621, 2: 3519, 5: 56737, 11: 46317, 13: 46317}


def inv_bytewise(fn):
    tab = {}
    for b in range(256):
        tab.setdefault(fn(bytes([b]))[0], b)
    return bytes(tab.get(c, 0) for c in range(256))


def _chain_inv(cipher, K):
    """逆：ch_i = c_i ^ (c_{i-1} if i>0 else K)"""
    r = bytearray(); prev = K
    for c in cipher:
        r.append((c ^ prev) & 255); prev = c
    return bytes(r)


def dec_field(ty, cipher):
    """解密（逆运算）：逐字节用逆表 / 链式用 _chain_inv / 其余自逆直接重跑"""
    fn = FIELD_ENC.get(ty)
    if fn is None:
        return None
    if ty in BYTEWISE:
        return bytes(inv_bytewise(fn)[c] for c in cipher)
    if ty in CHAIN_K:
        return _chain_inv(cipher, CHAIN_K[ty])
    return fn(cipher)


def enc_field(ty, plain):
    fn = FIELD_ENC.get(ty)
    return fn(plain) if fn else None


def roundtrip_selftest():
    import random
    ok = 0
    for ty, fn in FIELD_ENC.items():
        for n in (1, 4, 8, 20, 80):
            pt = bytes(random.randrange(256) for _ in range(n))
            ct = fn(pt)
            back = dec_field(ty, ct)
            if back == pt:
                ok += 1
            else:
                print('RT FAIL type=%d n=%d' % (ty, n))
    print('roundtrip ok=%d/90' % ok)
    return ok == 90


if __name__ == '__main__':
    roundtrip_selftest()
