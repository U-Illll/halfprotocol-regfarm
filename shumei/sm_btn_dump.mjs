// sm_btn_dump.mjs — dump 所有"继续/免费试用"元素定位 + 截图
import fs from 'node:fs';
const PORT = process.env.CDP_PORT || '9229';
const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter(t => t.type === 'page');
const t = pages.find(p => (p.url || '').includes('ishumei'));
if (!t) { console.log('NO page'); process.exit(1); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (m, p = {}, t = 15000) => new Promise(res => { const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, t); pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;

const d = await ev(`(function(){try{
  var out=[];
  var all=[].slice.call(document.querySelectorAll('*'));
  all.forEach(function(e){
    var tx=(e.childElementCount===0?(e.innerText||e.textContent||''):'').trim();
    if(tx==='继续'||tx==='免费试用'||tx==='获取验证码'){
      var r=e.getBoundingClientRect();
      var st=getComputedStyle(e);
      out.push({txt:tx, tag:e.tagName, cls:String(e.className).slice(0,55), x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height), bg:st.backgroundColor, vis: r.width>0 && st.display!=='none'});
    }
  });
  var inner = window.innerWidth, ih = window.innerHeight;
  return JSON.stringify({viewport:[inner,ih], dpr:window.devicePixelRatio, els: out});
}catch(e){return 'ERR '+e}})()`);
console.log(d);
const shot = await send('Page.captureScreenshot', { format: 'png' });
if (shot?.result?.data) fs.writeFileSync('/tmp/non-ali/sm-now.png', Buffer.from(shot.result.data, 'base64'));
console.log('saved sm-now.png');
ws.close();
