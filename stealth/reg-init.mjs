// reg-init.mjs — stealth-kit 通用初始化器（注入注册 → 暖场导航 → 目标页 → 就绪 → 截图）
// 用法: CDP_PORT=9228 node reg-init.mjs <target-url> [warmup-urls-逗号分隔]
// env:
//   CDP_PORT   默认 9228
//   OUT_DIR    默认 /tmp/stealth-kit-out
//   READY_SEL  可选：就绪选择器（默认探测常见表单元素或 body）
//   SKIP_WARM=1 跳过暖场
// 输出：stdout 摘要 JSON；截图 <OUT_DIR>/init-<port>.png
import fs from 'node:fs';

const PORT = process.env.CDP_PORT || '9228';
const OUT = process.env.OUT_DIR || '/tmp/stealth-kit-out';
const READY_SEL = process.env.READY_SEL || 'input[name=email],input[type=email],input[type=text],form,body';
const SKIP_WARM = process.env.SKIP_WARM === '1';
const target = process.argv[2];
if (!target) { console.log('usage: CDP_PORT=xxx node reg-init.mjs <target-url> [warmup1,warmup2]'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const pages = list.filter(t => t.type === 'page');
const t = pages.find(p => (p.url || '').startsWith('about:')) || pages[0];
if (!t) { console.log('NO page'); process.exit(1); }
console.log('[init] attach:', t.id.slice(0, 12), (t.url || '').slice(0, 60));

const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (m, p = {}, timeoutMs = 25000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;

// 0) 注入注册（对后续所有文档/iframe 生效；不调 Runtime.enable）
const stealth = fs.readFileSync(new URL('./stealth-core.js', import.meta.url), 'utf8');
await send('Page.enable', {});
const inj = await send('Page.addScriptToEvaluateOnNewDocument', { source: stealth });
console.log('[init] preinject registered:', JSON.stringify(inj?.result || inj).slice(0, 120));

// 1) 暖场导航
async function nav(url, waitMs) {
  console.log('[init] goto', url);
  try { await send('Page.navigate', { url }); } catch (e) { console.log('[init] nav err', String(e).slice(0, 80)); }
  await sleep(waitMs);
}
if (!SKIP_WARM) {
  const warm = (process.argv[3] ? process.argv[3].split(',') : ['https://www.google.com/']);
  for (const u of warm) await nav(u, 4000);
}
await nav(target, 7000);

// 2) 等就绪
let ready = false;
for (let i = 0; i < 25; i++) {
  const ok = await ev(`!!document.querySelector(${JSON.stringify(READY_SEL)})`);
  if (ok) { ready = true; break; }
  await sleep(800);
}
console.log('[init] page ready:', ready);

// 3) 截图
const shot = await send('Page.captureScreenshot', { format: 'png' });
if (shot?.result?.data) {
  fs.writeFileSync(`${OUT}/init-${PORT}.png`, Buffer.from(shot.result.data, 'base64'));
  console.log('[init] screenshot saved:', `${OUT}/init-${PORT}.png`);
}
ws.close();
console.log(JSON.stringify({ ok: true, ready, url: target }));
