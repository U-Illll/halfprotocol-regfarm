#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ac body 二进制层结构分解: 找记录周期/字段布局"""
import json, os, base64, re, difflib
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.normpath(os.path.join(HERE, "..", "artifacts"))
S = json.load(open(os.path.join(ART, "ac-samples.json"), encoding="utf-8"))

B = {}
for k in ("drag1", "drag2"):
    ac = S[k]["ac_full"]
    pre, _, body = ac.partition("#")
    pad = body + "=" * ((4 - len(body) % 4) % 4)
    B[k] = {"pre": pre, "b64": body, "bin": base64.b64decode(pad)}

A, Z = B["drag1"]["bin"], B["drag2"]["bin"]
P = print
P("=" * 80)
P(f"二进制长度 drag1={len(A)}  drag2={len(Z)}  差={len(A)-len(Z)}")
P("=" * 80)

# --- 1. 字节级公共前缀/后缀 + 最长公共子串 ---
n = min(len(A), len(Z))
cp = 0
while cp < n and A[cp] == Z[cp]:
    cp += 1
cs = 0
while cs < n - cp and A[-1 - cs] == Z[-1 - cs]:
    cs += 1
P(f"[1] 字节级 公共前缀={cp}B  公共后缀={cs}B  不同区段 drag1[{cp}:{len(A)-cs}]={len(A)-cp-cs}B drag2={len(Z)-cp-cs}B")
P(f"    公共前缀 hex: {A[:cp].hex()}")
P(f"    分叉点 drag1: {A[cp:cp+8].hex()}  drag2: {Z[cp:cp+8].hex()}")
if cs:
    P(f"    公共后缀 hex: {A[-cs:].hex()}")

sm = difflib.SequenceMatcher(None, A, Z, autojunk=False)
sb = [b for b in sm.get_matching_blocks() if b.size > 0]
P(f"    匹配块数={len(sb)} 最大块={max(b.size for b in sb)}B  相同字节占比={sm.ratio():.3f}")
P(f"    最大 8 个匹配块:")
for b in sorted(sb, key=lambda x: -x.size)[:8]:
    P(f"      size={b.size:5d}B  drag1@{b.a:5d} drag2@{b.b:5d}  {A[b.a:b.a+min(b.size,32)].hex()}{'...' if b.size>32 else ''}")

# --- 2. 记录周期搜索: 对每个样本找 k-gram 重复的最小周期 ---
def period_profile(x, k=8, maxp=80):
    """返回各候选周期 p 下, 位置 i 与 i+p 的 k-gram 相等比例"""
    out = []
    for p in range(1, maxp + 1):
        tot = 0
        hit = 0
        for i in range(0, len(x) - k - p):
            tot += 1
            if x[i:i + k] == x[i + p:i + p + k]:
                hit += 1
        out.append((p, round(hit / tot, 4) if tot else 0))
    return sorted(out, key=lambda t: -t[1])[:8]

P()
P("[2] 周期候选 (k=8 字节 自匹配率, top8)")
for k in ("drag1", "drag2"):
    P(f"    {k}: {period_profile(B[k]['bin'])}")

# --- 3. 33 字节 = 44 base64 字符 记录段检查 ---
def slice_b64(b64, start, reclen, count):
    return [b64[start + i * reclen: start + (i + 1) * reclen] for i in range(count)]

P()
P("[3] drag1 从 b64[472] 起, 每 44 字符一条记录 (12 条):")
recs = slice_b64(B["drag1"]["b64"], 472, 44, 12)
for i, r in enumerate(recs):
    P(f"    #{i:02d} @{472+i*44:5d}: {r}")
P("    --- 记录间逐字符相同性 (相邻记录) ---")
for i in range(len(recs) - 1):
    same = "".join("=" if recs[i][j] == recs[i + 1][j] else "." for j in range(44))
    P(f"    #{i:02d}vs#{i+1:02d}: {same}")
P()
P("    --- 12 条记录逐列相同性 (列 x 是否全同) ---")
cols = ["".join(r[j] for r in recs) for j in range(44)]
P("    列内容:")
for j, c in enumerate(cols):
    const = len(set(c)) == 1
    P(f"      col{j:02d}: {c}  {'<<CONST' if const else ''}")

P()
P("[3b] drag2 从 b64[464] 起, 每 44 字符一条记录 (11 条):")
recs2 = slice_b64(B["drag2"]["b64"], 464, 44, 11)
for i, r in enumerate(recs2):
    P(f"    #{i:02d} @{464+i*44:5d}: {r}")
cols2 = ["".join(r[j] for r in recs2) for j in range(44)]
P("    列常量列: " + str([j for j in range(44) if len(set(cols2[j])) == 1]))

# --- 4. 跨样本: 相同 44 字符块的对齐比较 (找明文模板) ---
P()
P("[4] 两样本共享的 44 字符块 (明文模板证据)")
def blocks44(b64, start, cnt):
    return {b64[start + i * 44: start + (i + 1) * 44] for i in range(cnt)}
ba = blocks44(B["drag1"]["b64"], 472, 12)
bb = blocks44(B["drag2"]["b64"], 464, 11)
P(f"    drag1 独有块数={len(ba)} drag2 独有块数={len(bb)} 交集={len(ba & bb)}")
for x in list(ba & bb)[:6]:
    P(f"      交集块: {x}")

# --- 5. 是否有 ASCII 明文 (ak / udid / 坐标) ---
P()
P("[5] 二进制中的 ASCII 可打印串 (>=5)")
for k in ("drag1", "drag2"):
    hits = re.findall(rb"[\x20-\x7e]{5,}", B[k]["bin"])
    P(f"    {k}: {len(hits)} 条 -> {[h.decode() for h in hits[:12]]}")

# --- 6. 头部结构: 前 64 字节 ---
P()
P("[6] 前 48 字节明细")
for k in ("drag1", "drag2"):
    P(f"    {k}: " + " ".join(f"{b:02x}" for b in B[k]["bin"][:48]))
P("    drag1 u32le 序列: " + str([hex(int.from_bytes(A[i:i+4], 'little')) for i in range(0, 40, 4)]))
P("    drag2 u32le 序列: " + str([hex(int.from_bytes(Z[i:i+4], 'little')) for i in range(0, 40, 4)]))

# --- 7. 尾部结构 ---
P()
P("[7] 尾部 32 字节")
for k in ("drag1", "drag2"):
    P(f"    {k}: " + " ".join(f"{b:02x}" for b in B[k]["bin"][-32:]))

# --- 8. 位置: x=240 y=73 / x=96 y=56 是否以明文整数出现 ---
P()
P("[8] 坐标搜索 (little/big endian, 1/2/4 字节, value 或 value*10)")
targets = {"drag1": {"x": 240, "y": 73}, "drag2": {"x": 96, "y": 56}}
for k, tv in targets.items():
    buf = B[k]["bin"]
    for label, v in tv.items():
        for mult in (1, 10):
            vv = v * mult
            for width in (1, 2, 4):
                if vv >= 1 << (8 * width):
                    continue
                le = vv.to_bytes(width, "little")
                be = vv.to_bytes(width, "big")
                pl = [i for i in range(len(buf) - width + 1) if buf[i:i + width] == le]
                pb = [i for i in range(len(buf) - width + 1) if buf[i:i + width] == be]
                if pl or pb:
                    P(f"    {k} {label}={v} (x{mult}) w{width}: LE@{pl[:8]} BE@{pb[:8]}")

# --- 9. 变化性分析: 哪个偏移在两样本间是常量/变量 ---
P()
P("[9] 逐字节偏移: 只在公共区段内比较 (0..%d)" % cp)
if cp > 8:
    P(f"    公共前缀 {cp}B 全同 -> 头部常量区")
# 用滑动窗口法找'相同块'分布
P()
P("[10] 两样本的相同/不同区段的宏观分布 (每 64 字节块 的 相同字节占比)")
blk = 64
rows = []
for st in range(0, min(len(A), len(Z)), blk):
    seg = min(blk, min(len(A), len(Z)) - st)
    same = sum(1 for i in range(seg) if A[st + i] == Z[st + i])
    rows.append((st, same, seg, round(same / seg, 2)))
line = ""
for st, same, seg, r in rows:
    ch = "#" if r > .8 else ("+" if r > .5 else ("." if r > .2 else " "))
    line += ch
P("    offset 0 -> " + str(min(len(A), len(Z))))
P("    相似度图: " + line)
P("    (# >80% 同  + >50%  . >20%  空 <20%)")
P("    明细(前 40 块):")
for st, same, seg, r in rows[:40]:
    P(f"      @{st:5d} ({st*4//3:5d}b64) same={same:3d}/{seg} {r:.2f}")
json.dump({k: {"b64_len": len(B[k]["b64"]), "bin_len": len(B[k]["bin"]), "prefix": B[k]["pre"]} for k in B},
          open(os.path.join(HERE, "ac-bin-summary.json"), "w"), indent=1)
