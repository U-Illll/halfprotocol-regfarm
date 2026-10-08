// sm_rerun1.mjs — 数美注册重走 1/2：reload → 填手机号 → 触发验证码弹层 → 抓题图
import fs from 'node:fs';
const PORT = process.env.CDP_PORT || '9229';
const OUT = process.env.SM_OUT || '/tmp/non-ali';
const PHONE = process.env.SM_PHONE || '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.filter(x => x.type === 'page').find(p => (p.url || '').includes('ishumei')) || list.filter(x => x.type === 'page')[0];
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const net = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  if (m.method === 'Network.requestWillBeSent') {
    const u = m.params?.request?.url || '';
    if (/fengkongcloud|register|conf/.test(u) && !/\/log/.test(u) && !/\.(css|js)/.test(u)) net.push(m.params.request.method + ' ' + u.slice(0, 160));
  }
};
const send = (m, p = {}, T = 25000) => new Promise(res => { const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, T); pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true }))?.result?.result?.value;
const log = s => { console.log(s); fs.appendFileSync(OUT + '/sm-rerun.log', s + '\n'); };

await send('Network.enable', {});
await send('Page.enable', {});
await send('Page.bringToFront', {});
log('[reload]');
await send('Page.reload', {});
await sleep(6000);

// 等页面就绪
for (let k = 0; k < 10; k++) {
  const rdy = await ev(`!!document.querySelector('input[name=mobile]')`);
  if (rdy) break;
  await sleep(1000);
}
// 填手机号
const fill = await ev(`(function(){var inp=document.querySelector('input[name=mobile]');if(!inp)return 'NO';var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp,"${PHONE}");inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));inp.dispatchEvent(new Event('blur',{bubbles:true}));return 'FILLED:'+inp.value;})()`);
log('[fill mobile] ' + fill);
await sleep(1500);

// 等题图自动加载（reload 后 SDK 自动取题）
let bgUrl = null;
for (let k = 0; k < 12; k++) {
  const r = JSON.parse(await ev(`(function(){var bg=document.querySelector('[class*=loaded_img_bg]');return JSON.stringify({bg: bg?bg.src:null});})()`) || '{}');
  if (r.bg) { bgUrl = r.bg; break; }
  await sleep(1000);
}
log('[bgUrl] ' + bgUrl);

// dump 题图 URL + 弹层状态
const st = await ev(`(function(){try{
  var bg=document.querySelector('[class*=loaded_img_bg]'), fg=document.querySelector('[class*=loaded_img_fg]');
  var w=document.querySelector('[class*=shumei_captcha_wrapper]');
  return JSON.stringify({bg: bg?bg.src:null, fg: fg?fg.src:null, wtext: w?(w.innerText||'').replace(/\\s+/g,' ').slice(0,80):null});
}catch(e){return 'ERR '+e}})()`);
log('[题图] ' + st);
log('[net]');
[...new Set(net)].slice(0, 12).forEach(x => log('  ' + x));
ws.close();
