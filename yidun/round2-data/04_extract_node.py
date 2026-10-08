# -*- coding: utf-8 -*-
"""从 deob-strings.js 抽取易盾 crypto 相关函数，生成可独立运行的 Node 模块"""
import os, json, re
BASE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(BASE)
s = open(os.path.join(ROOT, 'round2-static/deob-strings.js'), encoding='utf8').read()

def extract_func(name):
    key = 'function %s(' % name
    i = s.find(key)
    if i == -1: return None
    j = s.find('{', i)
    depth = 0; k = j
    while k < len(s):
        c = s[k]
        if c == '{': depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0: return s[i:k+1]
        elif c in '"\'':
            q = c; k += 1
            while k < len(s) and s[k] != q:
                if s[k] == '\\': k += 1
                k += 1
        k += 1
    return None

NAMES = ['_0x3ab4e1','_0x6470c6','_0x474f75','_0x9e274a','_0x54cf1d','_0x1128f7','_0x18c57a',
         '_0x312bea','_0x8d3c78','_0x50d2f1','_0x1ca2ea','_0x1afea9','_0x242d4e','_0x85b935',
         '_0x3da674','_0x18e809','_0xeebe90',
         '_0x2d84c6','_0x4c4b3e','_0x343900','_0x527c2b','_0x16ff0d','_0x337fe6','_0x491e42',
         '_0x121dbc','_0x17d8ba','_0x5dfb84','_0x541d79','_0x1556d2','_0x3c6402','_0x5dd6b9',
         '_0x1d8917','_0x5995f1','_0x446610','_0x20f9c7','_0x23c1c7','_0x509c46','_0x34ece2',
         '_0x37afb7','_0x3855dc','_0x235465','_0x3ebd00']

parts, missing = [], []
for n in NAMES:
    f = extract_func(n)
    if f is None: missing.append(n)
    else: parts.append(f)
print('extracted %d/%d  missing=%s' % (len(parts), len(NAMES), missing))

c = json.load(open(os.path.join(BASE, 'consts.json'), encoding='utf-8'))
seed = bytes.fromhex(c['SEED_KEY']) if False else c['SEED_KEY']

prelude = """
'use strict';
const window = { encodeURIComponent, decodeURIComponent, parseInt, parseInt_ };
"""
prelude = """
'use strict';
const window = {
  encodeURIComponent: encodeURIComponent,
  decodeURIComponent: decodeURIComponent,
  parseInt: parseInt,
};
function _0x1f8f1d(){ return { safeGlobal: window }; }
const __SBOX_HEX__ = %s;
const __ROUND_KEY__ = %s;
const __SEED_KEY__ = %s;
const __BASE64_ALPHABET__ = %s;
const __BASE64_PADDING__ = %s;
""" % (json.dumps(c['SBOX']), json.dumps(c['ROUND_KEY']), json.dumps(c['SEED_KEY']),
       json.dumps(c['BASE64_ALPHABET']), json.dumps(c['BASE64_PADDING']))

vars_ = {
 '_0x1f8f1d':'', '_0x5bf327':"const _0x5bf327 = __SBOX_HEX__;",
 '_0x38f130':"const _0x38f130 = __SEED_KEY__;", '_0x2c3029':"const _0x2c3029 = __ROUND_KEY__;",
 '_0x3c38ba':"const _0x3c38ba = __BASE64_ALPHABET__;", '_0x453667':"const _0x453667 = __BASE64_PADDING__;",
}
tail = """
const _0x5bf327 = __SBOX_HEX__;
const _0x38f130 = __SEED_KEY__;
const _0x2c3029 = __ROUND_KEY__;
const _0x3c38ba = __BASE64_ALPHABET__;
const _0x453667 = __BASE64_PADDING__;
var _0x4a6f80 = {}; var _0x4924e4 = {}; var _0x8eb501 = {};
%s
// ---- 模块内别名（还原自 bundle 的 var 赋值） ----
var _0x4cd5f2=_0x242d4e,_0x1f706f=_0x1afea9,_0x4a7013=_0x1ca2ea,_0x341b83=_0x18c57a,
    _0x181811=_0x1128f7,_0x456279=_0x85b935,_0x1878d5=_0x6470c6,_0x31eca0=_0x474f75,
    _0x10cc41=_0x8d3c78,_0x368271=_0x312bea,_0x31c064=_0x3ab4e1,_0x35db7c=_0x9e274a,
    _0x5b1ad2=_0x54cf1d,_0x179ba8=_0x337fe6,_0x22898c=_0x16ff0d,_0x2a136f=_0x491e42,
    _0xf0a154=_0x3ab4e1;
var _0x54d28b = function(arr, n){ return n===undefined ? Array.from(arr) : arr.slice(0,n); };
_0x4a6f80.copyToBytes=_0x242d4e;_0x4a6f80.genCrc32=_0x1afea9;_0x4a6f80.hexToByte=_0x1ca2ea;
_0x4a6f80.hexsToBytes=_0x18c57a;_0x4a6f80.intToBytes=_0x1128f7;_0x4a6f80.paddingArrayZero=_0x85b935;
_0x4a6f80.shift=_0x6470c6;_0x4a6f80.shifts=_0x474f75;_0x4a6f80.stringToBytes=_0x312bea;
_0x4a6f80.toByte=_0x3ab4e1;_0x4a6f80.xor=_0x9e274a;_0x4a6f80.xors=_0x54cf1d;
_0x4a6f80.bytesToString=_0x8d3c78;
_0x4924e4.base64EncodePrivate=_0x491e42;_0x4924e4.base64Encode=_0x16ff0d;_0x4924e4.base64Decode=_0x337fe6;
_0x8eb501.aes=_0x3ebd00;_0x8eb501.xorEncode=_0x3855dc;_0x8eb501.xorDecode=_0x235465;
module.exports = { a0_0x1e60_utils:_0x4a6f80, b64:_0x4924e4, crypto:_0x8eb501,
  raw:{ aes:_0x3ebd00, b64encPriv:_0x491e42, b64dec:_0x337fe6, b64encPub:_0x16ff0d,
        deriveKeyPartial:_0x37afb7, roundTransform:_0x34ece2, sbox2:_0x1556d2,
        pad64:_0x17d8ba, padBlock:_0x5dfb84, splitBlocks:_0x541d79, rand4:_0x3c6402,
        xorEncode:_0x3855dc, xorDecode:_0x235465, ALPHA:__BASE64_ALPHABET__, PAD:__BASE64_PADDING__,
        privDecode:_0x527c2b, pubDecode:_0x337fe6, pubEncode:_0x16ff0d, toByte:_0x3ab4e1,
        xor_:_0x9e274a, xors_:_0x54cf1d, shift_:_0x6470c6, shifts_:_0x474f75,
        h2b:_0x1ca2ea, h2bs:_0x18c57a, crc:_0x1afea9, utf2b:_0x312bea, b2utf:_0x8d3c78,
        SBOXHEX:__SBOX_HEX__, ROUNDKEY:__ROUND_KEY__, SEEDKEY:__SEED_KEY__ } };
""" % ('\n'.join(parts))

open(os.path.join(BASE, 'yd_crypto_extracted.js'), 'w', encoding='utf-8').write(prelude + tail)
print('[saved] yd_crypto_extracted.js')
