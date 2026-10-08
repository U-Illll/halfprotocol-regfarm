// sm_drag2.mjs — 数美对位拖动（精确目标距离）+ 全量协议抓取
// 用法: node sm_drag2.mjs <drag_px>
import fs from 'node:fs';
const PORT = process.env.CDP_PORT || '9229';
const OUT = '/tmp/non-ali';
const TARGET = parseFloat(process.argv[2] || '122.5');
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
    if (/fengkongcloud/.test(u) && !/\/log/.test(u)) {
      reqs.push({ ts: Date.now(), m: m.params.request.method, u: u.slice(0, 1500) });
    }
  }
  if (m.method === 'Network.responseReceived') {
    const u = m.params?.response?.url || '';
    if (/fengkongcloud/.test(u) && !/\/log/.test(u)) respIds.push({ id: m.params.requestId, u: u.slice(0, 130), status: m.params.response.status });
  }
};
const send = (m, p = {}, timeoutMs = 25000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;
const log = s => { console.log(s); fs.appendFileSync(OUT + '/sm-drag2.log', s + '\n'); };

await send('Network.enable', {});
// 确认当前题目
const q = await ev(`(function(){try{
  var bg=document.querySelector('[class*=loaded_img_bg]'), fg=document.querySelector('[class*=loaded_img_fg]');
  return JSON.stringify({bg: bg?(bg.src||'').slice(-50):null, fg: fg?(fg.src||'').slice(-50):null});
}catch(e){return 'ERR '+e}})()`);
log('[题目] ' + q);

// 焦点三件套
const win = await send('Browser.getWindowForTarget', {});
if (win?.result?.windowId) await send('Browser.setWindowBounds', { windowId: win.result.windowId, bounds: { windowState: 'normal' } });
await send('Page.bringToFront', {});
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await sleep(300);

// 手柄
const btn = JSON.parse(await ev(`(function(){var e=document.querySelector('.shumei_captcha_slide_btn');if(!e)return '{}';var r=e.getBoundingClientRect();return JSON.stringify({cx:r.x+r.width/2,cy:r.y+r.height/2});})()`) || '{}');
log('[btn] ' + JSON.stringify(btn));
if (!btn.cx) { log('ABORT-NO-BTN'); process.exit(1); }

// 拖动（eased + 末端停顿）
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: btn.cx, y: btn.cy });
await sleep(200);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: btn.cx, y: btn.cy, button: 'left', buttons: 1, clickCount: 1 });
await sleep(150);
const steps = Math.max(16, Math.round(TARGET / 5));
let x = btn.cx;
for (let i = 1; i <= steps; i++) {
  const p = i / steps;
  const eased = 1 - Math.pow(1 - p, 3);
  x = btn.cx + TARGET * eased;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: btn.cy + (Math.random() - 0.5) * 1.8, button: 'left', buttons: 1 });
  await sleep(28 + Math.random() * 14);
}
// 末端停顿 + 微抖
await sleep(260);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: btn.cx + TARGET, y: btn.cy + 0.5, button: 'left', buttons: 1 });
await sleep(120);
// 检查拼图块位置
const pre = await ev(`(function(){try{var fg=document.querySelector('[class*=loaded_img_fg]');var r=fg.getBoundingClientRect();return JSON.stringify({fgX:Math.round(r.x)});}catch(e){return 'ERR '+e}})()`);
log('[release前 fg 位置] ' + pre);
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btn.cx + TARGET, y: btn.cy, button: 'left', clickCount: 1 });

// 观察 8s
for (let k = 1; k <= 8; k++) {
  await sleep(1000);
  const st = await ev(`(function(){try{
    var w=document.querySelector('[class*=shumei_captcha_wrapper]');
    var txt=(w?w.innerText:'').replace(/\\s+/g,' ').slice(0,150);
    return JSON.stringify({txt});
  }catch(e){return 'ERR '+e}})()`);
  log(`[after +${k}s] ` + st);
}

log('=== 非日志请求（全量 URL） ===');
for (const r of reqs) log(`[REQ] ${r.m} ${r.u}`);
log('=== 响应 ===');
for (const r of respIds.slice(-8)) {
  try {
    const body = await send('Network.getResponseBody', { requestId: r.id });
    const b = String(body?.result?.body || '');
    if (b) log('[resp] ' + r.status + ' ' + r.u + ' :: ' + b.slice(0, 800));
  } catch (e) { log('[resp] ERR ' + r.u); }
}
ws.close();
