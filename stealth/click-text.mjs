// click-text.mjs — 通用小工具：按文本找元素并点击 + 观察导航
// 用法: CDP_PORT=9228 node click-text.mjs "免费试用" [urlMatch]
const PORT = process.env.CDP_PORT || '9228';
const TEXT = process.argv[2];
const MATCH = process.argv[3] || '';
if (!TEXT) { console.log('usage: node click-text.mjs <text> [urlMatch]'); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const pages = list.filter(x => x.type === 'page');
console.log('[click] tabs:', JSON.stringify(pages.map(p => (p.url || '').slice(0, 55))));
const t = MATCH ? pages.find(p => (p.url || '').includes(MATCH)) : pages[pages.length - 1];
if (!t) { console.log('NO page for match:', MATCH); process.exit(1); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (m, p = {}, timeoutMs = 15000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;

console.log('[click] page:', (t.url || '').slice(0, 70));
const r = await ev(`(function(){ try {
  const all = [...document.querySelectorAll('a,button,div,span')];
  const el = all.find(e => ((e.innerText || '').trim() === ${JSON.stringify(TEXT)} || (e.innerText || '').trim().includes(${JSON.stringify(TEXT)})) && e.offsetParent !== null);
  if (!el) return 'NOT_FOUND';
  const tag = el.tagName; const cls = String(el.className).slice(0, 60);
  el.click();
  return 'CLICKED ' + tag + ' ' + cls;
} catch(e) { return 'ERR ' + e; } })()`);
console.log('[click]', r);
await sleep(4000);
const url = await ev('location.href');
console.log('[click] now at:', url);
ws.close();
