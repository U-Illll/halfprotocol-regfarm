// sm_cont2.mjs — 再点"继续" + 深诊断 dump
import fs from 'node:fs';
const PORT = process.env.CDP_PORT || '9229';
const OUT = process.env.SM_OUT || '/tmp/non-ali';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.filter(x => x.type === 'page').find(p => (p.url || '').includes('ishumei')) || list.filter(x => x.type === 'page')[0];
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (m, p = {}, T = 15000) => new Promise(res => { const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, T); pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true }))?.result?.result?.value;
const log = s => { console.log(s); fs.appendFileSync(OUT + '/sm-reg5.log', s + '\n'); };

const deepDump = `(function(){try{
  var mes=document.querySelector('input[name=mes]');
  var errs=[].slice.call(document.querySelectorAll('[class*=error]')).map(function(e){return {cls:String(e.className).slice(0,50), disp:getComputedStyle(e).display, txt:(e.innerText||'').slice(0,50)};}).filter(function(e){return e.disp!=='none' && e.txt;});
  var cb=[].slice.call(document.querySelectorAll('[class*=checkbox],[class*=agree]')).map(function(e){return {cls:String(e.className).slice(0,50), cls2: e.querySelector('*')?String(e.querySelector('*').className).slice(0,40):null};}).slice(0,6);
  var btn=document.querySelector('.reg-btn');
  var tips=document.querySelector('.serviceItem-tips');
  return JSON.stringify({mes: mes?mes.value:null, mesCls: mes?String(mes.className).slice(0,60):null, errs, cb, btnTxt: btn?btn.innerText:null, tips: tips?{disp:getComputedStyle(tips).display, txt:(tips.innerText||'').slice(0,60)}:null});
}catch(e){return 'ERR '+e}})()`;

await send('Page.bringToFront', {});
await sleep(300);
log('[dump-A] ' + await ev(deepDump));

// 先点击页面空白处（blur），再点继续
const btn = JSON.parse(await ev(`(function(){var el=document.querySelector('.reg-btn');if(!el)return '{}';var r=el.getBoundingClientRect();return JSON.stringify({cx:Math.round(r.x+r.width/2),cy:Math.round(r.y+r.height/2)});})()`) || '{}');
log('[btn] ' + JSON.stringify(btn));
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 400, y: 200 });
await sleep(200);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 400, y: 200, button: 'left', buttons: 1, clickCount: 1 });
await sleep(80);
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 400, y: 200, button: 'left', clickCount: 1 });
await sleep(800);
log('[dump-B after-blank] ' + await ev(deepDump));

if (btn.cx) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: btn.cx - 60, y: btn.cy });
  await sleep(220);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: btn.cx, y: btn.cy });
  await sleep(180);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: btn.cx, y: btn.cy, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(110);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btn.cx, y: btn.cy, button: 'left', clickCount: 1 });
  log('[clicked]');
}
for (let k = 1; k <= 6; k++) {
  await sleep(1000);
  const st = await ev(`(function(){var f=document.querySelector('.first-step'),s=document.querySelector('.second-step');var txt=(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,200);return JSON.stringify({first:f?getComputedStyle(f).display:null,second:s?getComputedStyle(s).display:null,tail:txt.slice(-100)});})()`);
  log(`[+${k}s] ` + st);
}
log('[dump-C] ' + await ev(deepDump));
ws.close();
