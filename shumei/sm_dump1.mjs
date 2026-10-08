// sm_dump1.mjs — dump 数美验证码 DOM 布局（滑块手柄/轨道/拼图区）
const PORT = process.env.CDP_PORT || '9229';
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.filter(x => x.type === 'page').find(p => (p.url || '').includes('ishumei')) || list.filter(x => x.type === 'page')[0];
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (m, p = {}, timeoutMs = 15000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;

const dump = await ev(`(function(){try{
  var out=[];
  var nodes=[].slice.call(document.querySelectorAll('[class*=shumei],[id*=shumei]'));
  nodes.forEach(function(e){
    var r=e.getBoundingClientRect();
    if(r.width>0&&r.height>0){
      out.push({cls:String(e.className).slice(0,70), x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height), txt:(e.innerText||'').replace(/\\s+/g,' ').slice(0,40)});
    }
  });
  return JSON.stringify(out.slice(0,40), null, 0);
}catch(e){return 'ERR '+e}})()`);
const arr = JSON.parse(dump || '[]');
arr.forEach(o => console.log(`[${o.x},${o.y} ${o.w}x${o.h}] ${o.cls} ${o.txt ? '| ' + o.txt : ''}`));
ws.close();
