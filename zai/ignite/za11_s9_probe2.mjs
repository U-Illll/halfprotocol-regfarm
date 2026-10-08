// S9b：终点帧取证与入口矩阵探查
// 目标：在同一个 paused call frame 内比较 th/tu/ts/np 的输入形态，避免
//       resume 后丢失闭包引用。只保存长度、头部和结构摘要，不落盘凭据全文。
import fs from 'node:fs';

const PORT = process.env.CDP_PORT || '9226';
const PX = Number(process.argv[2] || 250);
const OUT = process.env.OUT || '/tmp/zai-recon-4';
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = s => { console.log(s); fs.appendFileSync(`${OUT}/za11-s9b.log`, `${s}\n`); };

const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter(x => x.type === 'page');
const tab = pages.find(x => /chat\.z\.ai/.test(x.url || '')) || pages[0];
if (!tab) throw new Error('no page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let seq = 0;
const pending = new Map();
const events = [];
const scripts = [];
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method) { events.push(m); if (m.method === 'Debugger.scriptParsed') scripts.push(m.params); }
};
const send = (method, params = {}, timeout = 30000) => new Promise(resolve => {
  const id = ++seq;
  const timer = setTimeout(() => { pending.delete(id); resolve({ timeout: true }); }, timeout);
  pending.set(id, m => { clearTimeout(timer); resolve(m); });
  ws.send(JSON.stringify({ id, method, params }));
});
const pageEval = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true }))?.result?.result?.value;
const frameEval = async (frame, expression, timeout = 30000) => {
  const r = await send('Debugger.evaluateOnCallFrame', { callFrameId: frame.callFrameId, expression, returnByValue: true }, timeout);
  if (r?.result?.exceptionDetails) return { error: String(r.result.exceptionDetails.text || r.result.exceptionDetails.description || '').slice(0, 500) };
  return { value: r?.result?.result?.value };
};

await send('Page.bringToFront');
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Debugger.enable');
await sleep(1200);
const pe = [...scripts].reverse().find(p => /dynamicJS.*pe\./.test(String(p.url || '')));
if (!pe) { log('NO_PE'); ws.close(); process.exit(10); }
const srcR = await send('Debugger.getScriptSource', { scriptId: pe.scriptId });
const src = srcR?.result?.scriptSource || '';
const raw = [];
for (const re of [/=JSON\[[^\]]{1,60}\]\(/g]) {
  let m; while ((m = re.exec(src)) && raw.length < 40) raw.push(m.index);
}
const cols = [...new Set(raw.flatMap(p => [p - 13, p, p + 5, p + 13, p + 20, p + 27].filter(x => x > 0)))];
log(`[P1] pe=${String(pe.url).split('/').pop()} source=${src.length} candidates=${cols.length}`);
const bpids = [];
for (const columnNumber of cols) {
  const r = await send('Debugger.setBreakpoint', { location: { scriptId: pe.scriptId, lineNumber: 0, columnNumber } });
  if (r?.result?.breakpointId) bpids.push({ bid: r.result.breakpointId, requested: columnNumber, actual: r.result.actualLocation?.columnNumber ?? null });
}
log(`[P1] bps=${JSON.stringify(bpids.map(b=>[b.requested,b.actual]))}`);

await pageEval(`(()=>{for(const id of ['aliyunCaptcha-window-popup','aliyunCaptcha-mask']){const e=document.getElementById(id);if(e)e.style.display='block'}return 1})()`);
await sleep(500);
const slider = JSON.parse(await pageEval(`(()=>{const e=document.getElementById('aliyunCaptcha-sliding-slider');if(!e)return '{}';const r=e.getBoundingClientRect();return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()`));
if (!slider.x) { log('NO_SLIDER'); ws.close(); process.exit(11); }
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: slider.x, y: slider.y });
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: slider.x, y: slider.y, button: 'left', clickCount: 1 });
const n = Math.max(20, Math.round(PX / 9));
for (let i = 1; i <= n; i++) {
  const k = i / n; const ease = k < .5 ? 2*k*k : 1 - Math.pow(-2*k+2, 2)/2;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: slider.x + PX*ease, y: slider.y + (Math.random()-.5)*2, button: 'left' });
  await sleep(16);
}
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: slider.x + PX, y: slider.y, button: 'left', clickCount: 1 });
log('[P2] drag released');

const deadline = Date.now() + 100000;
let pause;
while (Date.now() < deadline) {
  pause = events.find(x => x.method === 'Debugger.paused');
  if (pause) break;
  await sleep(100);
}
if (!pause) { log('[P3] NO_PAUSE'); for (const b of bpids) await send('Debugger.removeBreakpoint', { breakpointId: b.bid }); await send('Debugger.disable'); ws.close(); process.exit(12); }

// 终点帧通常不是第一处命中：先记录上游停点，移除其邻域断点后继续。
// 最多推进 3 次；若已经出现 cvp/data，则保留当前帧。
for (let hop = 0; hop < 3; hop++) {
  const hit = pause.params.callFrames?.[0]?.location?.columnNumber ?? -1;
  const cvpCount = Number(await pageEval('window.__CVPS ? window.__CVPS.length : 0')) || 0;
  if (cvpCount > 0 || hop === 2) break;
  const near = bpids.filter(b => b.bid && Math.abs((b.actual ?? b.requested) - hit) < 120);
  if (!near.length) break;
  for (const b of near) { await send('Debugger.removeBreakpoint', { breakpointId: b.bid }); b.bid = null; }
  log(`[P3] upstream hit=${hit}; removed=${near.length}; resume hop=${hop + 1}`);
  await send('Debugger.resume');
  const until = Date.now() + 90000; pause = null;
  while (Date.now() < until) {
    const next = events.find((x, i) => x.method === 'Debugger.paused' && i > 0 && x !== pause);
    const all = events.filter(x => x.method === 'Debugger.paused');
    if (all.length > 1 + hop) { pause = all[all.length - 1]; break; }
    await sleep(100);
  }
  if (!pause) { log('[P3] no later pause'); break; }
}

const frames = pause.params.callFrames || [];
const report = { pe: pe.url, hit: frames[0]?.location || null, frames: [], probes: [], cvps: null };
log(`[P3] paused reason=${pause.params.reason} frames=${frames.length}`);

// 采集每个帧的全部 scope 名称，并把值压成可比摘要。
let selected = null;
for (let fi = 0; fi < Math.min(frames.length, 20); fi++) {
  const f = frames[fi];
  const names = new Set();
  for (const sc of f.scopeChain || []) {
    if (!sc.object?.objectId) continue;
    const p = await send('Runtime.getProperties', { objectId: sc.object.objectId, ownProperties: true });
    for (const x of p?.result?.result || []) if (!['this', 'arguments'].includes(x.name)) names.add(x.name);
  }
  const namesJson = JSON.stringify([...names]);
  const r = await frameEval(f, `(function(){
    const names=${namesJson}, out={frame:${fi},names,values:[],functions:[],mats:[],cvps:[]};
    for(const n of names){let v;try{v=eval(n)}catch(_){continue} if(v==null)continue;
      try{
        if(typeof v==='string') out.values.push({n,type:'string',len:v.length,head:v.slice(0,96)});
        else if(['number','boolean','bigint'].includes(typeof v)) out.values.push({n,type:typeof v,value:String(v)});
        else if(typeof v==='function'){const s=String(v);out.functions.push({n,len:s.length,head:s.slice(0,220)})}
        else if(typeof v==='object'){const ks=Object.keys(v);const z={n,type:'object',keys:ks.slice(0,80)};
          if(typeof v.data==='string')Object.assign(z,{dataLen:v.data.length,dataHead:v.data.slice(0,96)});
          out.values.push(z);if(ks.includes('TrackList'))out.mats.push(n);if(ks.includes('certifyId'))out.cvps.push(n)}
      }catch(e){out.values.push({n,error:String(e).slice(0,180)})}
    } return JSON.stringify(out);
  })()`);
  let d; try { d = JSON.parse(r.value || '{}'); } catch { d = { frame: fi, parseError: r.value || r.error }; }
  report.frames.push(d);
  if (!selected && (d.mats?.length || d.cvps?.length || d.functions?.some(x => x.len > 8000))) selected = { f, d };
}

// 只在暂停帧内执行矩阵，确保闭包和临时 key 尚未失效。
if (selected) {
  const { f, d } = selected;
  const mat = d.mats?.[0] || null;
  const cvp = d.cvps?.[0] || null;
  const fnNames = new Set(['th','tu','ts','np','nh','e','s']);
  for (const x of d.functions || []) if (x.len > 8000) fnNames.add(x.n);
  const fnList = [...fnNames];
  log(`[P4] frame=${d.frame} mat=${mat} cvp=${cvp} fns=${fnList.join(',')}`);
  const matExpr = mat || 'undefined';
  const cvpExpr = cvp || 'undefined';
  const matrix = [];
  for (const fn of fnList) {
    for (const op of Array.from({length: 32}, (_, i) => i)) {
      for (const variant of ['mat','mat_cvp','mat_json','cvp','mat_truth']) {
        const arg = variant === 'mat' ? matExpr : variant === 'mat_cvp' ? `${matExpr},${cvpExpr}` : variant === 'mat_json' ? `JSON.stringify(${matExpr})` : variant === 'cvp' ? cvpExpr : `${matExpr},${cvpExpr}&&${cvpExpr}.data`;
        const expr = `(function(){try{if(typeof ${fn}!=='function')return JSON.stringify({skip:typeof ${fn}});var v=${fn}.call(this,${op},${arg});return JSON.stringify({ok:1,type:typeof v,len:(v&&v.length)||null,head:String(v??'').slice(0,120)})}catch(e){return JSON.stringify({ok:0,error:String(e).slice(0,240)})}})()`;
        const q = await frameEval(f, expr, 25000);
        let result; try { result = JSON.parse(q.value || '{}'); } catch { result = { raw: q.value || q.error }; }
        matrix.push({fn, op, variant, result});
      }
    }
  }
  report.probes = matrix;
}
report.cvps = await pageEval(`JSON.stringify((window.__CVPS||[]).slice(-4).map(x=>({dataLen:x.dataLen,head:String(x.dataHead||'').slice(0,96),t:x.t})))`);
fs.writeFileSync(`${OUT}/za11-s9b-report.json`, JSON.stringify(report, null, 2));
for (const b of bpids) await send('Debugger.removeBreakpoint', { breakpointId: b.bid });
await send('Debugger.resume');
await send('Debugger.disable');
log(`[P5] wrote ${OUT}/za11-s9b-report.json`);
ws.close();
