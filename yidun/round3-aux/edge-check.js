// 边界行为核验：n=2 与 n=3 时 f 明文长什么样（module 0x38 的早退分支）
const L = require('./yd-lib.js');
const mk = (n) => Array.from({ length: n }, (_, i) => [i + 5, 0, 20 + i * 20, 1]);
for (const n of [2, 3, 4]) {
  const atoms = mk(n);
  const raw = L.MOTION(atoms);
  console.log(`n=${n}: module0x38 返回 ${Array.isArray(raw[0]) ? '数组套数组(早退分支)' : raw.length + ' 个数字'}`);
  console.log(`   f 明文 = "${L.buildF(atoms).plain}"`);
  console.log(`   47 项统计 = ${JSON.stringify(L.buildF(atoms).stats.join(','))}`.slice(0, 220));
}
