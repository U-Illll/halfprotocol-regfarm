// sm_drag1.mjs — 数美滑块第一次侦察拖动（两段式 + 全程抓网络）
import fs from 'node:fs';
const PORT = process.env.CDP_PORT || '9229';
const OUT = '/tmp/non-ali';
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
    if (/fengkongcloud/.test(u) && /(verify|check|slide|submit|ca\/v1)/.test(u)) {
      reqs.push({ ts: Date.now(), m: m.params.request.method, u: u.slice(0, 150), pd: (m.params.request.postData || '').slice(0, 4000) });
    }
  }
  if (m.method === 'Network.responseReceived') {
    const u = m.params?.response?.url || '';
    if (/fengkongcloud/.test(u) && /(verify|check|slide|submit|ca\/v1)/.test(u)) respIds.push({ id: m.params.requestId, u: u.slice(0, 120), status: m.params.response.status });
  }
};
const send = (m, p = {}, timeoutMs = 25000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;
const log = s => { console.log(s); fs.appendFileSync(OUT + '/sm-drag1.log', s + '\n'); };

await send('Network.enable', {});
// 焦点三件套
const win = await send('Browser.getWindowForTarget', {});
if (win?.result?.windowId) await send('Browser.setWindowBounds', { windowId: win.result.windowId, bounds: { windowState: 'normal' } });
await send('Page.bringToFront', {});
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await sleep(300);

// 手柄位置
const btn = JSON.parse(await ev(`(function(){var e=document.querySelector('.shumei_captcha_slide_btn');if(!e)return '{}';var r=e.getBoundingClientRect();return JSON.stringify({cx:r.x+r.width/2,cy:r.y+r.height/2,left:r.x});})()`) || '{}');
log('[btn] ' + JSON.stringify(btn));
if (!btn.cx) { log('ABORT-NO-BTN'); process.exit(1); }

// 段1：按下 + 拖 100px
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: btn.cx, y: btn.cy });
await sleep(150);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: btn.cx, y: btn.cy, button: 'left', buttons: 1, clickCount: 1 });
await sleep(120);
let x = btn.cx;
const SEG1 = 100;
for (let i = 1; i <= 12; i++) {
  x = btn.cx + (SEG1 * i / 12);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: btn.cy + (Math.random() - 0.5) * 1.5, button: 'left', buttons: 1 });
  await sleep(30 + Math.random() * 15);
}
await sleep(400);
// dump 映射：手柄位移 vs 拼图块位置
const m1 = await ev(`(function(){try{
  var b=document.querySelector('.shumei_captcha_slide_btn');
  var fg=document.querySelector('[class*=loaded_img_fg]');
  var bg=document.querySelector('[class*=loaded_img_bg]');
  function rc(e){if(!e)return null;var r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};}
  return JSON.stringify({btn:rc(b), fgEl:rc(fg), bgEl:rc(bg), fgStyle: fg?{left:fg.style.left,top:fg.style.top}:null, wrapper: (document.querySelector('[class*=shumei_captcha_wrapper]')||{}).className });
}catch(e){return 'ERR '+e}})()`);
log('[map-after-100] ' + m1);

// 段2：继续拖到目标（先假设映射 1:1 像素，拖到 165px 处——不足则再补）
const SEG2_TARGET = 165;
while (x < btn.cx + SEG2_TARGET) {
  x += 6; if (x > btn.cx + SEG2_TARGET) x = btn.cx + SEG2_TARGET;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: btn.cy + (Math.random() - 0.5) * 1.5, button: 'left', buttons: 1 });
  await sleep(32 + Math.random() * 15);
}
await sleep(200);
const m2 = await ev(`(function(){try{
  var fg=document.querySelector('[class*=loaded_img_fg]');
  function rc(e){if(!e)return null;var r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};}
  return JSON.stringify({fgEl:rc(fg), fgStyle: fg?{left:fg.style.left,top:fg.style.top}:null});
}catch(e){return 'ERR '+e}})()`);
log('[map-before-release] ' + m2);

await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y: btn.cy, button: 'left', clickCount: 1 });

// 观察 6s
for (let k = 1; k <= 6; k++) {
  await sleep(1000);
  const st = await ev(`(function(){try{
    var w=document.querySelector('[class*=shumei_captcha_wrapper]');
    var txt=(w?w.innerText:'').replace(/\\s+/g,' ').slice(0,150);
    return JSON.stringify({txt});
  }catch(e){return 'ERR '+e}})()`);
  log(`[after-release +${k}s] ` + st);
}

// 网络档案
log('=== 请求 ===');
for (const r of reqs) {
  log(`[REQ ${r.u.includes('log') ? 'LOG' : 'MAIN'}] ${r.m} ${r.u}`);
  if (r.pd && !r.u.includes('/log')) log('  PD: ' + r.pd.slice(0, 1500));
}
log('=== 响应 ===');
for (const r of respIds.slice(-10)) {
  try {
    const body = await send('Network.getResponseBody', { requestId: r.id });
    const b = String(body?.result?.body || '');
    if (b) log('[resp] ' + r.status + ' ' + r.u + ' :: ' + b.slice(0, 600));
  } catch (e) { log('[resp] ERR ' + r.u); }
}
ws.close();
