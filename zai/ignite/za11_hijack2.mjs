// za11_hijack2.mjs — P0-a 引用劫持 v2
// 改进：5点分布布点(287240-287520) + Network.enable + 滑块预检自动refresh + 250px拖动 + finally 保底 resume
import fs from 'node:fs';
const PORT = process.env.CDP_PORT || '9226';
const PX = parseFloat(process.argv[2] || '250');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter(t => t.type === 'page');
const t = pages.find(p => (p.url || '').includes('chat.z.ai')) || pages[0];
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const events = []; const scripts = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  else if (m.method) { events.push(m); if (m.method === 'Debugger.scriptParsed') scripts.push(m.params); }
};
const send = (m, p = {}, timeoutMs = 25000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;
const log = s => { console.log(s); fs.appendFileSync('/tmp/zai-recon-4/za11-hijack2.log', s + '\n'); };

const cleanup = async (bpids) => { try { for (const b of bpids) await send('Debugger.removeBreakpoint', { breakpointId: b }); await send('Debugger.resume'); await send('Debugger.disable'); } catch (e) {} };

// ============ P0: 前台保活 + 滑块预检 ============
const win = await send('Browser.getWindowForTarget', { targetId: t.id });
if (win?.result?.windowId) await send('Browser.setWindowBounds', { windowId: win.result.windowId, bounds: { windowState: 'normal' } });
await send('Page.bringToFront');
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await sleep(400);
// 弹层可见 + 滑块位置检查（靠右则 refresh 复位）
await ev("(function(){var w=document.getElementById('aliyunCaptcha-window-popup');if(w&&getComputedStyle(w).display==='none')w.style.display='block';var m=document.getElementById('aliyunCaptcha-mask');if(m)m.style.display='block';return 1;})()");
let sx = await ev("(function(){var s=document.getElementById('aliyunCaptcha-sliding-slider');if(!s)return -1;var r=s.getBoundingClientRect();return r.width>0?r.x+r.width/2:-2;})()");
if (sx > 600) { log('[P0] slider right(' + sx + '), refresh first'); await ev("(function(){try{window.__INSTANCE.refresh();}catch(e){}return 1;})()"); await sleep(1200); sx = await ev("(function(){var s=document.getElementById('aliyunCaptcha-sliding-slider');var r=s.getBoundingClientRect();return r.x+r.width/2;})()"); }
const sy = await ev("(function(){var s=document.getElementById('aliyunCaptcha-sliding-slider');return s.getBoundingClientRect().y+s.getBoundingClientRect().height/2;})()");
log('[P0] vis=' + await ev('document.visibilityState') + ' slider@' + Number(sx).toFixed(0) + ',' + Number(sy).toFixed(0));
if (sx < 0) { log('ABORT no slider'); ws.close(); process.exit(1); }
await ev('window.__CVPS_DBG=false;1');

// ============ P1: Network + 布点 ============
await send('Network.enable', { maxTotalBufferSize: 20000000 });
await send('Debugger.enable');
await sleep(1500);
let pe = null;
for (const p of scripts) { const u = String(p.url || ''); if (u.includes('dynamicJS') && u.includes('pe.059')) { pe = p; break; } }
if (!pe) { log('NO PE.059'); ws.close(); process.exit(10); }
log('[P1] pe.059 sid=' + pe.scriptId);
const COLS = [287240, 287320, 287379, 287440, 287520];
const bpids = [];
for (const col of COLS) {
  const r = await send('Debugger.setBreakpoint', { location: { scriptId: pe.scriptId, lineNumber: 0, columnNumber: col } });
  const bid = r?.result?.breakpointId;
  if (bid) bpids.push(bid);
  log('[P1] bp@' + col + ' -> ' + (bid || JSON.stringify(r).slice(0, 80)));
}

// ============ P2: 拖动 ============
log('[P2] drag ' + PX + 'px from ' + Number(sx).toFixed(0));
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sx, y: sy });
await sleep(150);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sx, y: sy, button: 'left', clickCount: 1 });
await sleep(120);
const steps = Math.max(18, Math.round(PX / 10));
for (let i = 1; i <= steps; i++) {
  const k = i / steps;
  const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sx + PX * ease + (Math.random() * 2 - 1), y: sy + (Math.random() * 2 - 1), button: 'left' });
  await sleep(15 + Math.random() * 12);
}
await sleep(140);
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: sx + PX, y: sy, button: 'left', clickCount: 1 });
log('[P2] released');

// ============ P3: 等 paused ============
let paused = null;
const t0 = Date.now();
while (Date.now() - t0 < 70000) {
  const p = events.find(e => e.method === 'Debugger.paused');
  if (p) { paused = p; break; }
  await sleep(150);
}
if (!paused) { log('NO_PAUSE'); await cleanup(bpids); ws.close(); process.exit(12); }
const frames = paused.params.callFrames || [];
log('[P3] PAUSED reason=' + paused.params.reason + ' frames=' + frames.length);
for (let i = 0; i < Math.min(frames.length, 8); i++) { const f = frames[i]; log('  f[' + i + '] ' + (f.functionName || '(anon)') + ' loc=' + (f.location.lineNumber + 1) + ':' + f.location.columnNumber); }

const evalOn = async (f, expr, timeout = 20000) => {
  const r = await send('Debugger.evaluateOnCallFrame', { callFrameId: f.callFrameId, expression: expr, returnByValue: true }, timeout);
  if (r?.result?.exceptionDetails) return { err: String(r.result.exceptionDetails.text || '').slice(0, 120) };
  return { value: r?.result?.result?.value };
};

// ============ P4: 找 ts + 保存 ============
let tsFrame = -1;
for (let fi = 0; fi < Math.min(frames.length, 8); fi++) {
  const r = await evalOn(frames[fi], `(function(){try{return typeof ts==='function'?('ts-len:'+String(ts).length):(typeof ts);}catch(e){return 'NTS';}})()`);
  if (typeof r.value === 'string' && r.value.startsWith('ts-len:')) { tsFrame = fi; log('[P4] f' + fi + ': ' + r.value); break; }
}
if (tsFrame < 0) log('[P4] ts not resolvable in f0-f7');
const tf = tsFrame >= 0 ? frames[tsFrame] : frames[0];

const allNames = new Set();
for (const sc of (tf.scopeChain || [])) {
  if (!sc.object?.objectId) continue;
  const pr = await send('Runtime.getProperties', { objectId: sc.object.objectId, ownProperties: true }, 20000);
  for (const pp of (pr?.result?.result || [])) {
    if (pp.name === 'this' || pp.name === 'arguments') continue;
    if (pp.value && (pp.value.type === 'function' || pp.value.type === 'object' || pp.value.type === 'string')) allNames.add(pp.name);
  }
}
log('[P4] scope names: ' + allNames.size);
const namesJson = JSON.stringify([...allNames].slice(0, 500));
const scan = await evalOn(tf, `(function(){
  var names = ${namesJson}; var out = { ts:null, mat:null, cvp:null, tsLen:0 };
  for (var i = 0; i < names.length; i++) {
    var nm = names[i]; var v;
    try { v = eval(nm); } catch (e) { continue; }
    if (v === undefined || v === null) continue;
    if (typeof v === 'function') { try { var s = String(v); if (!out.ts && s.length > 20000 && s.indexOf('switch') >= 0) { out.ts = nm; out.tsLen = s.length; } } catch (e) {} }
    else if (typeof v === 'object' && !Array.isArray(v)) { try {
      var ks = Object.keys(v);
      if (!out.mat && (ks.indexOf('TrackList') >= 0 || ks.indexOf('TrackStartTime') >= 0)) out.mat = nm;
      if (!out.cvp && ks.indexOf('certifyId') >= 0 && (ks.indexOf('sceneId') >= 0 || ks.indexOf('deviceToken') >= 0)) out.cvp = nm;
    } catch (e) {} }
  }
  return JSON.stringify(out);
})()`);
log('[P4] scan: ' + JSON.stringify(scan.value || scan.err));
let scanObj = {}; try { scanObj = JSON.parse(scan.value || '{}'); } catch (e) {}
const tsName = scanObj.ts || (tsFrame >= 0 ? 'ts' : null);
const matName = scanObj.mat, cvpName = scanObj.cvp;

if (tsName) {
  const save = await evalOn(tf, `(function(){
    var r = {};
    try { window.__TSREF = ${tsName}; r.ts = String(${tsName}).length; } catch (e) { r.ts = 'ERR:' + e; }
    try { window.__CTXREF = this; } catch (e) {}
    ${matName ? `try { window.__MATREF = ${matName}; r.matRef = 1; try { window.__MATCLONE = JSON.parse(JSON.stringify(${matName})); r.matCloneLen = JSON.stringify(window.__MATCLONE).length; } catch (e2) { r.matClone = 'ERR'; } } catch (e) { r.matRef = 'ERR'; }` : 'r.matRef = "nf";'}
    ${cvpName ? `try { window.__CVPREF = ${cvpName}; window.__CVP_DATA_TRUTH = String(${cvpName}.data || ''); r.cvpLen = window.__CVP_DATA_TRUTH.length; } catch (e) { r.cvp = 'ERR'; }` : 'r.cvp = "nf";'}
    return JSON.stringify(r);
  })()`, 25000);
  log('[P4] save: ' + JSON.stringify(save.value || save.err));
}

// ============ P5: 清理 + 程序化调用 ============
await cleanup(bpids);
log('[P5] resumed');
await sleep(3500);
const gen = await ev(`(function(){
  try {
    var mat = window.__MATCLONE || window.__MATREF;
    if (!window.__TSREF) return 'NO_TS';
    if (!mat) return 'NO_MAT';
    var out = window.__TSREF.call(window.__CTXREF || window, 11, mat);
    window.__GEN = out;
    return JSON.stringify({ type: typeof out, len: (out && out.length) || null, head: String(out || '').slice(0, 60) });
  } catch (e) { return 'ERR:' + e; }
})()`);
log('[P5] GEN: ' + JSON.stringify(gen));

const cmp = await ev(`(function(){
  var truth = window.__CVP_DATA_TRUTH || ''; var g = window.__GEN;
  return JSON.stringify({ truthLen: truth.length, truthHead: truth.slice(0, 50), genLen: g && g.length ? g.length : null, genHead: String(g || '').slice(0, 50), equal: String(g) === truth });
})()`);
log('[P6] CMP: ' + JSON.stringify(cmp));

// 网络总结：captcha 相关
const netSummary = events.filter(e => e.method === 'Network.requestWillBeSent').map(e => String(e.params?.request?.url || '')).filter(u => /captcha-open|verify|aliyuncs/.test(u));
log('[P7] net reqs: ' + JSON.stringify(netSummary.slice(-10)));

fs.writeFileSync('/tmp/zai-recon-4/za11-hijack2-report.json', JSON.stringify({ tsFrame, scan: scanObj, gen, cmp, netSummary: netSummary.slice(-15), t: Date.now() }, null, 1));
log('DONE-HIJACK2');
ws.close();
