// gap_detect.cjs — 离线缺口检测（纯 node，复刻 round2-hook/gap_detect_page.js 的算法）
// 输入：bg(jpeg) / fg(png) 的 Buffer；输出：缺口位置 (dx,dy) 及得分
// 算法：fg alpha 轮廓点 × bg Sobel 梯度幅度（膨胀 1px）匹配打分
const jpeg = require('./lib/jpeg-js');
const { PNG } = require('./lib/pngjs');

function decodeBg(buf) { const r = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 256 }); return { data: r.data, w: r.width, h: r.height }; }
function decodeFg(buf) { const p = PNG.sync.read(buf); return { data: p.data, w: p.width, h: p.height }; }

function detectGap(bgBuf, fgBuf, opts = {}) {
  const bg = decodeBg(bgBuf);
  const fg = decodeFg(fgBuf);
  const W0 = bg.w, H0 = bg.h, N = W0 * H0;
  const bd = bg.data;
  const gray = new Float32Array(N);
  for (let i = 0, p = 0; i < N; i++, p += 4) gray[i] = 0.299 * bd[p] + 0.587 * bd[p + 1] + 0.114 * bd[p + 2];
  const mag = new Float32Array(N);
  for (let y = 1; y < H0 - 1; y++) {
    for (let x = 1; x < W0 - 1; x++) {
      const i0 = y * W0 + x;
      const gx = (gray[i0 - W0 - 1] + 2 * gray[i0 - 1] + gray[i0 + W0 - 1]) - (gray[i0 - W0 + 1] + 2 * gray[i0 + 1] + gray[i0 + W0 + 1]);
      const gy = (gray[i0 - W0 - 1] + 2 * gray[i0 - W0] + gray[i0 - W0 + 1]) - (gray[i0 + W0 - 1] + 2 * gray[i0 + W0] + gray[i0 + W0 + 1]);
      const m = Math.sqrt(gx * gx + gy * gy);
      mag[i0] = m > 255 ? 255 : m;
    }
  }
  const dil = new Float32Array(N);
  for (let y = 1; y < H0 - 1; y++) {
    for (let x = 1; x < W0 - 1; x++) {
      const i0 = y * W0 + x;
      let b = mag[i0];
      if (mag[i0 - 1] > b) b = mag[i0 - 1];
      if (mag[i0 + 1] > b) b = mag[i0 + 1];
      if (mag[i0 - W0] > b) b = mag[i0 - W0];
      if (mag[i0 + W0] > b) b = mag[i0 + W0];
      dil[i0] = b;
    }
  }
  const fw = fg.w, fh = fg.h, fd = fg.data;
  const alpha = new Uint8Array(fw * fh);
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let j = 0; j < fh; j++) {
    for (let k = 0; k < fw; k++) {
      const a = fd[(j * fw + k) * 4 + 3];
      alpha[j * fw + k] = a;
      if (a > 16) { if (k < x0) x0 = k; if (k > x1) x1 = k; if (j < y0) y0 = j; if (j > y1) y1 = j; }
    }
  }
  const pts = [];
  for (let j = 1; j < fh - 1; j++) {
    for (let k = 1; k < fw - 1; k++) {
      const idx = j * fw + k;
      if (alpha[idx] > 16 && (alpha[idx - 1] <= 16 || alpha[idx + 1] <= 16 || alpha[idx - fw] <= 16 || alpha[idx + fw] <= 16)) pts.push([k, j]);
    }
  }
  const samplePts = opts.keepAll ? pts : pts.filter((_, i) => i % 2 === 0);
  const k = W0 / 320;
  const dxMax = Math.max(0, Math.round(W0 - (x1 + 1) * k));
  const dyLo = opts.dyLo !== undefined ? opts.dyLo : -3, dyHi = opts.dyHi !== undefined ? opts.dyHi : 5;
  let best = { score: -1, dx: -1, dy: -1 };
  const all = [];
  for (let dy = dyLo; dy <= dyHi; dy++) {
    for (let dx = 0; dx <= dxMax; dx++) {
      let s = 0, cnt = 0;
      for (let q = 0; q < samplePts.length; q++) {
        const bx = dx + Math.round(samplePts[q][0] * k), by = dy + Math.round(samplePts[q][1] * k);
        if (bx < 0 || by < 0 || bx >= W0 || by >= H0) { cnt++; continue; }
        s += dil[by * W0 + bx]; cnt++;
      }
      const sc = cnt ? s / cnt : -1;
      all.push({ dx, dy, score: Math.round(sc * 100) / 100 });
      if (sc > best.score) { best = { dx, dy, score: sc }; }
    }
  }
  all.sort((a, b) => b.score - a.score);
  let refine = null;
  for (let ddx = -1; ddx <= 1; ddx++) {
    for (let ddy = -1; ddy <= 1; ddy++) {
      const dx2 = best.dx + ddx, dy2 = best.dy + ddy;
      let s2 = 0, c2 = 0;
      for (let q = 0; q < samplePts.length; q++) {
        const bx = dx2 + Math.round(samplePts[q][0] * k), by = dy2 + Math.round(samplePts[q][1] * k);
        if (bx < 0 || by < 0 || bx >= W0 || by >= H0) continue;
        s2 += mag[by * W0 + bx]; c2++;
      }
      const sc2 = c2 ? s2 / c2 : -1;
      if (!refine || sc2 > refine.score) refine = { dx: dx2, dy: dy2, score: sc2 };
    }
  }
  return {
    ok: true, bgNat: [W0, H0], fgNat: [fw, fh], k,
    fgBBox: [x0, y0, x1, y1], pts: pts.length,
    best: { dx: Math.round(best.dx * 10) / 10, dy: best.dy, score: Math.round(best.score * 100) / 100 },
    top: all.slice(0, 8),
    refine: refine ? { dx: refine.dx, dy: refine.dy, score: Math.round(refine.score * 100) / 100 } : null,
  };
}
module.exports = { detectGap, decodeBg, decodeFg };
