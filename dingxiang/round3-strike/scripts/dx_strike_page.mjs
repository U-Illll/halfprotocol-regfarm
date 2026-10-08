// dx_strike_page.mjs — 直打管线·页面侧采集 v2（CDP 9231）
// 关键设计：
//   * 用 Target.createTarget 开**干净新标签页**（不注入任何 hook，避免顶象环境检测打断点击链路）
//   * 用 JS el.click() 切 tab（CDP 真实鼠标事件在带 hook 的旧标签页会失效）
//   * 用 CDP Input 真实鼠标点击「验证条」→ 触发拼图面板
//   * 全程不拖动滑块（拖动预算 = 0）
// 产出 out/ctx-<tag>.json：sid/y/cid/p1/p2/c/aid/ak + canvas.png + frag.webp + 几何 + locate.json
// 用法: node dx_strike_page.mjs [tag]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = process.env.CDP_PORT || '9231';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTDIR = path.resolve(HERE, '..', 'out');
const TAG = process.argv[2] || ('p' + Date.now());
const KEEP_TAB = process.argv.includes('--keep');
const PAGE_URL = 'https://www.dingxiang-inc.com/business/captcha';
fs.mkdirSync(OUTDIR, { recursive: true });
const LOG = [];
const log = (s) => { const l = `[${new Date().toISOString().slice(11, 23)}] ${s}`; console.log(l); LOG.push(l); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 浏览器级连接：新建 target ----
const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const wsB = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => (wsB.onopen = r));
let idB = 0; const pendB = new Map();
wsB.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } if (m.id && pendB.has(m.id)) { pendB.get(m.id)(m); pendB.delete(m.id); } };
const sendB = (method, params = {}) => new Promise((res) => { const i = ++idB; pendB.set(i, res); wsB.send(JSON.stringify({ id: i, method, params })); });
const tRes = await sendB('Target.createTarget', { url: PAGE_URL });
const targetId = tRes?.result?.targetId;
if (!targetId) { console.error('createTarget failed', JSON.stringify(tRes)); process.exit(1); }
log('[newtab] ' + targetId);
await sleep(1200);
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const tinfo = list.find((x) => x.id === targetId);
if (!tinfo?.webSocketDebuggerUrl) { console.error('no ws for new tab'); process.exit(1); }
const ws = new WebSocket(tinfo.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let id = 0; const pend = new Map();
const netReqs = []; const netById = new Map();
const INTEREST = /dingxiang-inc\.com|cap\.|constid/i;
ws.onmessage = (e) => {
  let m; try { m = JSON.parse(e.data); } catch { return; }
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  try {
    if (m.method === 'Network.requestWillBeSent') {
      const u = m.params?.request?.url || '';
      if (INTEREST.test(u)) {
        const rec = { seq: netReqs.length, requestId: m.params.requestId, ts: Date.now(), method: m.params.request.method, url: u, postData: m.params.request.postData || null, headers: m.params.request.headers || {} };
        netReqs.push(rec); netById.set(m.params.requestId, rec);
      }
    } else if (m.method === 'Network.responseReceived') {
      const rec = netById.get(m.params.requestId);
      if (rec) rec.resp = { status: m.params.response.status };
    }
  } catch { }
};
const send = (method, params = {}, t = 60000) => new Promise((res) => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, t);
  pend.set(i, (v) => { clearTimeout(timer); res(v); });
  ws.send(JSON.stringify({ id: i, method, params }));
});
const ev = async (expr, t = 40000) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, t);
  if (r?.result?.exceptionDetails) return { __err: r.result.exceptionDetails.text };
  return r?.result?.result?.value;
};

await send('Network.enable', { maxTotalBufferSize: 200 * 1024 * 1024, maxResourceBufferSize: 100 * 1024 * 1024 });
await send('Page.enable', {});
await send('Page.bringToFront');
await send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => { });

// 等 ready
let ok = false;
for (let i = 0; i < 45; i++) {
  await sleep(700);
  const s = String(await ev(`document.readyState + ':' + document.querySelectorAll('.captcha-intro-tabs li').length`));
  if (s.startsWith('complete') && Number(s.split(':')[1]) > 3) { ok = true; break; }
}
log('[ready] ' + ok);
await sleep(3000);

// 1) 切 tab（JS click）
const tabR = await ev(`(function(){var b=null;document.querySelectorAll('.captcha-intro-tabs li').forEach(function(li){if((li.innerText||'').indexOf('滑动拼图')>=0)b=li;}); if(!b) return 'none'; b.click(); return 'ok';})()`);
await sleep(2200);
const activeTab = await ev(`(function(){var a=document.querySelector('.captcha-intro-tabs li.active');return a?a.innerText.trim():'?';})()`);
log('[tab] ' + tabR + ' active=' + activeTab);

// 2) 点验证条（CDP 真实鼠标）
const rect = JSON.parse(String(await ev(`(function(){var li=document.querySelector('.captcha-intro-contents li.item-2'); if(!li) return '{}'; li.scrollIntoView({block:'center'}); var tr=li.querySelector('.captcha-trigger'); if(!tr) return '{}'; var r=tr.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2,w:r.width});})()`)) || '{}');
log('[bar] ' + JSON.stringify(rect));
if (rect.x) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x - 40, y: rect.y });
  await sleep(150);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y });
  await sleep(200);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(110);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
}
let panel = null;
for (let k = 0; k < 25; k++) {
  await sleep(800);
  panel = JSON.parse(String(await ev(`JSON.stringify({wrap:!!document.querySelector('.dx_captcha_basic_wrapper'), canvas:document.querySelectorAll('.dx_captcha_basic_bg canvas').length})`)) || '{}');
  if (panel?.wrap && panel?.canvas) break;
}
log('[panel] ' + JSON.stringify(panel));
if (!panel?.wrap) { log('ABORT: no puzzle panel'); fs.writeFileSync(path.join(OUTDIR, `ctx-${TAG}.log`), LOG.join('\n')); process.exit(2); }
await sleep(900);

// 3) 采集几何 + canvas + frag
const geom = JSON.parse(String(await ev(`JSON.stringify((function(){
  function R(el){ if(!el) return null; var r=el.getBoundingClientRect(); return {x:+r.x.toFixed(2),y:+r.y.toFixed(2),w:+r.width.toFixed(2),h:+r.height.toFixed(2)}; }
  var w=document.querySelector('.dx_captcha_basic_wrapper');
  var cv=document.querySelector('.dx_captcha_basic_bg canvas');
  var s=document.querySelector('.dx_captcha_basic_sub-slider');
  var si=document.querySelector('.dx_captcha_basic_sub-slider img');
  var sl=document.querySelector('.dx_captcha_basic_slider');
  return { ok:true, handle:R(sl), content:R(document.querySelector('.dx_captcha_basic_content')),
    sub:R(s), subStyle: s?s.getAttribute('style'):null, fragSrc: si?si.src:null,
    canvas: cv?{w:cv.width,h:cv.height,style:cv.getAttribute('style')}:null,
    dpr: window.devicePixelRatio, inner:{w:innerWidth,h:innerHeight}, scroll:{x:scrollX,y:scrollY},
    pageUrl: location.href, ref: document.referrer, ua: navigator.userAgent, cookie: document.cookie };
})())`)) || '{}');
const canvasB64 = await ev(`(function(){ var c=document.querySelector('.dx_captcha_basic_bg canvas'); return c?c.toDataURL('image/png'):null; })()`);
const canvasPath = path.join(OUTDIR, `ctx-${TAG}-canvas.png`);
if (typeof canvasB64 === 'string' && canvasB64.startsWith('data:image/png')) {
  fs.writeFileSync(canvasPath, Buffer.from(canvasB64.split(',')[1], 'base64'));
  log('[canvas] ' + fs.statSync(canvasPath).size + 'b ' + canvasB64.length);
} else log('[canvas] FAIL ' + String(canvasB64).slice(0, 100));

let fragPath = null;
if (geom.fragSrc) {
  const fb = await ev(`(async function(){ try{ var r=await fetch(${JSON.stringify(geom.fragSrc)}); var b=await r.arrayBuffer(); var u=new Uint8Array(b); var s=''; for(var i=0;i<u.length;i++) s+=String.fromCharCode(u[i]); return btoa(s);}catch(e){return 'ERR:'+e;} })()`);
  if (typeof fb === 'string' && !fb.startsWith('ERR:')) {
    fragPath = path.join(OUTDIR, `ctx-${TAG}-frag.webp`);
    fs.writeFileSync(fragPath, Buffer.from(fb, 'base64'));
    log('[frag] ' + fs.statSync(fragPath).size + 'b');
  } else log('[frag] FAIL ' + String(fb).slice(0, 100));
}

// 4) /api/a（找最新的 ak=99de95ad 的响应）
let apiAUrl = null, apiAResp = null;
const cands = netReqs.filter((r) => /\/api\/a\?/.test(r.url) && /99de95ad1f23597c23b3558d932ded3c/.test(r.url));
for (let i = cands.length - 1; i >= 0 && !apiAResp; i--) {
  try {
    const b = await send('Network.getResponseBody', { requestId: cands[i].requestId });
    if (b?.result?.body) { apiAResp = JSON.parse(b.result.body); apiAUrl = cands[i].url; }
  } catch { }
}
// 若页面还没请求过该 ak（首次点 bar 才会发），尝试用页面 fetch 主动取一次（同源同 c）
if (!apiAResp) {
  log('[api/a] page has none for 99de95ad, fallback page fetch');
  const r = await ev(`(async function(){ try{ var u=location.origin.replace('www','cap'); return 'skip'; }catch(e){ return 'ERR'; } })()`);
}
log('[api/a] ' + JSON.stringify(apiAResp));
if (!apiAResp) { log('ABORT no api/a'); fs.writeFileSync(path.join(OUTDIR, `ctx-${TAG}.log`), LOG.join('\n')); process.exit(3); }

// 5) y_api: 面板里 slider 的 margin-top 与 api y 对应（同 round2）
let yApi = apiAResp.y;
const m = /margin-top:\s*([-\d.]+)px/.exec(geom.subStyle || '');
const ySub = m ? parseFloat(m[1]) : null;
log('[y] api=' + yApi + ' subStyle=' + ySub);

const ctx = {
  tag: TAG, ts: Date.now(), targetId,
  canvasPath, fragPath, apiAUrl, apiAResp,
  apiAAid: (() => { try { return new URL(apiAUrl).searchParams.get('aid'); } catch { return null; } })(),
  geom, yApi, ySub, ySubCanvas: (typeof yApi === 'number' ? +(yApi / 0.825).toFixed(2) : null),
  netAll: netReqs.map((r) => ({ seq: r.seq, ts: r.ts, method: r.method, url: r.url, postData: r.postData })),
};
const ctxPath = path.join(OUTDIR, `ctx-${TAG}.json`);

// 6) 定位
if (canvasPath && fragPath && yApi != null) {
  const outJson = path.join(OUTDIR, `ctx-${TAG}-locate.json`);
  try {
    const py = process.env.DX_PYTHON || 'python3'; // 需要 cv2+numpy
    execFileSync(py, [path.resolve(HERE, '..', '..', 'round2-hook', 'locate.py'), '--canvas', canvasPath, '--frag', fragPath, '--y-api', String(yApi), '--out', outJson], { encoding: 'utf8', timeout: 180000 });
    const loc = JSON.parse(fs.readFileSync(outJson, 'utf8'));
    ctx.locate = loc;
    log('[locate] chamfer_y=' + JSON.stringify((loc.chamfer_y_candidates || []).slice(0, 2)) + ' ncc=' + JSON.stringify((loc.ncc_top || []).slice(0, 2)));
  } catch (e) { log('[locate] ERR ' + String(e).slice(0, 200)); }
}
fs.writeFileSync(ctxPath, JSON.stringify(ctx, null, 1));
fs.writeFileSync(path.join(OUTDIR, `ctx-${TAG}.log`), LOG.join('\n'));
if (!KEEP_TAB) { await sendB('Target.closeTarget', { targetId }); log('[tab closed]'); }
console.log('CTX_PATH=' + ctxPath);
process.exit(0);
