/**
 * round3-aux/verify-fields.js
 * 对全部真实样本逐字段验证 d/f/ext 的明文构造规则：
 *   1) dec(y) → 层1 aes → 层2 xor / 分段
 *   2) 用「样本的 d 解出的轨迹点」复算 f 明文 → 与样本 f 明文逐字符比较
 *   3) 复算 d（重新 xorEncode 每点 + sample）→ 与样本 d 的 aes 明文比较
 *   4) ext 自洽（traceData.length == d 段数 == f 的点数）
 * 运行（CWD = agent-易盾/）： node round3-aux/verify-fields.js
 */
const fs = require('fs');
const L = require('./yd-lib.js');

function loadSamples() {
  const out = [];
  // round2 out/artifacts （31 点样本，check 通过）
  for (const [name, dataFile, urlFile] of [
    ['check2', 'out/artifacts/check2-data-sample.json', 'out/artifacts/check2-request-full.txt'],
    ['check1', 'out/artifacts/check-data-sample.json', 'out/artifacts/check-request-full.txt'],
  ]) {
    if (!fs.existsSync(dataFile) || !fs.existsSync(urlFile)) continue;
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const url = fs.readFileSync(urlFile, 'utf8').trim();
    const token = decodeURIComponent(url.match(/[?&]token=([^&]*)/)[1]);
    out.push({ name, token, data, raw: url });
  }
  // round2-hook samples
  for (const dir of ['pass1', 'pass2', 'dry1']) {
    const p = `round2-hook/samples/${dir}/check-sample.json`;
    if (!fs.existsSync(p)) continue;
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const q = j.query || {};
    if (!q.data) continue;
    out.push({ name: dir, token: q.token, data: JSON.parse(q.data), raw: j.url, status: j.status });
  }
  return out;
}

function decodeFields(s) {
  const { token, data } = s;
  const r = {};
  const dAes = L.aesDecrypt(data.d);
  const segs = dAes.text.split(':');
  const pts = segs.map((x) => L.xorDecode(token, x));
  const atoms = pts.map((x) => x.split(',').map(Number));
  const fAes = L.aesDecrypt(data.f);
  const fPlain = L.xorDecode(token, fAes.text);
  let extPlain = null;
  try {
    extPlain = L.xorDecode(token, L.aesDecrypt(data.ext).text);
  } catch (e) {
    extPlain = 'ERR ' + e.message;
  }
  let pPlain = null;
  try {
    pPlain = L.xorDecode(token, L.aesDecrypt(data.p).text);
  } catch (e) {
    pPlain = 'ERR ' + e.message;
  }
  return { dAes, segs, pts, atoms, fAes, fPlain, extPlain, pPlain };
}

/* ---------- 复算 ---------- */
function recalc(s, d) {
  const token = s.token;
  const atoms = d.atoms;
  // d 复算：重新 xorEncode 每个点 → sample → join(':')
  const traceData = atoms.map((p) => L.xorEncode(token, p.join(',')));
  const pts2 = L.sample(traceData, L.SAMPLE_NUM);
  const dPlain = pts2.join(':');
  // f 复算
  const u = L.unique2DArray(atoms, 2);
  const stats = L.motionStats(u);
  const fPlain = stats.join(',');
  const statsSdk = L.MOTION(u).join(',');
  // ext 复算
  const mdc = d.extPlain ? d.extPlain.split(',')[0] : '?';
  const extPlain = mdc + ',' + traceData.length;
  return {
    dPlain,
    dEq: dPlain === d.dAes.text,
    segsEq: traceData.length === d.segs.length,
    fPlain,
    fEq: fPlain === d.fPlain,
    fEqSdk: statsSdk === d.fPlain,
    myEqSdk: statsSdk === fPlain,
    extPlain,
    extEq: extPlain === d.extPlain,
    uniqLen: u.length,
    statCount: stats.length,
  };
}

/* ---------- 解释表 ---------- */
function explainTable(s, d, rc) {
  const atoms = d.atoms;
  const u = L.unique2DArray(atoms, 2);
  const rows = [];
  const vals = rc.fPlain.split(',');
  for (let i = 0; i < L.F_FIELD_LABELS.length; i++) {
    rows.push({ idx: i + 1, field: L.F_FIELD_LABELS[i], value: vals[i], meaning: L.F_FIELD_NAMES[i][1] });
  }
  const dts = atoms.map((p) => p[2]);
  const dxs = atoms.map((p) => p[0]);
  const flags = atoms.map((p) => p[3]);
  const flagCount = {};
  flags.forEach((f) => (flagCount[f] = (flagCount[f] || 0) + 1));
  return {
    rows,
    traceStats: {
      atomCount: atoms.length,
      uniqByDt: u.length,
      dtFirstLast: [dts[0], dts[dts.length - 1]],
      dtMonotonicStrict: dts.every((v, i) => i === 0 || v > dts[i - 1]),
      dtDupCount: atoms.length - u.length,
      dxRange: [Math.min(...dxs), Math.max(...dxs)],
      dxMonotonicNonDecreasing: dxs.every((v, i) => i === 0 || v >= dxs[i - 1]),
      flagCount,
      isTrustedAllOne: flags.every((v) => v === 1),
    },
  };
}

const samples = loadSamples();
const reportLines = [];
const summary = [];
for (const s of samples) {
  const d = decodeFields(s);
  const rc = recalc(s, d);
  const ex = explainTable(s, d, rc);
  const head = `\n================================================================\n样本 ${s.name}  token=${s.token}  status=${s.status ?? '(n/a)'}\n================================================================`;
  console.log(head);
  console.log(`d: aes 明文 ${d.dAes.text.length} 字 / ${d.segs.length} 段；点数=${d.atoms.length}`);
  console.log(`  d 明文前 60 字: ${d.dAes.text.slice(0, 60)}`);
  console.log(`  解出点(前 5): ${JSON.stringify(d.pts.slice(0, 5))}`);
  console.log(`  复算 d == 样本: ${rc.dEq}   段数一致: ${rc.segsEq}`);
  console.log(`f: aes 明文 ${d.fAes.text.length} 字 → 二层明文 ${d.fPlain.length} 字 / ${rc.statCount} 个数字`);
  console.log(`  复算 f == 样本: ${rc.fEq}   （SDK 原函数输出 == 样本: ${rc.fEqSdk}；我的复刻 == SDK: ${rc.myEqSdk}）`);
  console.log(`ext: 明文 = "${d.extPlain}"   复算 == 样本: ${rc.extEq}`);
  console.log(`p  : 明文 = "${d.pPlain}"`);
  console.log(`轨迹: 点数=${ex.traceStats.atomCount}，按 Δt 去重后=${ex.traceStats.uniqByDt}（丢 ${ex.traceStats.dtDupCount}）`);
  console.log(
    `      Δt 严格递增=${ex.traceStats.dtMonotonicStrict}；dx 单调不减=${ex.traceStats.dxMonotonicNonDecreasing}；isTrusted 全 1=${ex.traceStats.isTrustedAllOne}；flag 分布=${JSON.stringify(ex.traceStats.flagCount)}`,
  );
  console.log('  —— f 明文 47 项解释表 ——');
  for (const row of ex.rows) console.log(`   [${String(row.idx).padStart(2)}] ${row.value.padEnd(10)} ${row.field}`);
  reportLines.push(head, JSON.stringify({ name: s.name, rc, traceStats: ex.traceStats, fPlain: d.fPlain, rows: ex.rows }, null, 1));
  summary.push({
    sample: s.name,
    points: ex.traceStats.atomCount,
    uniqByDt: ex.traceStats.uniqByDt,
    fChars: d.fPlain.length,
    fNums: rc.statCount,
    dRecalc: rc.dEq,
    fRecalc: rc.fEq,
    extRecalc: rc.extEq,
    extPlain: d.extPlain,
    pPlain: d.pPlain,
    head5: rc.fPlain.split(',').slice(0, 5).join(','),
  });
}

console.log('\n=============== 汇总 ===============');
console.table ? console.table(summary) : console.log(summary);

// sample() 采样点数实验（SDK 原函数 vs 复刻）
console.log('\n=============== sample(traceData,50) 行为实测 ==============');
for (const len of [31, 50, 51, 60, 99, 100, 137, 200]) {
  const arr = Array.from({ length: len }, (_, i) => i);
  const a = L.UTILS.sample(arr, L.SAMPLE_NUM);
  const b = L.sample(arr, L.SAMPLE_NUM);
  console.log(
    `len=${String(len).padStart(3)} → sdk 输出 ${String(a.length).padStart(3)} 点, 复刻 ${String(b.length).padStart(3)} 点, 一致=${JSON.stringify(a) === JSON.stringify(b)}` +
      (len === 137 ? `\n        137 点时的选中索引: ${JSON.stringify(a)}` : ''),
  );
}
fs.writeFileSync('round3-aux/verify-output.json', JSON.stringify({ summary, detail: reportLines }, null, 1));
console.log('\n[ok] 详见 round3-aux/verify-output.json');
