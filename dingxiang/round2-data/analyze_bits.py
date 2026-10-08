#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""判定 ac 是'强加密'还是'结构化编码': 位级/字符级偏斜 + 位置熵"""
import json, os, base64, math
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.normpath(os.path.join(HERE, "..", "artifacts"))
S = json.load(open(os.path.join(ART, "ac-samples.json"), encoding="utf-8"))
P = print
D = {}
for k in ("drag1", "drag2"):
    ac = S[k]["ac_full"]
    _, _, body = ac.partition("#")
    pad = body + "=" * ((4 - len(body) % 4) % 4)
    D[k] = {"b64": body, "bin": base64.b64decode(pad)}
A, Z = D["drag1"]["bin"], D["drag2"]["bin"]

def bitstat(buf):
    tot = len(buf) * 8
    ones = sum(bin(b).count("1") for b in buf)
    # 每 bit 位置 (MSB-first within byte)
    per = []
    for bit in range(8):
        o = sum((b >> (7 - bit)) & 1 for b in buf)
        per.append(round(o / len(buf), 4))
    return round(ones / tot, 4), per

def chisq_bit(buf):
    n = len(buf) * 8
    o = sum(bin(b).count("1") for b in buf)
    e = n / 2
    return round(((o - e) ** 2) / e + (((n - o) - e) ** 2) / e, 2)

P("=" * 84)
P("A. 位级统计 (随机/加密数据的判据: ones≈0.5, 各 bit 位≈0.5)")
P("=" * 84)
for k in ("drag1", "drag2"):
    b = D[k]["bin"]
    r, per = bitstat(b)
    P(f"    [{k}] ones_ratio={r}  chi2(1doF)={chisq_bit(b)}  (|z|>3 显著偏斜) "
      f"z={round((r-0.5)/ (0.5/math.sqrt(len(b)*8)),2)}")
    P(f"         每 bit 位 ones 比例(MSB->LSB): {per}")
# 对照: 真随机
import random
random.seed(7)
rb = bytes(random.randrange(256) for _ in range(len(A)))
r, per = bitstat(rb)
P(f"    [随机对照] ones_ratio={r} chi2={chisq_bit(rb)} 每bit={per}")

P()
P("=" * 84)
P("B. 字符级分布 (base64 文本, 64 符号均匀 => entropy 6.0)")
P("=" * 84)
for k in ("drag1", "drag2"):
    b = D[k]["b64"]
    c = Counter(b)
    n = len(b)
    ent = -sum((v / n) * math.log2(v / n) for v in c.values())
    chi = sum((v - n / 64) ** 2 / (n / 64) for v in c.values())
    P(f"    [{k}] entropy={ent:.4f} (max 6.0)  chi2={chi:.1f} (df=63, 临界 82@0.05)  "
      f"min_sym={min(c.values())} max_sym={max(c.values())} present={len(c)}")
    P(f"          {' '.join(f'{ch}:{v}' for ch, v in c.most_common(8))}")

P()
P("=" * 84)
P("C. 33B 记录段: 每条记录内部 12 条的一致性 (位置条件熵)")
P("=" * 84)
for k, st in (("drag1", 327), ("drag2", 321)):
    buf = D[k]["bin"]
    rr = [buf[st + i * 33: st + (i + 1) * 33] for i in range(12)]
    H = 0.0
    const_cols = 0
    for j in range(33):
        col = [r[j] for r in rr]
        c = Counter(col)
        e = -sum((v / 12) * math.log2(v / 12) for v in c.values())
        H += e
        if len(c) == 1:
            const_cols += 1
    P(f"    [{k}] 记录段列平均条件熵 = {H/33:.3f} bit/byte  常量列={const_cols}/33")
    H2 = 0.0
    for j in range(33):
        col = [r[j] for r in rr]
        H2 += len(set(col)) / 12
    P(f"         平均列 distinct 率 = {H2/33:.3f}")

P()
P("=" * 84)
P("D. 头部 106B 常量区的性质 (跨样本全同 => 非随机)")
P("=" * 84)
P(f"    跨样本相同字节占比(前 1365B 内): {sum(1 for i in range(min(len(A),len(Z))) if A[i]==Z[i])}/{min(len(A),len(Z))}"
  f" = {sum(1 for i in range(min(len(A),len(Z))) if A[i]==Z[i])/min(len(A),len(Z)):.4f}")
hA, hZ = A[12:106], Z[12:106]
P(f"    头 12..106 (94B) 两样本相同: {hA == hZ}")
c = Counter(hA)
P(f"    该 94B 的 distinct 字节数 = {len(c)}/94  众数 {c.most_common(3)}")
cA = Counter(A)
P(f"    整段 drag1 distinct 字节 = {len(cA)}/256  entropy={-sum((v/len(A))*math.log2(v/len(A)) for v in cA.values()):.3f} bit/byte (max 8)")
cZ = Counter(Z)
P(f"    整段 drag2 distinct 字节 = {len(cZ)}/256  entropy={-sum((v/len(Z))*math.log2(v/len(Z)) for v in cZ.values()):.3f} bit/byte")

P()
P("=" * 84)
P("E. 结论性判据")
P("=" * 84)
P("    1) 若 ac 为 AES/流密码强加密: 密文位分布应≈均匀(ones 0.50), 字符 entropy≈6.0,")
P("       且跨样本不应出现 94B 以上的逐字节完全一致区段(除非明文相同且 keystream 可复用)。")
P("    2) 实测: 头 94B 跨样本逐字节全同 + 记录段大量列值集重叠 => 强烈指向'编码/轻混淆'而非'强加密'。")
