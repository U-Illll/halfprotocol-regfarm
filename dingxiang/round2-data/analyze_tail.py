#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ac 尾部结构 + 已知值嵌入检查"""
import json, os, base64, re
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
    D[k] = {"b64": body, "bin": base64.b64decode(pad), "p": S[k]["params"], "resp": S[k]["resp"]}
A, Z = D["drag1"]["bin"], D["drag2"]["bin"]

P("=" * 86)
P("A. 已知值嵌入检查 (udid / sid / ak / aid-ts / 坐标)")
P("=" * 86)
known = {
    "udid": "6ac45e92ZNi9AwoH4hzRvN7PogivypXxvRczR8d1",
    "ak": "99de95ad1f23597c23b3558d932ded3c",
    "jsv": "5.1.53",
}
for k in ("drag1", "drag2"):
    p = D[k]["p"]; buf = D[k]["bin"]
    tests = dict(known)
    tests["sid"] = p["sid"]
    tests["aid_ts_ms"] = p["aid"].split("-")[1]
    tests["aid_rand"] = p["aid"].split("-")[2]
    P(f"[{k}]")
    for name, v in tests.items():
        forms = {
            "ascii": v.encode(),
            "ascii_hex": v.encode().hex().encode(),
            "hexbin": bytes.fromhex(v) if re.fullmatch(r"[0-9a-f]+", v) and len(v) % 2 == 0 else None,
            "b64": None,
        }
        try:
            forms["b64"] = base64.b64decode(v + "=" * ((4 - len(v) % 4) % 4))
        except Exception:
            pass
        hits = []
        for fn, fb in forms.items():
            if not fb:
                continue
            pos = [i for i in range(len(buf) - len(fb) + 1) if buf[i:i + len(fb)] == fb]
            if pos:
                hits.append(f"{fn}@{pos}")
        P(f"    {name:10s} len={len(v):4d} -> {hits if hits else 'NOT FOUND (明文/裸编码) '}")

P()
P("=" * 86)
P("B. 尾部区段 (48 字节周期?) 相位扫描")
P("=" * 86)
SEG = {"drag1": (723, 1354), "drag2": (717, 1341)}
for k in ("drag1", "drag2"):
    s, e = SEG[k]
    seg = D[k]["bin"][s:e]
    P(f"[{k}] 尾部 {s}..{e} len={len(seg)}  len/48={len(seg)/48:.3f}  len/33={len(seg)/33:.3f}  len/16={len(seg)/16:.3f}")
    for reclen in (48, 33, 16, 24, 12):
        best = None
        for ph in range(reclen):
            nrec = (len(seg) - ph) // reclen
            if nrec < 6:
                continue
            score = 0
            for j in range(reclen):
                col = [seg[ph + i * reclen + j] for i in range(nrec)]
                score += Counter(col).most_common(1)[0][1]
            sc = score / (reclen * nrec)
            if best is None or sc > best[1]:
                best = (ph, sc, nrec)
        P(f"       reclen={reclen:3d}: best phase={best[0]:3d} score/byte={best[1]:.4f} nrec={best[2]}")

P()
P("=" * 86)
P("C. 尾部 48B 记录逐列画像 (drag2 phase=0)")
P("=" * 86)
s, e = SEG["drag2"]
seg = D["drag2"]["bin"][s:e]
nrec = len(seg) // 48
P(f"    nrec={nrec} (剩余 {len(seg)%48}B)")
for j in range(48):
    col = [seg[i * 48 + j] for i in range(nrec)]
    c = Counter(col)
    top, cnt = c.most_common(1)[0]
    vals = " ".join(f"{v:02x}" for v in col)
    mk = "CONST" if len(c) == 1 else ("~" if cnt >= nrec * .7 else " ")
    P(f"      +{j:02d} top={top:02x} x{cnt:2d}/{nrec} distinct={len(c):2d} {mk:5s}| {vals}")

P()
P("=" * 86)
P("D. 全 ac 的 k-gram 重复结构 (找重复模板块)")
P("=" * 86)
for k in ("drag1", "drag2"):
    buf = D[k]["bin"]
    hits = {}
    for kk in (12, 16):
        c = Counter(buf[i:i + kk] for i in range(len(buf) - kk + 1))
        rep = [(g, n) for g, n in c.items() if n >= 3]
        hits[kk] = sorted(rep, key=lambda t: -t[1])[:6]
        P(f"    {k} {kk}B 重复>=3 的块数={len(rep)}; top:")
        for g, n in hits[kk]:
            pos = [i for i in range(len(buf) - kk + 1) if buf[i:i + kk] == g]
            P(f"        x{n} @{pos[:12]} {g.hex()}")

P()
P("=" * 86)
P("E. 头 8 字节 + offset8..11 变化字节的性质")
P("=" * 86)
P(f"    drag1 bin[0:8]  = {A[:8].hex()}  (= {int.from_bytes(A[:8],'big'):d} big / {int.from_bytes(A[:8],'little'):d} le)")
P(f"    drag2 bin[0:8]  = {Z[:8].hex()}")
for k, buf in (("drag1", A), ("drag2", Z)):
    u = int.from_bytes(buf[8:12], "little"); v = int.from_bytes(buf[8:12], "big")
    P(f"    {k} bin[8:12] = {buf[8:12].hex()}  LE={u} BE={v}  LE^0xffffffff={u ^ 0xffffffff} BE^0xffffffff={v ^ 0xffffffff}")
    P(f"         as float32 LE={__import__('struct').unpack('<f', buf[8:12])[0]:.6g}")
ts1 = int(S["drag1"]["params"]["aid"].split("-")[1]); ts2 = int(S["drag2"]["params"]["aid"].split("-")[1])
P(f"    aid ts: drag1={ts1} drag2={ts2} delta_ms={ts2-ts1}")
P(f"    aid ts >> 3 = {ts1>>3} / {ts2>>3};  ts & 0xffffffff = {ts1 & 0xffffffff} / {ts2 & 0xffffffff}")

P()
P("=" * 86)
P("F. 会话时序 (aid / sid / cid)")
P("=" * 86)
rows = [
    ("body-003 api/a", "dx-1791254192453-85117419-1", "ed28d8459fb0c76ef6eb954bf663dc03", "26ba29b6a3744dbebee8e46fbe3f311a", "c=空"),
    ("body-005 api/a", "dx-1791254193108-24273989-2", "4e286807c3c76334915ccbad677473f8", "dxdxdxtest2017keyc3e83b6940835", "c=空"),
    ("slide-80.610 api/a", "dx-1791254317035-69831998-1", "be4346328ec2765d4c327bb2a9749a79", "26ba29b6a3744dbebee8e46fbe3f311a", "type=1"),
    ("slide-80.616 api/a", "dx-1791254317108-67216974-2", "1366d8f96de881e497ea1e7fe6fd0a2", "dxdxdxtest2017keyc3e83b6940835", "type=12"),
    ("slide-80.635 api/a", "dx-1791254331515-6147815-3", "b4b36be404f9a5bfc1a5d7562349edc4", "99de95ad1f23597c23b3558d932ded3c", "type?"),
    ("drag1 POST /api/v1", "dx-1791254331515-6147815-3", "b4b36be404f9a5bfc1a5d7562349edc4", "99de95ad1f23597c23b3558d932ded3c", "x=240 y=73"),
    ("drag1 后 api/a", "dx-1791254664084-85561408-4", "6fba4a68c5b2cca6447d121617fdb3ba", "99de95ad1f23597c23b3558d932ded3c", "y=79"),
    ("drag2 前 api/a", "dx-1791254896518-98344667-2", "?", "99de95ad1f23597c23b3558d932ded3c", "?"),
    ("drag2 前 api/a", "dx-1791254897108-7013090-1", "d9c9a0f9a9c4c39b8e24c7b2c38e2bb7", "99de95ad1f23597c23b3558d932ded3c", "?"),
    ("drag2 POST /api/v1", "dx-1791254922626-37899156-3", "d9c9a0f9a9c4c39b8e24c7b2c38e2bb7", "99de95ad1f23597c23b3558d932ded3c", "x=96 y=56"),
]
t0 = 1791254192453
P(f"{'事件':<22} {'aid 序号':>4} {'ts(ms)':>14} {'Δt(与首件)':>12}  sid")
for name, aid, sid, ak, note in rows:
    parts = aid.split("-")
    ts = int(parts[1]); seq = parts[3]
    P(f"{name:<22} {seq:>4} {ts:>14} {(ts-t0)/1000:>11.3f}s  {sid[:12]}.. ak={ak[:8]}.. {note}")
