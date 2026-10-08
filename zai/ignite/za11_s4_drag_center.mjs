// za11_s4_drag_center.mjs — S4：修正坐标（滑块中心）+ 拖动 + 观察
import fs from 'node:fs';
const PORT = '9226';
const PX = parseFloat(process.argv[2] || '250');
const REMOVE_HOOK = process.argv[3] === 'nohook';
const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter(t => t.type === 'page');
const t = pages.find(p => (p.url || '').includes('chat.z.ai')) || pages[0];
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (m, p = {}, timeoutMs = 20000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;
const log = s => { console.log(s); fs.appendFileSync('/tmp/zai-recon-4/za11-s4.log', s + '\n'); };

const win = await send('Browser.getWindowForTarget', { targetId: t.id });
if (win?.result?.windowId) await send('Browser.setWindowBounds', { windowId: win.result.windowId, bounds: { windowState: 'normal' } });
await send('Page.bringToFront');
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await sleep(300);

if (REMOVE_HOOK) {
  const rh = await ev(`(function(){if(window.__BIND_HOOKED2 && window.__BIND_ORIG){Function.prototype.bind = window.__BIND_ORIG;window.__BIND_HOOKED2=false;return 'restored';}return 'no-hook';})()`);
  log('[0] remove-hook: ' + rh);
} else {
  // 确保 hook 在（记录原始 bind 以备恢复）
  const rh = await ev(`(function(){if(!window.__BIND_HOOKED2){var b=Function.prototype.bind;window.__BIND_ORIG=b;window.__BIND_HOOKED2=true;window.__BIND_CANDS=window.__BIND_CANDS||[];var _bind=b;Function.prototype.bind=function(){try{if(arguments.length>=2&&arguments[1]===11&&typeof this==='function'){var isTs=false;try{isTs=(this.length===6)&&String(this).length>20000;}catch(e){}if(!isTs){try{isTs=String(this).length>30000&&/switch/.test(String(this));}catch(e){}}if(isTs){window.__TSREF=this;window.__BIND_THISARG=arguments[0];window.__BIND_T=Date.now();try{window.__BIND_CANDS.push({t:Date.now(),len:String(this).length});}catch(e){}var bf=_bind.apply(this,arguments);return function(){try{window.__MATREF=arguments[0];window.__MAT_T=Date.now();}catch(e){}return bf.apply(null,arguments);};}}}catch(e){}return _bind.apply(this,arguments);};return 're-hooked';}return 'already';})()`);
  log('[0] hook check: ' + rh);
}

// 强显示
await ev("(function(){var w=document.getElementById('aliyunCaptcha-window-popup');if(w)w.style.display='block';var m=document.getElementById('aliyunCaptcha-mask');if(m)m.style.display='block';return 1;})()");
await sleep(500);

// 修正坐标：滑块中心
const sInfo = JSON.parse(await ev(`(function(){var s=document.getElementById('aliyunCaptcha-sliding-slider');if(!s)return '{}';var r=s.getBoundingClientRect();return JSON.stringify({cx:r.x+r.width/2, cy:r.y+r.height/2, w:r.width, h:r.height, cert:(document.getElementById('aliyunCaptcha-certifyId')||{}).textContent});})()`) || '{}');
log('[1] slider center: ' + JSON.stringify(sInfo));
if (!sInfo.cx) { log('ABORT'); ws.close(); process.exit(1); }

log('[2] drag ' + PX + 'px from ' + sInfo.cx.toFixed(0) + ',' + sInfo.cy.toFixed(0));
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
log('[2] released');

// 观察 45s
let prev = '';
for (let i = 0; i < 45; i++) {
  await sleep(1000);
  const s = await ev(`JSON.stringify({
    text:(document.getElementById('aliyunCaptcha-sliding-text')||{}).textContent,
    pz:(function(){var p=document.getElementById('aliyunCaptcha-puzzle');return p?p.style.left:null;})(),
    ts:!!window.__TSREF, mat:!!window.__MATREF, cands:(window.__BIND_CANDS||[]).length,
    cvps:(window.__CVPS||[]).length, netx:(window.__NETX?window.__NETX.recs.length:-1)
  })`);
  if (s !== prev) { log('[3 +' + (i + 1) + 's] ' + s); prev = s; }
}

const cap = await ev(`JSON.stringify({
  tsLen: window.__TSREF ? String(window.__TSREF).length : null,
  matKeys: window.__MATREF ? Object.keys(window.__MATREF) : null,
  matT: window.__MAT_T || null,
  cands: window.__BIND_CANDS || [],
  newCvps: (window.__CVPS||[]).map(function(x){return {dataLen:x.dataLen, t:String(x.t).slice(-7)};})
})`);
log('[4] capture: ' + cap);
log('DONE-S4');
ws.close();
