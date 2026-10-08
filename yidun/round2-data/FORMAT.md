# 易盾 v3 check 密文格式规范（逆向自 core-optimi.m25b40.v2.28.5.min.js）

> 目标版本：`cstaticdun.126.net/2.28.5/core-optimi.m25b40.v2.28.5.min.js?v=2985423`
> 所有结论均已用官方 SDK 的真实密文双向验证（见 `REPORT.md` 证据链）。

---

## 0. 三层结构总览

```
明文 UTF-8 字符串
   │
   │ (可选) xorEncode(token, ·) = base64_PUB( XOR(utf8(明文), utf8(token)) )
   ▼
yd_aes()  ← 自研 64 字节分组"白盒 AES"，含 CRC32 校验、随机 IV 前缀、CBC 链
   │
   │ base64_PRIV()
   ▼
URL 参数值（例：data.d / data.p / data.f / data.ext / cb）
```

外层不是加密而是**编码**，所以密文串字符分布接近均匀（H≈5.4~5.97 / 理论 6.0），
而**自定义 base64 解码后的原始字节是高熵的**（H≈5.70~7.66 / 理论 8.0）——这是判定"外层=编码、内层=加密"的关键证据。

---

## 1. 三套字符集（模块 `0x1b` / string-map idx 557–561）

| 名称 | 值 |
|---|---|
| `__BASE64_ALPHABET__`（私有表，用于密文） | `MB.CfHUzEeJpsuGkgNwhqiSaI4Fd9L6jYKZAxn1/Vml0c5rbXRP+8tD3QTO2vWyo` |
| `__BASE64_PADDING__` | `7` |
| `__SBOX__`（256 字节字节替代表） | `a7be3f39…d1addb5e`（512 hex） |
| `__ROUND_KEY__` | `037606da0296055c` |
| `__SEED_KEY__` | `fd6a43ae25f74398b61c03c83be37449`（**按 32 个 ASCII 字节使用，不是 hex 解码**） |
| 公开表（`base64Encode`/`base64Decode`，用于 `xorEncode`） | `i/x1XgU0z7k8N+lCpOnPrv6\qu2Gj9HRcwTYZ4bfSJBhaWstAeoMIEQ5mDdVFLKy` |
| 公开表 padding | `3` |

要点：
* **`7` 不在 64 字符私有表内**，它是 padding 字符 → 解释"所有密文尾字符固定 `7`"。
* 公开表含反斜杠 `\`，padding 是 `3` → 解释内层 `xorEncode` 串里出现的 `3`/`\`。

---

## 2. base64 变体（`_0x2d84c6` / `_0x4c4b3e` / `_0x343900` / `_0x527c2b`）

位打包与**标准 base64 完全一致**（big-endian，每组 3 字节 → 4 字符），只改了两点：

* 字母表替换：`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/`
  → `MB.CfHUzEeJpsuGkgNwhqiSaI4Fd9L6jYKZAxn1/Vml0c5rbXRP+8tD3QTO2vWyo`
* padding 字符 `=` → `7`

```
encode(bytes) → 字符数 = 4*ceil(len/3)，尾部 padding 数 = (3 - len%3) % 3
decode(s)     → 从首个 padding 字符处截断，再每 4 字符还原 3/2/1 字节
```

---

## 3. `yd_aes`（`_0x3ebd00`，导出名 `aes`）

### 3.1 加密

```
P      = utf8(plain)
CRC8   = utf8( genCrc32(P) )          # genCrc32 返回 8 个 hex 字符的**字符串**，故占 8 字节
M      = P ‖ CRC8
padLen = (M%64 <= 60) ? 64 - M%64 - 4 : 128 - M%64 - 4
BODY   = M ‖ 0*padLen ‖ int32BE(len(M))        # 长度恒为 64 的倍数
rand4  = 4 个随机字节
KEY    = pad64(ascii(SEED_KEY)) XOR pad64(rand4)   # pad64：len>=64 截断，否则循环复制到 64
OUT    = rand4
prev   = KEY
对 BODY 每 64 字节块 blk：
    t       = xors(roundTransform(blk), KEY)
    t       = shifts(t, prev)          # 逐字节 加法 mod 256
    t       = xors(t, prev)
    out_blk = sbox(sbox(t))            # 两次字节替换
    OUT    ‖= out_blk
    prev    = out_blk
return base64_PRIV(OUT)
```

### 3.2 roundTransform（`_0x34ece2`，由 `ROUND_KEY` 驱动）

`ROUND_KEY='037606da0296055c'` 按 4 个 hex 字符分组 → `(op, arg)`：

| 组 | op | 含义 |
|---|---|---|
| `03 76` | 3 | `xors` 递增：`b[i] ^= (0x76 + i) & 0xff` |
| `06 da` | 6 | `shifts` 递减：`b[i] += (0xda - i) & 0xff` |
| `02 96` | 2 | `shifts` 固定：`b[i] += 0x96` |
| `05 5c` | 5 | `xors` 递减：`b[i] ^= (0x5c - i) & 0xff` |

op 表：`0=identity, 1=xors固定, 2=shifts固定, 3=xors递增, 4=shifts递增, 5=xors递减, 6=shifts递减`；
`shifts` 是加法、`xors` 是异或，全部在 8 bit 内。

### 3.3 解密（本文档新增，SDK 未导出）

```
raw   = base64_PRIV_decode(cipher)      # 长度必须为 4 + 64k
rand4 = raw[:4]
KEY   = pad64(ascii(SEED_KEY)) XOR pad64(rand4)
prev  = KEY
for i in 0..k-1:
    cblk = raw[4+64i : 4+64i+64]
    t    = sbox_inv(sbox_inv(cblk))     # ★ 关键：密文块 = sbox²(t)
    t    = xors(t, prev)
    t    = shifts_sub(t, prev)
    t    = xors(t, KEY)
    blk  = roundTransform_inv(t)        # 逆序 + 逆运算
    BODY ‖= blk
    prev  = cblk                        # ★ prev 链 = 上一个密文块本身
dlen = int32BE(BODY[-4:])               # = len(plain)+8
plain = utf8(BODY[:dlen-8]) ; crc8 = ascii(BODY[dlen-8:dlen])
assert crc8 == genCrc32(plain)
```

### 3.4 长度公式（可直接用于预判密文长度）

| 量 | 公式 |
|---|---|
| 块数 k | `k = (len(P)+8+padLen+4) / 64` |
| 密文原始字节 | `n = 4 + 64k` |
| 密文字符数 | `4*ceil(n/3)` |
| 尾部 `7` 个数 | `(3 - n%3) % 3` ⇒ `k%3==0→2 个；k%3==1→1 个；k%3==2→0 个` |

> **"尾字符恒为 7"不是绝对规律**：当 `k ≡ 2 (mod 3)` 时密文无 padding，尾字符是随机的。
> 实测构造 k=2 的样本，末字符出现 `1/E/I/M/R/W/r/z`，**从不为 `7`** —— 强力证实 `7`=padding。

---

## 4. 字段语义（滑块 jigsaw，`onVerifyCaptcha` 组装）

```js
data = {
  d  : aes( sampledTraceData.map(p => xorEncode(token, p)).join(':') ),
  m  : '',                                                    // 滑块恒为空
  p  : aes( xorEncode(token, (parseInt(jigsaw.left)/width*100) + '') ),
  f  : aes( xorEncode(token, unique2DArray(atomTraceData,2).join(',')) ),
  ext: aes( xorEncode(token, mouseDownCounts + ',' + traceData.length) ),
}
cb = aes( 32 位随机 [0-9A-Za-z]，6 个位置写入水印 'vfnv46' )   // 见 §5
```

单个采样点 `p` 的原文格式：**`x,y,t,isTrusted`**

| 分量 | SDK 表达式 |
|---|---|
| x | `Math.round(dragX < 0 ? 0 : dragX)`（相对拖动起点、CSS 像素） |
| y | `Math.round(clientY - startY)` |
| t | `now() - beginTime`（ms，单调递增） |
| isTrusted | `null→0` / `true→1` / `false→2` |

`d` 的采样：`sample(traceData, SAMPLE_NUM)`（实测样本未触发抽稀，点数 == ext 里的长度）。

`f` 明文形态（实测）：
`35,3,-0.2222,0.5827, 36,-0.007,0.4167,0.2358,0.0864, 23,0.2153,…, 16,-0.04,…`
= 以整数（时间差）分段的特征序列，段内含若干 4 位小数（速度/加速度类归一化量）。

---

## 5. `cb` 参数（`_0x62692`）

```js
cfg = { suffix:'m25b40', code:'vfnv46', pos:[1,10,12,13,26,31] }
u = uuid(32)                       // 字符集 '0-9A-Za-z'
for i,ch in code: u[pos[i]] = ch   // 在 6 个固定位置写入 SDK 指纹水印
return u                           // 32 字符明文
```
随后该 32 字符串在被发送前**同样过一次 `yd_aes`**（实测：URL 中的 `cb` 是 92 字符密文，解密即得上式 32 字符串，两个真实样本的水印位均命中 `vfnv46`）。

同一 SDK 还导出 `_0xab267f`，形如 `hash('::'拼接) + "_v_i_1"`（另一路指纹，未在 check 中出现）。

---

## 6. URL 参数表（`GET https://c.dun.163.com/api/v3/check`）

| 参数 | 取值 | 备注 |
|---|---|---|
| `referer` | 页面 URL（urlencoded） | |
| `zoneId` | `CN31` | |
| `dt` | deviceToken | 来自 `/get` 之后本地生成/缓存 |
| `id` | captchaId | |
| `token` | 会话 token | 同时是 `xorEncode` 的密钥 |
| `data` | `JSON.stringify({d,m,p,f,ext})` | **JSON 本身不额外加密**，只是 URL 编码 |
| `width` | 320 | |
| `type` | 2 | 滑块 |
| `version` | `2.28.5` | SDK 版本 |
| `cb` | `yd_aes(32字符)` | 见 §5 |
| `user` / `extraData` | 空串 | |
| `bf` | `0` | |
| `runEnv` | `10` | |
| `sdkVersion` / `loadVersion` | 空 / `2.5.4` | |
| `iv` | **`4`（常量 `IV_VERSION = 0x4`）** | 硬编码，非随机、非加密相关 |
| `callback` | `__JSONP_xxx_n` | JSONP |

---

## 7. 快速自检公式

给定密文串 `s`（URL 解码后）：
1. `set(s) ⊆ (64 字母表 ∪ {'7'})` 必须成立；
2. `len(s) % 4 == 0`；
3. 尾部 `7` 的个数 `t7 = (3 - (len(s)-t7)%3) % 3`（不动点解，实际用 base64 解码后字节数 `n` 反推即可）；
4. `n = 4 + 64k`，`k` 为整数。
不满足以上任意一条 → 不是本 SDK 的 `yd_aes` 密文。
