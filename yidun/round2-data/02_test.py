# -*- coding: utf-8 -*-
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from yd_crypto import *

print('SBOX len', len(SBOX), 'unique', len(set(SBOX)))
print('B alphabet len', len(ALPHABET), 'unique', len(set(ALPHABET)))

# 1) 往返自测
msg = json.dumps({"x":123,"y":"中文测试\u00e9","arr":[1,2,3]}, ensure_ascii=False)
for trial in range(3):
    c = yd_aes_encrypt(msg)
    p, meta = yd_aes_decrypt(c)
    print('trial%d cipher_len=%d  roundtrip=%s crc_ok=%s' % (trial, len(c), p == msg, meta['crc_ok']))
    if p != msg: print('  got:', repr(p))

# 2) 长度规律验证
print()
print('--- 长度模型: out = 4 + 64k 字节 → 自定义base64 ---')
def b64len(n):
    return 4 * ((n + 2) // 3)
for k in [1, 7, 9, 10]:
    n = 4 + 64 * k
    print(' k=%-3d bytes=%-4d b64len=%-4d pad=%d' % (k, n, b64len(n), (3 - n % 3) % 3))
