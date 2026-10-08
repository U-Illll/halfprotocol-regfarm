// sm_getmes.mjs — 真实鼠标点击"获取验证码" + 全量抓网络
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
    if (/ishumei/.test(u) && !/\.(png|jpg|jpeg|gif|css|woff2?|ico|svg|js)/.test(u)) {
      reqs.push({ m: m.params.request.method, u: u.slice(0, 160), pd: null });
    }
  }
  if (m.method === 'Network.responseReceived') {
    const u = m.params?.response?.url || '';
    if (/ishumei|fengkong/.test(u) && !/\.(png|jpg|jpeg|gif|css|woff2?|ico|svg|js)/.test(u)) respIds.push({ id: m.params.requestId, u: u.slice(0, 140), status: m.params.response.status });
  }
};
const send = (m, p = {}, timeoutMs = 20000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;
const log = s => { console.log(s); fs.appendFileSync(OUT + '/sm-getmes.log', s + '\n'); };

await send('Network.enable', {});
await send('Page.bringToFront', {});
await sleep(300);

// 检查 getMes 按钮状态
const st = await ev(`(function(){try{
  var c=document.querySelector('.getMes');
  if(!c) return 'NO';
  var r=c.getBoundingClientRect();
  return JSON.stringify({cls:String(c.className), text:c.innerText, x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height), cx:Math.round(r.x+r.width/2), cy:Math.round(r.y+r.height/2)});
}catch(e){return 'ERR '+e}})()`);
log('[getMes 状态] ' + st);
const o = JSON.parse(st);
if (!o.cx) { log('ABORT'); process.exit(1); }

// 真实鼠标点击
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: o.cx - 40, y: o.cy });
await sleep(180);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: o.cx, y: o.cy });
await sleep(140);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: o.cx, y: o.cy, button: 'left', buttons: 1, clickCount: 1 });
await sleep(95);
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: o.cx, y: o.cy, button: 'left', clickCount: 1 });
log('[已点击 ' + o.cx + ',' + o.cy + ']');

// 观察 15s
for (let k = 1; k <= 15; k++) {
  await sleep(1000);
  const s2 = await ev(`(function(){try{
    var c=document.querySelector('.getMes');
    var txt=(document.body.innerText||'').replace(/\\s+/g,' ');
    var hint=(txt.match(/(重新发送|秒|已发送|发送成功|验证码已|短信未填写|forbidMes|失败|错误)/g)||[]).slice(0,5);
    return JSON.stringify({mesText: c?c.innerText:null, mesCls: c?String(c.className).slice(0,50):null, hint});
  }catch(e){return 'ERR '+e}})()`);
  if (k <= 8 || k === 15) log(`[+${k}s] ` + s2);
}
log('=== 请求 ===');
for (const r of reqs) log(`[REQ] ${r.m} ${r.u}`);
log('=== 响应 ===');
for (const r of respIds.slice(-8)) {
  try {
    const body = await send('Network.getResponseBody', { requestId: r.id });
    const b = String(body?.result?.body || '');
    if (b) log('[resp] ' + r.status + ' ' + r.u + ' :: ' + b.slice(0, 400));
  } catch (e) { log('[resp] ERR ' + r.u); }
}
ws.close();
