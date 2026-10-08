// 逆向 aes()（自定义分组加密）并用真实样本验证 data 生成链
const fs = require('fs');
const { req } = require('./extract-crypto.js');

const U = req(0x1a);                 // bytes utils: stringToBytes/xors/shift/shifts/bytesToString/...
const C = req(0x1b);                 // __SBOX__ / __ROUND_KEY__ / __SEED_KEY__ / __BASE64_*
const B = req(0x3a);                 // base64EncodePrivate / base64Encode / base64Decode
const A = req(0xa);                  // aes / xorEncode / xorDecode

const SBOX = U.hexsToBytes(C.__SBOX__).map((b) => b & 0xff);  // 256 字节（hexsToBytes 返回有符号，需归一无符号）
const INV = new Array(256);
for (let i = 0; i < 256; i++) INV[SBOX[i]] = i;
const S = (arr) => arr.map((b) => SBOX[0x10 * ((b >>> 4) & 0xf) + (0xf & b)]);
const Sinv = (arr) => arr.map((b) => INV[b & 0xff]);

// ---- 私有 base64 解码（表 __BASE64_ALPHABET__，padding '7'）----
const ALPHA = C.__BASE64_ALPHABET__, PAD = C.__BASE64_PADDING__;
function b64DecodePrivate(str) {
  const cut = str.indexOf(PAD);
  const body = cut === -1 ? str : str.slice(0, cut);
  const out = [];
  let i = 0;
  for (; i + 4 <= body.length; i += 4) {
    const n = (ALPHA.indexOf(body[i]) << 18) | (ALPHA.indexOf(body[i+1]) << 12) | (ALPHA.indexOf(body[i+2]) << 6) | ALPHA.indexOf(body[i+3]);
    out.push((n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
  }
  const rem = body.length - i;
  if (rem === 2) { const n = (ALPHA.indexOf(body[i]) << 12) | (ALPHA.indexOf(body[i+1]) << 6); out.push((n >>> 10) & 0xff); }
  else if (rem === 3) { const n = (ALPHA.indexOf(body[i]) << 12) | (ALPHA.indexOf(body[i+1]) << 6) | ALPHA.indexOf(body[i+2]); out.push((n >>> 10) & 0xff, (n >>> 2) & 0xff); }
  return out;
}
// 与 SDK 的 base64EncodePrivate 做一次往返自检
{
  const raw = b64DecodePrivate(B.base64EncodePrivate([1,2,3,4,5,250,251,252]));
  const ok = JSON.stringify(raw) === JSON.stringify([1,2,3,4,5,250,251,252]);
  console.log('[check] private b64 roundtrip:', ok, JSON.stringify(raw));
}

// ---- 轮函数（复刻 _0x34ece2，ROUND_KEY 驱动）----
function buildOps(roundKeyHex) {
  const ops = [];
  for (let p = 0; p < roundKeyHex.length; p += 4) {
    const seg = roundKeyHex.substring(p, p + 4);
    ops.push({ kind: U.hexToByte(seg.substring(0, 2)), arg: U.hexToByte(seg.substring(2, 4)) });
  }
  return ops;
}
// 正向（加密时使用）
function opFwd(o, arr) {
  let b = U.toByte(o.arg);
  if (o.kind === 0x03) return arr.map((v) => U.xor(v, b++));   // xor, 参数递增
  if (o.kind === 0x02) return arr.map((v) => U.shift(v, b));   // 加, 参数固定
  if (o.kind === 0x06) return arr.map((v) => U.shift(v, b--)); // 加, 参数递减
  if (o.kind === 0x05) return arr.map((v) => U.xor(v, b--));   // xor, 参数递减
  throw new Error('unknown op kind 0x' + o.kind.toString(16));
}
// 逆向
function opInv(o, arr) {
  let b = U.toByte(o.arg);
  if (o.kind === 0x03) return arr.map((v) => U.xor(v, b++));
  if (o.kind === 0x02) return arr.map((v) => U.shift(v, -b));
  if (o.kind === 0x06) return arr.map((v) => U.shift(v, -b--));
  if (o.kind === 0x05) return arr.map((v) => U.xor(v, b--));
  throw new Error('unknown op kind');
}
const F = (ops, block) => ops.reduce((acc, o) => opFwd(o, acc), block);
const Finv = (ops, block) => [...ops].reverse().reduce((acc, o) => opInv(o, acc), block);

// ---- rk 派生（复刻 _0x37afb7 + _0x17d8ba）----
const expand64 = (arr) => {
  if (!arr.length) return new Array(64).fill(0);
  if (arr.length >= 64) return arr.slice(0, 64);
  const out = [];
  for (let i = 0; i < 64; i++) out[i] = arr[i % arr.length];
  return out;
};
function deriveRK(iv4) {
  const seed = expand64(U.stringToBytes(C.__SEED_KEY__));
  const ivE = expand64(iv4);
  return U.xors(seed, ivE);
}
const subShift = (arr, key) => arr.map((v, i) => U.shift(v, -key[i % key.length]));

// ---- aes 解密（复刻 _0x3ebd00 的逆）----
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
    let t = Sinv(Sinv(cBlk));
    let a = U.xors(t, prev);          // 撤销 xors(..., prev)
    let y = subShift(a, prev);        // 撤销 shifts(..., prev)
    let f = U.xors(y, rk);            // 撤销 xors(..., rk)
    const P = Finv(ops, f);
    plain.push(...P);
    prev = cBlk;
  }
  // 缓冲布局：plain[0..L) = data||crcHex(8B)，plain[60..64) = intToBytes(L)（若只有 1 块）
  const tail = plain.slice(-4);
  const L = ((tail[0] & 0xff) << 24 >>> 0) + ((tail[1] & 0xff) << 16) + ((tail[2] & 0xff) << 8) + (tail[3] & 0xff);
  const body = plain.slice(0, Math.max(0, L));
  const data = body.slice(0, Math.max(0, L - 8));
  const crc = body.slice(L - 8, L);
  let text;
  try { text = U.bytesToString(data); } catch (e) { text = '[bytesToString failed] ' + data.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join(''); }
  return { text, len: L, iv, crc, raw: data };
}

// ---- 自检：加密 → 解密 ----
{
  const cases = ['hello world', 'vfnv46' + 'A'.repeat(26), 'x'.repeat(120)];
  for (const c of cases) {
    const enc = A.aes(c);
    const dec = aesDecrypt(enc);
    console.log(`[check] roundtrip len=${c.length}: ${dec.text === c ? 'OK' : 'FAIL'} (enc=${enc.length}ch, decLen=${dec.len}, text=${JSON.stringify(dec.text.slice(0, 24))})`);
  }
}

// ---- 真实样本验证（两层：aes 解密 → xorDecode(token, ·)）----
const sample = JSON.parse(fs.readFileSync('out/artifacts/check2-data-sample.json', 'utf8'));
const url = fs.readFileSync('out/artifacts/check2-request-full.txt', 'utf8');
const cb = decodeURIComponent(url.match(/[?&]cb=([^&]*)/)[1]);
const out = {};
for (const k of Object.keys(sample)) {
  if (!sample[k]) { out[k] = '(empty)'; continue; }
  try {
    const r = aesDecrypt(sample[k]);
    out[k] = { text: r.text.length > 200 ? r.text.slice(0, 200) + `...(共${r.text.length}字)` : r.text, plainLen: r.len, iv: r.iv.map(b=>b&0xff) };
  } catch (e) { out[k] = 'ERR ' + e.message; }
}
const TOKEN = decodeURIComponent(url.match(/[?&]token=([^&]*)/)[1]);
console.log('[i] token =', TOKEN);
const xorLayer = {};
for (const k of ['d','p','f','ext']) {
  if (!sample[k]) continue;
  try {
    const inner = aesDecrypt(sample[k]).text;
    let out2;
    try { out2 = A.xorDecode(TOKEN, inner); } catch (e) { out2 = 'ERR ' + e.message; }
    xorLayer[k] = { aesPlain: inner.length > 160 ? inner.slice(0,160)+`...(共${inner.length}字)` : inner, xorDecoded: out2.length > 220 ? out2.slice(0,220)+`...(共${out2.length}字)` : out2 };
  } catch (e) { xorLayer[k] = 'ERR ' + e.message; }
}
// d 特例：aes 明文 = 各轨迹点 xorEncode(token,·) 以 ':' 连接
if (sample.d) {
  const inner = aesDecrypt(sample.d).text;
  const segs = inner.split(':');
  const pts = segs.map((sg) => { try { return A.xorDecode(TOKEN, sg); } catch (e) { return 'ERR'; } });
  console.log('\n===== d 轨迹分段解码 =====');
  console.log('段数:', segs.length, '| 前 8 段:', JSON.stringify(segs.slice(0,8)));
  console.log('解出轨迹点:', JSON.stringify(pts.slice(0,10)), '...');
}
console.log('\n===== 第二层 xorDecode(token, ·) =====');
console.log(JSON.stringify(xorLayer, null, 1));

try {
  const r = aesDecrypt(cb);
  const pos = [1, 10, 12, 13, 26, 31];
  const chars = pos.map((p) => r.text.charAt(p)).join('');
  out.cb = { text: r.text, len: r.text.length, codeAtPos: chars, expectCode: 'vfnv46', match: chars === 'vfnv46' };
} catch (e) { out.cb = 'ERR ' + e.message; }

console.log('\n===== 样本字段解密结果 =====');
console.log(JSON.stringify(out, null, 1));
