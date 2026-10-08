// gt-probe2.mjs — 深挖：全局实例、初始化参数、控件事件属性、复点观察
// 用法: CDP_PORT=9228 node gt-probe2.mjs
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
    if (/geetest|gcaptcha/i.test(u)) net.push(m.params.request.method + ' ' + u.slice(0, 140));
  }
};
const send = (m, p = {}, timeoutMs = 12000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;
await send('Network.enable', {});

// 1) 全局键 + 脚本线索
const g = await ev(`(function(){ try {
  const keys = Object.keys(window).filter(k => /gt|geetest|captcha|initGee/i.test(k));
  const scripts = [...document.querySelectorAll('script[src]')].map(s=>s.src).filter(u=>/geetest|gt4|captcha/i.test(u));
  const scriptsInline = [...document.querySelectorAll('script:not([src])')].map(s=>s.textContent).filter(t=>/initGeetest|captcha_id/i.test(t)).slice(0,2).map(t=>t.slice(0,300));
  return JSON.stringify({keys, scripts, inline: scriptsInline}, null, 1);
} catch(e) { return 'ERR ' + e; } })()`);
console.log('[p2] globals/scripts:', g);

// 2) 控件元素上的属性探查
const attrs = await ev(`(function(){ try {
  const el = document.querySelector('[class*=geetest_btn_click]');
  const own = Object.keys(el).filter(k=>k.startsWith('__')||k.startsWith('_')||k==='onclick').slice(0,20);
  const par = el.parentElement;
  return JSON.stringify({btnOwnKeys: own, btnOnclick: String(el.onclick), parentCls: String(par.className).slice(0,80), parentKeys: Object.keys(par).filter(k=>k.startsWith('__')).slice(0,20)});
} catch(e) { return 'ERR ' + e; } })()`);
console.log('[p2] attrs:', attrs);

// 3) 复点测试（两次连点，分步观察 + 网络）
const clickAt = async () => {
  const r = JSON.parse(await ev(`(function(){ try {
    const el = [...document.querySelectorAll('[class*=geetest_btn_click]')].find(e=>e.getBoundingClientRect().width>0);
    const r = el.getBoundingClientRect();
    return JSON.stringify({x: r.x + r.width/2, y: r.y + r.height/2});
  } catch(e) { return '{"x":0}'; } })()`));
  if (!r.x) return false;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y });
  await sleep(300);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(120);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', buttons: 1, clickCount: 1 });
  return true;
};
console.log('[p2] re-click #1:', await clickAt());
await sleep(1200);
console.log('[p2] re-click #2:', await clickAt());
await sleep(3000);

const st = await ev(`(function(){ try {
  const el = document.querySelector('[class*=geetest_captcha]');
  return JSON.stringify({txt: (el.innerText||'').replace(/\\s+/g,' ').slice(0,100), cls: String(el.className).slice(0,120)});
} catch(e) { return 'ERR ' + e; } })()`);
console.log('[p2] widget after:', st);
console.log('[p2] geetest net:', JSON.stringify([...new Set(net)], null, 1));
ws.close();
