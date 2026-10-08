#!/usr/bin/env node
/**
 * round3-aux/synth.js —— 易盾滑块（jigsaw）轨迹合成器
 *
 * 输入：轨迹参数（点数 / 时长 / 幅度 / 抖动 / 种子 / token）
 * 输出：d / f / ext（+ 可选 p）三个字段的 **明文**，与加密器对接即得线上字段值；
 *        亦可直接 --encrypt 输出 aes 后的字段值。
 *
 * 用法（CWD = agent-易盾/）：
 *   node round3-aux/synth.js --points 31 --duration 700 --dx 240 --seed 7 \
 *        --token 2a041cf5632744d68ced0787b79abdc7 --encrypt
 *   node round3-aux/synth.js --compare check2      # 与真实样本的 47 维统计并排对比
 *
 * 作为库：
 *   const { synth } = require('./synth.js');
 *   const r = synth({points:31, duration:700, dx:240, token:'...', seed:7});
 *   r.plain.d / r.plain.f / r.plain.ext   // 明文（直接喂给 aes/xorEncode 层）
 */
const fs = require('fs');
const L = require('./yd-lib.js');

/* ------------------------- PRNG（mulberry32，可复现） ------------------------- */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------- 轨迹生成 ------------------------- */
/**
 * @param {object} o
 *  points      点数（traceData.length），默认 31
 *  duration   首个点到最后一个点的总时长 ms，默认 700
 *  dx         水平总位移（px，整数），默认 240
 *  jitterY    y 方向抖动幅度（px），默认 1.5
 *  jitterT    时间抖动比例，默认 0.25
 *  profile    'human'（默认：钟形速度曲线）| 'linear' | 'sample'（复刻采集样本的等距 25px / ~25ms 风格）
 *  curve      速度曲线陡度（仅 human）：1=钟形（默认）；0.3=接近匀速
 *  pauses     [[index, extraMs], ...] 在索引 index 处插入停顿（Δts 变大），模拟真人犹豫
 *  startDelay 首点 Δt（相对 mousedown 的"反应时间"），默认 120ms（真样本 132~514ms）
 *  mouseDownCounts ext 第 1 个数字，默认 1
 *  flag       isTrusted 编码：1=真实事件（默认），2=脚本派发
 *  seed       随机种子，默认 1
 * @returns {{atoms:number[][], t:number[], dxArr:number[], dyArr:number[], dtArr:number[]}}
 */
function genTrace(o = {}) {
  const points = o.points ?? 31;
  const duration = o.duration ?? 700;
  const totalDx = o.dx ?? 240;
  const jitterY = o.jitterY ?? 1.0;
  const jitterT = o.jitterT ?? 0.25;
  const profile = o.profile ?? 'human';
  const curve = o.curve ?? 1;
  const pauses = o.pauses ?? null;
  const startDelay = o.startDelay ?? 120;
  const flag = o.flag ?? 1;
  const rnd = mulberry32(o.seed ?? 1);
  const n = Math.max(3, points | 0);

  // 1) 位移曲线 s(u)∈[0,1]（单调不减）
  const s = [];
  if (profile === 'sample' || profile === 'linear') {
    for (let i = 0; i < n; i++) s.push(i / (n - 1));
  } else {
    // 钟形速度权重 w(u) → 累积积分 s(u)（起步慢、中段快、收尾慢）；curve 控制陡峭度
    const w = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      w.push(0.12 * (1 - curve * 0.5) + curve * Math.pow(Math.sin(Math.PI * u), 1.4));
    }
    const W = w.reduce((a, b) => a + b, 0);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      acc += w[i];
      s.push(acc / W);
    }
  }

  // 2) dx：累计位移（相对起点，px 整数），强制单调不减
  const dxArr = [];
  let maxSoFar = 0;
  for (let i = 0; i < n; i++) {
    let v = Math.round(totalDx * s[i] + (rnd() - 0.5) * (profile === 'sample' ? 3 : 0.8));
    // SDK 约束：onMouseMove 只有在 clientX-startX > 3 时才产出第一个点 → 首点 dx ≥ 4
    if (i === 0 && v < 4) v = Math.min(4, totalDx);
    if (v < maxSoFar) v = maxSoFar;
    if (i === 0) v = Math.max(1, v);
    maxSoFar = v;
    dxArr.push(v);
  }
  dxArr[n - 1] = totalDx; // 末点精确落到目标位移

  // 3) dy：低频抖动（正弦 + 噪声），幅度 jitterY，末点回到 ±2px 内
  const dyArr = [];
  const phase = rnd() * Math.PI * 2;
  const freq = profile === 'sample' ? 4 : 1 + rnd() * 2;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const base = Math.sin(phase + freq * Math.PI * u) * jitterY * (1 - 0.7 * u);
    const noise = (rnd() - 0.5) * jitterY;
    dyArr.push(Math.round(base + noise));
  }
  dyArr[0] = Math.round((rnd() - 0.5) * 2);
  dyArr[n - 1] = Math.max(-2, Math.min(2, dyArr[n - 1]));

  // 4) Δt：基准间隔 + 抖动，严格递增（毫秒整数；同 ms 的点会被 unique2DArray 丢弃）
  const base = profile === 'sample' ? (o.intervalMs ?? 25) : duration / (n - 1);
  const pauseMap = new Map(Array.isArray(pauses) ? pauses : []);
  const dtArr = [startDelay];
  for (let i = 1; i < n; i++) {
    const jit = 1 + (rnd() - 0.5) * 2 * jitterT;
    let step = Math.max(1, Math.round(base * jit)) + (pauseMap.get(i) || 0);
    let t = dtArr[i - 1] + step;
    if (t <= dtArr[i - 1]) t = dtArr[i - 1] + 1; // 严格递增
    dtArr.push(t);
  }

  const atoms = [];
  for (let i = 0; i < n; i++) atoms.push([dxArr[i], dyArr[i], dtArr[i], flag]);
  return { atoms, dxArr, dyArr, dtArr };
}

/* ------------------------- 合成（核心接口） ------------------------- */
/**
 * @returns {{
 *   atoms, plain:{d,f,ext,p?}, stats:{label,value,meaning}[], traceData, pts,
 *   selfCheck:object, encrypted?:{d,f,ext}
 * }}
 */
function synth(o = {}) {
  const token = o.token || null;
  const gen = genTrace(o);
  const atoms = gen.atoms;

  const d = L.buildD(token || 'TOKEN_PLACEHOLDER_32CHARS_ABCDEF', atoms);
  const f = L.buildF(atoms);
  const traceDataLen = atoms.length;
  const extPlain = L.buildExt(o.mouseDownCounts ?? 1, { length: traceDataLen });

  const plain = { d: d.plain, f: f.plain, ext: extPlain };

  // 可选 p：复刻 SDK 的浮点写法  (parseInt(left,10)/width)*100 + ''
  if (o.jigsawLeftPx != null && o.width != null) {
    plain.p = (parseInt(o.jigsawLeftPx, 10) / o.width) * 100 + '';
  }

  const stats = f.stats.map((v, i) => ({
    idx: i + 1,
    label: L.F_FIELD_LABELS[i],
    value: v,
    meaning: L.F_FIELD_NAMES[i][1],
  }));

  // 自洽性自检
  const u = f.uniqAtoms;
  const dSegCount = d.pts.length;
  const selfCheck = {
    dtStrictlyIncreasing: gen.dtArr.every((v, i) => i === 0 || v > gen.dtArr[i - 1]),
    uniqByDt: u.length,
    atomCount: atoms.length,
    dSegCount,
    dSegEqualsMinN50: dSegCount === Math.min(atoms.length, L.SAMPLE_NUM),
    extLenMatchesTraceData: plain.ext === (o.mouseDownCounts ?? 1) + ',' + atoms.length,
    fStatCount: f.statCount,
    fPointCountMatches: f.stats[4] === u.length,
    uniqXLessOrEqualN: f.stats[0] <= u.length,
    allIsTrusted1: atoms.every((p) => p[3] === 1),
    firstPointDxGt3: gen.dxArr[0] > 3,
    dxMonotonicNonDecreasing: gen.dxArr.every((v, i) => i === 0 || v >= gen.dxArr[i - 1]),
    // 与 SDK 原函数交叉验证
    sdkMatches: L.MOTION(u).join(',') === f.plain,
    noNaNInF: !plain.f.includes('NaN'),
  };

  const out = { atoms, plain, stats, traceData: d.traceData, pts: d.pts, selfCheck };

  if (o.encrypt) {
    const enc = L.encodeFields(token, { dPlain: plain.d, fPlain: plain.f, extPlain: plain.ext });
    out.encrypted = enc;
    if (plain.p) {
      // p = aes(xorEncode(token, pPlain))
      out.encrypted.p = L.aes(L.xorEncode(token, plain.p));
    }
  }
  return out;
}

/* ------------------------- CLI ------------------------- */
function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    const num = typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : null;
    o[k] = num === null ? v : num;
  }
  return o;
}

function medianInterval(atoms) {
  const ds = [];
  for (let i = 1; i < atoms.length; i++) ds.push(atoms[i][2] - atoms[i - 1][2]);
  ds.sort((x, y) => x - y);
  return ds.length ? ds[Math.floor(ds.length / 2)] : 25;
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.compare) {
    // 与真实样本的 47 维统计对比
    const name = a.compare;
    const paths = {
      check2: ['out/artifacts/check2-data-sample.json', 'out/artifacts/check2-request-full.txt'],
      check1: ['out/artifacts/check-data-sample.json', 'out/artifacts/check-request-full.txt'],
      pass1: ['round2-hook/samples/pass1/check-sample.json', null],
      pass2: ['round2-hook/samples/pass2/check-sample.json', null],
    }[name];
    if (!paths) throw new Error('unknown sample ' + name);
    let token, data;
    if (paths[1]) {
      data = JSON.parse(fs.readFileSync(paths[0], 'utf8'));
      const url = fs.readFileSync(paths[1], 'utf8');
      token = decodeURIComponent(url.match(/[?&]token=([^&]*)/)[1]);
    } else {
      const j = JSON.parse(fs.readFileSync(paths[0], 'utf8'));
      token = j.query.token;
      data = JSON.parse(j.query.data);
    }
    const atoms = L.aesDecrypt(data.d)
      .text.split(':')
      .map((s) => L.xorDecode(token, s).split(',').map(Number));
    const sampleStats = L.motionStats(L.unique2DArray(atoms, 2));
    const mi = medianInterval(atoms);
    const mine = synth({
      points: atoms.length,
      duration: atoms[atoms.length - 1][2],
      dx: atoms[atoms.length - 1][0],
      token,
      seed: a.seed ?? 7,
      jitterY: a.jitterY ?? 1.0,
      profile: a.profile ?? 'sample',
      startDelay: atoms[0][2],
      intervalMs: mi,
      pauses:
        a.pauses === true
          ? atoms.slice(1).map((p, i) => {
              const d = p[2] - atoms[i][2];
              return d > 2 * mi ? [i + 1, d - mi] : null;
            }).filter(Boolean)
          : null,
    });
    console.log(`对比样本 ${name}：点数 ${atoms.length}，时长 ${atoms[atoms.length - 1][2]}ms，位移 ${atoms[atoms.length - 1][0]}px`);
    console.log('idx  字段        样本值        合成值');
    for (let i = 0; i < sampleStats.length; i++) {
      const s = String(sampleStats[i]).padEnd(12);
      const m = String(mine.stats[i].value).padEnd(12);
      const mark = sampleStats[i] === mine.stats[i].value ? '' : '  <-- 差异';
      console.log(`${String(i + 1).padStart(3)}  ${L.F_FIELD_LABELS[i].padEnd(10)} ${s} ${m}${mark}`);
    }
    console.log('\n合成字段自检:', JSON.stringify(mine.selfCheck, null, 1));
    return;
  }

  const token = a.token && a.token !== true ? a.token : null;
  const r = synth({
    points: a.points ?? 31,
    duration: a.duration ?? 700,
    dx: a.dx ?? 240,
    jitterY: a.jitterY ?? 1.5,
    jitterT: a.jitterT ?? 0.25,
    profile: a.profile ?? 'human',
    mouseDownCounts: a.mouseDownCounts ?? 1,
    flag: a.flag ?? 1,
    seed: a.seed ?? 1,
    token,
    encrypt: !!a.encrypt && !!token,
    width: a.width ?? (a.left != null ? 320 : undefined),
    jigsawLeftPx: a.left,
  });
  const out = {
    params: {
      points: r.atoms.length,
      duration: r.atoms[r.atoms.length - 1][2],
      dx: r.atoms[r.atoms.length - 1][0],
      token: token || '(none)',
    },
    plain: r.plain,
    stats: r.stats,
    selfCheck: r.selfCheck,
    atoms: r.atoms,
    encrypted: r.encrypted,
  };
  console.log(JSON.stringify(out, null, 1));
}

if (require.main === module) main();
module.exports = { synth, genTrace };
