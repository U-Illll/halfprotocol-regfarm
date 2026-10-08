// 从 deob 文件提取 webpack 模块数组并建立 require，导出 aes/编码函数，做样本验证
const fs = require('fs');
const s = fs.readFileSync('round2-static/deob-strings.pretty.js', 'utf8');
const start = s.indexOf('})([') + 4;
const end = s.lastIndexOf(']);');
const modsSrc = s.slice(start, end);
// 模块内部引用 window.encodeURIComponent（UTF-8 编码）等浏览器全局
global.window = {
  encodeURIComponent: encodeURIComponent,
  decodeURIComponent: decodeURIComponent,
  parseInt: parseInt,
  parseFloat: parseFloat,
  Math: Math,
  location: { protocol: 'https:', hostname: 'dun.163.com', href: 'https://dun.163.com/' },
  navigator: { userAgent: 'node' },
};
// mock document：SDK 用 iframe('NECaptchaSafeWindow') 取 safeGlobal（反 hook 探测）
global.document = {
  getElementById: () => null,
  createElement: () => ({ setAttribute() {}, style: {}, contentWindow: undefined }),
  createTextNode: () => ({}),
  body: { appendChild() {}, removeChild() {} },
};
console.log('[i] modules src length =', modsSrc.length);
const mods = new Function('return [' + modsSrc + '];')();
console.log('[i] module count =', mods.length);
const cache = {};
function req(id) {
  if (cache[id]) return cache[id].exports;
  const m = (cache[id] = { exports: {}, id, loaded: false });
  mods[id].call(m.exports, m, m.exports, req);
  m.loaded = true;
  return m.exports;
}
module.exports = { req, mods };
if (require.main === module) {
  const c0 = req(0x1b);
  console.log('[i] module 0x1b consts:', JSON.stringify({SBOX_len:c0.__SBOX__.length, ROUND:c0.__ROUND_KEY__, SEED:c0.__SEED_KEY__, ALPHA:c0.__BASE64_ALPHABET__, PAD:c0.__BASE64_PADDING__}));
  const aesmod = req(0xa);
  console.log('[i] module 0xa keys:', Object.keys(aesmod));
  const b64 = req(0x3a);
  console.log('[i] module 0x3a keys:', Object.keys(b64));
  // 编码器验证
  const test = [0,1,2,3,255,254,253,10,20,30];
  const enc = b64.base64EncodePrivate(test);
  console.log('[i] base64EncodePrivate([0,1,2,3,255,254,253,10,20,30]) =', enc);
  const dec = b64.base64Decode(enc);
  console.log('[i] base64Decode(enc) =', JSON.stringify(dec), 'roundtrip=', JSON.stringify(dec)===JSON.stringify(test));
  // aes 输出长度验证
  for (const t of ['vfnv46_placeholder_32char_str!','hello','a'.repeat(32)]) {
    const e = aesmod.aes(t);
    console.log(`[i] aes(${JSON.stringify(t.slice(0,12))}... len=${t.length}) -> len=${e.length} tail=${JSON.stringify(e.slice(-4))}`);
  }
  // xorEncode 验证
  const xe = aesmod.xorEncode('2a041cf5632744d68ced0787b79abdc7', '3,38');
  console.log('[i] xorEncode(token,"3,38") =', xe, 'len', xe.length);
  console.log('[i] xorDecode back =', JSON.stringify(aesmod.xorDecode('2a041cf5632744d68ced0787b79abdc7', xe)));
}
