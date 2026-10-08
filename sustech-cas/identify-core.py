#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""读 get-resp2.json（node 已下载的挑战）→ 1D NCC 识别 → 写 pending-point.json + overlay"""
import json, base64
import numpy as np
import cv2

P = "/tmp/cas-captcha-recon/"
d = json.load(open(P + "get-resp2.json"))
rd = d["repData"]

bg = cv2.imdecode(np.frombuffer(base64.b64decode(rd["originalImageBase64"]), np.uint8), cv2.IMREAD_COLOR)
jig = cv2.imdecode(np.frombuffer(base64.b64decode(rd["jigsawImageBase64"]), np.uint8), cv2.IMREAD_UNCHANGED)
cv2.imwrite(P + "bg2.png", bg); cv2.imwrite(P + "jig2.png", jig)

alpha = jig[:, :, 3].astype(np.float32)
ys = np.where(alpha.max(axis=1) > 10)[0]
y0, y1 = int(ys.min()), int(ys.max())
jgray = cv2.cvtColor(jig[:, :, :3], cv2.COLOR_BGR2GRAY).astype(np.float32)
bgray = cv2.cvtColor(bg, cv2.COLOR_BGR2GRAY).astype(np.float32)
mask = (alpha > 10)[y0:y1+1, :]
strip = jgray[y0:y1+1, :]

scores = []
for dp in range(0, 310 - 47 + 1):
    seg = bgray[y0:y1+1, dp:dp+47]
    m = mask > 0
    if m.sum() < 30:
        scores.append((dp, -1.0)); continue
    a = strip[m] - strip[m].mean(); b = seg[m] - seg[m].mean()
    den = np.sqrt((a*a).sum()) * np.sqrt((b*b).sum())
    scores.append((dp, float((a*b).sum()/den) if den > 1e-6 else -1.0))

ranked = sorted(scores, key=lambda t: -t[1])
best_d, best_s = ranked[0]
second = next(((dd, ss) for dd, ss in ranked if abs(dd - best_d) > 4), (None, -1))
json.dump({"x": int(best_d), "y": 5, "ncc": round(best_s, 3), "second": round(second[1], 3)},
          open(P + "pending-point.json", "w"))

canvas = bg.copy()
ys2, xs2 = np.where(jig[:, :, 3] > 10)
for yy, xx in zip(ys2, xs2):
    tx = int(xx) + int(best_d); ty = int(yy)
    if 0 <= tx < canvas.shape[1]:
        canvas[ty, tx] = jig[yy, xx, :3]
cv2.imwrite(P + "overlay_final.png", canvas)
print(f"ID_RESULT x={best_d} ncc={best_s:.3f} second={second[1]:.3f}")
