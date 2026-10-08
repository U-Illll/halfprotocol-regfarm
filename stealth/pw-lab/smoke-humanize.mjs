// smoke-humanize.mjs — stealth-kit humanize.mjs 冒烟验证（9228 example 页空拖 100px）
// 用法: CDP_PORT=9228 node smoke-humanize.mjs
import { dragEased } from '../humanize.mjs';

const PORT = process.env.CDP_PORT || '9228';
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.filter(x => x.type === 'page' && (x.url || '').includes('example')).pop() || list.filter(x => x.type === 'page')[0];
if (!t) { console.log('NO page'); process.exit(1); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (m, p = {}, timeoutMs = 10000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

const t0 = Date.now();
await dragEased(send, sleep, { x: 400, y: 400, delta: 100 });
console.log(JSON.stringify({ ok: true, elapsedMs: Date.now() - t0, page: (t.url || '').slice(0, 50) }));
ws.close();
