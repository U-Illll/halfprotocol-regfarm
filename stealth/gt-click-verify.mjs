// gt-click-verify.mjs — 点击 "Click to verify" 触发极验控件 + 观察弹层与网络
// 用法: CDP_PORT=9228 node gt-click-verify.mjs
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
    if (!/\.(js|css|png|svg|woff|jpg|gif|ico)/.test(u)) net.push(m.params.request.method + ' ' + u.slice(0, 140));
  }
};
const send = (m, p = {}, timeoutMs = 15000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;
await send('Network.enable', {});

// 点 "Click to verify"（geetest_btn_click）
const r = await ev(`(function(){ try {
  const el = document.querySelector('.geetest_btn_click_11401cf5, [class*=geetest_btn_click]');
  if (!el) return 'NO_BTN';
  el.click();
  return 'CLICKED ' + String(el.className).slice(0,60);
} catch(e) { return 'ERR ' + e; } })()`);
console.log('[cv]', r);
await sleep(2500);

// 观察弹层出现
for (let k = 1; k <= 5; k++) {
  const st = await ev(`(function(){ try {
    const layers = [...document.querySelectorAll('[class*=geetest]')].filter(e=>e.offsetParent && /panel|popup|window|slide|box/i.test(e.className));
    const txt = (document.body.innerText||'').replace(/\\s+/g,' ');
    const hint = (txt.match(/(请完成安全验证|拖动|滑块|按住|点击|verify|slide|drag|Hold)/g)||[]).slice(0,5);
    const bg = document.querySelector('[class*=geetest_bg], [class*=geetest_panel] img');
    return JSON.stringify({n:layers.length, cls:layers.slice(0,4).map(e=>String(e.className).slice(0,60)), hint, bgSrc: bg? (bg.src||'').slice(0,60):null});
  } catch(e){ return 'ERR '+e; } })()`);
  console.log(`[cv +${k*2}s]`, st);
  await sleep(2000);
}
console.log('[cv] net:', JSON.stringify([...new Set(net)].slice(0, 15), null, 1));
ws.close();
