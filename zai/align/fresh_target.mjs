// fresh_target.mjs — 开全新标签（无任何 hook）→ 等弹层 → 注入 VIP 拦截 → 状态输出
import fs from 'node:fs';
const PORT = process.env.CDP_PORT || '9226';
fs.mkdirSync('/tmp/zai-recon-4', { recursive: true });
const AUTH = 'https://chat.z.ai/auth?redirect_uri=https%3A%2F%2Fz.ai%2F';
const BARE = process.argv[2] === 'bare';  // bare=不注入 VIP（自然对照用）
const listRaw = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const anyPage = listRaw.find(t => t.type === 'page');
const ws0 = new WebSocket(anyPage.webSocketDebuggerUrl);
await new Promise(r => ws0.onopen = r);
let id0 = 0; const pend0 = new Map();
ws0.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend0.has(m.id)) { pend0.get(m.id)(m); pend0.delete(m.id); } };
const call = (m, p = {}, timeoutMs = 25000) => new Promise(res => {
  const i = ++id0; const timer = setTimeout(() => { pend0.delete(i); res({ timeout: true }); }, timeoutMs);
  pend0.set(i, v => { clearTimeout(timer); res(v); }); ws0.send(JSON.stringify({ id: i, method: m, params: p }));
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

const created = await call('Target.createTarget', { url: AUTH });
const tid = created?.result?.targetId;
console.log('[fresh] new target:', tid);
fs.writeFileSync('/tmp/zai-recon-4/fresh-tid.txt', String(tid || ''));
console.log('[fresh] tid 已写 fresh-tid.txt | BARE =', BARE);
ws0.close();

// 等新 target 出现
await sleep(4000);
let nt = null;
for (let i = 0; i < 15; i++) {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  nt = list.find(t => t.id === tid) || list.filter(t => (t.url || '').includes('chat.z.ai')).pop();
  if (nt && (nt.url || '').includes('chat.z.ai')) break;
  await sleep(1500);
}
if (!nt) { console.log('[fresh] FAIL no target'); process.exit(1); }
console.log('[fresh] attached:', (nt.url || '').slice(0, 80));

const ws = new WebSocket(nt.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (m, p = {}, timeoutMs = 25000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;

// 等弹层（最长 ~45s）
let ready = false;
for (let i = 0; i < 30; i++) {
  const ok = await ev(`!!document.getElementById('aliyunCaptcha-sliding-slider')`);
  if (ok) { ready = true; break; }
  await sleep(1500);
}
console.log('[fresh] slider ready:', ready);

// 确认无 4in1 hooks + （非 bare 时）注入 VIP
const hooks = await ev(`JSON.stringify({pre3: !!window.__PRE3B, r4: !!window.__R4, cvps: !!window.__CVPS, netx: !!window.__NETX})`);
console.log('[fresh] hooks(应为全 false):', hooks);
if (BARE) {
  console.log('[fresh] BARE 模式: 跳过 VIP 注入（自然提交对照）');
} else {
  const code = fs.readFileSync(new URL('../submit/hook_verify_intercept.js', import.meta.url), 'utf8');
  const r = await ev(code);
  console.log('[fresh] VIP inject:', r);
}
const chk = await ev(`JSON.stringify({vip: typeof window.__VIP, cert: (document.getElementById('aliyunCaptcha-certifyId')||{}).textContent})`);
console.log('[fresh] check:', chk);
ws.close();
