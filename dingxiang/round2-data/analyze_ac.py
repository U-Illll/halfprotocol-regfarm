#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""顶象 ac 样本结构分析 (node e-dx-r2-data)

输入: artifacts/ac-samples.json
输出: round2-data/ac-analysis.json  + stdout 报告
"""
import json, os, sys, math, re, zlib, base64, itertools
from collections import Counter

ART = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "artifacts")
ART = os.path.normpath(ART)
OUT = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(ART, "ac-samples.json"), encoding="utf-8") as f:
    S = json.load(f)

rep = {}

def ent(counter, n):
    return -sum((c / n) * math.log2(c / n) for c in counter.values())

def analyze(name, d):
    ac = d["ac_full"]
    params = d["params"]
    r = {}
    r["ac_len_reported"] = d["ac_len"]
    r["ac_len_actual"] = len(ac)
    pre, _, body = ac.partition("#")
    r["prefix"] = pre
    r["prefix_len"] = len(pre)
    r["has_hash"] = "#" in ac
    r["body_len"] = len(body)
    r["body_len_mod4"] = len(body) % 4
    r["body_len_mod3"] = len(body) % 3
    r["body_len_div4"] = len(body) / 4
    r["body_est_bytes"] = len(body) // 4 * 3
    r["tail_8"] = body[-8:]
    r["head_32"] = body[:32]
    r["pad_eq"] = len(body) - len(body.rstrip("="))
    chars = Counter(body)
    r["n_distinct_chars"] = len(chars)
    r["charset"] = "".join(sorted(chars))
    r["entropy_per_char"] = round(ent(chars, len(body)), 4)
    r["entropy_total_bits"] = round(ent(chars, len(body)) * len(body), 1)
    r["compression"] = {
        "raw": len(body),
        "zlib9": len(zlib.compress(body.encode(), 9)),
        "zlib_ratio": round(len(zlib.compress(body.encode(), 9)) / len(body), 4),
    }
    # top chars
    r["top_chars"] = chars.most_common(12)
    # base64 validity (standard alphabet)
    STD = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=")
    r["chars_outside_std_b64"] = sorted(set(body) - STD)
    r["is_std_b64"] = len(r["chars_outside_std_b64"]) == 0
    # try to decode
    dec = None
    try:
        pad = body + "=" * ((4 - len(body) % 4) % 4)
        dec = base64.b64decode(pad, validate=False)
        r["b64_decode_bytes"] = len(dec)
        r["b64_decode_hex_head"] = dec[:32].hex()
        r["b64_roundtrip_exact"] = base64.b64encode(dec).decode() == pad
    except Exception as e:
        r["b64_decode_error"] = str(e)
    return r, body


def diff(a, b):
    """差分: 公共前缀/后缀 + SequenceMatcher opcodes"""
    import difflib
    n = min(len(a), len(b))
    cp = 0
    while cp < n and a[cp] == b[cp]:
        cp += 1
    cs = 0
    while cs < n - cp and a[len(a) - 1 - cs] == b[len(b) - 1 - cs]:
        cs += 1
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    ops = [(t, round(1 - sm.ratio(), 4), sm.ratio(), i1, i2, j1, j2) for t, i1, i2, j1, j2 in sm.get_opcodes() if t != "equal"]
    blocks = []
    for t, i1, i2, j1, j2 in sm.get_opcodes():
        blocks.append({"op": t, "i": [i1, i2], "j": [j1, j2],
                       "len_a": i2 - i1, "len_b": j2 - j1,
                       "a": a[i1:i2][:60], "b": b[j1:j2][:60]})
    return {"common_prefix_len": cp, "common_suffix_len": cs, "ratio": round(sm.ratio(), 4),
            "equal_blocks": blocks}


r1, b1 = analyze("drag1", S["drag1"])
r2, b2 = analyze("drag2", S["drag2"])

# ---- 全局: 4-gram / 重复子串 ----
def ngrams(s, k):
    return Counter(s[i:i + k] for i in range(len(s) - k + 1))

def top_ngrams(s, k, n=15):
    c = ngrams(s, k)
    return [(g, v) for g, v in c.most_common(n)]

# 全部样本连同 Param header
PARAM = "5879#X8XIoW6cMTkcoRF6QpkcXrm8Q4A29FkIGStKLGzH7biVLsEi0fqKCeqspbKbCsiY5512CsUspSK5NJdWGfw0Lpw/5nUdreDDoQ1VVpi37Si99GkR74sErksDQ4Pc9pUuQvfjXXQS6a5pf/5q/ma2mX8XIAoHWmQK3jnniCMbPESHJyZMiN/IZD8jkY88JXv8vACHjNXPkCCC3/yMTMaNju7AXLITm8Xexg+NMSdSykUvl7iewqlRxoJLy0R1bWj7wlNHeIGbtFduSOEeAHNfBIKoLr=="

# ---- "XX" 作为定界符的检查 ----
def xx_stats(s):
    idx = [m.start() for m in re.finditer("XX", s)]
    gaps = [idx[i + 1] - idx[i] for i in range(len(idx) - 1)]
    return {"count_XX": len(idx), "first_20_pos": idx[:20],
            "gap_counter": Counter(gaps).most_common(10),
            "runs": Counter(len(m.group(0)) for m in re.finditer("X+", s)).most_common(12)}

out = {
    "drag1": r1,
    "drag2": r2,
    "param_header": {
        "prefix": PARAM.split("#")[0],
        "body_len": len(PARAM.split("#")[1]),
        "body_len_mod4": len(PARAM.split("#")[1]) % 4,
        "tail": PARAM[-6:],
        "char_outside_std_b64": sorted(set(PARAM.split("#")[1]) - set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=")),
        "body_len_div4": len(PARAM.split("#")[1]) / 4,
    },
    "diff_body": diff(b1, b2),
    "diff_full": diff(S["drag1"]["ac_full"], S["drag2"]["ac_full"]),
    "ngrams_drag1": {"4": top_ngrams(b1, 4), "6": top_ngrams(b1, 6), "8": top_ngrams(b1, 8)},
    "ngrams_drag2": {"4": top_ngrams(b2, 4), "6": top_ngrams(b2, 6), "8": top_ngrams(b2, 8)},
    "xx_drag1": xx_stats(b1),
    "xx_drag2": xx_stats(b2),
    "xx_param": xx_stats(PARAM.split("#")[1]),
}

with open(os.path.join(OUT, "ac-analysis.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)

# ---------------- report ----------------
P = print
P("=" * 78)
P("A. 基本参数")
P("=" * 78)
for k in ["drag1", "drag2"]:
    r = out[k]
    P(f"[{k}] ac_len(报)={r['ac_len_reported']} ac_len(实)={r['ac_len_actual']} 前缀={r['prefix']!r}(len={r['prefix_len']})"
      f" body_len={r['body_len']} body%4={r['body_len_mod4']} body/4={r['body_len_div4']:.1f} 估算字节={r['body_est_bytes']}")
    P(f"       tail='{r['tail_8']}' pad={r['pad_eq']} distinct={r['n_distinct_chars']}/64 entropy={r['entropy_per_char']}bit/char "
      f"总熵={r['entropy_total_bits']}bit zlib_ratio={r['compression']['zlib_ratio']}")
    P(f"       is_std_base64={r['is_std_b64']} decode_bytes={r.get('b64_decode_bytes')} roundtrip={r.get('b64_roundtrip_exact')} head_hex={r.get('b64_decode_hex_head')}")
P()
P(f"[param header] prefix={out['param_header']['prefix']} body_len={out['param_header']['body_len']} "
  f"%4={out['param_header']['body_len_mod4']} tail={out['param_header']['tail']!r} outside_std={out['param_header']['char_outside_std_b64']}")
P()
P("=" * 78)
P("B. 字符集 (drag1)")
P("=" * 78)
P(out["drag1"]["charset"])
P("top: " + str(out["drag1"]["top_chars"]))
P("charset (drag2): " + out["drag2"]["charset"])
P("top2: " + str(out["drag2"]["top_chars"]))
P()
P("=" * 78)
P("C. 两样本差分 (body)")
P("=" * 78)
d = out["diff_body"]
P(f"common_prefix_len={d['common_prefix_len']} common_suffix_len={d['common_suffix_len']} ratio={d['ratio']}")
P(f"公共前缀: {b1[:d['common_prefix_len']]}")
P(f"公共后缀: {b1[-d['common_suffix_len']:] if d['common_suffix_len'] else '(none)'}")
P("opcode 块 (前 40):")
for blk in d["equal_blocks"][:40]:
    P(f"  {blk['op']:8s} a[{blk['i'][0]}:{blk['i'][1]}] b[{blk['j'][0]}:{blk['j'][1]}] "
      f"|A={blk['a']} |B={blk['b']}")
P(f"... 总块数={len(d['equal_blocks'])}")
P()
P("=" * 78)
P("D. 'XX' 定界符统计")
P("=" * 78)
for k in ["xx_drag1", "xx_drag2", "xx_param"]:
    P(f"{k}: {out[k]}")
P()
P("=" * 78)
P("E. 高频 n-gram")
P("=" * 78)
for k in ["ngrams_drag1", "ngrams_drag2"]:
    for n in ["4", "6", "8"]:
        P(f"{k} top-{n}: {out[k][n][:10]}")
P()
P("=" * 78)
P("F. 原始响应 (retry oracle)")
P("=" * 78)
for k in ["drag1", "drag2"]:
    P(f"[{k}] {S[k]['resp']}")
    P(f"       sid={S[k]['params']['sid']} aid={S[k]['params']['aid']} c={S[k]['params']['c']} x={S[k]['params']['x']} y={S[k]['params']['y']}")
P(f"saved -> {os.path.join(OUT,'ac-analysis.json')}")
