// za11_hijack.mjs — P0-a 引用劫持实验
// 流程：布点(pe.059@287379) → 拖动触发组装 → 命中断点 → 保存 ts 引用+素材+cvp → resume → 程序化调用 ts(11,素材) → 对照真 data
import fs from 'node:fs';
const PORT = process.env.CDP_PORT || '9226';
const COL_STACK = 287379; // 1-based stack 值；CDP 用 0-based，布 3 点冗余
const PX = parseFloat(process.argv[2] || '195');
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
const log = s => { console.log(s); fs.appendFileSync('/tmp/zai-recon-4/za11-hijack.log', s + '\n'); };

// ============ P0: 前台保活 + 弹层可见性 ============
const win = await send('Browser.getWindowForTarget', { targetId: t.id });
if (win?.result?.windowId) await send('Browser.setWindowBounds', { windowId: win.result.windowId, bounds: { windowState: 'normal' } });
await send('Page.bringToFront');
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await sleep(400);
log('[P0] vis=' + await ev('document.visibilityState'));
// 确保弹层可见
await ev("(function(){var w=document.getElementById('aliyunCaptcha-window-popup');if(w&&getComputedStyle(w).display==='none')w.style.display='block';var m=document.getElementById('aliyunCaptcha-mask');if(m)m.style.display='block';return 1;})()");
const sliderOk = await ev("(function(){var s=document.getElementById('aliyunCaptcha-sliding-slider');if(!s)return 'NO-SLIDER';var r=s.getBoundingClientRect();return r.width>0?JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2}):'ZERO-RECT';})()");
log('[P0] slider=' + sliderOk);
if (sliderOk === 'NO-SLIDER' || sliderOk === 'ZERO-RECT') { log('ABORT: no slider'); ws.close(); process.exit(1); }
const s0 = JSON.parse(sliderOk);

// ============ P1: 布点 ============
await send('Debugger.enable');
await sleep(1500);
let pe = null;
for (const p of scripts) {
  const u = String(p.url || '');
  if (u.includes('dynamicJS') && u.includes('pe.059')) { pe = p; break; }
}
if (!pe) { log('NO PE.059 SCRIPT. scripts=' + scripts.length); ws.close(); process.exit(10); }
log('[P1] pe.059 sid=' + pe.scriptId);
const bpids = [];
for (const col of [COL_STACK - 2, COL_STACK - 1, COL_STACK]) {
  const r = await send('Debugger.setBreakpoint', { location: { scriptId: pe.scriptId, lineNumber: 0, columnNumber: col } });
  const bid = r?.result?.breakpointId;
  if (bid) bpids.push(bid);
  log('[P1] bp@' + col + ' -> ' + (bid || JSON.stringify(r).slice(0, 100)));
}

// ============ P2: 拖动 ============
log('[P2] dragging PX=' + PX + ' from ' + s0.x.toFixed(0) + ',' + s0.y.toFixed(0));
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: s0.x, y: s0.y });
await sleep(150);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: s0.x, y: s0.y, button: 'left', clickCount: 1 });
await sleep(120);
const steps = Math.max(16, Math.round(PX / 10));
for (let i = 1; i <= steps; i++) {
  const k = i / steps;
  const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const x = s0.x + PX * ease + (Math.random() * 2 - 1);
  const y = s0.y + (Math.random() * 2 - 1);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left' });
  await sleep(15 + Math.random() * 12);
}
await sleep(140);
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: s0.x + PX, y: s0.y, button: 'left', clickCount: 1 });
log('[P2] drag released');

// ============ P3: 等 paused ============
let paused = null;
const t0 = Date.now();
while (Date.now() - t0 < 60000) {
  const p = events.find(e => e.method === 'Debugger.paused');
  if (p) { paused = p; break; }
  await sleep(200);
}
if (!paused) { log('NO_PAUSE (60s)'); for (const b of bpids) await send('Debugger.removeBreakpoint', { breakpointId: b }); await send('Debugger.disable'); ws.close(); process.exit(12); }
const frames = paused.params.callFrames || [];
log('[P3] PAUSED reason=' + paused.params.reason + ' frames=' + frames.length);
for (let i = 0; i < Math.min(frames.length, 8); i++) {
  const f = frames[i];
  log('  f[' + i + '] ' + (f.functionName || '(anon)') + ' @ ' + String(f.url).split('/').pop().slice(0, 30) + ' loc=' + (f.location.lineNumber + 1) + ':' + f.location.columnNumber);
}

const evalOn = async (f, expr, timeout = 20000) => {
  const r = await send('Debugger.evaluateOnCallFrame', { callFrameId: f.callFrameId, expression: expr, returnByValue: true }, timeout);
  if (r?.result?.exceptionDetails) return { err: String(r.result.exceptionDetails.text || '').slice(0, 120) };
  return { value: r?.result?.result?.value };
};

// ============ P4: 找 ts 帧 + 保存引用 ============
const report = { tsFrame: -1, save: null, scan: null };
for (let fi = 0; fi < Math.min(frames.length, 8); fi++) {
  const f = frames[fi];
  const r = await evalOn(f, `(function(){try{return typeof ts==='function'?('ts-len:'+String(ts).length):(typeof ts);}catch(e){return 'NTS';}})()`);
  log('[P4] f' + fi + ' ts? ' + JSON.stringify(r.value || r.err));
  if (typeof r.value === 'string' && r.value.startsWith('ts-len:')) { report.tsFrame = fi; break; }
}
if (report.tsFrame < 0) { log('TS NOT FOUND in frames 0-7'); }
const tf = report.tsFrame >= 0 ? frames[report.tsFrame] : frames[0];

// 收集 tf 所有作用域层的变量名
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
const namesArr = [...allNames].slice(0, 500);
const namesJson = JSON.stringify(namesArr);

// 扫描：找 ts（大函数）/ 素材（TrackList）/ cvp（certifyId+sceneId）
const scan = await evalOn(tf, `(function(){
  var names = ${namesJson};
  var out = { ts:null, mat:null, cvp:null, tsLen:0 };
  for (var i = 0; i < names.length; i++) {
    var nm = names[i]; var v;
    try { v = eval(nm); } catch (e) { continue; }
    if (v === undefined || v === null) continue;
    if (typeof v === 'function') {
      try { var s = String(v); if (!out.ts && s.length > 20000 && s.indexOf('switch') >= 0) { out.ts = nm; out.tsLen = s.length; } } catch (e) {}
    } else if (typeof v === 'object' && !Array.isArray(v)) {
      try {
        var ks = Object.keys(v);
        if (!out.mat && (ks.indexOf('TrackList') >= 0 || ks.indexOf('TrackStartTime') >= 0)) out.mat = nm;
        if (!out.cvp && ks.indexOf('certifyId') >= 0 && (ks.indexOf('sceneId') >= 0 || ks.indexOf('deviceToken') >= 0)) out.cvp = nm;
      } catch (e) {}
    }
  }
  return JSON.stringify(out);
})()`);
log('[P4] scan: ' + JSON.stringify(scan.value || scan.err));
report.scan = scan.value;

let scanObj = {};
try { scanObj = JSON.parse(scan.value || '{}'); } catch (e) {}
const tsName = scanObj.ts || (report.tsFrame >= 0 ? 'ts' : null);
const matName = scanObj.mat;
const cvpName = scanObj.cvp;

// 保存引用与克隆
if (tsName) {
  const saveExpr = `(function(){
    var r = {};
    try { window.__TSREF = ${tsName}; r.ts = typeof ${tsName}; r.tsLen = String(${tsName}).length; } catch (e) { r.ts = 'ERR:' + e; }
    try { window.__CTXREF = this; } catch (e) {}
    ${matName ? `try { window.__MATREF = ${matName}; r.matRef = 1;
        try { window.__MATCLONE = JSON.parse(JSON.stringify(${matName})); r.matCloneLen = JSON.stringify(window.__MATCLONE).length; } catch (e2) { r.matClone = 'ERR:' + e2; }
      } catch (e) { r.matRef = 'ERR:' + e; }` : `r.matRef = 'not-found';`}
    ${cvpName ? `try { window.__CVPREF = ${cvpName}; window.__CVP_DATA_TRUTH = String(${cvpName}.data || ''); r.cvpDataLen = window.__CVP_DATA_TRUTH.length; r.cvpDataHead = window.__CVP_DATA_TRUTH.slice(0, 50); } catch (e) { r.cvp = 'ERR:' + e; }` : `r.cvp = 'not-found';`}
    return JSON.stringify(r);
  })()`;
  const save = await evalOn(tf, saveExpr, 25000);
  log('[P4] save: ' + JSON.stringify(save.value || save.err));
  report.save = save.value;
}

// resume + 清理
await send('Debugger.resume');
for (const b of bpids) await send('Debugger.removeBreakpoint', { breakpointId: b });
await send('Debugger.disable');
log('[P4] resumed + cleaned');

// ============ P5: 程序化调用 ============
await sleep(3500);
const gen = await ev(`(function(){
  try {
    var mat = window.__MATCLONE || window.__MATREF;
    if (!window.__TSREF) return 'NO_TS';
    if (!mat) return 'NO_MAT';
    var ctx = window.__CTXREF || window;
    var out = window.__TSREF.call(ctx, 11, mat);
    window.__GEN = out;
    return JSON.stringify({ type: typeof out, len: (out && out.length) || null, head: String(out || '').slice(0, 60) });
  } catch (e) { return 'ERR:' + e; }
})()`);
log('[P5] GEN: ' + JSON.stringify(gen));

// ============ P6: 对照 ============
const cmp = await ev(`(function(){
  var truth = window.__CVP_DATA_TRUTH || '';
  var g = window.__GEN;
  return JSON.stringify({
    truthLen: truth.length, truthHead: truth.slice(0, 50),
    genLen: g && g.length ? g.length : null, genHead: String(g || '').slice(0, 50),
    equal: String(g) === truth
  });
})()`);
log('[P6] CMP: ' + JSON.stringify(cmp));

fs.writeFileSync('/tmp/zai-recon-4/za11-hijack-report.json', JSON.stringify({ report, gen, cmp, ts: Date.now() }, null, 1));
log('DONE-HIJACK');
ws.close();
