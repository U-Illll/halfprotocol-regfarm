#!/usr/bin/env python3
# 顶象 ac 解析/解密工具（静态逆向所得）
# ac = version + "#" + custom_b64( concat([type(1)][len_hi(1)][len_lo(1)][payload(len)])... )
import json, sys, base64, re

# greenseer 自定义 base64 字母表（来自 greenseer.js: i["btoa"]）
B64_ALPH = "XmYj3u1PnvisIZUF8ThR/a6DfO+kW4JHrCELycAzSxleoQp02MtwV9Nd57qGgbKB="
B64_IDX = {c: i for i, c in enumerate(B64_ALPH)}

def dec_b64(s):
    bits = []
    for ch in s:
        if ch in B64_IDX and B64_IDX[ch] < 64:
            bits.append(format(B64_IDX[ch], '06b'))
    b = ''.join(bits)
    return bytes(int(b[i:i+8], 2) for i in range(0, len(b) - 7, 8))

def enc_b64(data):
    out = []
    for i in range(0, len(data), 3):
        chunk = data[i:i+3]
        while len(chunk) < 3:
            chunk += b'\x00'
        u, c, d = chunk[0], chunk[1], chunk[2]
        g = u >> 2
        l = ((u & 3) << 4) | (c >> 4)
        j = ((c & 15) << 2) | (d >> 6)
        p = d & 63
        n = len(data) - i
        if n < 2: j = p = 64
        elif n < 3: p = 64
        out += [B64_ALPH[g], B64_ALPH[l], B64_ALPH[j], B64_ALPH[p]]
    return ''.join(out)

# ---- greenseer 的 encrypt_* 函数（自逆 XOR 变体） ----
def _cc(o): 
    return [ord(c) for c in o]

def e_selfreg(seed, mul, add, o):
    """c = seed; s = orig ^ (c = c*i%256 + add)  —— 注意各函数具体形式见实现"""
    raise NotImplementedError

def enc_3519(o):  # encrypt_6dknua3bfnwbgs6k2ueg
    r = ''; i = 3519
    for ch in o:
        u = (ord(ch) ^ i) & 255
        r += chr(u); i = u
    return r

def enc_NxML(o):  # encrypt_sgwdkctstvny9q3p1248  key NxMLsN8Ng7lA, c=32,c=(c+3)%12
    key = "NxMLsN8Ng7lA"; r = ''; c = 32
    for ch in o:
        c = (c + 3) % len(key)
        s = ord(ch) ^ ord(key[c])
        r += chr(s & 255)
    return r

def enc_dx54(o):  # encrypt_rwj3ccrr01kuh9spnerm key dx54gFRTbvc 循环
    key = "dx54gFRTbvc"; r = ''; s = 0
    for ch in o:
        v = ord(ch) ^ ord(key[s]); s += 1
        if s >= len(key): s = 0
        r += chr(v & 255)
    return r

def enc_bhbX(o):  # encrypt_43xivvl7s7518db0j0ku key bhbXy6HJSaj67jk 按位置
    key = "bhbXy6HJSaj67jk"; r = ''
    for f, ch in enumerate(o):
        r += chr((ord(ch) ^ ord(key[f % len(key)])) & 255)
    return r

def enc_237(o):  # encrypt_mjb470o7onmk7vtmtksp  = 恒等
    r = ''
    for ch in o:
        d = 237 ^ ord(ch)
        r += chr(((d >> 8) ^ ord(ch)) & 255)
    return r

def enc_43521(o):  # encrypt_p1tyxdx8rojx2fimmsva
    r = ''; c = 43521
    for f, ch in enumerate(o):
        s = ord(ch) ^ c
        c = c * f % 256 + 24351
        r += chr(s & 255)
    return r

def enc_72439(o):  # encrypt_v6z3zw469kdzfxxha55r
    r = ''; a = 72439
    for ch in o:
        a = ord(ch) ^ a
        r += chr(a & 255)
    return r

def enc_5547(o):  # encrypt_vzigbys1175r5o30bywo
    r = ''; u = 5547
    for c, ch in enumerate(o):
        f = ord(ch) ^ u
        u = u * c % 256 + 22424
        r += chr(f & 255)
    return r

def enc_121(o):  # encrypt_chiq6w9cbvngmakl6wg8 : f=121^orig; out=(f>>6 ^ orig)&255
    r = ''
    for ch in o:
        f = 121 ^ ord(ch)
        r += chr(((f >> 6) ^ ord(ch)) & 255)
    return r

def enc_179(o):  # encrypt_5w0ncy77lpx9r2y66u2h
    r = ''; c = 179
    for ch in o:
        c = ((c << 6 ^ c) & 240) + (c >> 4)
        r += chr((ord(ch) ^ c) & 255)
    return r

def enc_2372(o):  # encrypt_vxhi06x40ro3adppqbb6
    r = ''; a = 2372
    for ch in o:
        c = ord(ch) ^ a
        a += 2
        if a >= 2147483647: a = 2372
        r += chr(c & 255)
    return r

def enc_56737(o):  # encrypt_d8nrtkn0j3gzw2bmq6xf
    r = ''; c = 56737
    for ch in o:
        s = ord(ch) ^ c
        c = s
        r += chr(s & 255)
    return r

def enc_46317(o):  # encrypt_55nnt3ep9qwjkbpkcaj8
    r = ''; i = 46317
    for ch in o:
        u = ord(ch) ^ i
        i = u
        r += chr(u & 255)
    return r

def enc_621(o):  # encrypt_2eg33kdtkgouos5mfayu
    r = ''; u = 621
    for ch in o:
        f = (ord(ch) ^ u) & 255
        r += chr(f); u = f
    return r

def enc_3127_21473(o):  # encrypt_6bqrb1fro5sh7yffzg85
    r = ''; f = 3127
    for s, ch in enumerate(o):
        f = f * s % 256 + 21473
        h = ord(ch) ^ f
        r += chr(h & 255)
    return r

def enc_2_5(o):  # encrypt_0td9sl42b8rpil9w01wx
    r = ''
    for ch in o:
        f = (ord(ch) - 2) & 255
        s = ((f >> 5) + (f << 3)) & 255
        r += chr(s)
    return r

def enc_208(o):  # encrypt_ibnwwnx75wveeknf0y8v  (not self-inverse: out=(orig^208)>>4 ^ orig)
    r = ''
    for ch in o:
        c = 208 ^ ord(ch)
        r += chr(((c >> 4) ^ ord(ch)) & 255)
    return r

ALL_ENC = {
    'enc_3519': enc_3519, 'enc_NxML': enc_NxML, 'enc_dx54': enc_dx54, 'enc_bhbX': enc_bhbX,
    'enc_237': enc_237, 'enc_43521': enc_43521, 'enc_72439': enc_72439, 'enc_5547': enc_5547,
    'enc_121': enc_121, 'enc_179': enc_179, 'enc_2372': enc_2372, 'enc_56737': enc_56737,
    'enc_46317': enc_46317, 'enc_621': enc_621, 'enc_3127_21473': enc_3127_21473,
    'enc_2_5': enc_2_5, 'enc_208': enc_208,
}

def parse_ac(ac):
    ver, body = ac.split('#', 1)
    raw = dec_b64(body)
    fields = []
    pos = 0
    while pos + 3 <= len(raw):
        ty = raw[pos]; ln = raw[pos+1]*256 + raw[pos+2]
        if pos + 3 + ln > len(raw):
            fields.append((ty, ln, raw[pos+3:], True)); break
        fields.append((ty, ln, raw[pos+3:pos+3+ln], False))
        pos += 3 + ln
    return ver, raw, fields

def score(s):
    if not s: return -1
    printable = sum(1 for ch in s if 32 <= ord(ch) < 127)
    return printable / len(s)

if __name__ == '__main__':
    p = sys.argv[1] if len(sys.argv) > 1 else None
    if p:
        ac = json.load(open(p))[sys.argv[2]]['ac_full']
    else:
        ac = sys.stdin.read().strip()
    ver, raw, fields = parse_ac(ac)
    print('version=%s  raw=%d bytes  fields=%d' % (ver, len(raw), len(fields)))
    for i, (ty, ln, data, trunc) in enumerate(fields):
        s = data.decode('latin1')
        print('\n#%d type=%d len=%d%s' % (i, ty, ln, ' TRUNC' if trunc else ''))
        print('   raw :', data.hex())
        best = []
        for name, fn in ALL_ENC.items():
            try:
                d = fn(s)
            except Exception as e:
                continue
            sc = score(d)
            best.append((sc, name, d))
        best.sort(reverse=True, key=lambda x: x[0])
        for sc, name, d in best[:3]:
            show = ''.join(c if 32 <= ord(c) < 127 else '.' for c in d[:48])
            print('   %-14s sc=%.2f  hex=%-*s ascii=%s' % (name, sc, min(len(d),48)*2, d[:48].encode('latin1').hex(), show))
