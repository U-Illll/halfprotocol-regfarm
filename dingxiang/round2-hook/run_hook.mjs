// run_hook.mjs — 顶象（dingxiang-inc.com）ac 生成链运行时 hook 取证（主流程）
// 用法: node run_hook.mjs [runName] [--no-drag] [--maxdrag=4] [--step=6] [--deltas=76,80]
// 流程: 注入 document-start hook → reload → 点"滑动拼图"tab → 点验证条 → 等拼图面板 →
//       导出 canvas/碎片 → Chamfer 定位 → 人类化拖动 → 采集 hook 记录/网络/响应 → 落盘
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = process.env.CDP_PORT || '9231';
const HOOK_DIR = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const getArg = (k, d) => { const m = argv.find((a) => a.startsWith(k + '=')); return m ? m.slice(k.length + 1) : d; };
const RUN = (argv[0] && !argv[0].startsWith('--')) ? argv[0] : ('run-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
const NO_DRAG = has('--no-drag');
const MAXDRAG = parseInt(getArg('--maxdrag', '4'), 10);
const STEP = parseFloat(getArg('--step', '6'));
const DELTAS_OVERRIDE = getArg('--deltas', null);
const OUT = path.join(HOOK_DIR, 'samples', RUN);
fs.mkdirSync(OUT, { recursive: true });
const LOG = [];
const log = (s) => { const line = `[${new Date().toISOString().slice(11, 23)}] ${s}`; console.log(line); LOG.push(line); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const saveLog = () => { try { fs.writeFileSync(path.join(OUT, 'run.log'), LOG.join('\n')); } catch {} };

// ---------- CDP ----------
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const target = list.filter((x) => x.type === 'page').find((p) => (p.url || '').includes('dingxiang-inc'));
if (!target) { console.error('NO TARGET PAGE'); process.exit(1); }
log('[target] ' + target.url + ' id=' + target.id);
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let id = 0;
const pend = new Map();
const netReqs = [];
const netById = new Map();
const IMG_RE = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i;
const INTEREST = /dingxiang-inc\.com|cap\.|constid|greenseer/i;
ws.onmessage = (e) => {
  let m; try { m = JSON.parse(e.data); } catch { return; }
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  try {
    if (m.method === 'Network.requestWillBeSent') {
      const u = m.params?.request?.url || '';
      if (INTEREST.test(u)) {
        const rec = {
          seq: netReqs.length, requestId: m.params.requestId, ts: Date.now(), type: m.params.type,
          method: m.params.request.method, url: u, postData: m.params.request.postData || null,
          headers: m.params.request.headers || {},
          initiator: m.params.initiator?.stack?.callFrames?.slice(0, 6).map((f) => `${f.functionName}@${(f.url || '').slice(-80)}:${f.lineNumber}:${f.columnNumber}`) || null
        };
        netReqs.push(rec); netById.set(m.params.requestId, rec);
      }
    } else if (m.method === 'Network.responseReceived') {
      const rec = netById.get(m.params.requestId);
      if (rec) { rec.resp = { status: m.params.response.status, mimeType: m.params.response.mimeType, headers: m.params.response.headers }; }
    } else if (m.method === 'Network.loadingFinished') {
      const rec = netById.get(m.params.requestId);
      if (rec) rec.finishedAt = Date.now();
    }
  } catch {}
};
const send = (method, params = {}, timeoutMs = 30000) => new Promise((res) => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, (v) => { clearTimeout(timer); res(v); });
  ws.send(JSON.stringify({ id: i, method, params }));
});
const ev = async (expr, awaitPromise = true) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise }, 30000);
  if (r?.result?.exceptionDetails) return { __err: r.result.exceptionDetails.text + ' | ' + (r.result.exceptionDetails.exception?.description || '') };
  return r?.result?.result?.value;
};
const evJson = async (expr) => { const v = await ev(expr); try { return JSON.parse(v); } catch { return { __raw: v }; } };
const snapRecs = async (tag) => {
  const total = await ev('window.__DXH__ ? window.__DXH__.recs.length : -1');
  if (!total || total < 0) { log(`[snap:${tag}] no hook`); return { tag, total: -1, n: 0 }; }
  const out = [];
  const PAGE = 700;
  for (let a = 0; a < total; a += PAGE) {
    const chunk = await evJson(`JSON.stringify(window.__DXH__.recs.slice(${a}, ${Math.min(a + PAGE, total)}))`);
    if (Array.isArray(chunk)) out.push(...chunk); else break;
  }
  fs.writeFileSync(path.join(OUT, `hook-recs.${tag}.json`), JSON.stringify(out));
  log(`[snap:${tag}] recs=${out.length}/${total}`);
  return { tag, total, n: out.length };
};
const extraOf = async (tag = 'x') => {
  const v = await evJson(`JSON.stringify({ counts: window.__DXH__ && window.__DXH__.counts, probe: window.__DXH__ && window.__DXH__.probe, notes: window.__DXH__ && window.__DXH__.notes, err: (window.__DXH__ && window.__DXH__.err || []).slice(0, 60) })`);
  fs.writeFileSync(path.join(OUT, `hook-extra.${tag}.json`), JSON.stringify(v, null, 1));
  return v;
};
const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'png' }); if (s?.result?.data) fs.writeFileSync(path.join(OUT, name), Buffer.from(s.result.data, 'base64')); };

// ---------- 阶段 1：注入 hook + reload ----------
const hookSrc = fs.readFileSync(path.join(HOOK_DIR, 'hook_inject.js'), 'utf8');
await send('Network.enable', { maxTotalBufferSize: 200 * 1024 * 1024, maxResourceBufferSize: 100 * 1024 * 1024 });
await send('Page.enable', {});
const inj = await send('Page.addScriptToEvaluateOnNewDocument', { source: hookSrc });
log('[inject] ' + JSON.stringify(inj?.result || inj));
await send('Page.bringToFront', {});
await send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});

async function reloadAndReady() {
  log('[reload] ...');
  await send('Page.reload', { ignoreCache: false });
  let ready = null;
  for (let i = 0; i < 45; i++) {
    await sleep(700);
    ready = await evJson(`JSON.stringify({hook: !!window.__DXH__, recs: window.__DXH__?window.__DXH__.recs.length:-1, rs: document.readyState, tabs: document.querySelectorAll('.captcha-intro-tabs li').length, item2: !!document.querySelector('.captcha-intro-contents li.item-2')})`);
    if (ready?.hook && ready?.rs === 'complete' && ready.tabs > 3) break;
  }
  log('[ready] ' + JSON.stringify(ready));
  return ready;
}
await reloadAndReady();
await sleep(4500);   // 让 SDK 初始化链走完
await snapRecs('init');
const extra0 = await extraOf('init');
log('[probe] libs=' + JSON.stringify(extra0?.probe?.libs || {}) + ' scripts=' + JSON.stringify(extra0?.probe?.scripts || []).slice(0, 400));

// ---------- 阶段 2：切 tab → 点 bar → 等面板 ----------
const safePoint = async (sel) => JSON.parse(await ev(`(function(){
  var li=document.querySelector('.captcha-intro-contents li.item-2');
  var el=${sel};
  if(!el) return '{}';
  el.scrollIntoView({block:'center'});
  var chat=document.getElementById('chatIframe');
  var cr=chat?chat.getBoundingClientRect():null;
  var r=el.getBoundingClientRect();
  if (r.y > 300 || r.y < 70) { document.body.scrollTop += (r.y - 160); r=el.getBoundingClientRect(); }
  for (var fy=0.3; fy<=0.7; fy+=0.2){
    for (var fx=0.5; fx>=0.05; fx-=0.05){
      var x=r.x+r.width*fx, y=r.y+r.height*fy;
      if (cr && x>=cr.x-2 && x<=cr.x+cr.width+2 && y>=cr.y-2 && y<=cr.y+cr.height+2) continue;
      var top=document.elementFromPoint(x, y);
      if (top && el.contains(top)) return JSON.stringify({x:x, y:y});
    }
  }
  return '{}';
})()`) || '{}');
const click = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: y - 6 });
  await sleep(200);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await sleep(160);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(100);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};
const geom = async () => evJson(`JSON.stringify((function(){
  var w=document.querySelector('.dx_captcha_basic_wrapper');
  if(!w) return {ok:false};
  var rr=w.getBoundingClientRect();
  if(rr.width<10) return {ok:false, w:0};
  var h=document.querySelector('.dx_captcha_basic_slider');
  var hr=h?h.getBoundingClientRect():null;
  var c=document.querySelector('.dx_captcha_basic_content');
  var cr=c?c.getBoundingClientRect():null;
  var s=document.querySelector('.dx_captcha_basic_sub-slider');
  var sr=s?s.getBoundingClientRect():null;
  var si=document.querySelector('.dx_captcha_basic_sub-slider img');
  return {ok:true,
    handle: hr?{x:hr.x+hr.width/2,y:hr.y+hr.height/2,w:hr.width,h:hr.height}:null,
    content: cr?{x:cr.x,y:cr.y,w:cr.width,h:cr.height}:null,
    sub: sr?{x:sr.x,y:sr.y}:null,
    subStyle: s?s.getAttribute('style'):null,
    fragSrc: si?si.src:null,
    dpr: window.devicePixelRatio};
})())`);

const tabPt = await safePoint(`(function(){var best=null;document.querySelectorAll('.captcha-intro-tabs li').forEach(function(li){if((li.innerText||'').indexOf('滑动拼图')>=0) best=li;});return best;})()`);
log('[tab pt] ' + JSON.stringify(tabPt));
if (!tabPt.x) { log('ABORT: no tab'); saveLog(); process.exit(2); }
await click(tabPt.x, tabPt.y);
log('[clicked tab2]');
await sleep(2000);
const barPt = await safePoint(`(function(){var li=document.querySelector('.captcha-intro-contents li.item-2');return li?li.querySelector('.captcha-trigger'):null;})()`);
log('[bar pt] ' + JSON.stringify(barPt));
if (!barPt.x) { log('ABORT: no bar'); saveLog(); process.exit(2); }
await click(barPt.x, barPt.y);
log('[clicked bar]');

let g = null;
for (let k = 0; k < 30; k++) {
  await sleep(800);
  g = await geom();
  if (g?.ok && g.handle) break;
}
log('[puzzle] ' + JSON.stringify(g));
if (!g?.ok) { await shot('no-puzzle.png'); log('ABORT: no puzzle panel'); await snapRecs('nopanel'); saveLog(); process.exit(2); }
await shot('pre-drag.png');

// ---------- 阶段 3：导出 canvas / 碎片 → 定位 ----------
const canvasB64 = await ev(`(function(){
  var c=document.querySelector('.dx_captcha_basic_bg canvas') || document.querySelector('.dx_captcha_basic_pic canvas') || document.querySelector('.dx_captcha_basic_content canvas');
  return c ? c.toDataURL('image/png') : null;
})()`);
let canvasPath = path.join(OUT, 'canvas.png');
if (typeof canvasB64 === 'string' && canvasB64.startsWith('data:image/png')) {
  fs.writeFileSync(canvasPath, Buffer.from(canvasB64.split(',')[1], 'base64'));
  log('[canvas] saved ' + fs.statSync(canvasPath).size + 'b');
} else { log('[canvas] FAILED: ' + String(canvasB64).slice(0, 120)); canvasPath = null; }

async function fetchBodyByUrl(url) {
  const cand = netReqs.filter((r) => r.url === url || (r.url && url && r.url.split('?')[0] === url.split('?')[0]));
  for (let i = cand.length - 1; i >= 0; i--) {
    try {
      const b = await send('Network.getResponseBody', { requestId: cand[i].requestId });
      if (b?.result?.body) return { b64: b.result.body, enc: !!b.result.base64Encoded, url: cand[i].url };
    } catch {}
  }
  return null;
}
let fragPath = null;
if (g.fragSrc) {
  let fb = await fetchBodyByUrl(g.fragSrc);
  if (!fb) {
    const pageFb = await ev(`(async function(){ try{ var r=await fetch(${JSON.stringify(g.fragSrc)}); var b=await r.arrayBuffer(); var u=new Uint8Array(b); var s=''; for(var i=0;i<u.length;i++) s+=String.fromCharCode(u[i]); return btoa(s); }catch(e){ return 'ERR:'+e; } })()`);
    if (typeof pageFb === 'string' && !pageFb.startsWith('ERR:')) fb = { b64: pageFb, enc: true, url: g.fragSrc };
    else log('[frag] page fetch failed: ' + String(pageFb).slice(0, 150));
  }
  if (fb) {
    fragPath = path.join(OUT, 'frag.webp');
    fs.writeFileSync(fragPath, Buffer.from(fb.b64, fb.enc ? 'base64' : 'utf8'));
    log('[frag] saved ' + fs.statSync(fragPath).size + 'b from ' + fb.url);
  }
}

let yApi = null;
try { const m = /margin-top:\s*([-\d.]+)px/.exec(g.subStyle || ''); if (m) yApi = parseFloat(m[1]); } catch {}
log('[y_api from subStyle] ' + yApi);

let locate = null;
if (canvasPath && fragPath && yApi != null) {
  const outJson = path.join(OUT, 'locate.json');
  try {
    const py = process.env.DX_PYTHON || 'python3'; // 需要 cv2+numpy
    const res = execFileSync(py, [path.join(HOOK_DIR, 'locate.py'), '--canvas', canvasPath, '--frag', fragPath, '--y-api', String(yApi), '--out', outJson], { encoding: 'utf8', timeout: 120000 });
    locate = JSON.parse(fs.readFileSync(outJson, 'utf8'));
    log('[locate] chamfer_top=' + JSON.stringify(locate.chamfer_top?.slice(0, 4)) + ' ncc_top=' + JSON.stringify(locate.ncc_top?.slice(0, 3)));
  } catch (e) { log('[locate] ERR ' + String(e).slice(0, 300)); }
}

await snapRecs('pre');
const extraPre = await extraOf('pre');

// ---------- 阶段 4：拖动 ----------
let deltas = [];
if (DELTAS_OVERRIDE) deltas = DELTAS_OVERRIDE.split(',').map(Number);
else if (locate?.chamfer_top?.[0]) {
  const d0 = locate.chamfer_top[0].ui_x - 20;
  deltas = [d0, d0 + STEP, d0 - STEP, d0 + 2 * STEP];
} else deltas = [220, 226, 214, 232];
deltas = deltas.slice(0, MAXDRAG);
log('[deltas] ' + JSON.stringify(deltas));

async function dragOnce(delta, tag) {
  const gg = await geom();
  if (!gg?.ok || !gg.handle) { log(`[${tag}] no handle`); return false; }
  const hx = gg.handle.x, hy = gg.handle.y;
  log(`[${tag}] drag delta=${delta} from (${hx.toFixed(1)},${hy.toFixed(1)}) sub0=${gg.sub?.x}`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hx - 40 - Math.random() * 25, y: hy + (Math.random() - 0.5) * 10 });
  await sleep(130 + Math.random() * 130);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hx - 2 + Math.random() * 4, y: hy + (Math.random() - 0.5) * 3 });
  await sleep(110 + Math.random() * 110);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hx, y: hy });
  await sleep(90 + Math.random() * 80);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hx, y: hy, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(80 + Math.random() * 90);
  const steps = 32 + Math.floor(Math.random() * 12);
  for (let i = 1; i <= steps; i++) {
    const p = i / steps;
    let eased = 1 - Math.pow(1 - p, 2.6);
    if (Math.random() < 0.10) eased = Math.max(0, eased - 0.012 * Math.random());
    const x = hx + delta * eased;
    const y = hy + (Math.random() - 0.5) * 2.4;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: +x.toFixed(2), y: +y.toFixed(2), button: 'left', buttons: 1 });
    await sleep(13 + Math.random() * 26);
    if (i === Math.floor(steps * (0.35 + Math.random() * 0.3)) && Math.random() < 0.6) await sleep(50 + Math.random() * 130);
  }
  await sleep(170 + Math.random() * 190);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: +(hx + delta).toFixed(2), y: +(hy + (Math.random() - 0.5) * 1.5).toFixed(2), button: 'left', buttons: 1 });
  await sleep(120 + Math.random() * 140);
  const pre = await geom();
  log(`[${tag}] pre-release sub=${pre?.sub?.x}`);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hx + delta, y: hy, button: 'left', clickCount: 1 });
  log(`[${tag}] released at ${(hx + delta).toFixed(1)}`);
  return true;
}

async function waitApiResp(timeoutMs) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < timeoutMs) {
    await sleep(900);
    const recs = await evJson(`JSON.stringify((window.__DXH__?window.__DXH__.recs:[]).filter(function(r){return r.k==='xhr.done'&&String(r.u||'').indexOf('/api/v1')>=0;}).map(function(r){return {u:r.u,resp:r.resp,status:r.status,t:r.t};}))`);
    if (Array.isArray(recs) && recs.length) { last = recs[recs.length - 1]; break; }
  }
  return last;
}

const results = [];
if (NO_DRAG) {
  log('[dry-run] skip drag');
} else {
  for (let i = 0; i < deltas.length; i++) {
    const tag = 'drag' + (i + 1);
    const ok = await dragOnce(deltas[i], tag);
    if (!ok) break;
    const resp = await waitApiResp(45000);
    log(`[${tag}] resp=${JSON.stringify(resp)}`);
    await sleep(2500);
    await snapRecs(tag);
    await extraOf(tag);
    await shot(tag + '.png');
    const uiState = await evJson(`JSON.stringify((function(){
      var bar=document.querySelector('.dx_captcha_basic_bar-inform');
      var s=document.querySelector('.dx_captcha_basic_bar-success');
      var f=document.querySelector('.dx_captcha_basic_bar-fail, .dx_captcha_basic_bar-load-fail');
      function vis(e){ if(!e) return null; var r=e.getBoundingClientRect(); return r.width>0&&r.height>0; }
      var li=document.querySelector('.captcha-intro-contents li.item-2');
      return {barTxt:(bar?bar.innerText:'').slice(0,60), successVis:vis(s), failVis:vis(f), liTxt:(li?li.innerText:'').slice(-60)};
    })())`);
    log(`[${tag}] ui=${JSON.stringify(uiState)}`);
    results.push({ tag, delta: deltas[i], resp, ui: uiState, geom: await geom() });
    let parsed = null;
    try { parsed = JSON.parse(resp?.resp || '{}'); } catch {}
    if (parsed && parsed.success === true) { log(`[${tag}] SUCCESS!!!`); break; }
    await sleep(600);
  }
}

// ---------- 阶段 5：落盘 ----------
const netOut = [];
for (const r of netReqs) {
  const item = { ...r };
  if (r.resp && !IMG_RE.test(r.url) && r.type !== 'Image') {
    try {
      const b = await send('Network.getResponseBody', { requestId: r.requestId });
      if (b?.result?.body) item.body = b.result.base64Encoded ? '[b64]' + b.result.body.slice(0, 4000) + `…[len=${b.result.body.length}]` : b.result.body;
    } catch (e) { item.bodyErr = String(e); }
  }
  if (IMG_RE.test(r.url)) item.body = `[image ${r.resp?.mimeType || '?'} skipped]`;
  netOut.push(item);
}
fs.writeFileSync(path.join(OUT, 'net.json'), JSON.stringify(netOut, null, 1));
const final = await snapRecs('final');
const extraFinal = await extraOf('final');
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({
  run: RUN, at: new Date().toISOString(), target: target.url,
  hookInjected: !!inj?.result?.identifier, geom: g, yApi,
  locate: locate ? { chamfer_top: locate.chamfer_top, ncc_top: locate.ncc_top, diff_blocks: locate.diff_blocks, mask_bbox: locate.mask_bbox } : null,
  deltas, results, finalRecs: final.total
}, null, 1));
log('[net] ' + netOut.filter((r) => /\/api\/(a|v1)/.test(r.url)).map((r) => r.method + ' ' + r.url.slice(0, 80) + ' | pd=' + String(r.postData || '').slice(0, 80)).join(' || '));
saveLog();
ws.close();
console.log('DONE -> ' + OUT);
