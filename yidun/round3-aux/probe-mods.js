// 探测 webpack 模块 0x38 / 0x3 / 0x5 的源码（用于定位 _0x318cde 语义）
const { mods } = require('../round2-static/extract-crypto.js');

const targets = process.argv.slice(2).map((x) => parseInt(x, 16));
console.log('module count =', mods.length);
for (const id of targets) {
  const src = mods[id] ? mods[id].toString() : '(none)';
  console.log(`\n===== module 0x${id.toString(16)} ===== len=${src.length}`);
  console.log(src);
}
