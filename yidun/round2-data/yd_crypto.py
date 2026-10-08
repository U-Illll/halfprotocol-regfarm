#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
易盾 core-optimi.m25b40.v2.28.5 密码学模块复刻（纯 Python）
来源：sdk/core-optimi.m25b40.v2.28.5.min.js（字符串表已解密 = round2-static/deob-strings.js）

模块常量（string-map 索引 557-561）：
  __SBOX__            = 256 字节替代表
  __ROUND_KEY__       = '037606da0296055c'
  __SEED_KEY__        = 'fd6a43ae25f74398b61c03c83be37449'   (32 ASCII 字符，非 hex 解码)
  __BASE64_ALPHABET__ = 'MB.CfHUzEeJpsuGkgNwhqiSaI4Fd9L6jYKZAxn1/Vml0c5rbXRP+8tD3QTO2vWyo'
  __BASE64_PADDING__  = '7'
另有一套公开表 base64Encode/Decode: alphabet=['i','/','x',...], padding='3'
"""
import struct

SBOX_HEX = ("a7be3f3933fa8c5fcf86c4b6908b569ba1e26c1a6d7cfbf60ae4b00e074a194d"
            "ac4b73e7f898541159a39d08183b76eedee3ed341e6685d2357440158394b1ff"
            "03a9004cbbb5ca7dcb7f41489a16e03dcc9c71eb3c9796685b1d01b4d56193"
            "a6e1f1a2470445c191ae49c5d82765dc82c350f263387a24a502fcbf442e2dd"
            "daad0e936d9ea22b89275307b42518fbc3a626ba806d4ecd6d725f50cc8c72f"
            "efa4551ccd6fc9b2b7ab954f815c7264c6e51f4eaf99885a79892b1b60a0b3"
            "526e57ba5d178d370958847eb9fd28f9ce0bc023f4148a2adfe632126769057"
            "043d3bd8eda0df7872629f3809ef05310e83113216afe202c460fc23e789f77d1addb5e")
assert len(SBOX_HEX) == 512, len(SBOX_HEX)
SBOX = bytes(int(SBOX_HEX[i:i+2], 16) for i in range(0, 512, 2))

ROUND_KEY = '037606da0296055c'
SEED_KEY  = 'fd6a43ae25f74398b61c03c83be37449'
ALPHABET  = 'MB.CfHUzEeJpsuGkgNwhqiSaI4Fd9L6jYKZAxn1/Vml0c5rbXRP+8tD3QTO2vWyo'
PADDING   = '7'
# 公开表（base64Encode/Decode）
PUB_ALPHABET = ['i','/','x','1','X','g','U','0','z','7','k','8','N','+','l','C','p','O','n','P',
                'r','v','6','\\','q','u','2','G','j','9','H','R','c','w','T','Y','Z','4','b','f',
                'S','J','B','h','a','W','s','t','A','e','o','M','I','E','Q','5','m','D','d','V','F','L','K','y']
PUB_PADDING = '3'
assert len(PUB_ALPHABET) == 64

# ---------------- 基础工具（对应 _0x242d4e 等） ----------------
def to_byte(x):
    x &= 0xff
    return x

def string_to_bytes(s):
    return list(s.encode('utf-8'))

def bytes_to_string(b):
    return bytes(x & 0xff for x in b).decode('utf-8', 'replace')

def int_to_bytes(n):
    return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]

CRC_TABLE = None
def _crc_table():
    global CRC_TABLE
    if CRC_TABLE is None:
        t = []
        for n in range(256):
            c = n
            for _ in range(8):
                c = (0xEDB88320 ^ (c >> 1)) if (c & 1) else (c >> 1)
            t.append(c & 0xffffffff)
        CRC_TABLE = t
    return CRC_TABLE

def gen_crc32(data):
    """genCrc32: 返回 4 字节 intToBytes(0xffffffff ^ crc) 的**大写 hex 字符串**（8 字符）"""
    t = _crc_table(); c = 0xffffffff
    for b in data:
        c = (c >> 8) ^ t[(c ^ (b & 0xff)) & 0xff]
    v = (0xffffffff ^ c) & 0xffffffff
    nb = int_to_bytes(v)
    return ''.join('%02x' % x for x in nb)

def gen_crc32_bytes(data):
    """genCrc32 的返回值再经 stringToBytes() → 8 字节 ASCII"""
    return string_to_bytes(gen_crc32(data))

def pad64(arr):
    """_0x17d8ba: len>=64 → 截取前 64；否则循环重复填充到 64"""
    if len(arr) >= 64:
        return list(arr[:64])
    if len(arr) == 0:
        return [0] * 64
    return [arr[i % len(arr)] for i in range(64)]

def xors(a, b):
    """_0x54cf1d: 逐字节 XOR，b 循环"""
    if not a: return []
    return [(a[i] & 0xff) ^ (b[i % len(b)] & 0xff) for i in range(len(a))]

def shifts_add(a, b):
    """_0x474f75: 逐字节加法(shift=toByte(a+b))，b 循环"""
    if not a: return []
    return [((a[i] & 0xff) + (b[i % len(b)] & 0xff)) & 0xff for i in range(len(a))]

def sub_shifts(a, b):
    if not a: return []
    return [((a[i] & 0xff) - (b[i % len(b)] & 0xff)) & 0xff for i in range(len(a))]

# ---------------- base64（自定义表；位打包 = 标准 big-endian） ----------------
def b64_encode_private(data, alphabet=ALPHABET, padding=PADDING):
    """_0x491e42(base64EncodePrivate) + _0x4c4b3e + _0x2d84c6"""
    out = []
    A = alphabet
    for i in range(0, len(data), 3):
        chunk = data[i:i+3]
        n = len(chunk)
        if n == 1:
            b0 = chunk[0] & 0xff
            out += [A[b0 >> 2 & 0x3f], A[(b0 << 4 & 0x30)], padding, padding]
        elif n == 2:
            b0, b1 = chunk[0] & 0xff, chunk[1] & 0xff
            out += [A[b0 >> 2 & 0x3f], A[(b0 << 4 & 0x30) + (b1 >> 4 & 0xf)],
                    A[(b1 << 2 & 0x3c)], padding]
        else:
            b0, b1, b2 = chunk[0] & 0xff, chunk[1] & 0xff, chunk[2] & 0xff
            out += [A[b0 >> 2 & 0x3f], A[(b0 << 4 & 0x30) + (b1 >> 4 & 0xf)],
                    A[(b1 << 2 & 0x3c) + (b2 >> 6 & 0x3)], A[b2 & 0x3f]]
    return ''.join(out)

def b64_decode_private(s, alphabet=ALPHABET, padding=PADDING):
    """_0x527c2b + _0x343900：以 padding 首次出现位置截断，每 4 字符 → 3/2/1 字节"""
    idx = s.find(padding)
    core = s[:idx] if idx != -1 else s
    chars = list(core)
    out = bytearray()
    i = 0
    while i < len(chars):
        grp = chars[i:i+4]
        i += 4
        v = [(alphabet.index(c) if isinstance(alphabet, (list, tuple)) else alphabet.find(c)) for c in grp]
        if any(x < 0 for x in v):
            raise ValueError('char not in alphabet: %r' % [c for c, x in zip(grp, v) if x < 0])
        n = len(v)
        if n >= 2:
            out.append(((v[0] << 2) & 0xff) + ((v[1] >> 4) & 0x3))
        if n >= 3:
            out.append(((v[1] << 4) & 0xff) + ((v[2] >> 2) & 0xf))
        if n >= 4:
            out.append(((v[2] << 6) & 0xff) + (v[3] & 0x3f))
    return bytes(out)

def b64_encode_pub(data):
    return b64_encode_private(data, PUB_ALPHABET, PUB_PADDING)

def b64_decode_pub(s):
    return b64_decode_private(s, PUB_ALPHABET, PUB_PADDING)

# ---------------- 轮变换 _0x34ece2 ----------------
def round_transform(blk):
    """ROUND_KEY='037606da0296055c' → (op,arg) = (3,0x76),(6,0xda),(2,0x96),(5,0x5c)"""
    b = [x & 0xff for x in blk]
    ops = []
    for i in range(0, len(ROUND_KEY), 4):
        pair = ROUND_KEY[i:i+4]
        ops.append((int(pair[0:2], 16), int(pair[2:4], 16)))
    for op, arg in ops:
        a = arg
        if op == 0:
            pass
        elif op == 1:   # xors 固定
            b = xors(b, [to_byte(a)])
        elif op == 2:   # shifts 固定
            b = shifts_add(b, [to_byte(a)])
        elif op == 3:   # xors 递增
            b = [(b[i] ^ ((a + i) & 0xff)) & 0xff for i in range(len(b))]
        elif op == 4:   # shifts 递增
            b = [((b[i] + ((a + i) & 0xff)) & 0xff) for i in range(len(b))]
        elif op == 5:   # xors 递减
            b = [(b[i] ^ ((a - i) & 0xff)) & 0xff for i in range(len(b))]
        elif op == 6:   # shifts 递减
            b = [((b[i] + ((a - i) & 0xff)) & 0xff) for i in range(len(b))]
        else:
            raise ValueError('op %d' % op)
    return b

def round_transform_inv(blk):
    b = [x & 0xff for x in blk]
    ops = []
    for i in range(0, len(ROUND_KEY), 4):
        pair = ROUND_KEY[i:i+4]
        ops.append((int(pair[0:2], 16), int(pair[2:4], 16)))
    for op, arg in reversed(ops):
        a = arg
        if op == 0:
            pass
        elif op == 1:
            b = xors(b, [to_byte(a)])
        elif op == 2:
            b = sub_shifts(b, [to_byte(a)])
        elif op == 3:
            b = [(b[i] ^ ((a + i) & 0xff)) & 0xff for i in range(len(b))]
        elif op == 4:
            b = [((b[i] - ((a + i) & 0xff)) & 0xff) for i in range(len(b))]
        elif op == 5:
            b = [(b[i] ^ ((a - i) & 0xff)) & 0xff for i in range(len(b))]
        elif op == 6:
            b = [((b[i] - ((a - i) & 0xff)) & 0xff) for i in range(len(b))]
        else:
            raise ValueError('op %d' % op)
    return b

SBOX_INV = [0]*256
for _i, _v in enumerate(SBOX):
    SBOX_INV[_v] = _i
assert len(set(SBOX)) == 256, 'SBOX 非双射'

def sbox_inv_apply(arr, times=1):
    out = [x & 0xff for x in arr]
    for _ in range(times):
        out = [SBOX_INV[x] for x in out]
    return out

def sbox_apply(arr, times=1):
    out = [x & 0xff for x in arr]
    for _ in range(times):
        out = [SBOX[x] for x in out]
    return out

# ---------------- key 派生 _0x37afb7 ----------------
def derive_key(rand4):
    """key64 = pad64(SEED.ascii) XOR pad64(rand4)  → 64 字节"""
    seed = string_to_bytes(SEED_KEY)          # 32 字节 ASCII
    k = pad64(seed)                            # 重复 2 次 → 64
    r = pad64(list(rand4))                     # 重复 16 次 → 64
    k = xors(k, r)
    k = pad64(k)
    return k

# ---------------- 加密 _0x3ebd00(aes) ----------------
def yd_aes_encrypt(plain_str, rand4=None):
    import os as _os
    plain = string_to_bytes(plain_str)
    if rand4 is None:
        rand4 = list(_os.urandom(4))
    key64 = derive_key(rand4)
    crc8 = gen_crc32_bytes(plain)              # 8 字节 ASCII
    body = list(plain) + crc8
    padlen = (64 - len(body) % 64 - 4) if (len(body) % 64 <= 60) else (128 - len(body) % 64 - 4)
    body = body + [0] * padlen + int_to_bytes(len(plain) + 8)   # 与原实现一致：写入 len(plain+crc8)
    blocks = [body[i:i+64] for i in range(0, len(body), 64)]
    out = list(rand4)
    prev = key64
    for blk in blocks:
        t = xors(round_transform(blk), key64)
        t = shifts_add(t, prev)
        t = xors(t, prev)
        prev = sbox_apply(t, 2)
        out += prev
    return b64_encode_private(out)

def yd_aes_decrypt(cipher_str):
    """返回 (明文str, 元信息dict)；失败抛异常"""
    raw = b64_decode_private(cipher_str)
    if len(raw) < 68 or (len(raw) - 4) % 64 != 0:
        raise ValueError('len mismatch: %d' % len(raw))
    rand4 = raw[:4]
    key64 = derive_key(rand4)
    nblk = (len(raw) - 4) // 64
    prev = list(key64)
    body = bytearray()
    for i in range(nblk):
        cblk = list(raw[4 + 64 * i: 4 + 64 * (i + 1)])
        t = sbox_inv_apply(cblk, 2)      # 逆 sbox2：输出块 = sbox2(D)
        t = xors(t, prev)
        t = sub_shifts(t, prev)
        t = xors(t, key64)
        blk = round_transform_inv(t)
        body += bytes(blk)
        prev = list(cblk)      # 加密端 prev_next = 输出块本身(=sbox2(D))
    # 结构：[plain][8 字节 crc hex ASCII][padlen 个 0][4 字节 len]
    total = len(body)
    # _0x5dfb84 写入的长度字段 = len(plain)+8（明文+CRC8），不是 len(plain)
    dlen_total = (body[total-4] << 24) | (body[total-3] << 16) | (body[total-2] << 8) | body[total-1]
    dlen = dlen_total - 8
    plain = bytes(body[:dlen])
    crc8 = bytes(body[dlen:dlen_total])
    crc_ok = (crc8.decode('ascii', 'replace') == gen_crc32(plain))
    return bytes_to_string(plain), {
        'rand4': bytes(rand4).hex(), 'nblk': nblk, 'cipher_bytes': len(raw),
        'declared_len': dlen, 'crc8': crc8.decode('ascii', 'replace'),
        'crc_expected': gen_crc32(plain), 'crc_ok': crc_ok,
        'pad_tail': bytes(body[dlen_total:total-4]), 'len_field': bytes(body[total-4:total]).hex(),
    }

# ---------------- xorEncode / xorDecode（备用通道） ----------------
def yd_xor_encode(plain, key):
    return b64_encode_private(xors(string_to_bytes(plain), string_to_bytes(key)))

def yd_xor_decode(cipher, key):
    return bytes_to_string(xors(list(b64_decode_private(cipher)), string_to_bytes(key)))
