#!/usr/bin/env python3
"""ac 构造器（顶象 cap.dingxiang-inc.com /api/v1）
用法示例：
    from ac_build import build_ac, enc_dx54, enc_2372, enc_208
    fields = [(5, enc_208(bs2(46)+href+bs2(n)+ref)), (15, enc_2372(bs2(32)+sid)), (13, enc_dx54(pt8))]
    ac = build_ac(fields, version=5948)
结构：ac = version + "#" + customB64( concat([type u8][len u16BE][payload]) )
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ac_parse import B64_ALPH, enc_b64, ALL_ENC

def bs2(n): return bytes([(n >> 8) & 0xFF, n & 0xFF])
def bs4(n): return bytes([(n >> 24) & 0xFF, (n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF])
def bss(s):
    if isinstance(s, str): s = s.encode('latin1')
    return s

def field(ty, payload):
    if isinstance(payload, str): payload = payload.encode('latin1')
    return bytes([ty]) + bs2(len(payload)) + payload

def build_ac(fields, version=5948):
    """fields: iterable of (type:int, encrypted_payload:bytes)  —— 顺序敏感，应与采集顺序一致"""
    stream = b''.join(field(ty, pl) for ty, pl in fields)
    return "%d#%s" % (version, enc_b64(stream))

# 常用字段明文构造（对齐 greenseer 语义）
def plain_location(href, referrer):
    return bs2(len(href)) + bss(href) + bs2(len(referrer)) + bss(referrer)

def plain_token(token):
    return bs2(len(token)) + bss(token)

def plain_sa_point(dt_ms, page_x, page_y):
    return bs4(dt_ms) + bs2(page_x) + bs2(page_y)      # recordSA 原始格式（8 字节）

if __name__ == '__main__':
    # 自检：解析-重建往返（用 artifacts 里的样本）
    import json, sys
    from ac_parse import parse_ac
    import os
    p = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../artifacts/ac-samples.json')
    d = json.load(open(p))
    for k in d:
        ac = d[k]['ac_full']
        ver, raw, fl = parse_ac(ac)
        rebuilt = build_ac([(ty, dd) for ty, ln, dd, tr in fl], version=int(ver))
        print(k, 'roundtrip', rebuilt == ac)
