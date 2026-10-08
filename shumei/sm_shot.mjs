// sm_shot.mjs — 数美页截图（验证成功状态）
import fs from 'node:fs';
const PORT = process.env.CDP_PORT || '9229';
const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter(t => t.type === 'page');
const t = pages.find(p => (p.url || '').includes('ishumei'));
if (!t) { console.log('NO page'); process.exit(1); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (m, p = {}, t = 15000) => new Promise(res => { const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, t); pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const shot = await send('Page.captureScreenshot', { format: 'png' });
if (shot?.result?.data) {
  fs.writeFileSync('/tmp/non-ali/sm-pass.png', Buffer.from(shot.result.data, 'base64'));
  console.log('saved sm-pass.png', Buffer.from(shot.result.data, 'base64').length);
}
ws.close();
