// sm_drag3.mjs — 数美对齐拖动 v3（带过程截图+全量抓包）
// 用法: node sm_drag3.mjs <drag_px> [mid_shot_path]
import fs from 'node:fs';
const PORT = process.env.CDP_PORT || '9229';
const OUT = process.env.SM_OUT || '/tmp/non-ali';
const TARGET = parseFloat(process.argv[2] || '209.5');
const MIDSHOT = process.argv[3] || '/tmp/non-ali/r3-drag-mid.png';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.filter(x => x.type === 'page').find(p => (p.url || '').includes('ishumei')) || list.filter(x => x.type === 'page')[0];
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const reqs = []; const respIds = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  if (m.method === 'Network.requestWillBeSent') {
    const u = m.params?.request?.url || '';
    if (/fverify/.test(u)) reqs.push({ m: m.params.request.method, u: u.slice(0, 2000) });
  }
  if (m.method === 'Network.responseReceived') {
    const u = m.params?.response?.url || '';
    if (/fverify/.test(u)) respIds.push({ id: m.params.requestId, u: u.slice(0, 100), status: m.params.response.status });
  }
};
const send = (m, p = {}, T = 25000) => new Promise(res => { const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, T); pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true }))?.result?.result?.value;
const log = s => { console.log(s); fs.appendFileSync(OUT + '/sm-drag3.log', s + '\n'); };

await send('Network.enable', {});
const win = await send('Browser.getWindowForTarget', {});
if (win?.result?.windowId) await send('Browser.setWindowBounds', { windowId: win.result.windowId, bounds: { windowState: 'normal' } });
await send('Page.bringToFront', {});
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await sleep(300);

const btn = JSON.parse(await ev(`(function(){var e=document.querySelector('.shumei_captcha_slide_btn');if(!e)return '{}';var r=e.getBoundingClientRect();return JSON.stringify({cx:r.x+r.width/2,cy:r.y+r.height/2});})()`) || '{}');
log('[btn] ' + JSON.stringify(btn));
if (!btn.cx) { log('ABORT-NO-BTN'); process.exit(1); }

await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: btn.cx, y: btn.cy });
await sleep(200);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: btn.cx, y: btn.cy, button: 'left', buttons: 1, clickCount: 1 });
await sleep(150);
const steps = Math.max(20, Math.round(TARGET / 5));
let x = btn.cx;
for (let i = 1; i <= steps; i++) {
  const p = i / steps;
  const eased = 1 - Math.pow(1 - p, 3);
  x = btn.cx + TARGET * eased;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: btn.cy + (Math.random() - 0.5) * 1.8, button: 'left', buttons: 1 });
  await sleep(28 + Math.random() * 14);
}
// 到位停顿 + 过程截图（仍按住）
await sleep(1200);
try {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot?.result?.data) { fs.writeFileSync(MIDSHOT, Buffer.from(shot.result.data, 'base64')); log('[midshot] ' + MIDSHOT); }
} catch (e) { log('[midshot ERR] ' + e); }
// 微调 0.5px 后释放
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: btn.cx + TARGET + 0.5, y: btn.cy, button: 'left', buttons: 1 });
await sleep(140);
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btn.cx + TARGET + 0.5, y: btn.cy, button: 'left', clickCount: 1 });
log('[released @' + (TARGET + 0.5) + 'px]');

await sleep(4000);
for (const r of reqs) log('[fverify URL] ' + r.u.slice(0, 1200));
for (const r of respIds.slice(-4)) {
  try {
    const body = await send('Network.getResponseBody', { requestId: r.id });
    log('[fverify resp] ' + r.status + ' :: ' + String(body?.result?.body || '').slice(0, 400));
  } catch (e) { log('[resp ERR]'); }
}
ws.close();
