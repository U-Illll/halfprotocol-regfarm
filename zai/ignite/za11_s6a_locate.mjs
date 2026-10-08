// za11_s6a_locate.mjs — 抓当前版本 pe 源码 + 搜「组装调用模式」候选
import fs from 'node:fs';
const PORT = '9226';
const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter(t => t.type === 'page');
const t = pages.find(p => (p.url || '').includes('chat.z.ai')) || pages[0];
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const scripts = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  else if (m.method === 'Debugger.scriptParsed') scripts.push(m.params);
};
const send = (m, p = {}, timeoutMs = 25000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

await send('Debugger.enable');
await sleep(1500);
let cand = [];
for (const p of scripts) { const u = String(p.url || ''); if (u.includes('dynamicJS') && u.includes('pe.')) cand.push({ sid: p.scriptId, url: u }); }
console.log('pe candidates:', cand.map(c => c.url.split('/').pop().slice(0, 20)));
let src = null, info = null;
for (const c of cand) {
  const r = await send('Debugger.getScriptSource', { scriptId: c.sid }, 30000);
  const s = r?.result?.scriptSource || '';
  if (s.length > 100000) { src = s; info = c; break; }
}
if (!src) { console.log('NO PE SOURCE'); await send('Debugger.disable'); ws.close(); process.exit(1); }
const ver = info.url.split('/').pop().split('.')[1];
fs.writeFileSync('/tmp/zai-recon-4/pe-' + ver + '-src.js', src);
console.log('SAVED pe.' + ver + ' len=' + src.length + ' sid=' + info.sid);

// 搜模式1： n=JSON[xxx](S)  —— 直接调用 stringify
const re1 = /=JSON\[[^\]]{1,40}\]\(/g; let m; const hits1 = [];
while ((m = re1.exec(src)) && hits1.length < 60) hits1.push(m.index);
console.log('pattern1 =JSON[..]( :', hits1.length, 'hits');
// 搜模式2： JSON.stringify 字面量
const re2 = /JSON\.stringify/g; const hits2 = [];
while ((m = re2.exec(src)) && hits2.length < 60) hits2.push(m.index);
console.log('pattern2 JSON.stringify:', hits2.length);
// 搜模式3： 与旧组装点对照——「调用后在 switch 状态机内」 用「附近有 ;e+= 或 s^= 或 e-=」过滤
function ctxGo(pos) {
  const seg = src.slice(Math.max(0, pos - 150), pos + 150).replace(/\n/g, ' ');
  return seg;
}
const report = { ver, len: src.length, hits1: [], hits2: hits2.slice(0, 30) };
console.log('--- pattern1 hits with context ---');
for (const h of hits1.slice(0, 25)) {
  const seg = src.slice(h, h + 60);
  const left = src.slice(Math.max(0, h - 60), h);
  // 过滤：上下文有状态机痕迹（e+= / s^= / s-= / e-= / e^=）
  const statemachine = /e[-+^]=|s[-+^]=/.test(left);
  console.log((statemachine ? '[SM] ' : '[  ] ') + h + ' : ...' + left.slice(-50) + ' >> ' + seg.slice(0, 50));
  report.hits1.push({ pos: h, sm: statemachine });
}
fs.writeFileSync('/tmp/zai-recon-4/pe-' + ver + '-analysis.json', JSON.stringify(report, null, 1));
await send('Debugger.disable');
ws.close();
console.log('DONE-S6A');
