// za11_s8b.mjs — S8b：pe.071 布点（4候选 + e系精细区）+ 多停快照循环
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
const log = s => { console.log(s); fs.appendFileSync('/tmp/zai-recon-4/za11-s8b.log', s + '\n'); };

const win = await send('Browser.getWindowForTarget', { targetId: t.id });
if (win?.result?.windowId) await send('Browser.setWindowBounds', { windowId: win.result.windowId, bounds: { windowState: 'normal' } });
await send('Page.bringToFront');
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await sleep(300);

await send('Debugger.enable');
await sleep(1500);
let pe = null;
for (const p of scripts) { const u = String(p.url || ''); if (u.includes('dynamicJS') && u.includes('pe.')) { pe = p; break; } }
if (!pe) { log('NO PE'); ws.close(); process.exit(10); }
const peVer = String(pe.url).split('/').pop().split('.')[1];
log('[P1] pe.' + peVer + ' sid=' + pe.scriptId);
if (peVer !== '071') { log('VER!=071 abort'); await send('Debugger.disable'); ws.close(); process.exit(11); }

// 分组布点
const GROUPS = {
  A: [272082, 272040, 272124],          // s系
  B: [275433, 275390, 275476],          // stringify+replace
  C: [282325, 282280, 282370],          // 双stringify
  D: [284890, 284903, 284916, 284922, 284930]  // e系 + 预测真组装点
};
const bpids = [];
for (const [g, cols] of Object.entries(GROUPS)) {
  for (const col of cols) {
    const r = await send('Debugger.setBreakpoint', { location: { scriptId: pe.scriptId, lineNumber: 0, columnNumber: col } });
    if (r?.result?.breakpointId) bpids.push({ bid: r.result.breakpointId, col, group: g, actual: r.result.actualLocation?.columnNumber });
  }
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

async function snap(tag, pIdx) {
  const ps = events.filter(e => e.method === 'Debugger.paused');
  const p = ps[pIdx];
  const frames = p.params.callFrames || [];
  const hitLoc = frames[0] ? (frames[0].location.lineNumber + 1) + ':' + frames[0].location.columnNumber : '?';
  log('[' + tag + '] PAUSED @' + hitLoc + ' frames=' + frames.length);
  const f0 = frames[0];
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
    var out = { strings: [], cvps: [], mats: [], bigfns: [] };
    for (var i = 0; i < names.length; i++) {
      var nm = names[i]; var v;
      try { v = eval(nm); } catch (e) { continue; }
      if (v === undefined || v === null) continue;
      if (typeof v === 'string') { if (v.length > 250) out.strings.push({ n: nm, len: v.length, head: String(v).slice(0, 46) }); }
      else if (typeof v === 'function') { try { var s = String(v); if (s.length > 8000) out.bigfns.push({ n: nm, len: s.length }); } catch (e) {} }
      else if (typeof v === 'object' && !Array.isArray(v)) { try {
        var ks = Object.keys(v);
        if (ks.indexOf('certifyId') >= 0) out.cvps.push({ n: nm, keys: ks.slice(0, 12), dataLen: (typeof v.data === 'string') ? v.data.length : null, dataHead: (typeof v.data === 'string') ? v.data.slice(0, 36) : null });
        if (ks.indexOf('TrackList') >= 0) out.mats.push({ n: nm, keys: ks.slice(0, 8) });
      } catch (e) {} }
    }
    return JSON.stringify(out);
  })()`;
  const r = await evalOn(f0, snapExpr, 25000);
  log('[' + tag + '] snap: ' + String(r.value || r.err).slice(0, 2200));
  fs.writeFileSync('/tmp/zai-recon-4/za11-s8b-snap-' + tag + '.json', JSON.stringify({ hitLoc, frames: frames.length, snap: JSON.parse(r.value || '{}') }, null, 1));
}

// 多停循环（最多 4 停）
let stopIdx = 0, lastSeen = 0;
const tEnd = Date.now() + 240000;
while (stopIdx < 4 && Date.now() < tEnd) {
  // 等新的 paused
  let found = false;
  const tw = Date.now();
  while (Date.now() - tw < 80000) {
    const ps = events.filter(e => e.method === 'Debugger.paused');
    if (ps.length > lastSeen) { found = true; lastSeen = ps.length; break; }
    await sleep(150);
  }
  if (!found) { log('[loop] no more pauses (seen=' + lastSeen + ')'); break; }
  stopIdx++;
  await snap('stop' + stopIdx, lastSeen - 1);
  // 移除「命中点所在组」的 bp
  const lastP = events.filter(e => e.method === 'Debugger.paused').pop();
  const hitCol = lastP.params.callFrames?.[0]?.location?.columnNumber ?? -1;
  let grp = null;
  for (const [g, cols] of Object.entries(GROUPS)) {
    if (cols.some(c => Math.abs(c - hitCol) < 200)) { grp = g; break; }
  }
  if (grp) {
    for (const b of bpids) { if (b.group === grp && b.bid) { await send('Debugger.removeBreakpoint', { breakpointId: b.bid }); b.bid = null; } }
    log('[loop] removed group ' + grp + ' (hit@' + hitCol + ')');
  }
  if (lastSeen >= 1) await send('Debugger.resume');
}
// 清理
try { for (const b of bpids) { if (b.bid) await send('Debugger.removeBreakpoint', { breakpointId: b.bid }); } await send('Debugger.resume'); await send('Debugger.disable'); } catch (e) {}
log('[P5] cleaned');
await sleep(2500);
const cvps = await ev(`JSON.stringify((window.__CVPS||[]).map(function(x){return {dataLen:x.dataLen, head:String(x.dataHead||'').slice(0,36), t:String(x.t).slice(-7)};}))`);
log('[P6] cvps: ' + cvps);
log('DONE-S8B');
ws.close();
