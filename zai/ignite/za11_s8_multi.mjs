// za11_s8_multi.mjs — S8：多停模式。上游组+终点组 → 两次暂停两个快照（终点帧含 cvp+data）
import fs from 'node:fs';
const PORT = '9226';
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
const log = s => { console.log(s); fs.appendFileSync('/tmp/zai-recon-4/za11-s8.log', s + '\n'); };

const win = await send('Browser.getWindowForTarget', { targetId: t.id });
if (win?.result?.windowId) await send('Browser.setWindowBounds', { windowId: win.result.windowId, bounds: { windowState: 'normal' } });
await send('Page.bringToFront');
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await sleep(300);
log('[P0] vis=' + await ev('document.visibilityState'));

await send('Debugger.enable');
await sleep(1500);
let pe = null;
for (const p of scripts) { const u = String(p.url || ''); if (u.includes('dynamicJS') && u.includes('pe.')) { pe = p; break; } }
if (!pe) { log('NO PE'); ws.close(); process.exit(10); }
const peVer = String(pe.url).split('/').pop().split('.')[1];
log('[P1] pe.' + peVer + ' sid=' + pe.scriptId);
if (peVer !== '082') { log('VERSION != 082, abort for manual relocate. url=' + pe.url); await send('Debugger.disable'); ws.close(); process.exit(11); }

// 两组点：上游组 + 终点组
const UP = [271620, 271678, 271736];
const FINAL = [271688, 271691, 271694];
const bpids = []; // {bid, col, group}
for (const col of UP) {
  const r = await send('Debugger.setBreakpoint', { location: { scriptId: pe.scriptId, lineNumber: 0, columnNumber: col } });
  if (r?.result?.breakpointId) bpids.push({ bid: r.result.breakpointId, col, group: 'up', actual: r.result.actualLocation?.columnNumber });
}
for (const col of FINAL) {
  const r = await send('Debugger.setBreakpoint', { location: { scriptId: pe.scriptId, lineNumber: 0, columnNumber: col } });
  if (r?.result?.breakpointId) bpids.push({ bid: r.result.breakpointId, col, group: 'final', actual: r.result.actualLocation?.columnNumber });
}
log('[P1] bps: ' + JSON.stringify(bpids.map(b => b.group + '@' + b.col + '->' + b.actual)));

// 强显示 + 拖动
await ev("(function(){var w=document.getElementById('aliyunCaptcha-window-popup');if(w)w.style.display='block';var m=document.getElementById('aliyunCaptcha-mask');if(m)m.style.display='block';return 1;})()");
await sleep(400);
const sInfo = JSON.parse(await ev(`(function(){var s=document.getElementById('aliyunCaptcha-sliding-slider');var r=s.getBoundingClientRect();return JSON.stringify({cx:r.x+r.width/2,cy:r.y+r.height/2,cert:(document.getElementById('aliyunCaptcha-certifyId')||{}).textContent});})()`) || '{}');
log('[P2] slider ' + sInfo.cx + ',' + sInfo.cy + ' cert=' + sInfo.cert);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sInfo.cx, y: sInfo.cy });
await sleep(150);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sInfo.cx, y: sInfo.cy, button: 'left', clickCount: 1 });
await sleep(120);
const steps = Math.max(18, Math.round(PX / 10));
for (let i = 1; i <= steps; i++) {
  const k = i / steps;
  const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sInfo.cx + PX * ease + (Math.random() * 2 - 1), y: sInfo.cy + (Math.random() * 2 - 1), button: 'left' });
  await sleep(15 + Math.random() * 12);
}
await sleep(140);
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: sInfo.cx + PX, y: sInfo.cy, button: 'left', clickCount: 1 });
log('[P2] released');

const evalOn = async (f, expr, timeout = 20000) => {
  const r = await send('Debugger.evaluateOnCallFrame', { callFrameId: f.callFrameId, expression: expr, returnByValue: true }, timeout);
  if (r?.result?.exceptionDetails) return { err: String(r.result.exceptionDetails.text || '').slice(0, 150) };
  return { value: r?.result?.result?.value };
};

// 快照函数
async function snap(tag) {
  const p = events.filter(e => e.method === 'Debugger.paused').pop();
  const frames = p.params.callFrames || [];
  const hitLoc = frames[0] ? (frames[0].location.lineNumber + 1) + ':' + frames[0].location.columnNumber : '?';
  log('[' + tag + '] PAUSED @' + hitLoc + ' frames=' + frames.length);
  const f0 = frames[0];
  // 快照表达式：类型+预览所有变量（用 for..in 不可行，扫 scopeChain）
  const scNames = [];
  for (const sc of (f0.scopeChain || [])) {
    if (!sc.object?.objectId) continue;
    const pr = await send('Runtime.getProperties', { objectId: sc.object.objectId, ownProperties: true }, 20000);
    for (const pp of (pr?.result?.result || [])) {
      if (pp.name === 'this' || pp.name === 'arguments') continue;
      if (pp.value && (pp.value.type === 'function' || pp.value.type === 'object' || pp.value.type === 'string')) scNames.push(pp.name);
    }
  }
  const namesJson = JSON.stringify([...new Set(scNames)].slice(0, 800));
  const snapExpr = `(function(){
    var names = ${namesJson};
    var out = { strings: [], cvps: [], mats: [], bigfns: [], err: null };
    for (var i = 0; i < names.length; i++) {
      var nm = names[i]; var v;
      try { v = eval(nm); } catch (e) { continue; }
      if (v === undefined || v === null) continue;
      if (typeof v === 'string') {
        if (v.length > 300) out.strings.push({ n: nm, len: v.length, head: String(v).slice(0, 50) });
      } else if (typeof v === 'function') {
        try { var s = String(v); if (s.length > 8000) out.bigfns.push({ n: nm, len: s.length, head: s.slice(0, 60) }); } catch (e) {}
      } else if (typeof v === 'object' && !Array.isArray(v)) {
        try {
          var ks = Object.keys(v);
          if (ks.indexOf('certifyId') >= 0 && (ks.indexOf('sceneId') >= 0 || ks.indexOf('deviceToken') >= 0)) {
            out.cvps.push({ n: nm, keys: ks.slice(0, 12), dataLen: (typeof v.data === 'string') ? v.data.length : null, dataHead: (typeof v.data === 'string') ? v.data.slice(0, 40) : null });
          }
          if (ks.indexOf('TrackList') >= 0) out.mats.push({ n: nm, keys: ks.slice(0, 10) });
        } catch (e) {}
      }
    }
    return JSON.stringify(out);
  })()`;
  const r = await evalOn(f0, snapExpr, 25000);
  log('[' + tag + '] snap: ' + String(r.value || r.err).slice(0, 2600));
  fs.writeFileSync('/tmp/zai-recon-4/za11-s8-snap-' + tag + '.json', JSON.stringify({ hitLoc, frames: frames.length, snap: JSON.parse(r.value || '{}') }, null, 1));
  return { hitLoc, r };
}

// 停 1：等 paused
let got1 = false, got2 = false;
let t0 = Date.now();
while (Date.now() - t0 < 90000) { if (events.some(e => e.method === 'Debugger.paused')) { got1 = true; break; } await sleep(150); }
if (!got1) { log('NO_PAUSE#1'); await send('Debugger.disable'); ws.close(); process.exit(12); }
const s1 = await snap('stop1');
// 移除「当前停点所在组」的全部 bp：按命中列判断组
const hit1col = parseInt(String(s1.hitLoc).split(':')[1] || '0', 10);
const group1 = (hit1col < 272000) ? 'up' : 'final';
for (const b of bpids) { if (b.group === group1 && b.bid) await send('Debugger.removeBreakpoint', { breakpointId: b.bid }); }
log('[R1] removed group=' + group1);
await send('Debugger.resume');

// 停 2：等下一个 paused（另一个组）
t0 = Date.now();
while (Date.now() - t0 < 90000) { const ps = events.filter(e => e.method === 'Debugger.paused'); if (ps.length >= 2) { got2 = true; break; } await sleep(150); }
if (got2) { const s2 = await snap('stop2'); }
else log('[R2] no second pause');

// 清理：remove 全部 + resume + disable
try { for (const b of bpids) { if (b.bid) await send('Debugger.removeBreakpoint', { breakpointId: b.bid }); } await send('Debugger.resume'); await send('Debugger.disable'); } catch (e) {}
log('[P5] cleaned');
await sleep(2500);
// 真 data（从 cvps）
const cvps = await ev(`JSON.stringify((window.__CVPS||[]).map(function(x){return {dataLen:x.dataLen, head:String(x.dataHead||'').slice(0,40), t:String(x.t).slice(-7)};}))`);
log('[P6] cvps: ' + cvps);
log('DONE-S8');
ws.close();
