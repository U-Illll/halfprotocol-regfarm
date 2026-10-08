// gt-form-test.mjs — 空表单提交测试：看必填校验与验证控件
// 用法: CDP_PORT=9228 node gt-form-test.mjs
const PORT = process.env.CDP_PORT || '9228';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.filter(x => x.type === 'page').find(p => (p.url || '').includes('Register'));
if (!t) { console.log('NO page'); process.exit(1); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const net = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  if (m.method === 'Network.requestWillBeSent') {
    const u = m.params?.request?.url || '';
    if (/register|sms|captcha|verify|account/i.test(u) && !/\.(js|css|png|svg|woff)/.test(u)) net.push(m.params.request.method + ' ' + u.slice(0, 130));
  }
};
const send = (m, p = {}, timeoutMs = 15000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;
await send('Network.enable', {});

// 1) 找 "Start free trial" 按钮并点击（空表单）
const r = await ev(`(function(){ try {
  const btns = [...document.querySelectorAll('a,button')].filter(e => /Start free trial/i.test(e.innerText||'') && e.offsetParent !== null);
  if (!btns.length) return 'NO_BTN';
  btns[0].click();
  return 'CLICKED n=' + btns.length;
} catch(e) { return 'ERR ' + e; } })()`);
console.log('[test]', r);
await sleep(3000);

// 2) 看页面错误提示
const state = await ev(`(function(){ try {
  const errs = [...document.querySelectorAll('[class*=error],[class*=tip],[class*=msg]')].filter(e=>e.offsetParent&&(e.innerText||'').trim()).map(e=>({cls:String(e.className).slice(0,40),txt:(e.innerText||'').trim().slice(0,80)}));
  const capEls = [...document.querySelectorAll('[id*=aliyunCaptcha],[class*=geetest],[id*=captcha],[class*=captcha]')].filter(e=>e.offsetParent).slice(0,10).map(e=>({id:e.id||undefined,cls:String(e.className).slice(0,50),txt:(e.innerText||'').trim().slice(0,40)}));
  return JSON.stringify({errs, capEls}, null, 1);
} catch(e) { return 'ERR ' + e; } })()`);
console.log(JSON.stringify(JSON.parse(state || '{}'), null, 1));
console.log('[test] net:', JSON.stringify([...new Set(net)].slice(0, 12), null, 1));
ws.close();
