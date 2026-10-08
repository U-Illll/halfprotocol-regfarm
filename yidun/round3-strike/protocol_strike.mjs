// protocol_strike.mjs — 易盾滑块「协议直打」端到端管线（不拖动鼠标）
// 流程：getconf → v3/get(取图+token) → 下载图 → 离线缺口检测 → 本地合成轨迹/构造 data+cb → v3/check → 打印 result
// 用法：node protocol_strike.mjs [runName]      （默认 runs/<UTC时间戳>）
// 注意：每 token 最多提交 2 次（服务端限制）；本脚本每次运行只提交 1 次。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);

const AGENT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(AGENT); // lib_yd / gap_detect 依赖相对路径
const L = require(path.join(AGENT, 'round3-strike/lib_yd.cjs'));
const { detectGap } = require(path.join(AGENT, 'round3-strike/gap_detect.cjs'));

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0';
const ID = '07e2387ab53a4d6f930b8d9a9be71bdf'; // dun.163.com/trial/jigsaw 固定 bid
const WIDTH = 320;
const VERSION = '2.28.5';

const runName = process.argv[2] || ('r' + Date.now());
const RUN = path.resolve(AGENT, 'round3-strike/runs', runName);
fs.mkdirSync(path.join(RUN, 'img'), { recursive: true });
const LOG = [];
function log(s) {
  const line = `[${new Date().toISOString()}] ${s}`;
  console.log(line);
  LOG.push(line);
  fs.writeFileSync(path.join(RUN, 'log.txt'), LOG.join('\n') + '\n');
}
function save(name, obj) { fs.writeFileSync(path.join(RUN, name), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 1)); }
function curl(url, opts = {}) {
  const t0 = Date.now();
  const args = ['-s', '-m', '30', '-w', '\n__HTTP:%{http_code}__', '-H', 'User-Agent: ' + UA, '-H', 'Referer: https://dun.163.com/'];
  if (opts.raw) { args.push('-o', opts.raw); }
  args.push(url);
  try {
    const out = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    const m = out.match(/__HTTP:(\d+)__/);
    return { body: opts.raw ? '' : out.replace(/\n?__HTTP:\d+__\s*$/, ''), status: m ? +m[1] : 0, ms: Date.now() - t0 };
  } catch (e) { return { body: 'ERR ' + e.message, status: -1, ms: Date.now() - t0 }; }
}
const jsonp = (s) => { const i = s.indexOf('('), j = s.lastIndexOf(')'); return JSON.parse(s.slice(i + 1, j)); };
const hex32 = () => Array.from({ length: 32 }, () => '0123456789abcdef'[0 | (Math.random() * 16)]).join('');

// ---------- 1. getconf（dt 传空 → 服务端签发新 dt；可用 YD_DT 复用已知 dt） ----------
const FIXED_DT = process.env.YD_DT || '';
const getconfCb = '__JSONP_' + Math.random().toString(36).slice(2, 9) + '_0';
const getconfUrl = 'https://c.dun.163.com/api/v2/getconf?' + new URLSearchParams({
  referer: 'https://dun.163.com/trial/jigsaw', zoneId: '', dt: FIXED_DT, id: ID, ipv6: 'false', runEnv: '10',
  iv: '5', type: '2', loadVersion: '2.5.4', callback: getconfCb,
}).toString();
const confResp = curl(getconfUrl);
save('01_getconf.json', { url: getconfUrl, status: confResp.status, ms: confResp.ms, body: confResp.body });
const conf = jsonp(confResp.body).data;
const dt = conf.dt; // 服务端签发（实测：随机值 param check error；空值则签发新 dt）
log(`getconf: ${confResp.status} ${confResp.ms}ms zoneId=${conf.zoneId} dt=${dt} apiServer=${conf.apiServer?.[0]}${FIXED_DT ? ' (复用 YD_DT)' : ''}`);

// ---------- 2. v3/get（纯 node 直发；**必须带有效 ir 凭据**：irToken 或 fp 至少其一为真，二者全空则 check 必 false——实测对照见 REPORT-ROUND3.md §4） ----------
const IR_FILE = path.join(AGENT, 'round3-strike/irtoken.json');
let IRTOKEN = process.env.YD_IRTOKEN || '', FP = process.env.YD_FP || '';
if (!IRTOKEN && fs.existsSync(IR_FILE)) {
  const j = JSON.parse(fs.readFileSync(IR_FILE, 'utf8'));
  IRTOKEN = j.irToken || ''; FP = FP || j.fp || '';
  log(`irtoken.json 载入: irToken=${IRTOKEN.slice(0, 12)}... fp.len=${(FP || '').length}`);
}
const getCb = L.buildCb().cb;
const getUrl = 'https://c.dun.163.com/api/v3/get?' + new URLSearchParams({
  referer: 'https://dun.163.com/trial/jigsaw', zoneId: conf.zoneId, dt, irToken: IRTOKEN, id: ID, fp: FP,
  https: 'true', type: '2', version: VERSION, dpr: '1.5', dev: '1', cb: getCb, ipv6: 'false', runEnv: '10',
  group: '', scene: '', lang: 'zh-CN', sdkVersion: '', loadVersion: '2.5.4', iv: '4', user: '',
  width: String(WIDTH), audio: 'false', sizeType: '10', smsVersion: 'v3', token: '',
  callback: '__JSONP_' + Math.random().toString(36).slice(2, 9) + '_0',
}).toString();
const getResp = curl(getUrl);
save('02_get.json', { url: getUrl, status: getResp.status, ms: getResp.ms, body: getResp.body });
const gd = jsonp(getResp.body).data;
log(`v3/get: ${getResp.status} ${getResp.ms}ms token=${gd.token} bg=${gd.bg[0]} front=${gd.front[0]}`);
const imgDir = path.join(RUN, 'img');
const bgPath = path.join(imgDir, gd.bg[0].split('/').pop());
const fgPath = path.join(imgDir, gd.front[0].split('/').pop());
curl(gd.bg[0], { raw: bgPath });
curl(gd.front[0], { raw: fgPath });

// ---------- 3. 离线缺口检测 ----------
const bgBuf = fs.readFileSync(bgPath), fgBuf = fs.readFileSync(fgPath);
const det = detectGap(bgBuf, fgBuf);
save('03_detect.json', det);
log(`detect: best=${JSON.stringify(det.best)} refine=${JSON.stringify(det.refine)} bbox=${JSON.stringify(det.fgBBox)} pts=${det.pts}`);
const gapX = Math.round(det.refine ? (det.refine.dx + det.best.dx) / 2 : det.best.dx); // 用 best/refine 均值的整数
log(`gapX=${gapX}`);

// ---------- 4. 本地合成轨迹（模拟人类拖动；atoms = [x, dy, dtMs, isTrusted]） ----------
// 关键实证（解密 round2 pass1/pass2 通过样本）：
//   d 末点 dragX = 227 / 93  而 p 对应 jigsaw.left = 216 / 82.5
//   → dragX_final = 缺口x + (sliderW - jigsawW)/2 ≈ 缺口x + 10.5（拼图块比手柄宽约 21px）
//   → p 明文 = jigsaw.left/width*100 = 缺口x/width*100（不随偏移变化）
const DRAG_OFFSET = Number(process.env.YD_DRAG_OFFSET ?? 10.5);
function synthTrajectory(targetX, opts = {}) {
  const n = opts.n || 26;
  const atoms = [];
  const totalMs = opts.totalMs || (240 + Math.random() * 160);
  for (let i = 0; i < n; i++) {
    const p = i / (n - 1);
    const ease = p < 0.2 ? (p / 0.2) * 0.15 : 0.15 + Math.pow((p - 0.2) / 0.8, 0.72) * 0.85;
    const x = Math.min(targetX, Math.max(1, Math.round(targetX * ease)));
    const dy = i === 0 ? 0 : [1, 0, -1, 0][i % 4];
    const t = Math.round(150 + totalMs * p + (i > 0 ? Math.random() * 14 : 0));
    atoms.push([x, dy, t, 1]);
  }
  for (let i = 1; i < atoms.length; i++) {
    if (atoms[i][0] < atoms[i - 1][0]) atoms[i][0] = atoms[i - 1][0];
    if (atoms[i][2] <= atoms[i - 1][2]) atoms[i][2] = atoms[i - 1][2] + 1 + (0 | (Math.random() * 8));
  }
  atoms[0][0] = Math.max(2, atoms[0][0]);
  atoms[n - 1][0] = targetX;
  return atoms;
}
const targetDragX = Math.round(gapX + DRAG_OFFSET); // 真实客户端：dragX 需多走 ~10.5px
const atoms = synthTrajectory(targetDragX);
save('04_atoms.json', { atoms, targetDragX, DRAG_OFFSET });
log(`atoms: n=${atoms.length} x=${atoms[0][0]}..${atoms[atoms.length - 1][0]} (targetDragX=${targetDragX}=gapX+${DRAG_OFFSET}) t=${atoms[0][2]}..${atoms[atoms.length - 1][2]}`);

// ---------- 5. 构造 data + cb ----------
const pPlain = String(Math.trunc(gapX) / WIDTH * 100); // SDK: parseInt(jigsaw.style.left,10)/width*100 + ''
const built = L.buildData({ token: gd.token, atoms, pPlain, mouseDownCounts: 1 });
const cbObj = L.buildCb();
save('05_construct.json', {
  token: gd.token, pPlain, cbPlain: cbObj.plain,
  fPlain: built.debug.fPlain, extPlain: built.debug.extPlain, traceDataLen: built.debug.traceDataLen,
  dataCipher: { d: built.d, m: built.m, p: built.p, f: built.f, ext: built.ext },
  dataJson: built.json,
});
log(`construct: p="${pPlain}" f.len=${built.debug.fPlain.length} ext="${built.debug.extPlain}" | d.len=${built.d.length} f.cipher.len=${built.f.length} cb.len=${cbObj.cb.length}`);

// ---------- 6. 提交 check ----------
const checkUrl = 'https://c.dun.163.com/api/v3/check?' + new URLSearchParams({
  referer: 'https://dun.163.com/trial/jigsaw', zoneId: conf.zoneId, dt, id: ID, token: gd.token,
  data: built.json, width: String(WIDTH), type: '2', version: VERSION, cb: cbObj.cb, user: '', extraData: '',
  bf: '0', runEnv: '10', sdkVersion: '', loadVersion: '2.5.4', iv: '4',
  callback: '__JSONP_' + Math.random().toString(36).slice(2, 9) + '_1',
}).toString();
const checkResp = curl(checkUrl);
let parsed = null;
try { parsed = jsonp(checkResp.body); } catch (e) { parsed = { parseError: String(e), raw: checkResp.body }; }
save('06_check.json', { url: checkUrl, status: checkResp.status, ms: checkResp.ms, body: checkResp.body, parsed });
const result = parsed?.data?.result;
log(`check: HTTP ${checkResp.status} ${checkResp.ms}ms  =>  result=${result}  validate=${(parsed?.data?.validate || '').slice(0, 24)}...`);
save('SUMMARY.json', {
  runName, at: new Date().toISOString(), dt, token: gd.token, zoneId: conf.zoneId,
  img: { bg: gd.bg[0], front: gd.front[0] }, detect: { best: det.best, refine: det.refine, gapX },
  pPlain, cbPlain: cbObj.plain, fPlain: built.debug.fPlain, extPlain: built.debug.extPlain,
  atoms, http: { getconf: confResp.status, get: getResp.status, check: checkResp.status },
  result, validate: parsed?.data?.validate || '', raw: checkResp.body,
});
console.log(`\n===== RESULT: ${result} ===== (run dir: ${RUN})`);
