// dump-form.mjs — dump 页面表单结构（input/select/button/验证控件）
// 用法: CDP_PORT=9228 node dump-form.mjs [urlMatch]
const PORT = process.env.CDP_PORT || '9228';
const MATCH = process.argv[2] || 'Register';
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const pages = list.filter(x => x.type === 'page');
const t = pages.find(p => (p.url || '').includes(MATCH));
if (!t) { console.log('NO page'); process.exit(1); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (m, p = {}, timeoutMs = 15000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const r = await send('Runtime.evaluate', {
  expression: `(function(){try{
    const inputs = [...document.querySelectorAll('input')].map(e=>({type:e.type,name:e.name,id:e.id,ph:e.placeholder,vis:getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'}));
    const selects = [...document.querySelectorAll('select')].map(e=>({name:e.name,id:e.id,opts:[...e.options].slice(0,8).map(o=>o.value+':'+o.text)}));
    const buttons = [...document.querySelectorAll('button,.btn,a')].filter(e=>e.offsetParent&&/(verify|submit|create|sign|register|get|start)/i.test((e.innerText||'')+(e.className||''))).slice(0,10).map(e=>({tag:e.tagName,cls:String(e.className).slice(0,50),txt:(e.innerText||'').trim().slice(0,40)}));
    const countryDiv = [...document.querySelectorAll('[class*=country],[class*=area],[class*=code]')].slice(0,8).map(e=>({cls:String(e.className).slice(0,50),txt:(e.innerText||'').trim().slice(0,30)}));
    return JSON.stringify({inputs,selects,buttons,countryDiv},null,1);
  }catch(e){return 'ERR '+e}})()`,
  returnByValue: true
});
console.log(r?.result?.result?.value);
ws.close();
