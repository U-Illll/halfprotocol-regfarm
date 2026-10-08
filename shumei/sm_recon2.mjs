// sm_recon2.mjs — 重载数美注册页并抓验证码初始化请求链
import fs from 'node:fs';
const PORT = process.env.CDP_PORT || '9229';
const OUT = '/tmp/non-ali';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.filter(x => x.type === 'page').find(p => (p.url || '').includes('ishumei')) || list.filter(x => x.type === 'page')[0];
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const reqs = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  if (m.method === 'Network.requestWillBeSent') {
    const u = m.params?.request?.url || '';
    if (/fengkong|captcha|conf|smcp|verify|check|pr\//.test(u) && !/\.(css|woff)/.test(u)) {
      reqs.push({ m: m.params.request.method, u: u.slice(0, 160), pd: (m.params.request.postData || '').slice(0, 800) });
    }
  }
};
const send = (m, p = {}, timeoutMs = 25000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;

await send('Network.enable', {});
await send('Page.enable', {});
await send('Page.reload', {});
await sleep(7000);

// 容器状态
const st = await ev(`(function(){try{
  var w=document.querySelector('[class*=shumei_captcha_wrapper]');
  var txt=(w?w.innerText:'').replace(/\\s+/g,' ').slice(0,120);
  return JSON.stringify({wrapper: !!w, wtext: txt});
}catch(e){return 'ERR '+e}})()`);
console.log('[state]', st);

console.log('=== 请求链（前 25） ===');
reqs.slice(0, 25).forEach(r => {
  console.log(`${r.m} ${r.u}`);
  if (r.pd) console.log('   PD:', r.pd.slice(0, 400));
});
fs.writeFileSync(OUT + '/sm-init-reqs.json', JSON.stringify(reqs, null, 1));
console.log('[saved] /tmp/non-ali/sm-init-reqs.json  (共', reqs.length, '条)');
ws.close();
