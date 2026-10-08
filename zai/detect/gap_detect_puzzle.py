#!/usr/bin/env python3
"""gap_detect_puzzle.py — PUZZLE 题缺口检测器（正式版, for z.ai / aliyun captcha PUZZLE）
原理: 缺口在背景图上表现为"白色实心拼图块"。检测 = 白色连通域(多阈值) + 与块 mask 尺寸匹配 + 中心对齐换算。
输出: 推荐 puzzle.left 目标值 L（用于 drag_align2.mjs）
用法: python3 gap_detect_puzzle.py [bg.png] [piece.png]
"""
import sys
import numpy as np
import cv2
from PIL import Image

BG = sys.argv[1] if len(sys.argv) > 1 else '/tmp/zai-recon-4/q-bg.png'
PIECE = sys.argv[2] if len(sys.argv) > 2 else '/tmp/zai-recon-4/q-piece.png'

img = np.array(Image.open(BG).convert('RGB'))
puz = np.array(Image.open(PIECE).convert('RGBA'))
a = puz[:, :, 3]
ys, xs = np.where(a > 30)
mx0, mx1, my0, my1 = xs.min(), xs.max(), ys.min(), ys.max()
mask_w = mx1 - mx0 + 1
mask_h = my1 - my0 + 1
mask_cx = (mx0 + mx1) / 2.0
print(f'[det] 块 mask: x[{mx0},{mx1}] y[{my0},{my1}] 宽{mask_w} 高{mask_h} 中心x={mask_cx:.1f}')

# 白色连通域（多阈值投票）
cands = {}
for th in (240, 225, 210, 195, 180, 165):
    white = ((img[:, :, 0] > th) & (img[:, :, 1] > th) & (img[:, :, 2] > th)).astype(np.uint8)
    n, lab, stats, cent = cv2.connectedComponentsWithStats(white, 8)
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        # 尺寸过滤: 与块 mask 接近 (容差 ±60%)
        if not (mask_w * 0.4 <= w <= mask_w * 1.6 and mask_h * 0.4 <= h <= mask_h * 1.6):
            continue
        if area < 250:
            continue
        # 位置过滤: y 与块 mask 的 y 区重叠
        if y > my1 + 10 or y + h < my0 - 10:
            continue
        key = (round(x / 4), round(y / 4))  # 粗聚类
        c = cands.get(key)
        if c is None or area > c[4]:
            cands[key] = (x, y, w, h, area, th, cent[i][0], cent[i][1])

print(f'[det] 候选组件 {len(cands)} 个:')
best = None
for k, (x, y, w, h, area, th, cx, cy) in sorted(cands.items(), key=lambda kv: -kv[1][4]):
    # 中心对齐换算: L = 白区中心 - mask 中心
    Lc = cx - mask_cx
    # bbox 对齐换算: L = 白区左缘 - (mask 左缘 - 0) .. 用形状左缘 mx0
    Lb = x - mx0
    print(f'  th={th} bbox=({x},{y},{w},{h}) area={area} 中心=({cx:.0f},{cy:.0f}) -> L_center={Lc:.1f} L_bbox={Lb:.1f}')
    if best is None:
        best = (Lc, Lb, (x, y, w, h), area)

if best:
    Lc, Lb, bbox, area = best
    L = round((Lc + Lb) / 2)
    print(f'[det] 推荐 L = {L}  (L_center={Lc:.1f}, L_bbox={Lb:.1f}, 取平均)')
    print(f'[det] 拖动命令: node drag_align2.mjs {L}')
else:
    print('[det] 未找到候选!!')
