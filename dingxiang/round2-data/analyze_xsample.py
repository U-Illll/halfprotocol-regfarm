#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""跨样本 33B 记录对齐: 验证'固定明文模板 + 变量字段'假设"""
import json, os, base64
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.normpath(os.path.join(HERE, "..", "artifacts"))
S = json.load(open(os.path.join(ART, "ac-samples.json"), encoding="utf-8"))

D = {}
for k in ("drag1", "drag2"):
    ac = S[k]["ac_full"]
    _, _, body = ac.partition("#")
    pad = body + "=" * ((4 - len(body) % 4) % 4)
    D[k] = {"b64": body, "bin": base64.b64decode(pad)}
P = print
REC = 33

# 记录段起点: 由常量 5d70b9 (=b64 'XXC5') 的位置反推 +27 偏移
STARTS = {"drag1": 354 - 27, "drag2": 348 - 27}
CNT = {"drag1": 12, "drag2": 12}

P("=" * 88)
P("A. 记录段 (33B/条) 跨样本逐列比较  —  baseline: 5d70b9 在 +27")
P("=" * 88)
cols = {}
for k in ("drag1", "drag2"):
    s = STARTS[k]
    rr = [D[k]["bin"][s + i * REC: s + (i + 1) * REC] for i in range(CNT[k])]
    cols[k] = [[r[j] for r in rr] for j in range(REC)]

P(f"{'off':>4} | {'drag1 (12条)':<36} | {'drag2 (12条)':<36} | 判定")
for j in range(REC):
    a, b = cols["drag1"][j], cols["drag2"][j]
    sa, sb = set(a), set(b)
    tag = ""
    if len(sa) == 1 and len(sb) == 1 and sa == sb:
        tag = "**CROSS-CONST**"
    elif len(sa) == 1:
        tag = "d1-const"
    elif len(sb) == 1:
        tag = "d2-const"
    elif sa & sb:
        tag = "overlap"
    fa = " ".join(f"{v:02x}" for v in a[:9])
    fb = " ".join(f"{v:02x}" for v in b[:9])
    P(f"  +{j:02d} | {fa:<36} | {fb:<36} | {tag}")

P()
P("=" * 88)
P("B. 跨样本相同值列 (offset -> value)")
P("=" * 88)
same_cols = []
for j in range(REC):
    sa, sb = set(cols["drag1"][j]), set(cols["drag2"][j])
    inter = sa & sb
    if len(sa) == 1 and len(sb) == 1 and sa == sb:
        same_cols.append((j, list(sa)[0]))
P(f"    完全跨样本常量列: {[(j, f'{v:02x}') for j, v in same_cols]}")
P(f"    数量={len(same_cols)}/33")
# 记录级: 两样本中每个 offset 的字节值集合交集
inter_cols = [j for j in range(REC) if set(cols['drag1'][j]) & set(cols['drag2'][j])]
P(f"    有值交集的列({len(inter_cols)}): {inter_cols}")

P()
P("=" * 88)
P("C. nibble 层分析 (每字节拆高/低 4bit)")
P("=" * 88)
P("    对 drag1 记录段, 每列的高低 nibble 分布:")
for j in range(REC):
    a = cols["drag1"][j]
    hi = Counter(v >> 4 for v in a)
    lo = Counter(v & 15 for v in a)
    hi_s = "".join(f"{h:x}" for h in [v >> 4 for v in a])
    lo_s = "".join(f"{l:x}" for l in [v & 15 for v in a])
    f1 = "CONST" if len(hi) == 1 else ("~" if hi.most_common(1)[0][1] >= 9 else " ")
    f2 = "CONST" if len(lo) == 1 else ("~" if lo.most_common(1)[0][1] >= 9 else " ")
    P(f"      +{j:02d} hi[{f1:5s}]={hi_s}  lo[{f2:5s}]={lo_s}")

P()
P("=" * 88)
P("D. 头部结构 (前 128 字节) 逐字节跨样本比较")
P("=" * 88)
A, Z = D["drag1"]["bin"], D["drag2"]["bin"]
P(f"{'off':>4} {'drag1':>4} {'drag2':>4}  diff")
for i in range(0, 128):
    if i >= len(A) or i >= len(Z):
        break
    mark = "  " if A[i] == Z[i] else "<>"
    if i % 8 == 0:
        P("")
    P(f"  {i:3d} {A[i]:02x}  {Z[i]:02x} {mark}", end="")
P()
P()
P("    前 128B 中不同的字节偏移: " + str([i for i in range(128) if A[i] != Z[i]]))

P()
P("=" * 88)
P("E. 记录数 vs b64 长度")
P("=" * 88)
for k in ("drag1", "drag2"):
    P(f"    {k}: b64_len={len(D[k]['b64'])} bin_len={len(D[k]['bin'])} "
      f"记录段起点={STARTS[k]} 记录段={CNT[k]}x33={CNT[k]*33}B "
      f"尾部剩余={len(D[k]['bin'])-(STARTS[k]+CNT[k]*REC)}B")
json.dump({k: {"bin_len": len(D[k]["bin"]), "start": STARTS[k], "nrec": CNT[k]} for k in D},
          open(os.path.join(HERE, "records.json"), "w"), indent=1)
