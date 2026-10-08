// drag_align3.mjs — 自然对照版: 对齐拖动 + CDP Network 捕获 verify 请求/响应（不注入任何 hook）
// 用法: node drag_align3.mjs <target_puzzle_left> [observe_seconds]
import fs from 'node:fs';
const PORT = process.env.CDP_PORT || '9226';
const P = parseFloat(process.argv[2] || '232');
const OBSERVE = parseInt(process.argv[3] || '10', 10);
const A = 0.003549978, B = 0.077, C = -0.0039;
const S = (-B + Math.sqrt(B * B + 4 * A * (P - C))) / (2 * A);
fs.mkdirSync('/tmp/zai-recon-4', { recursive: true });
const log = s => { console.log(s); fs.appendFileSync('/tmp/zai-recon-4/za11-align.log', s + '\n'); };
log(`[align3] target=${P} -> slider=${S.toFixed(2)}px`);

const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter(t => t.type === 'page');
const _tid = fs.existsSync('/tmp/zai-recon-4/fresh-tid.txt') ? fs.readFileSync('/tmp/zai-recon-4/fresh-tid.txt', 'utf8').trim() : '';
let t = (_tid && pages.find(p => p.id === _tid)) || null;
if (!t) { const _zp = pages.filter(p => (p.url || '').includes('chat.z.ai')); t = _zp.length ? _zp[_zp.length - 1] : pages[0]; }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
const netEvents = [];      // 所有 verify 相关事件
const reqMap = new Map();  // requestId -> info

ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  // Network 事件收集
  if (m.method === 'Network.requestWillBeSent') {
    const u = m.params?.request?.url || '';
    if (/no8xfe-verify|captcha-open/.test(u)) {
      const rid = m.params.requestId;
      reqMap.set(rid, { url: u, postData: m.params.request?.postData || '', t: Date.now() });
      netEvents.push({ kind: 'req', rid, url: u, t: Date.now() });
      log(`[net] REQ ${u.slice(0, 80)} postLen=${(m.params.request?.postData || '').length}`);
    }
  }
  if (m.method === 'Network.responseReceived') {
    const rid = m.params?.requestId;
    if (reqMap.has(rid)) {
      log(`[net] RESP status=${m.params?.response?.status} for ${reqMap.get(rid).url.slice(0, 70)}`);
      netEvents.push({ kind: 'resp', rid, status: m.params?.response?.status, t: Date.now() });
    }
  }
  if (m.method === 'Network.loadingFinished') {
    const rid = m.params?.requestId;
    if (reqMap.has(rid)) {
      netEvents.push({ kind: 'fin', rid, t: Date.now() });
      // 取响应体
      send('Network.getResponseBody', { requestId: rid }).then(r => {
        const body = r?.result?.body || '';
        const rec = { ...reqMap.get(rid), respBody: body, respB64: !!r?.result?.base64Encoded };
        fs.writeFileSync('/tmp/zai-recon-4/natural-verify-' + Date.now() + '.json', JSON.stringify(rec, null, 1));
        log(`[net] BODY len=${body.length}: ${body.slice(0, 220)}`);
        // 也写合并文件
        fs.writeFileSync('/tmp/zai-recon-4/natural-verify-last.json', JSON.stringify(rec, null, 1));
      });
    }
  }
};
const send = (m, p = {}, timeoutMs = 20000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const sendRaw = (m, p) => ws.send(JSON.stringify({ id: ++id, method: m, params: p }));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.result?.value;

await send('Network.enable', {});  // 开网络捕获
await ev("(function(){var w=document.getElementById('aliyunCaptcha-window-popup');if(w)w.style.display='block';var m=document.getElementById('aliyunCaptcha-mask');if(m)m.style.display='block';return 1;})()");
const win = await send('Browser.getWindowForTarget', { targetId: t.id });
if (win?.result?.windowId) await send('Browser.setWindowBounds', { windowId: win.result.windowId, bounds: { windowState: 'normal' } });
await send('Page.bringToFront');
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await sleep(250);
const sInfo = JSON.parse(await ev(`(function(){var s=document.getElementById('aliyunCaptcha-sliding-slider');if(!s)return '{}';var r=s.getBoundingClientRect();return JSON.stringify({cx:r.x+r.width/2, cy:r.y+r.height/2, left:s.style.left, cert:(document.getElementById('aliyunCaptcha-certifyId')||{}).textContent});})()`) || '{}');
log('[1] slider: ' + JSON.stringify(sInfo));
if (!sInfo.cx) { log('ABORT-NO-SLIDER'); process.exit(1); }

log(`[2] drag ${S.toFixed(1)}px (natural mode, no hooks)`);
sendRaw('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sInfo.cx, y: sInfo.cy });
await sleep(160);
sendRaw('Input.dispatchMouseEvent', { type: 'mousePressed', x: sInfo.cx, y: sInfo.cy, button: 'left', clickCount: 1 });
await sleep(130);
const steps = 14;
for (let i = 1; i <= steps; i++) {
  const p = i / steps;
  const eased = 1 - Math.pow(1 - p, 3);
  const x = sInfo.cx + S * eased;
  const y = sInfo.cy + (Math.random() - 0.5) * 1.4;
  sendRaw('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left' });
  await sleep(32);
}
sendRaw('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sInfo.cx + S, y: sInfo.cy, button: 'left' });
await sleep(60);
sendRaw('Input.dispatchMouseEvent', { type: 'mouseReleased', x: sInfo.cx + S, y: sInfo.cy, button: 'left', clickCount: 1 });
log('[3] released; observing ' + OBSERVE + 's');

for (let k = 1; k <= OBSERVE; k++) {
  await sleep(1000);
  const st = await ev(`(function(){try{var p=document.getElementById('aliyunCaptcha-puzzle');var tx=(document.getElementById('aliyunCaptcha-sliding-text')||{}).textContent||'';var pop=document.getElementById('aliyunCaptcha-window-popup');return JSON.stringify({pl:(p&&p.style)?p.style.left:null, txt:tx.slice(0,50), popup:pop?getComputedStyle(pop).display:null});}catch(e){return 'ERR '+e;}})()`);
  log(`[4 +${k}s] ${st}`);
  if (netEvents.some(x => x.kind === 'fin')) break;
}
log(`[5] net events: ${JSON.stringify(netEvents)}`);
log('DONE-ALIGN3');
ws.close();
