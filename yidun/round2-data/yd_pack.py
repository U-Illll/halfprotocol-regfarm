#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
易盾 v3 check —— data/cb 本地打包器（协议直打用）
依赖: yd_crypto.py
"""
import os, sys, json, random, string
from urllib.parse import urlencode, quote
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from yd_crypto import (yd_aes_encrypt, b64_encode_private, b64_decode_private,
                       xors, string_to_bytes, ALPHABET, PADDING,
                       PUB_ALPHABET, PUB_PADDING)

# ---- cb 水印参数（SDK: __cbCfg = {suffix:'m25b40', code:'vfnv46', pos:[1,10,12,13,26,31]}）----
CB_SUFFIX, CB_CODE, CB_POS = 'm25b40', 'vfnv46', [1, 10, 12, 13, 26, 31]
UUID_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

def uuid_chars(n=32):
    return ''.join(random.choice(UUID_CHARSET) for _ in range(n))

def gen_cb_plain():
    """cb 明文：32 字符 [0-9A-Za-z] 随机，6 个位置写入水印 'vfnv46'"""
    arr = list(uuid_chars(32))
    for i, p in enumerate(CB_POS):
        arr[p] = CB_CODE[i]
    return ''.join(arr)

def xor_encode(token: str, data: str) -> str:
    """SDK xorEncode(token, data) = base64Encode_PUB( xors(utf8(data), utf8(token)) )"""
    return b64_encode_private(xors(string_to_bytes(data), string_to_bytes(token)),
                              PUB_ALPHABET, PUB_PADDING)

def xor_decode(token: str, s: str) -> str:
    b = b64_decode_private(s, PUB_ALPHABET, PUB_PADDING)
    return bytes(b[i] ^ (ord(token[i % len(token)]) & 0xff) for i in range(len(b))).decode('utf-8','replace')

def build_check_payload(token: str, *, trace=None, slide_pct=None,
                        fp=None, mouse_down=1, cb_plain=None) -> dict:
    """
    trace      : [('x,y,t,trusted'), ...] 或 [('x,y,t,trusted')] 原生四元组
    slide_pct  : 滑块位移百分比字符串，如 '75'
    fp         : f 字段明文（特征串），默认给最小可用值
    """
    trace = trace or []
    pts = [t if isinstance(t, str) else ','.join(str(v) for v in t) for t in trace]
    # 每个采样点单独 xorEncode(token, "x,y,t,trusted")，再用 ':' 连接
    d_plain = ':'.join(xor_encode(token, p) for p in pts)
    p_plain = xor_encode(token, slide_pct if slide_pct is not None else '0')
    f_plain = xor_encode(token, fp if fp is not None else '1,1')
    ext_plain = xor_encode(token, '%d,%d' % (mouse_down, len(pts)))  # 原始点数
    return {
        'd':   yd_aes_encrypt(d_plain),
        'm':   '',
        'p':   yd_aes_encrypt(p_plain),
        'f':   yd_aes_encrypt(f_plain),
        'ext': yd_aes_encrypt(ext_plain),
    }

def build_check_url(cfg: dict) -> str:
    """cfg 必填: referer, zone_id, dt, id, token, data(dict), cb(明文或None), width, version, load_version, callback"""
    data = cfg['data']
    cb = cfg.get('cb')
    if cb is None: cb = gen_cb_plain()
    cb_cipher = yd_aes_encrypt(cb)
    q = [
        ('referer', cfg['referer']),
        ('zoneId', cfg['zone_id']),
        ('dt', cfg['dt']),
        ('id', cfg['id']),
        ('token', cfg['token']),
        ('data', json.dumps(data, separators=(',', ':'), ensure_ascii=False)),
        ('width', cfg.get('width', 320)),
        ('type', cfg.get('type', 2)),
        ('version', cfg.get('version', '2.28.5')),
        ('cb', cb_cipher),
        ('user', cfg.get('user', '')),
        ('extraData', cfg.get('extraData', '')),
        ('bf', cfg.get('bf', 0)),
        ('runEnv', cfg.get('runEnv', 10)),
        ('sdkVersion', cfg.get('sdkVersion', '')),
        ('loadVersion', cfg.get('load_version', '2.5.4')),
        ('iv', cfg.get('iv', 4)),                 # IV_VERSION 常量 = 4
        ('callback', cfg.get('callback', '__JSONP_x_1')),
    ]
    return 'https://c.dun.163.com/api/v3/check?' + '&'.join(
        '%s=%s' % (k, quote(str(v), safe='')) for k, v in q)
