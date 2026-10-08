# locate.py — 顶象拼图缺口定位（Chamfer 形状匹配 + y 约束 + 可选 canvas/p1 差分）
# 用法: python locate.py --canvas a.png --frag b.webp --y-api 56 [--p1 p1.png] --out result.json
import sys, json, argparse
import cv2
import numpy as np

def load_gray_rgba(path):
    im = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if im is None:
        raise SystemExit('cannot read ' + path)
    return im

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--canvas', required=True)
    ap.add_argument('--frag', required=True)
    ap.add_argument('--y-api', type=float, default=None)
    ap.add_argument('--p1', default=None)
    ap.add_argument('--out', default=None)
    a = ap.parse_args()

    canvas = load_gray_rgba(a.canvas)
    if canvas.ndim == 2:
        canvas = cv2.cvtColor(canvas, cv2.COLOR_GRAY2BGR)
    cav = canvas[..., :3].copy()
    gray = cv2.cvtColor(cav, cv2.COLOR_BGR2GRAY)
    H, W = gray.shape

    frag = load_gray_rgba(a.frag)
    alpha = frag[..., 3] if frag.ndim == 3 and frag.shape[2] == 4 else np.full(frag.shape[:2], 255, np.uint8)
    fh, fw = alpha.shape
    mask = (alpha > 128).astype(np.uint8) * 255
    ys, xs = np.where(mask > 0)
    if len(xs) == 0:
        print(json.dumps({'err': 'empty mask'})); return
    bx, by, bw, bh = xs.min(), ys.min(), xs.max() - xs.min() + 1, ys.max() - ys.min() + 1

    out = {'canvas_size': [W, H], 'frag_size': [fw, fh], 'mask_bbox': [int(bx), int(by), int(bw), int(bh)]}
    if a.y_api is not None:
        out['y_expect_canvas'] = round(a.y_api / 0.825, 2)

    # ---- Chamfer: frag 轮廓 -> canvas 边缘距离变换 ----
    res = None
    for (lo, hi, blur) in [(40, 110, 1.2), (25, 80, 1.0), (60, 160, 1.5)]:
        g2 = cv2.GaussianBlur(gray, (5, 5), blur)
        edges = cv2.Canny(g2, lo, hi)
        dt = cv2.distanceTransform(255 - edges, cv2.DIST_L2, 5).astype(np.float32)
        grad = cv2.morphologyEx(mask, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
        contour = (grad > 0).astype(np.float32)
        cnt = contour.sum()
        r = cv2.matchTemplate(dt, contour, cv2.TM_CCORR) / max(cnt, 1)
        res = r if res is None else np.minimum(res, r)

    cand = []
    for y in range(res.shape[0]):
        for x in range(res.shape[1]):
            cand.append((float(res[y, x]), x, y))
    cand.sort()

    def to_entry(d, x, y):
        e = {'x': int(x), 'y': int(y), 'd': round(d, 2), 'ui_x': round(x * 0.95, 1), 'ui_y': round(y * 0.825, 1)}
        return e

    seen = []
    for d, x, y in cand:
        if all((x - s[0]) ** 2 + (y - s[1]) ** 2 > 12 ** 2 for s in seen):
            seen.append((x, y, d))
        if len(seen) >= 12:
            break
    out['chamfer_top'] = [to_entry(d, x, y) for x, y, d in seen]

    # y 约束（碎片图顶 y ≈ y_api/0.825）
    if a.y_api is not None:
        yc = a.y_api / 0.825
        ycand = [(d, x, y) for d, x, y in cand if abs(y - yc) <= 10]
        out['chamfer_y_candidates'] = [to_entry(d, x, y) for d, x, y in ycand[:8]]

    # ---- NCC 内容匹配（掩码内灰度，去均值） ----
    fr_g = cv2.cvtColor(frag[..., :3], cv2.COLOR_BGR2GRAY).astype(np.float64)
    m = mask > 0
    tmpl = fr_g[m]
    n = tmpl.size
    if n > 0:
        tmpl_c = tmpl - tmpl.mean()
        tden = np.sqrt((tmpl_c ** 2).sum())
        step = 2
        ylo, yhi = 0, H - fh
        if a.y_api is not None:
            yc = a.y_api / 0.825
            ylo = max(0, int(yc - 12)); yhi = min(H - fh, int(yc + 12))
        nccs = []
        for y in range(ylo, yhi + 1, step):
            for x in range(0, W - fw + 1, step):
                win = gray[y:y + fh, x:x + fw][m].astype(np.float64)
                wc = win - win.mean()
                den = np.sqrt((wc ** 2).sum())
                if den < 1e-6:
                    continue
                nccs.append((float((wc * tmpl_c).sum() / (den * tden)), x, y))
        nccs.sort(reverse=True)
        top = []
        for s, x, y in nccs:
            if all((x - t[0]) ** 2 + (y - t[1]) ** 2 > 10 ** 2 for t in top):
                top.append((x, y, s))
            if len(top) >= 8:
                break
        out['ncc_top'] = [{'x': x, 'y': y, 'ncc': round(s, 3), 'ui_x': round(x * 0.95, 1), 'ui_y': round(y * 0.825, 1)} for x, y, s in top]

    # ---- canvas vs p1 差分（找被替换的块） ----
    if a.p1:
        try:
            p1 = cv2.imread(a.p1, cv2.IMREAD_UNCHANGED)
            if p1 is not None:
                p1 = p1[..., :3]
                if p1.shape[:2] != (H, W):
                    p1 = cv2.resize(p1, (W, H))
                d = cv2.absdiff(p1, cav).max(axis=2)
                dm = (d > 40).astype(np.uint8) * 255
                dm = cv2.morphologyEx(dm, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
                dm = cv2.morphologyEx(dm, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
                nn, lab, stats, cent = cv2.connectedComponentsWithStats(dm, 8)
                blocks = []
                for i in range(1, nn):
                    x, y, w, h, area = stats[i]
                    if area >= 120:
                        blocks.append({'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h), 'area': int(area),
                                       'ui_x': round(x * 0.95, 1), 'ui_y': round(y * 0.825, 1)})
                blocks.sort(key=lambda b: -b['area'])
                out['diff_blocks'] = blocks[:12]
        except Exception as e:
            out['diff_err'] = str(e)

    txt = json.dumps(out, ensure_ascii=False, indent=1)
    if a.out:
        open(a.out, 'w', encoding='utf-8').write(txt)
    print(txt)

if __name__ == '__main__':
    main()
