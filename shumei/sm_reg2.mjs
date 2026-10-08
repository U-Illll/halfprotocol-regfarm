// sm_reg2.mjs — 数美注册推进 2：勾协议 + 真实点击"继续"
import fs from 'node:fs';
const PORT = process.env.CDP_PORT || '9229';
const OUT = '/tmp/non-ali';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.filter(x => x.type === 'page').find(p => (p.url || '').includes('ishumei')) || list.filter(x => x.type === 'page')[0];
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const net = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  if (m.method === 'Network.requestWillBeSent') {
    const u = m.params?.request?.url || '';
    if (!/\.(png|jpg|jpeg|gif|css|woff2?|ico|svg|js)/.test(u)) net.push(m.params.request.method + ' ' + u.slice(0, 150));
  }
};
const send = (m, p = {}, timeoutMs = 20000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;
const log = s => { console.log(s); fs.appendFileSync(OUT + '/sm-reg2.log', s + '\n'); };
const mouseClick = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await sleep(120);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(90);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};

await send('Network.enable', {});
await send('Page.bringToFront', {});
await sleep(200);

// 1) 勾选协议复选框
const cb = JSON.parse(await ev(`(function(){try{
  var cb=document.querySelector('input[type=checkbox]');
  if(!cb) return '{}';
  var r=cb.getBoundingClientRect();
  return JSON.stringify({cx:r.x+r.width/2, cy:r.y+r.height/2, checked:cb.checked, vis: cb.offsetParent!==null});
}catch(e){return '{}'}})()`) || '{}');
log('[checkbox] ' + JSON.stringify(cb));
if (cb.cx && !cb.checked) { await mouseClick(cb.cx, cb.cy); await sleep(500); }
const cbAfter = await ev(`(function(){var cb=document.querySelector('input[type=checkbox]');return cb?String(cb.checked):'none';})()`);
log('[checkbox 勾选后] ' + cbAfter);

// 2) "继续"按钮
const btn = JSON.parse(await ev(`(function(){try{
  var btns=[].slice.call(document.querySelectorAll('button,a,span,div,input')).filter(function(e){var tx=(e.innerText||e.value||'').trim();return (tx==='继续'||tx==='免费试用') && e.offsetParent!==null;});
  if(!btns.length) return '{}';
  var b=btns[0]; var r=b.getBoundingClientRect();
  return JSON.stringify({cx:r.x+r.width/2, cy:r.y+r.height/2, tag:b.tagName, txt:(b.innerText||'').trim()});
}catch(e){return '{}'}})()`) || '{}');
log('[继续按钮] ' + JSON.stringify(btn));
if (!btn.cx) { log('ABORT-NO-BTN'); process.exit(1); }

// 3) 真实点击
await mouseClick(btn.cx, btn.cy);
log('[clicked]');

// 4) 观察 12s
for (let k = 1; k <= 12; k++) {
  await sleep(1000);
  const st = await ev(`(function(){try{
    var txt=(document.body.innerText||'').replace(/\\s+/g,' ');
    var hint=(txt.match(/(验证成功|已发送|发送成功|已向|失败|错误|请输入|注册|企业|邮箱|短信验证码|请稍后|分钟)/g)||[]).slice(0,6);
    return JSON.stringify({url: location.href.slice(-60), hint});
  }catch(e){return 'ERR '+e}})()`);
  if (k <= 6 || k === 12) log(`[+${k}s] ` + st);
}
log('[net]');
[...new Set(net)].slice(0, 30).forEach(x => log('  ' + x));
ws.close();
