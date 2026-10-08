#!/usr/bin/env python3
"""gap_detect.py — 用 capsolver 的 detect_gap 对 q-bg.png + q-piece.png 找缺口 x"""
import sys
sys.path.insert(0, '/tmp/harness-lab/capsolver-repo/src')
import numpy as np
from PIL import Image
from capsolver.solver import detect_gap

main = np.array(Image.open('/tmp/zai-recon-4/q-bg.png').convert('RGB'))
puz = np.array(Image.open('/tmp/zai-recon-4/q-piece.png').convert('RGBA'))
print('main shape', main.shape, '| puz shape', puz.shape)

# alpha bbox 检查
a = puz[:, :, 3]
ys, xs = np.where(a > 30)
if len(ys):
    print('piece alpha bbox: y', ys.min(), ys.max(), '| x', xs.min(), xs.max(), '| alpha px', len(ys))
else:
    print('piece alpha empty!')

det = detect_gap(main, puz)
print('=== RESULT ===')
print('x =', det.x, '| x_refined =', round(float(det.x_refined), 2), '| confidence =', det.confidence)
print('method =', det.method)
sc = getattr(det, 'scene', None)
if sc is not None:
    print('scene =', getattr(sc, 'type', '?'), '| mean', round(getattr(sc, 'mean', 0), 1), '| var', round(getattr(sc, 'var', 0), 1), '| edge_density', getattr(sc, 'edge_density', 0), '| low_var_count', getattr(sc, 'low_var_count', 0))
cands = getattr(det, 'candidates', []) or []
print('candidates (top5):')
for c in cands[:5]:
    print('  ', c)
