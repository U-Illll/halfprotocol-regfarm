// gt-input-click.mjs — 用 CDP Input 真实鼠标事件点 "Click to verify" + 深度观察
// 用法: CDP_PORT=9228 node gt-input-click.mjs
const PORT = process.env.CDP_PORT || '9228';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.filter(x => x.type === 'page').find(p => (p.url || '').includes('Register'));
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const net = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  if (m.method === 'Network.requestWillBeSent') {
    const u = m.params?.request?.url || '';
    if (!/\.(js|css|png|svg|woff|jpg|gif|ico)/.test(u) && !/google|facebook|doubleclick/.test(u)) net.push(m.params.request.method + ' ' + u.slice(0, 150));
  }
};
const send = (m, p = {}, timeoutMs = 15000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;
await send('Network.enable', {});

// 1) 找控件坐标
const rect = await ev(`(function(){ try {
  const el = document.querySelector('.geetest_btn_click_11401cf5, [class*=geetest_btn_click]');
  if (!el) return 'NO_BTN';
  const r = el.getBoundingClientRect();
  return JSON.stringify({x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, h: r.height, vis: getComputedStyle(el).display});
} catch(e) { return 'ERR ' + e; } })()`);
console.log('[ic] rect:', rect);
if (String(rect).startsWith('NO_BTN') || String(rect).startsWith('ERR')) { console.log('no btn'); process.exit(1); }
const rc = JSON.parse(rect);
if (!rc.x) { console.log('no rect'); process.exit(1); }

// 2) Input 真实事件序列
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rc.x - 80, y: rc.y - 40 });
await sleep(200);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rc.x, y: rc.y });
await sleep(250);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rc.x, y: rc.y, button: 'left', buttons: 1, clickCount: 1 });
await sleep(90);
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rc.x, y: rc.y, button: 'left', buttons: 1, clickCount: 1 });
console.log('[ic] input click sent at', rc.x, rc.y);

// 3) 观察弹层/状态 + 截图
await sleep(2500);
for (let k = 1; k <= 5; k++) {
  const st = await ev(`(function(){ try {
    const layers = [...document.querySelectorAll('[class*=geetest]')].filter(e=>e.offsetParent && /panel|popup|window|slide|box|success|state/i.test(e.className));
    const btnTxt = (document.querySelector('[class*=geetest_btn_click]')||{}).innerText || '';
    const txt = (document.body.innerText||'').replace(/\\s+/g,' ');
    const hint = (txt.match(/(请完成安全验证|拖动|滑块|按住|验证成功|success|slide to|drag)/g)||[]).slice(0,5);
    return JSON.stringify({n:layers.length, cls:layers.slice(0,5).map(e=>String(e.className).slice(0,70)), btnTxt: btnTxt.slice(0,20), hint});
  } catch(e){ return 'ERR '+e; } })()`);
  console.log(`[ic +${k*2}s]`, st);
  await sleep(2000);
}
const shot = await send('Page.captureScreenshot', { format: 'png' });
if (shot?.result?.data) {
  const fs = await import('node:fs');
  fs.writeFileSync('/tmp/gt-test/gt-after-click.png', Buffer.from(shot.result.data, 'base64'));
  console.log('[ic] screenshot: /tmp/gt-test/gt-after-click.png');
}
console.log('[ic] net:', JSON.stringify([...new Set(net)].slice(0, 15), null, 1));
ws.close();
