#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ac 记录层 (33 字节/记录) 相位对齐 + 字段布局分析"""
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

def phase_scan(buf, reclen=REC, minrec=5):
    res = []
    for p in range(reclen):
        nrec = (len(buf) - p) // reclen
        if nrec < minrec:
            continue
        score = 0
        for j in range(reclen):
            col = [buf[p + i * reclen + j] for i in range(nrec)]
            score += Counter(col).most_common(1)[0][1]
        res.append({"phase": p, "nrec": nrec, "score": score,
                    "score_per_byte": round(score / (reclen * nrec), 4)})
    return sorted(res, key=lambda r: -r["score_per_byte"])

P("=" * 84)
P("A. 相位扫描: 找使 '列内一致度' 最大的记录起点相位 (reclen=33)")
P("=" * 84)
for k in ("drag1", "drag2"):
    P(f"[{k}] len={len(D[k]['bin'])}B")
    for r in phase_scan(D[k]["bin"])[:6]:
        P(f"    phase={r['phase']:2d} nrec={r['nrec']:3d} score/byte={r['score_per_byte']:.4f}")
# 对照: 随机基线
import random
random.seed(1)
rb = bytes(random.randrange(256) for _ in range(1354))
P(f"    [随机基线] {phase_scan(rb)[0]}")

def col_profile(buf, phase, reclen=REC, nrec=None):
    nrec = nrec or (len(buf) - phase) // reclen
    prof = []
    for j in range(reclen):
        col = [buf[phase + i * reclen + j] for i in range(nrec)]
        c = Counter(col)
        top, cnt = c.most_common(1)[0]
        prof.append({"off": j, "top": top, "cnt": cnt, "nrec": nrec,
                     "distinct": len(c), "vals": col})
    return prof, nrec

P()
P("=" * 84)
P("B. 最佳相位下的逐列画像 (记录内 33 字节)")
P("=" * 84)
BEST = {}
for k in ("drag1", "drag2"):
    r = phase_scan(D[k]["bin"])[0]
    BEST[k] = r["phase"]
    prof, nrec = col_profile(D[k]["bin"], r["phase"])
    P(f"[{k}] phase={r['phase']} nrec={nrec}")
    for c in prof:
        mark = "CONST" if c["distinct"] == 1 else ("~" if c["cnt"] / c["nrec"] > .7 else " ")
        vals = " ".join(f"{v:02x}" for v in c["vals"][:12])
        P(f"    +{c['off']:02d}: top={c['top']:02x} x{c['cnt']:2d}/{c['nrec']} distinct={c['distinct']:2d} {mark:5s} | {vals}")

P()
P("=" * 84)
P("C. 记录段在 base64 层的位置(已知 XX 间隔44 的段) vs 字节相位")
P("=" * 84)
for k in ("drag1", "drag2"):
    b = D[k]["b64"]
    idx = [m for m in range(len(b) - 1) if b[m:m + 2] == "XX"]
    runs = []
    start = None
    prev = None
    for i in idx:
        if prev is not None and i - prev == 44:
            if start is None:
                start = prev
        else:
            if start is not None:
                runs.append((start, prev))
            start = None
        prev = i
    if start is not None:
        runs.append((start, prev))
    P(f"[{k}] XX@ 全位置={idx[:14]}... 等差段={runs}")
    for (s, e) in runs:
        P(f"      -> b64[{s}..{e}] 共 {(e-s)//44+1} 条记录, 对应字节 offset {s//4*3} .. {e//4*3}")

P()
P("=" * 84)
P("D. 两样本 33B 记录段对齐比较 (找字段)")
P("=" * 84)
def recs(buf, phase, n):
    return [buf[phase + i * REC: phase + (i + 1) * REC] for i in range(n)]
# 从 XX 段反推记录起点: 取 XX 段起始的字节位置, 再按相位取整
for k, (bs64, cnt) in {"drag1": (472, 12), "drag2": (464, 11)}.items():
    boff = bs64 // 4 * 3
    P(f"[{k}] XX段 b64@{bs64} -> 字节 {boff}, phase={BEST[k]}, 相对相位差={(boff - BEST[k]) % REC}")
    n = cnt
    # 记录起点
    s = boff - ((boff - BEST[k]) % REC)
    rr = recs(D[k]["bin"], s, n)
    P(f"      记录起点={s} 条数={n}")
    cols = []
    for j in range(REC):
        col = [r[j] for r in rr]
        cols.append(col)
        P(f"        +{j:02d}: " + " ".join(f"{v:02x}" for v in col) +
          ("  <<CONST" if len(set(col)) == 1 else ""))
    P(f"      常量列: {[j for j in range(REC) if len(set(cols[j]))==1]}")
