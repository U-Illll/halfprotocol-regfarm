// sm_click_diag.mjs — 诊断"继续"按钮点击是否到达（elementFromPoint + 监听器探针）
import fs from 'node:fs';
const PORT = process.env.CDP_PORT || '9229';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.filter(x => x.type === 'page').find(p => (p.url || '').includes('ishumei')) || list.filter(x => x.type === 'page')[0];
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (m, p = {}, T = 15000) => new Promise(res => { const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, T); pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true }))?.result?.result?.value;
const log = s => { console.log(s); fs.appendFileSync('/tmp/non-ali/sm-diag.log', s + '\n'); };

await send('Page.bringToFront', {});
await sleep(300);

// 1) 按钮 rect
const btn = JSON.parse(await ev(`(function(){var el=document.querySelector('.reg-btn');if(!el)return '{}';var r=el.getBoundingClientRect();return JSON.stringify({cx:Math.round(r.x+r.width/2),cy:Math.round(r.y+r.height/2),x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)});})()`) || '{}');
log('[btn rect] ' + JSON.stringify(btn));

// 2) elementFromPoint 探测（按钮中心 + 前后偏移）
const efp = await ev(`(function(){try{
  var pts=[[${btn.cx},${btn.cy}],[${btn.cx-40},${btn.cy}],[${btn.cx+40},${btn.cy}],[${btn.cx},${btn.cy-10}],[${btn.cx},${btn.cy+10}]];
  var out=pts.map(function(p){var e=document.elementFromPoint(p[0],p[1]);return p.join(',')+' -> '+(e? (e.tagName+'.'+String(e.className).slice(0,40)) : 'null');});
  return JSON.stringify(out);
}catch(e){return 'ERR '+e}})()`);
log('[elementFromPoint] ' + efp);

// 3) 挂捕获监听探针（不干扰原 handler）
await ev(`(function(){window.__CLICKPROBE={n:0,tgt:null};document.addEventListener('click',function(e){window.__CLICKPROBE.n++;var t=e.target;window.__CLICKPROBE.tgt=t.tagName+'.'+String(t.className).slice(0,40);window.__CLICKPROBE.trusted=e.isTrusted;},true);return 'probe-installed';})()`);

// 4) CDP 真实点击
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: btn.cx - 80, y: btn.cy });
await sleep(250);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: btn.cx, y: btn.cy });
await sleep(200);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: btn.cx, y: btn.cy, button: 'left', buttons: 1, clickCount: 1 });
await sleep(120);
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btn.cx, y: btn.cy, button: 'left', clickCount: 1 });
await sleep(1200);
const probe = await ev(`JSON.stringify(window.__CLICKPROBE)`);
log('[probe] ' + probe);

// 5) 状态复查
const st = await ev(`(function(){var f=document.querySelector('.first-step'),s=document.querySelector('.second-step');return JSON.stringify({first:f?getComputedStyle(f).display:null,second:s?getComputedStyle(s).display:null});})()`);
log('[step] ' + st);
ws.close();
