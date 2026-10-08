#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""顶象 ac 工具库（Round 3）：自定义 base64 / TLV 解析 / 加密函数复刻 / ac 构造。
证据来源：
  - round2-static/scripts/ac_parse.py（17 个 encrypt_* 复刻；往返验证）
  - round2-hook/samples/run4/_ua_before.bin（5949 版 _ua 原始 1332B，TLV 对齐）
  - round3 实测：ac = "5949#" + custom_b64(_ua)  (cust==body True / std False)
"""
import base64, binascii, json, struct

B64_ALPH = "XmYj3u1PnvisIZUF8ThR/a6DfO+kW4JHrCELycAzSxleoQp02MtwV9Nd57qGgbKB="
B64_IDX = {c: i for i, c in enumerate(B64_ALPH)}


def dec_b64(s):
    bits = []
    for ch in s:
        if ch in B64_IDX and B64_IDX[ch] < 64:
            bits.append(format(B64_IDX[ch], '06b'))
    b = ''.join(bits)
    return bytes(int(b[i:i + 8], 2) for i in range(0, len(b) - 7, 8))


def enc_b64(data):
    out = []
    for i in range(0, len(data), 3):
        chunk = data[i:i + 3] + b'\x00' * (3 - len(data[i:i + 3]))
        u, c, d = chunk[0], chunk[1], chunk[2]
        g = u >> 2
        l = ((u & 3) << 4) | (c >> 4)
        j = ((c & 15) << 2) | (d >> 6)
        p = d & 63
        n = len(data) - i
        if n < 2:
            j = p = 64
        elif n < 3:
            p = 64
        out += [B64_ALPH[g], B64_ALPH[l], B64_ALPH[j], B64_ALPH[p]]
    return ''.join(out)


def bs2(n):
    return bytes([(n >> 8) & 0xFF, n & 0xFF])


def bs4(n):
    return bytes([(n >> 24) & 0xFF, (n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF])


# ---------------- encrypt_* 复刻（明文 bytes -> 密文 bytes） ----------------
def _x(s):
    return s if isinstance(s, bytes) else s.encode('latin1')


def enc_3519(o):
    r = bytearray(); i = 3519
    for ch in _x(o):
        u = (ch ^ i) & 255
        r.append(u); i = u
    return bytes(r)


def enc_NxML(o):
    key = b"NxMLsN8Ng7lA"; r = bytearray(); c = 32
    for ch in _x(o):
        c = (c + 3) % len(key)
        r.append((ch ^ key[c]) & 255)
    return bytes(r)


def enc_dx54(o):
    key = b"dx54gFRTbvc"; r = bytearray(); s = 0
    for ch in _x(o):
        r.append((ch ^ key[s]) & 255)
        s += 1
        if s >= len(key):
            s = 0
    return bytes(r)


def enc_bhbX(o):
    key = b"bhbXy6HJSaj67jk"; r = bytearray()
    for f, ch in enumerate(_x(o)):
        r.append((ch ^ key[f % len(key)]) & 255)
    return bytes(r)


def enc_237(o):
    r = bytearray()
    for ch in _x(o):
        d = 237 ^ ch
        r.append(((d >> 8) ^ ch) & 255)
    return bytes(r)


def enc_43521(o):
    r = bytearray(); c = 43521
    for f, ch in enumerate(_x(o)):
        s = ch ^ c
        c = c * f % 256 + 24351
        r.append(s & 255)
    return bytes(r)


def enc_72439(o):
    r = bytearray(); a = 72439
    for ch in _x(o):
        a = ch ^ a
        r.append(a & 255)
    return bytes(r)


def enc_5547(o):
    r = bytearray(); u = 5547
    for c, ch in enumerate(_x(o)):
        f = ch ^ u
        u = u * c % 256 + 22424
        r.append(f & 255)
    return bytes(r)


def enc_121(o):
    r = bytearray()
    for ch in _x(o):
        f = 121 ^ ch
        r.append(((f >> 6) ^ ch) & 255)
    return bytes(r)


def enc_179(o):
    r = bytearray(); c = 179
    for ch in _x(o):
        c = ((c << 6 ^ c) & 240) + (c >> 4)
        r.append((ch ^ c) & 255)
    return bytes(r)


def enc_2372(o):
    r = bytearray(); a = 2372
    for ch in _x(o):
        c = ch ^ a
        a += 2
        if a >= 2147483647:
            a = 2372
        r.append(c & 255)
    return bytes(r)


def enc_56737(o):
    r = bytearray(); c = 56737
    for ch in _x(o):
        s = ch ^ c
        c = s
        r.append(s & 255)
    return bytes(r)


def enc_46317(o):
    r = bytearray(); i = 46317
    for ch in _x(o):
        u = ch ^ i
        i = u
        r.append(u & 255)
    return bytes(r)


def enc_621(o):
    r = bytearray(); u = 621
    for ch in _x(o):
        f = (ch ^ u) & 255
        r.append(f); u = f
    return bytes(r)


def enc_3127_21473(o):
    """SA 轨迹点（5949 中 type 7）"""
    r = bytearray(); f = 3127
    for s, ch in enumerate(_x(o)):
        f = f * s % 256 + 21473
        r.append((ch ^ f) & 255)
    return bytes(r)


def enc_2_5(o):
    r = bytearray()
    for ch in _x(o):
        f = (ch - 2) & 255
        r.append(((f >> 5) + (f << 3)) & 255)
    return bytes(r)


def enc_208(o):
    r = bytearray()
    for ch in _x(o):
        c = 208 ^ ch
        r.append(((c >> 4) ^ ch) & 255)
    return bytes(r)


ALL_ENC = {
    'enc_3519': enc_3519, 'enc_NxML': enc_NxML, 'enc_dx54': enc_dx54, 'enc_bhbX': enc_bhbX,
    'enc_237': enc_237, 'enc_43521': enc_43521, 'enc_72439': enc_72439, 'enc_5547': enc_5547,
    'enc_121': enc_121, 'enc_179': enc_179, 'enc_2372': enc_2372, 'enc_56737': enc_56737,
    'enc_46317': enc_46317, 'enc_621': enc_621, 'enc_3127_21473': enc_3127_21473,
    'enc_2_5': enc_2_5, 'enc_208': enc_208,
}


# ---------------- TLV / ac ----------------
def parse_tlv(raw):
    """raw(bytes) -> list[(type, payload)]  """
    pos = 0
    fields = []
    while pos + 3 <= len(raw):
        ty = raw[pos]; ln = raw[pos + 1] * 256 + raw[pos + 2]
        if pos + 3 + ln > len(raw):
            fields.append((ty, raw[pos + 3:], True))
            break
        fields.append((ty, raw[pos + 3:pos + 3 + ln], False))
        pos += 3 + ln
    return fields


def tlv_bytes(fields):
    out = b''
    for ty, pl in fields:
        out += bytes([ty]) + bs2(len(pl)) + pl
    return out


def build_ac(fields, version=5949):
    return "%d#%s" % (version, enc_b64(tlv_bytes(fields)))


def parse_ac(ac):
    ver, body = ac.split('#', 1)
    raw = dec_b64(body)
    return ver, raw, parse_tlv(raw)


def score(s):
    if not s:
        return -1
    return sum(1 for ch in s if 32 <= ch < 127) / len(s)


def sa_point(plain8):
    """解密后的 8B 轨迹点 -> dict"""
    dt = int.from_bytes(plain8[0:4], 'big')
    x = int.from_bytes(plain8[4:6], 'big')
    y = int.from_bytes(plain8[6:8], 'big')
    return {'dt': dt, 'x': x, 'y': y, 'hex': plain8.hex()}


def enc_sa_point(dt, x, y):
    return enc_3127_21473(bs4(dt) + bs2(x) + bs2(y))


if __name__ == '__main__':
    import sys
    ac = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read().strip()
    ver, raw, fields = parse_ac(ac)
    print('version=%s raw=%dB fields=%d' % (ver, len(raw), len(fields)))
    for i, (ty, pl, tr) in enumerate(fields):
        print('#%-2d type=%-2d len=%-4d %s' % (i, ty, len(pl), 'TRUNC' if tr else pl[:24].hex()))
