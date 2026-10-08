// sm_submit2.mjs — 勾选协议 + 再次提交免费试用
import fs from 'node:fs';
const PORT = process.env.CDP_PORT || '9229';
const OUT = process.env.SM_OUT || '/tmp/non-ali';
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
    if (/applyTry/.test(u)) reqs.push({ m: m.params.request.method, u: u.slice(0, 1200) });
  }
  if (m.method === 'Network.responseReceived') {
    const u = m.params?.response?.url || '';
    if (/applyTry/.test(u)) respIds.push({ id: m.params.requestId, u: u.slice(0, 120), status: m.params.response.status });
  }
};
const send = (m, p = {}, T = 20000) => new Promise(res => { const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, T); pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true }))?.result?.result?.value;
const log = s => { console.log(s); fs.appendFileSync(OUT + '/sm-submit2.log', s + '\n'); };
const click = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x - 30, y });
  await sleep(180);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await sleep(140);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(100);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};

await send('Network.enable', {});
await send('Page.bringToFront', {});
await sleep(300);

// 1) 点击复选框
const cb = JSON.parse(await ev(`(function(){var e=document.querySelector('.checkbox');if(!e)return '{}';var r=e.getBoundingClientRect();return JSON.stringify({cx:Math.round(r.x+r.width/2),cy:Math.round(r.y+r.height/2),cls:String(e.className)});})()`) || '{}');
log('[checkbox] ' + JSON.stringify(cb));
if (!cb.cx) { log('ABORT'); process.exit(1); }
await click(cb.cx, cb.cy);
await sleep(800);
const cb2 = await ev(`(function(){var e=document.querySelector('.checkbox');return e?String(e.className):'none';})()`);
log('[checkbox after] ' + cb2);

// 2) 点"免费试用"
const btn = JSON.parse(await ev(`(function(){var el=document.querySelector('.reg-btn');if(!el)return '{}';var r=el.getBoundingClientRect();return JSON.stringify({cx:Math.round(r.x+r.width/2),cy:Math.round(r.y+r.height/2),txt:el.innerText});})()`) || '{}');
log('[btn] ' + JSON.stringify(btn));
await click(btn.cx, btn.cy);
log('[clicked]');

for (let k = 1; k <= 12; k++) {
  await sleep(1000);
  const st = await ev(`(function(){var txt=(document.body.innerText||'').replace(/\\s+/g,' ');var hint=(txt.match(/(成功|失败|错误|已注册|提交中|即将完成|欢迎|跳转|登录)/g)||[]).slice(0,6);return JSON.stringify({hint, tail: txt.slice(0,180)});})()`);
  if (k <= 6 || k === 12) log(`[+${k}s] ` + st);
}
log('=== applyTry 请求 ===');
for (const r of reqs) log('[REQ] ' + r.m + ' ' + r.u);
log('=== 响应 ===');
for (const r of respIds.slice(-4)) {
  try {
    const body = await send('Network.getResponseBody', { requestId: r.id });
    log('[resp] ' + r.status + ' ' + r.u + ' :: ' + String(body?.result?.body || '').slice(0, 600));
  } catch (e) { log('[resp ERR]'); }
}
ws.close();
