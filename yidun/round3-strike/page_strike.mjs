// page_strike.cjs — 降级路线：借 9230 页面当「取图器」（不拖动鼠标），本地构造 data 后提交
// 阶段1 CDP reload 页面 → 抓真实 v3/get（token/bg/front/dt/irToken/fp）
// 阶段2 下载图 → 离线缺口检测 → 本地合成轨迹 → 构造 data+cb
// 阶段3 curl 提交 check（纯 node 协议直打）
// 阶段4 若失败 → 在页面内用 JSONP 提交同一 data（区分「连接层」与「data 层」）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENT = path.resolve(__dirname, '..');
process.chdir(AGENT);
const L = require(path.join(AGENT, 'round3-strike/lib_yd.cjs'));
const { detectGap } = require(path.join(AGENT, 'round3-strike/gap_detect.cjs'));

const PORT = process.env.CDP_PORT || '9230';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0';
const DRAG_OFFSET = Number(process.env.YD_DRAG_OFFSET ?? 10.5);
const runName = process.argv[2] || ('p' + Date.now());
const RUN = path.resolve(AGENT, 'round3-strike/runs', runName);
fs.mkdirSync(path.join(RUN, 'img'), { recursive: true });
const LOG = [];
const log = (s) => { const l = `[${new Date().toISOString()}] ${s}`; console.log(l); LOG.push(l); fs.writeFileSync(path.join(RUN, 'log.txt'), LOG.join('\n') + '\n'); };
const save = (n, o) => fs.writeFileSync(path.join(RUN, n), typeof o === 'string' ? o : JSON.stringify(o, null, 1));
function curlGet(url, outFile) {
  const t0 = Date.now();
  const args = ['-s', '-m', '30', '-w', '\n__HTTP:%{http_code}__', '-H', 'User-Agent: ' + UA, '-H', 'Referer: https://dun.163.com/'];
  if (outFile) args.push('-o', outFile);
  args.push(url);
  try {
    const out = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 16e6 });
    const m = out.match(/__HTTP:(\d+)__/);
    return { body: outFile ? '' : out.replace(/\n?__HTTP:\d+__\s*$/, ''), status: m ? +m[1] : 0, ms: Date.now() - t0 };
  } catch (e) { return { body: 'ERR ' + e.message, status: -1, ms: Date.now() - t0 }; }
}
const jsonp = (s) => { const i = s.indexOf('('), j = s.lastIndexOf(')'); return JSON.parse(s.slice(i + 1, j)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- CDP ----------------
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.find((p) => p.type === 'page' && /dun\.163\.com/.test(p.url || ''));
if (!t) { console.error('no dun.163.com page'); process.exit(1); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map();
let getReqUrl = null, getRespBody = null, getReqId = null;
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  if (m.method === 'Network.requestWillBeSent') {
    const u = m.params.request.url || '';
    if (/\/api\/v3\/get/.test(u)) getReqUrl = u;
  }
  if (m.method === 'Network.responseReceived') {
    const u = m.params.response.url || '';
    if (/\/api\/v3\/get/.test(u)) getReqId = m.params.requestId;
  }
};
const send = (method, params = {}, timeoutMs = 30000) => new Promise((res) => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, (v) => { clearTimeout(timer); res(v); });
  ws.send(JSON.stringify({ id: i, method, params }));
});
const ev = async (expr, awaitPromise = false) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise });
  return r?.result?.result?.value ?? (r?.result?.exceptionDetails ? 'ERR ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300) : null);
};

await send('Network.enable', { maxTotalBufferSize: 64 * 1024 * 1024, maxResourceBufferSize: 32 * 1024 * 1024 });
await send('Page.enable');
log(`reload page: ${t.url}`);
await send('Page.reload', { ignoreCache: false });
for (let i = 0; i < 80 && !getRespBody; i++) {
  await sleep(400);
  if (getReqId) {
    const r = await send('Network.getResponseBody', { requestId: getReqId });
    if (r?.result?.body) getRespBody = r.result.body;
  }
}
if (!getRespBody) { log('FAILED: no v3/get captured'); process.exit(1); }
save('01_get_request_url.txt', getReqUrl);
save('02_get_response.txt', getRespBody);
const gd = jsonp(getRespBody).data;
const getParsed = Object.fromEntries(new URL(getReqUrl).searchParams);
const dt = getParsed.dt, zoneId = getParsed.zoneId || 'CN31';
const token = gd.token;
log(`captured v3/get: dt=${dt} token=${token} bg=${gd.bg?.[0]} front=${gd.front?.[0]}`);
log(`  get 参数: irToken=${(getParsed.irToken || '').slice(0, 24)}... fp="${(getParsed.fp || '').slice(0, 40)}..." (len=${(getParsed.fp || '').length})`);
save('03_get_params.json', { dt, zoneId, irToken: getParsed.irToken, fp: getParsed.fp, token, bg: gd.bg, front: gd.front });

// ---------------- 取图 + 检测 ----------------
const bgPath = path.join(RUN, 'img', gd.bg[0].split('/').pop());
const fgPath = path.join(RUN, 'img', gd.front[0].split('/').pop());
curlGet(gd.bg[0], bgPath); curlGet(gd.front[0], fgPath);
const det = detectGap(fs.readFileSync(bgPath), fs.readFileSync(fgPath));
save('04_detect.json', det);
const gapX = Math.round((det.best.dx + (det.refine ? det.refine.dx : det.best.dx)) / 2);
log(`detect: best=${JSON.stringify(det.best)} refine=${JSON.stringify(det.refine)} => gapX=${gapX}`);

// ---------------- 合成轨迹 + 构造 data ----------------
function synthTrajectory(targetX, n = 26) {
  const atoms = []; const totalMs = 240 + Math.random() * 160;
  for (let i = 0; i < n; i++) {
    const p = i / (n - 1);
    const ease = p < 0.2 ? (p / 0.2) * 0.15 : 0.15 + Math.pow((p - 0.2) / 0.8, 0.72) * 0.85;
    atoms.push([Math.min(targetX, Math.max(1, Math.round(targetX * ease))), i === 0 ? 0 : [1, 0, -1, 0][i % 4], Math.round(150 + totalMs * p + (i > 0 ? Math.random() * 14 : 0)), 1]);
  }
  for (let i = 1; i < atoms.length; i++) {
    if (atoms[i][0] < atoms[i - 1][0]) atoms[i][0] = atoms[i - 1][0];
    if (atoms[i][2] <= atoms[i - 1][2]) atoms[i][2] = atoms[i - 1][2] + 1 + (0 | (Math.random() * 8));
  }
  atoms[0][0] = Math.max(2, atoms[0][0]); atoms[n - 1][0] = targetX;
  return atoms;
}
const targetDragX = Math.round(gapX + DRAG_OFFSET);
const atoms = synthTrajectory(targetDragX);
const pPlain = String(Math.trunc(gapX) / 320 * 100);
const built = L.buildData({ token, atoms, pPlain, mouseDownCounts: 1 });
const cbObj = L.buildCb();
save('05_construct.json', { atoms, targetDragX, pPlain, cbPlain: cbObj.plain, fPlain: built.debug.fPlain, extPlain: built.debug.extPlain, dataJson: built.json });
log(`construct: p="${pPlain}" dragX=${targetDragX} n=${atoms.length} f.len=${built.debug.fPlain.length} ext="${built.debug.extPlain}"`);

// ---------------- 阶段3：curl 提交 ----------------
function buildCheckUrl(cbName) {
  return 'https://c.dun.163.com/api/v3/check?' + new URLSearchParams({
    referer: 'https://dun.163.com/trial/jigsaw', zoneId, dt, id: '07e2387ab53a4d6f930b8d9a9be71bdf', token,
    data: built.json, width: '320', type: '2', version: '2.28.5', cb: cbObj.cb, user: '', extraData: '',
    bf: '0', runEnv: '10', sdkVersion: '', loadVersion: '2.5.4', iv: '4', callback: cbName,
  }).toString();
}
const checkUrl1 = buildCheckUrl('__JSONP_ps_' + Math.random().toString(36).slice(2, 7) + '_1');
const r1 = curlGet(checkUrl1);
let p1 = null; try { p1 = jsonp(r1.body); } catch {}
save('06_check_curl.json', { url: checkUrl1, status: r1.status, ms: r1.ms, body: r1.body, parsed: p1 });
log(`check(curl): HTTP ${r1.status} ${r1.ms}ms => result=${p1?.data?.result}`);

// ---------------- 阶段4：页面内 JSONP 提交（同 data） ----------------
let p2 = null;
if (p1?.data?.result !== true) {
  const cbName = '__yd_strike_cb_' + Date.now();
  const url2 = buildCheckUrl(cbName);
  const expr = `(function(){window['${cbName}']=function(o){window.__ydStrikeResp=o;};var s=document.createElement('script');s.src=${JSON.stringify(url2)};document.head.appendChild(s);return 'injected';})()`;
  log('page inject: ' + (await ev(expr)));
  for (let i = 0; i < 30; i++) { await sleep(400); const v = await ev('window.__ydStrikeResp ? JSON.stringify(window.__ydStrikeResp) : null'); if (v) { try { p2 = JSON.parse(v); } catch {} break; } }
  save('07_check_page.json', { url: url2, parsed: p2 });
  log(`check(page JSONP): result=${p2?.data?.result}`);
}
save('SUMMARY.json', {
  runName, at: new Date().toISOString(), mode: 'page-get + local-construct', dt, zoneId, token,
  img: { bg: gd.bg?.[0], front: gd.front?.[0] }, detect: { best: det.best, refine: det.refine, gapX },
  targetDragX, pPlain, fPlain: built.debug.fPlain, extPlain: built.debug.extPlain, atoms,
  curl: { status: r1.status, result: p1?.data?.result, body: r1.body },
  page: p2 ? { result: p2?.data?.result } : null,
});
console.log(`\n===== curl result=${p1?.data?.result} | page result=${p2?.data?.result} =====`);
ws.close();
