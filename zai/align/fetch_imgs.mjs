// fetch_imgs.mjs — 取当前题的背景图(#aliyunCaptcha-img)与块图(#aliyunCaptcha-puzzle) data URL → 存 png
import fs from 'node:fs';
const PORT = process.env.CDP_PORT || '9226';
const OUT = process.env.OUT_DIR || '/tmp/zai-recon-4';
const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter(t => t.type === 'page');
const _tid = fs.existsSync('/tmp/zai-recon-4/fresh-tid.txt') ? fs.readFileSync('/tmp/zai-recon-4/fresh-tid.txt', 'utf8').trim() : '';
let t = (_tid && pages.find(p => p.id === _tid)) || null;
if (!t) { const _zp = pages.filter(p => (p.url || '').includes('chat.z.ai')); t = _zp.length ? _zp[_zp.length - 1] : pages[0]; }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (m, p = {}, timeoutMs = 25000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;

const bg = await ev(`(document.getElementById('aliyunCaptcha-img')||{}).src || ''`);
const piece = await ev(`(document.getElementById('aliyunCaptcha-puzzle')||{}).src || ''`);
const puzzleLeft = await ev(`(document.getElementById('aliyunCaptcha-puzzle')||{}).style.left || ''`);
const sliderLeft = await ev(`(document.getElementById('aliyunCaptcha-sliding-slider')||{}).style.left || ''`);

function saveDataUrl(src, path) {
  const m = /^data:image\/(\w+);base64,(.*)$/.exec(src);
  if (!m) { console.log('NOT_DATA_URL', path, String(src).slice(0, 60)); return false; }
  fs.writeFileSync(path, Buffer.from(m[2], 'base64'));
  console.log('WROTE', path, fs.statSync(path).size, 'bytes');
  return true;
}
saveDataUrl(bg, OUT + '/q-bg.png');
saveDataUrl(piece, OUT + '/q-piece.png');
console.log('puzzle.left =', puzzleLeft, '| slider.left =', sliderLeft);
ws.close();
