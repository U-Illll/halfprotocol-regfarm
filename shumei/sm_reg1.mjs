// sm_reg1.mjs — 数美注册推进：填手机号 + 点"获取验证码" + 抓网络
import fs from 'node:fs';
const PORT = process.env.CDP_PORT || '9229';
const OUT = '/tmp/non-ali';
const PHONE = process.argv[2] || process.env.SM_PHONE || '';
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
    if (!/\.(png|jpg|jpeg|gif|css|woff2?|ico|svg|js)/.test(u)) net.push(m.params.request.method + ' ' + u.slice(0, 140) + (m.params.request.postData ? ' PD=' + m.params.request.postData.slice(0, 200) : ''));
  }
};
const send = (m, p = {}, timeoutMs = 20000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;
const log = s => { console.log(s); fs.appendFileSync(OUT + '/sm-reg1.log', s + '\n'); };

await send('Network.enable', {});
await send('Page.bringToFront', {});

// 1) 填手机号（setter + events）
const fill = await ev(`(function(){try{
  var inp = document.querySelector('input[name=mobile]');
  if(!inp) return 'NO_INPUT';
  var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  setter.call(inp, ${JSON.stringify(PHONE)});
  inp.dispatchEvent(new Event('input',{bubbles:true}));
  inp.dispatchEvent(new Event('change',{bubbles:true}));
  inp.dispatchEvent(new Event('blur',{bubbles:true}));
  return 'FILLED:' + inp.value;
}catch(e){return 'ERR '+e}})()`);
log('[1] 填手机号: ' + fill);
await sleep(800);

// 2) 找"获取验证码"按钮状态
const btnState = await ev(`(function(){try{
  var btns = [].slice.call(document.querySelectorAll('button,a,span,div')).filter(function(e){return (e.innerText||'').trim()==='获取验证码' && e.offsetParent!==null;});
  return JSON.stringify(btns.map(function(b){return {tag:b.tagName, cls:String(b.className).slice(0,50), disabled: b.disabled||b.getAttribute('disabled')||null};}));
}catch(e){return 'ERR '+e}})()`);
log('[2] 获取验证码按钮: ' + btnState);
await sleep(300);

// 3) 点击
const click = await ev(`(function(){try{
  var btns = [].slice.call(document.querySelectorAll('button,a,span,div')).filter(function(e){return (e.innerText||'').trim()==='获取验证码' && e.offsetParent!==null;});
  if(!btns.length) return 'NO_BTN';
  btns[0].click();
  return 'CLICKED';
}catch(e){return 'ERR '+e}})()`);
log('[3] 点击: ' + click);

// 4) 观察 12s
for (let k = 1; k <= 12; k++) {
  await sleep(1000);
  const st = await ev(`(function(){try{
    var txt=(document.body.innerText||'').replace(/\\s+/g,' ');
    var hint=(txt.match(/(验证成功|已发送|发送成功|已向|请勿|频繁|frequent|错误|正确|请输入正确|验证码.{0,12})/g)||[]).slice(0,5);
    return JSON.stringify({hint});
  }catch(e){return 'ERR '+e}})()`);
  if (k <= 6 || k === 12) log(`[4 +${k}s] ` + st);
}
log('[net]');
[...new Set(net)].slice(0, 25).forEach(x => log('  ' + x));
ws.close();
