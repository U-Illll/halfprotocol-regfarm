// sm_resend.mjs — 真实点击"获取验证码"重发 + 抓 sendsms 响应
import fs from 'node:fs';
const PORT = process.env.CDP_PORT || '9229';
const OUT = process.env.SM_OUT || '/tmp/non-ali';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.filter(x => x.type === 'page').find(p => (p.url || '').includes('ishumei')) || list.filter(x => x.type === 'page')[0];
if (!t) { console.log('NO page'); process.exit(1); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const respIds = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  if (m.method === 'Network.responseReceived') {
    const u = m.params?.response?.url || '';
    if (/sendsms|checkTelCode/.test(u)) respIds.push({ id: m.params.requestId, u: u.slice(0, 130), status: m.params.response.status });
  }
};
const send = (m, p = {}, timeoutMs = 15000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;
const log = s => { console.log(s); fs.appendFileSync(OUT + '/sm-reg4.log', s + '\n'); };

await send('Network.enable', {});
await send('Page.bringToFront', {});
await sleep(300);

const c = JSON.parse(await ev(`(function(){var e=document.querySelector('.getMes');if(!e)return '{}';var r=e.getBoundingClientRect();return JSON.stringify({cx:Math.round(r.x+r.width/2),cy:Math.round(r.y+r.height/2),txt:e.innerText,cls:String(e.className)});})()`) || '{}');
log('[getMes] ' + JSON.stringify(c));
if (!c.cx) { log('ABORT'); process.exit(1); }

await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.cx - 40, y: c.cy });
await sleep(180);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.cx, y: c.cy });
await sleep(140);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.cx, y: c.cy, button: 'left', buttons: 1, clickCount: 1 });
await sleep(95);
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.cx, y: c.cy, button: 'left', clickCount: 1 });
log('[clicked]');

for (let k = 1; k <= 8; k++) {
  await sleep(1000);
  const st = await ev(`(function(){var e=document.querySelector('.getMes');var txt=(document.body.innerText||'').replace(/\\s+/g,' ');var hint=(txt.match(/(秒|已发送|验证码已|错误|失败|频繁|请稍后)/g)||[]).slice(0,4);return JSON.stringify({mes:e?e.innerText:null, hint});})()`);
  log(`[+${k}s] ` + st);
}
for (const r of respIds.slice(-4)) {
  try {
    const body = await send('Network.getResponseBody', { requestId: r.id });
    log('[resp] ' + r.status + ' ' + r.u + ' :: ' + String(body?.result?.body || '').slice(0, 300));
  } catch (e) { log('[resp] ERR'); }
}
ws.close();
