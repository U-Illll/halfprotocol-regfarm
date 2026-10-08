/**
 * round3-aux/yd-lib.js —— 易盾 core-optimi.m25b40.v2.28.5 data 字段明文构造库
 * 依赖：../round2-static/extract-crypto.js（webpack 模块抽取 + 浏览器全局 mock）
 * 运行 CWD 必须是 agent-易盾/ 根目录（extract-crypto 内用相对路径读 deob 文件）
 *
 * 导出：
 *   aes / xorEncode / xorDecode         —— SDK 原函数
 *   aesDecrypt(cipherStr)               —— 逆向的解密（第一层）
 *   motionStats(trace)                  —— module 0x38（f 明文的统计函数），输入 [[x,y,t],...]
 *   unique2DArray(arr, idx) / sample(arr,n) —— utils 复刻
 *   buildD / buildF / buildExt          —— 三字段明文
 *   buildTrace(params)                  —— 由轨迹参数生成 atomTraceData
 */
const { req } = require('../round2-static/extract-crypto.js');

const U = req(0x1a);
const C = req(0x1b);
const A = req(0xa);
const MOTION = req(0x38); // _0x6e07ce
const UTILS = req(0x3); // utils（含 sample/unique2DArray/now）
const CONST = req(0x5); // SAMPLE_NUM 等

const aes = A.aes;
const xorEncode = A.xorEncode;
const xorDecode = A.xorDecode;
const SAMPLE_NUM = CONST.SAMPLE_NUM; // 50（IE<8: 30）
const BIGGER_SAMPLE_NUM = CONST.BIGGER_SAMPLE_NUM; // 100

/* ================= aes 解密（复刻 round2-static/decrypt-verify.js） ================= */
const SBOX = U.hexsToBytes(C.__SBOX__).map((b) => b & 0xff);
const INV = new Array(256);
for (let i = 0; i < 256; i++) INV[SBOX[i]] = i;
const Sinv = (arr) => arr.map((b) => INV[b & 0xff]);
const ALPHA = C.__BASE64_ALPHABET__;
const PAD = C.__BASE64_PADDING__;

function b64DecodePrivate(str) {
  const cut = str.indexOf(PAD);
  const body = cut === -1 ? str : str.slice(0, cut);
  const out = [];
  let i = 0;
  for (; i + 4 <= body.length; i += 4) {
    const n =
      (ALPHA.indexOf(body[i]) << 18) |
      (ALPHA.indexOf(body[i + 1]) << 12) |
      (ALPHA.indexOf(body[i + 2]) << 6) |
      ALPHA.indexOf(body[i + 3]);
    out.push((n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
  }
  const rem = body.length - i;
  if (rem === 2) {
    const n = (ALPHA.indexOf(body[i]) << 12) | (ALPHA.indexOf(body[i + 1]) << 6);
    out.push((n >>> 10) & 0xff);
  } else if (rem === 3) {
    const n = (ALPHA.indexOf(body[i]) << 12) | (ALPHA.indexOf(body[i + 1]) << 6) | ALPHA.indexOf(body[i + 2]);
    out.push((n >>> 10) & 0xff, (n >>> 2) & 0xff);
  }
  return out;
}

const buildOps = (hex) => {
  const ops = [];
  for (let p = 0; p < hex.length; p += 4) {
    const seg = hex.substring(p, p + 4);
    ops.push({ kind: U.hexToByte(seg.substring(0, 2)), arg: U.hexToByte(seg.substring(2, 4)) });
  }
  return ops;
};
function opInv(o, arr) {
  let b = U.toByte(o.arg);
  if (o.kind === 0x03) return arr.map((v) => U.xor(v, b++));
  if (o.kind === 0x02) return arr.map((v) => U.shift(v, -b));
  if (o.kind === 0x06) return arr.map((v) => U.shift(v, -b--));
  if (o.kind === 0x05) return arr.map((v) => U.xor(v, b--));
  throw new Error('unknown op kind 0x' + o.kind.toString(16));
}
const expand64 = (arr) => {
  if (!arr.length) return new Array(64).fill(0);
  if (arr.length >= 64) return arr.slice(0, 64);
  const out = [];
  for (let i = 0; i < 64; i++) out[i] = arr[i % arr.length];
  return out;
};
const deriveRK = (iv4) => U.xors(expand64(U.stringToBytes(C.__SEED_KEY__)), expand64(iv4));
const subShift = (arr, key) => arr.map((v, i) => U.shift(v, -key[i % key.length]));

function aesDecrypt(cipherStr) {
  const ops = buildOps(C.__ROUND_KEY__);
  const Finv = (block) => [...ops].reverse().reduce((acc, o) => opInv(o, acc), block);
  const bytes = b64DecodePrivate(cipherStr);
  const iv = bytes.slice(0, 4);
  const rk = deriveRK(iv);
  const blocks = [];
  for (let i = 4; i + 64 <= bytes.length; i += 64) blocks.push(bytes.slice(i, i + 64));
  let prev = rk;
  const plain = [];
  for (const cBlk of blocks) {
    const t = Sinv(Sinv(cBlk));
    const a = U.xors(t, prev);
    const y = subShift(a, prev);
    const f = U.xors(y, rk);
    plain.push(...Finv(f));
    prev = cBlk;
  }
  const tail = plain.slice(-4);
  const L =
    (((tail[0] & 0xff) << 24) >>> 0) + ((tail[1] & 0xff) << 16) + ((tail[2] & 0xff) << 8) + (tail[3] & 0xff);
  const data = plain.slice(0, Math.max(0, L - 8));
  let text;
  try {
    text = U.bytesToString(data);
  } catch (e) {
    text = '[bytesToString failed]';
  }
  return { text, len: L, iv: iv.map((b) => b & 0xff) };
}

/* ================= f 的 47 个统计量（命名，来自 module 0x38 的返回数组顺序） ================= */
const F_FIELD_NAMES = [
  ['uniqX', '去重后轨迹 x（累计位移 dx）的**不同取值个数**'],
  ['uniqY', 'y（dy）的不同取值个数'],
  ['meanY', 'dy 均值（4 位小数）'],
  ['stdY', 'dy 总体标准差（÷n，4 位小数）'],
  ['n', '参与统计的点数 = unique2DArray(atomTraceData,2).length'],
  ['vx.min', 'x 方向速度 Δx/Δt 的最小值'],
  ['vx.max', 'Δx/Δt 最大值'],
  ['vx.mean', 'Δx/Δt 均值'],
  ['vx.std', 'Δx/Δt 总体标准差'],
  ['vx.uniq', 'Δx/Δt 不同取值个数'],
  ['vx.p25', 'Δx/Δt 的 25% 分位（线性插值）'],
  ['vx.p75', 'Δx/Δt 的 75% 分位'],
  ['vy.min', 'y 方向速度 Δy/Δt 最小值'],
  ['vy.max', 'Δy/Δt 最大值'],
  ['vy.mean', 'Δy/Δt 均值'],
  ['vy.std', 'Δy/Δt 总体标准差'],
  ['vy.uniq', 'Δy/Δt 不同取值个数'],
  ['vy.p25', 'Δy/Δt 的 25% 分位'],
  ['vy.p75', 'Δy/Δt 的 75% 分位'],
  ['vs.min', '径向速度 Δ|x,y|/Δt 最小值'],
  ['vs.max', '径向速度最大值'],
  ['vs.mean', '径向速度均值'],
  ['vs.std', '径向速度总体标准差'],
  ['vs.uniq', '径向速度不同取值个数'],
  ['vs.p25', '径向速度 25% 分位'],
  ['vs.p75', '径向速度 75% 分位'],
  ['ax.min', 'x 加速度 Δ(vx)/Δt 最小值'],
  ['ax.max', 'x 加速度最大值'],
  ['ax.mean', 'x 加速度均值'],
  ['ax.std', 'x 加速度总体标准差'],
  ['ax.uniq', 'x 加速度不同取值个数'],
  ['ax.p25', 'x 加速度 25% 分位'],
  ['ax.p75', 'x 加速度 75% 分位'],
  ['ay.min', 'y 加速度最小值'],
  ['ay.max', 'y 加速度最大值'],
  ['ay.mean', 'y 加速度均值'],
  ['ay.std', 'y 加速度总体标准差'],
  ['ay.uniq', 'y 加速度不同取值个数'],
  ['ay.p25', 'y 加速度 25% 分位'],
  ['ay.p75', 'y 加速度 75% 分位'],
  ['as.min', '径向加速度最小值'],
  ['as.max', '径向加速度最大值'],
  ['as.mean', '径向加速度均值'],
  ['as.std', '径向加速度总体标准差'],
  ['as.uniq', '径向加速度不同取值个数'],
  ['as.p25', '径向加速度 25% 分位'],
  ['as.p75', '径向加速度 75% 分位'],
];
const F_FIELD_LABELS = F_FIELD_NAMES.map(([k]) => k);

/* ================= 纯 JS 复刻（与 SDK 逐位对齐，见 verify 输出 mineEqSdk=true） ================= */
const r4 = (x) => parseFloat(x.toFixed(4));
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const std = (a) => {
  const m = mean(a);
  let s = 0;
  for (const v of a) if (v - m) s += Math.pow(v - m, 2);
  return Math.sqrt(s / a.length);
};
const uniq = (a) => {
  const o = [];
  for (const v of a) if (o.indexOf(v) === -1) o.push(v);
  return o;
};
function pct(arr, p) {
  const s = arr.slice().sort((a, b) => a - b);
  if (p <= 0) return s[0];
  if (p >= 100) return s[s.length - 1];
  const idx = Math.floor((s.length - 1) * (p / 100));
  const lo = s[idx],
    hi = s[idx + 1];
  return lo + (hi - lo) * ((s.length - 1) * (p / 100) - idx);
}
function ratios(denom, num) {
  const out = [];
  for (let i = 0; i < denom.length - 1; i++) out.push((num[i + 1] - num[i]) / (denom[i + 1] - denom[i]));
  return out;
}
/** module 0x38 复刻：输入 [[x,y,t(,flag)], ...]，输出 47 个数字（点 <= 2 时 SDK 返回 [[],[],[]]） */
function motionStats(trace) {
  if (!Array.isArray(trace) || trace.length <= 2) return [[], [], []];
  const xs = trace.map((p) => p[0]),
    ys = trace.map((p) => p[1]),
    ts = trace.map((p) => p[2]);
  const vx = ratios(ts, xs),
    vy = ratios(ts, ys);
  const radius = xs.map((x, i) => Math.sqrt(Math.pow(x, 2) + Math.pow(ys[i], 2)));
  const vs = ratios(ts, radius);
  const tHead = ts.slice(0, -1);
  const ax = ratios(tHead, vx),
    ay = ratios(tHead, vy),
    as = ratios(tHead, vs);
  const g = (arr) => [
    r4(Math.min(...arr)),
    r4(Math.max(...arr)),
    r4(mean(arr)),
    r4(std(arr)),
    uniq(arr).length,
    r4(pct(arr, 25)),
    r4(pct(arr, 75)),
  ];
  return [
    uniq(xs).length,
    uniq(ys).length,
    r4(mean(ys)),
    r4(std(ys)),
    xs.length,
    ...g(vx),
    ...g(vy),
    ...g(vs),
    ...g(ax),
    ...g(ay),
    ...g(as),
  ];
}

function unique2DArray(arr, idx = 0) {
  if (!Array.isArray(arr)) return arr;
  const seen = {},
    out = [];
  for (let i = 0; i < arr.length; i++) {
    const k = arr[i][idx];
    if (k === null || k === undefined || seen[k]) continue;
    seen[k] = true;
    out.push(arr[i]);
  }
  return out;
}
function sample(arr, num) {
  const len = arr.length;
  if (len <= num) return arr.slice();
  const out = [];
  let picked = 0;
  for (let i = 0; i < len; i++) {
    if (i >= (picked * (len - 1)) / (num - 1)) {
      out.push(arr[i]);
      picked += 1;
    }
  }
  return out;
}

/* ================= 三字段明文构造 ================= */
/** d 明文：pts(sample(traceData,50)) 用 ':' 连接；每个点是 xorEncode(token, "dx,dy,dt,flag") */
function buildD(token, atoms) {
  const traceData = atoms.map((p) => xorEncode(token, p.join(',')));
  const pts = sample(traceData, SAMPLE_NUM);
  return { plain: pts.join(':'), traceData, pts, pointCount: pts.length };
}
/** f 明文：unique2DArray(atomTraceData,2) 按 Δt 去重 → 47 个统计量 join(',') */
function buildF(atoms) {
  const uniqAtoms = unique2DArray(atoms, 2);
  const stats = motionStats(uniqAtoms);
  return { plain: stats.join(','), stats, uniqAtoms, statCount: stats.length };
}
/** ext 明文："mouseDownCounts,traceData.length" */
function buildExt(mouseDownCounts, traceData) {
  return mouseDownCounts + ',' + traceData.length;
}
/** 明文 → 线上字段值（对照 SDK：d= aes(明文)，f/ext = aes(xorEncode(token,明文))） */
function encodeFields(token, { dPlain, fPlain, extPlain }) {
  return {
    d: aes(dPlain),
    f: aes(xorEncode(token, fPlain)),
    ext: aes(xorEncode(token, extPlain)),
  };
}

module.exports = {
  U,
  C,
  A,
  MOTION,
  UTILS,
  CONST,
  aes,
  xorEncode,
  xorDecode,
  aesDecrypt,
  motionStats,
  unique2DArray,
  sample,
  buildD,
  buildF,
  buildExt,
  encodeFields,
  F_FIELD_LABELS,
  F_FIELD_NAMES,
  SAMPLE_NUM,
  BIGGER_SAMPLE_NUM,
};
