// sm_submit.mjs — second-step 填表 + 提交 applyTry
import fs from 'node:fs';
const PORT = process.env.CDP_PORT || '9229';
const OUT = process.env.SM_OUT || '/tmp/non-ali';
const EMAIL = process.env.SM_EMAIL || '';
const COMPANY = process.env.SM_COMPANY || '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.filter(x => x.type === 'page').find(p => (p.url || '').includes('ishumei')) || list.filter(x => x.type === 'page')[0];
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const reqs = []; const respIds = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  if (m.method === 'Network.requestWillBeSent') {
    const u = m.params?.request?.url || '';
    if (/applyTry|submitForm/.test(u)) reqs.push({ m: m.params.request.method, u: u.slice(0, 900) });
  }
  if (m.method === 'Network.responseReceived') {
    const u = m.params?.response?.url || '';
    if (/applyTry|submitForm/.test(u)) respIds.push({ id: m.params.requestId, u: u.slice(0, 120), status: m.params.response.status });
  }
};
const send = (m, p = {}, T = 20000) => new Promise(res => { const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, T); pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true }))?.result?.result?.value;
const log = s => { console.log(s); fs.appendFileSync(OUT + '/sm-submit.log', s + '\n'); };

await send('Network.enable', {});
await send('Page.bringToFront', {});
await sleep(300);

// 0) dump second-step 输入框
const fields = await ev(`(function(){try{
  var s=document.querySelector('.second-step');
  var ins=[].slice.call(s.querySelectorAll('input,select')).map(function(e){return {name:e.name||null, type:e.type||e.tagName, ph:e.placeholder||null, vis:e.offsetParent!==null};});
  return JSON.stringify(ins);
}catch(e){return 'ERR '+e}})()`);
log('[second-step fields] ' + fields);

// 1) 填 email + organization
const fill = await ev(`(function(){try{
  var out=[];
  var setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  var em=document.querySelector('input[name=email]');
  if(em){setter.call(em,${JSON.stringify(EMAIL)});em.dispatchEvent(new Event('input',{bubbles:true}));em.dispatchEvent(new Event('change',{bubbles:true}));em.dispatchEvent(new Event('blur',{bubbles:true}));out.push('email='+em.value);}
  var org=document.querySelector('input[name=organization]');
  if(org){setter.call(org,${JSON.stringify(COMPANY)});org.dispatchEvent(new Event('input',{bubbles:true}));org.dispatchEvent(new Event('change',{bubbles:true}));org.dispatchEvent(new Event('blur',{bubbles:true}));out.push('org='+org.value);}
  return out.join(' | ')||'NONE';
}catch(e){return 'ERR '+e}})()`);
log('[fill] ' + fill);
await sleep(900);

// 2) 点"免费试用"
const btn = JSON.parse(await ev(`(function(){var el=document.querySelector('.reg-btn');if(!el)return '{}';var r=el.getBoundingClientRect();return JSON.stringify({cx:Math.round(r.x+r.width/2),cy:Math.round(r.y+r.height/2),txt:el.innerText});})()`) || '{}');
log('[btn] ' + JSON.stringify(btn));
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: btn.cx - 60, y: btn.cy });
await sleep(220);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: btn.cx, y: btn.cy });
await sleep(180);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: btn.cx, y: btn.cy, button: 'left', buttons: 1, clickCount: 1 });
await sleep(100);
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btn.cx, y: btn.cy, button: 'left', clickCount: 1 });
log('[clicked 免费试用]');

for (let k = 1; k <= 10; k++) {
  await sleep(1000);
  const st = await ev(`(function(){var txt=(document.body.innerText||'').replace(/\\s+/g,' ');var hint=(txt.match(/(成功|失败|错误|已注册|提交中|即将完成|欢迎|登录)/g)||[]).slice(0,6);return JSON.stringify({hint, tail: txt.slice(0,200)});})()`);
  if (k <= 6 || k === 10) log(`[+${k}s] ` + st);
}
log('=== applyTry 请求 ===');
for (const r of reqs) log('[REQ] ' + r.m + ' ' + r.u);
log('=== 响应 ===');
for (const r of respIds.slice(-4)) {
  try {
    const body = await send('Network.getResponseBody', { requestId: r.id });
    log('[resp] ' + r.status + ' ' + r.u + ' :: ' + String(body?.result?.body || '').slice(0, 500));
  } catch (e) { log('[resp ERR]'); }
}
ws.close();
