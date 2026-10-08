// 字符串表解码器：提取 a0_0x3d6e 数组 + a0_0x1e60 解码函数，批量解密
const fs = require('fs');
const vm = require('vm');
const path = process.argv[2] || 'sdk/core-optimi.m25b40.v2.28.5.min.js';
const outdir = process.argv[3] || 'round2-static';
const s = fs.readFileSync(path, 'utf8');

// 1) 数组边界
const arrStart = s.indexOf('a0_0x3d6e=[');
const arrEnd = s.indexOf('];', arrStart) + 2;
// 2) 解码函数结束：到 "window['NECaptcha']" 之前
const wIdx = s.indexOf("window['NECaptcha']");
const prefix = s.slice(0, wIdx);
console.log('[i] arrStart=%d arrEnd=%d prefixLen=%d', arrStart, arrEnd, prefix.length);

// 3) 在 vm 中执行 prefix，取出 a0_0x1e60（同时得到原始数组）
const ctx = { window: {}, document: undefined, self: undefined };
vm.createContext(ctx);
const src = prefix + '\n;return {dec:a0_0x1e60, arr:a0_0x3d6e};})()';
try {
  ctx.__OUT = vm.runInContext(src, ctx, { timeout: 60000 });
} catch (e) {
  console.log('[!] vm error:', e.message);
}
const dec = ctx.__OUT && ctx.__OUT.dec;
const arr = ctx.__OUT && ctx.__OUT.arr;
if (!dec || !arr) { console.error('FAILED to extract decoder'); process.exit(1); }
console.log('[i] array length = %d', arr.length);

// 4) 逐索引解码
const map = {};
const fail = [];
const arrLen = ctx.window.__arrLen || arr.length;
for (let i = 0; ; i++) {
  if (i > 20000) break;
  let v;
  try { v = dec(i); } catch (e) { v = undefined; }
  if (v === undefined) { fail.push(i); if (fail.length > 50) break; continue; }
  map[i] = v;
}
// 探测真实数组长度
let realLen = 0;
for (let i = 0; i < arr.length; i++) if (map[i] !== undefined) realLen = i + 1;
console.log('[i] decoded %d entries (array len %d), failures: %s', Object.keys(map).length, arr.length, fail.slice(0,10).join(','));

// 5) 输出映射与统计
fs.writeFileSync(outdir + '/string-map.json', JSON.stringify(map, null, 0));
const inv = {};
let dupCount = 0;
for (const [k, v] of Object.entries(map)) { if (inv[v] !== undefined) dupCount++; else inv[v] = k; }
fs.writeFileSync(outdir + '/string-inverse.json', JSON.stringify(inv, null, 0));
console.log('[i] unique strings = %d, duplicates = %d', Object.keys(inv).length, dupCount);
// 样例
const sample = Object.entries(map).slice(0, 25).map(([k,v])=>`  [${k}] ${JSON.stringify(v)}`).join('\n');
console.log('[i] sample:\n' + sample);
