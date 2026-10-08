// sm_recon1.mjs — 数美注册页侦察：脚本/表单/验证码容器/截图
import fs from 'node:fs';
const PORT = process.env.CDP_PORT || '9229';
const OUT = '/tmp/non-ali';
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.filter(x => x.type === 'page').find(p => (p.url || '').includes('ishumei')) || list.filter(x => x.type === 'page')[0];
if (!t) { console.log('NO page'); process.exit(1); }
console.log('[attach]', (t.url || '').slice(0, 90));
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const net = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  if (m.method === 'Network.requestWillBeSent') {
    const u = m.params?.request?.url || '';
    if (!/\.(png|jpg|jpeg|gif|css|woff2?|ico|svg)/.test(u)) net.push(m.params.request.method + ' ' + u.slice(0, 140));
  }
};
const send = (m, p = {}, timeoutMs = 20000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;

await send('Network.enable', {});
await sleep(2500);

// 页面状态
const st = await ev(`(function(){try{
  const inputs = [].slice.call(document.querySelectorAll('input')).map(function(i){return {name:i.name||null, type:i.type, ph:i.placeholder||null, vis:i.offsetParent!==null};});
  const scripts = performance.getEntriesByType('resource').map(function(e){return e.name}).filter(function(n){return /\\.js(\\?|$)/.test(n)});
  const capEls = [].slice.call(document.querySelectorAll('[id*=captcha],[class*=captcha],[id*=sm-],[class*=sm_]')).map(function(e){return (e.id||'')+'|'+String(e.className).slice(0,40)}).slice(0,15);
  return JSON.stringify({url: location.href, title: document.title, inputs: inputs, scripts: scripts.slice(0,25), capEls: capEls, body: (document.body.innerText||'').replace(/\\s+/g,' ').slice(0,300)});
}catch(e){return 'ERR '+e}})()`);
console.log('[state]', st);

// 截图
const shot = await send('Page.captureScreenshot', { format: 'png' });
if (shot?.result?.data) {
  fs.writeFileSync(OUT + '/sm-register.png', Buffer.from(shot.result.data, 'base64'));
  console.log('[shot] /tmp/non-ali/sm-register.png');
}
console.log('[net]');
[...new Set(net)].slice(0, 30).forEach(x => console.log('  ', x));
ws.close();
