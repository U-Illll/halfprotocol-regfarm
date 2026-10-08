// 把 a0_0x1e60(0xNNN) 全部替换为明文字符串，输出 deob-strings.js
const fs = require('fs');
const s = fs.readFileSync(process.argv[2] || 'sdk/core-optimi.m25b40.v2.28.5.min.js', 'utf8');
const map = JSON.parse(fs.readFileSync(process.argv[3] || 'round2-static/string-map.json', 'utf8'));
let hits = 0, miss = 0;
const out = s.replace(/a0_0x1e60\(\s*(0x[0-9a-fA-F]+|\d+)\s*\)/g, (m, num) => {
  const v = map[String(parseInt(num, 16))];
  if (v === undefined) { miss++; return m; }
  hits++;
  return JSON.stringify(v);
});
console.log('[i] replaced %d refs, missed %d', hits, miss);
// 剩余未替换的（含非数字参数）
const rest = out.match(/a0_0x1e60\(/g);
console.log('[i] remaining a0_0x1e60( occurrences: %d', rest ? rest.length : 0);
fs.writeFileSync(process.argv[4] || 'round2-static/deob-strings.js', out);
console.log('[i] written', process.argv[4] || 'round2-static/deob-strings.js', out.length, 'bytes');
