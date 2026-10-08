// lib_yd.cjs — 易盾 v2.28.5「协议直打」本地库
// 关键点：加密/编码方向直接调用 SDK 反混淆产物中的原生函数（aes/xorEncode/base64EncodePrivate），
//         保证与页面逐字节一致；解密方向用 round2-static 已实证的复刻实现（仅用于自检/诊断）。
// 运行要求：CWD = agent-易盾/（extract-crypto.js 内部按相对路径读取 deob 文件）
const path = require('path');
const AGENT_DIR = path.resolve(__dirname, '..');
const { req } = require(path.join(AGENT_DIR, 'round2-static/extract-crypto.js'));

const U = req(0x1a);   // bytes utils
const C = req(0x1b);   // 常数池
const B = req(0x3a);   // base64 私有编码
const A = req(0xa);    // aes / xorEncode / xorDecode
const FGEN = req(0x38); // f 字段生成函数（atomTraceData 统计）

// ---------------- 私有 base64 解码（自检用） ----------------
const ALPHA = C.__BASE64_ALPHABET__, PAD = C.__BASE64_PADDING__;
function b64DecodePrivate(str) {
  const cut = str.indexOf(PAD);
  const body = cut === -1 ? str : str.slice(0, cut);
  const out = [];
  let i = 0;
  for (; i + 4 <= body.length; i += 4) {
    const n = (ALPHA.indexOf(body[i]) << 18) | (ALPHA.indexOf(body[i + 1]) << 12) | (ALPHA.indexOf(body[i + 2]) << 6) | ALPHA.indexOf(body[i + 3]);
    out.push((n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
  }
  const rem = body.length - i;
  if (rem === 2) { const n = (ALPHA.indexOf(body[i]) << 12) | (ALPHA.indexOf(body[i + 1]) << 6); out.push((n >>> 10) & 0xff); }
  else if (rem === 3) { const n = (ALPHA.indexOf(body[i]) << 12) | (ALPHA.indexOf(body[i + 1]) << 6) | ALPHA.indexOf(body[i + 2]); out.push((n >>> 10) & 0xff, (n >>> 2) & 0xff); }
  return out;
}

// ---------------- aes 解密（round2-static/decrypt-verify.js 复刻，已验证 round-trip） ----------------
const SBOX = U.hexsToBytes(C.__SBOX__).map((b) => b & 0xff);
const INV = new Array(256);
for (let i = 0; i < 256; i++) INV[SBOX[i]] = i;
const Sinv = (arr) => arr.map((b) => INV[b & 0xff]);
function buildOps(hex) { const ops = []; for (let p = 0; p < hex.length; p += 4) ops.push({ kind: U.hexToByte(hex.substring(p, p + 2)), arg: U.hexToByte(hex.substring(p + 2, p + 4)) }); return ops; }
function opInv(o, arr) {
  let b = U.toByte(o.arg);
  if (o.kind === 0x03) return arr.map((v) => U.xor(v, b++));
  if (o.kind === 0x02) return arr.map((v) => U.shift(v, -b));
  if (o.kind === 0x06) return arr.map((v) => U.shift(v, -b--));
  if (o.kind === 0x05) return arr.map((v) => U.xor(v, b--));
  throw new Error('unknown op kind');
}
const expand64 = (arr) => { if (!arr.length) return new Array(64).fill(0); if (arr.length >= 64) return arr.slice(0, 64); const out = []; for (let i = 0; i < 64; i++) out[i] = arr[i % arr.length]; return out; };
function deriveRK(iv4) { return U.xors(expand64(U.stringToBytes(C.__SEED_KEY__)), expand64(iv4)); }
const subShift = (arr, key) => arr.map((v, i) => U.shift(v, -key[i % key.length]));
function aesDecrypt(cipherStr) {
  const ops = buildOps(C.__ROUND_KEY__);
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
    const P = [...ops].reverse().reduce((acc, o) => opInv(o, acc), f);
    plain.push(...P);
    prev = cBlk;
  }
  const tail = plain.slice(-4);
  const L = ((tail[0] & 0xff) << 24 >>> 0) + ((tail[1] & 0xff) << 16) + ((tail[2] & 0xff) << 8) + (tail[3] & 0xff);
  const body = plain.slice(0, Math.max(0, L));
  const data = body.slice(0, Math.max(0, L - 8));
  let text;
  try { text = U.bytesToString(data); } catch (e) { text = '[dec-fail]'; }
  return { text, len: L, iv: iv.map((b) => b & 0xff) };
}

// ---------------- 编码方向（直接使用 SDK 原生实现） ----------------
const aes = (plain) => A.aes(plain);                                  // 第二层：自研分组加密 + 私有 base64
const xorEncode = (token, plain) => A.xorEncode(token, plain);        // 第一层
const xorDecode = (token, cipher) => A.xorDecode(token, cipher);

// ---------------- 轨迹/f 生成（复刻 onMouseMove + onMouseUp + unique2DArray + mod38） ----------------
const sample = (arr, n) => {
  const len = arr.length;
  if (len <= n) return arr;
  const out = [];
  let cnt = 0;
  for (let i = 0; i < len; i++) if (i >= (cnt * (len - 1)) / (n - 1)) { out.push(arr[i]); cnt += 1; }
  return out;
};
const unique2DArray = (arr, idx) => {
  if (!Array.isArray(arr)) return arr;
  const seen = {}, out = [];
  for (let i = 0; i < arr.length; i++) { const v = arr[i][idx]; if (v !== null && v !== undefined && !seen[v]) { seen[v] = true; out.push(arr[i]); } }
  return out;
};
// atoms: 4 元组 [x, dy, dtMs, isTrusted]
const traceDataPlain = (atoms) => atoms.map((a) => String(a)); // 与 SDK 中 _0x1d0d76 + '' 一致
const fPlain = (atoms) => {
  const r = FGEN(unique2DArray(atoms, 2));
  return Array.isArray(r) ? r.join(',') : String(r);
};
const SAMPLE_NUM = 50;

// 构造 data（与 onMouseUp @6503-6514 完全同构）
function buildData({ token, atoms, pPlain, mouseDownCounts = 1 }) {
  const traceData = traceDataPlain(atoms);               // 每点 xorEncode 前的明文 "x,dy,dt,tr"
  const pts = sample(traceData, SAMPLE_NUM);
  const d = aes(pts.map((p) => xorEncode(token, p)).join(':'));
  const p = aes(xorEncode(token, pPlain));
  const f = aes(xorEncode(token, fPlain(atoms)));
  const ext = aes(xorEncode(token, mouseDownCounts + ',' + traceData.length));
  return { json: JSON.stringify({ d, m: '', p, f, ext }), d, p, f, ext, m: '', debug: { pPlain, fPlain: fPlain(atoms), extPlain: mouseDownCounts + ',' + traceData.length, traceDataLen: traceData.length } };
}

// 复刻 SDK 的 cb 生成：32 随机字符（uuid 表）嵌入 code 'vfnv46' @ [1,10,12,13,26,31]，再 aes
const CB_ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const CB_POS = [1, 10, 12, 13, 26, 31];
const CB_CODE = 'vfnv46';
function buildCb(code = CB_CODE) {
  const s = [];
  for (let i = 0; i < 32; i++) s[i] = CB_ALPHA[0 | (Math.random() * CB_ALPHA.length)];
  CB_POS.forEach((pos, k) => { s[pos] = code[k]; });
  const plain = s.join('');
  return { plain, cb: aes(plain) };
}

module.exports = { A, U, C, B, FGEN, aes, xorEncode, xorDecode, aesDecrypt, b64DecodePrivate, sample, unique2DArray, fPlain, traceDataPlain, buildData, buildCb, ALPHA, PAD, CB_ALPHA, CB_POS, CB_CODE, SAMPLE_NUM };
