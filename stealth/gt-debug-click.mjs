// gt-debug-click.mjs — 事件/请求探针 + 重点击诊断
// 用法: CDP_PORT=9228 node gt-debug-click.mjs
const PORT = process.env.CDP_PORT || '9228';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.filter(x => x.type === 'page').find(p => (p.url || '').includes('Register'));
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (m, p = {}, timeoutMs = 12000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;

// 1) 注入探针
await ev(`(function(){ try {
  window.__gt_dbg = { clicks: [], downs: [], reqs: [] };
  document.addEventListener('click', e => window.__gt_dbg.clicks.push({ t: Date.now(), target: (e.target.className||'').toString().slice(0,70), x: e.clientX, y: e.clientY, trusted: e.isTrusted }), true);
  document.addEventListener('mousedown', e => window.__gt_dbg.downs.push({ target: (e.target.className||'').toString().slice(0,70), trusted: e.isTrusted }), true);
  const of = window.fetch;
  window.fetch = function(...a){ try { window.__gt_dbg.reqs.push(['fetch', String(a[0]).slice(0,140)]); } catch(e){} return of.apply(this, a); };
  const oo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, u){ try { window.__gt_dbg.reqs.push([m, String(u).slice(0,140)]); } catch(e){} return oo.apply(this, arguments); };
  const os = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(...a){ try { if (a[0]) window.__gt_dbg.reqs.push(['SEND', String(a[0]).slice(0,120)]); } catch(e){} return os.apply(this, a); };
  return 'probes installed';
} catch(e) { return 'ERR ' + e; } })()`);

// 2) 找控件坐标（含可见性判断）
const rect = await ev(`(function(){ try {
  const els = [...document.querySelectorAll('[class*=geetest_btn_click]')];
  return JSON.stringify(els.map(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { x: r.x, y: r.y, w: r.width, h: r.height, disp: cs.display, vis: cs.visibility, z: cs.zIndex, pe: cs.pointerEvents }; }));
} catch(e) { return 'ERR ' + e; } })()`);
console.log('[dbg] btn candidates:', rect);
const cands = JSON.parse(rect);
const c = cands.find(x => x.w > 0) || cands[0];
console.log('[dbg] pick:', JSON.stringify(c));

// 3) 滚动让控件完全可见 + 点击
await ev('window.scrollTo(0, 200)');
await sleep(500);
const rect2 = await ev(`(function(){ try {
  const el = [...document.querySelectorAll('[class*=geetest_btn_click]')].find(e=>e.getBoundingClientRect().width>0);
  const r = el.getBoundingClientRect();
  return JSON.stringify({x: r.x + r.width/2, y: r.y + r.height/2, scrollY: window.scrollY});
} catch(e) { return 'ERR ' + e; } })()`);
console.log('[dbg] after scroll:', rect2);
const rc = JSON.parse(rect2);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rc.x - 120, y: rc.y - 60 });
await sleep(300);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rc.x - 40, y: rc.y - 15 });
await sleep(180);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rc.x, y: rc.y });
await sleep(220);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rc.x, y: rc.y, button: 'left', buttons: 1, clickCount: 1 });
await sleep(110);
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rc.x, y: rc.y, button: 'left', buttons: 1, clickCount: 1 });
console.log('[dbg] clicked at', rc.x, rc.y);

// 4) 读探针 + 控件状态
await sleep(2500);
const dbg = await ev('JSON.stringify(window.__gt_dbg)');
console.log('[dbg] probe result:', dbg);
const st = await ev(`(function(){ try {
  const el = document.querySelector('[class*=geetest_captcha]');
  const box = document.querySelector('[class*=geetest_box_wrap]');
  const mask = document.querySelector('[class*=geetest_mask]');
  return JSON.stringify({box: (()=>{const r=box.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]})(), mask: (()=>{const r=mask.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]})(), txt: (el.innerText||'').replace(/\\s+/g,' ').slice(0,120)});
} catch(e) { return 'ERR ' + e; } })()`);
console.log('[dbg] widget state:', st);
ws.close();
