// fpcheck.mjs — stealth-kit 指纹体检器（独立可跑；输出 JSON 到 stdout，可选写文件）
// 用法: CDP_PORT=9228 node fpcheck.mjs [urlMatch] [outFile]
// 体检项与基线一致（可跨会话/跨驱动对比）：webdriver 链、chrome 对象、插件、
// automationGlobals、环境自洽（UA/platform/hw/tz/screen/dpr/gl）、焦点/可见性。
import fs from 'node:fs';

const PORT = process.env.CDP_PORT || '9228';
const urlMatch = process.argv[2] || '';
const outFile = process.argv[3] || '';

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const pages = list.filter(t => t.type === 'page');
const t = urlMatch ? pages.find(p => (p.url || '').includes(urlMatch)) : (pages.find(p => !(p.url || '').startsWith('about:')) || pages[0]);
if (!t) { console.log(JSON.stringify({ err: 'NO_PAGE' })); process.exit(1); }

const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (m, p = {}, timeoutMs = 15000) => new Promise(res => {
  const i = ++id; const timer = setTimeout(() => { pend.delete(i); res({ timeout: true }); }, timeoutMs);
  pend.set(i, v => { clearTimeout(timer); res(v); }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
});

const fp = (await send('Runtime.evaluate', {
  expression: `(function(){ try {
    const out = {};
    out.url = location.href;
    out.title = document.title;
    out.webdriver = (navigator.webdriver === undefined) ? 'undefined' : String(navigator.webdriver);
    out.webdriverInProto = !!Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver');
    out.webdriverOwn = Object.getOwnPropertyDescriptor(navigator, 'webdriver') ? 'HAS_OWN' : 'no-own';
    out.chrome = !!(window.chrome && window.chrome.runtime);
    out.chromeKeys = window.chrome ? Object.keys(window.chrome) : [];
    out.plugins = navigator.plugins ? navigator.plugins.length : -1;
    out.ua = navigator.userAgent;
    out.langs = (navigator.languages || []).join(',');
    out.platform = navigator.platform;
    out.hw = navigator.hardwareConcurrency;
    out.mem = navigator.deviceMemory || null;
    out.tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    out.screen = [screen.width, screen.height, screen.availWidth, screen.availHeight].join('x');
    out.win = [outerWidth, outerHeight, innerWidth, innerHeight].join('x');
    out.dpr = devicePixelRatio;
    try { const c = document.createElement('canvas'); const gl = c.getContext('webgl'); const d = gl.getExtension('WEBGL_debug_renderer_info');
      out.gl = gl.getParameter(d.UNMASKED_VENDOR_WEBGL) + ' / ' + gl.getParameter(d.UNMASKED_RENDERER_WEBGL); } catch(e) { out.gl = 'ERR ' + e; }
    const tr = [];
    for (const k of ['__playwright__binding__','__pwInitScripts','__puppeteer_utility_world__','_phantom','callSelenium','__selenium_unwrapped','__webdriver_evaluate','__driver_evaluate','__fxdriver_evaluate','_Selenium_IDE_Recorder','cdc_adoQpoasnfa76pfcZLmcfl_Array']) {
      if (k in window || k in document) tr.push(k);
    }
    out.automationGlobals = tr;
    out.notif = (typeof Notification !== 'undefined') ? Notification.permission : 'n/a';
    out.hasFocus = document.hasFocus();
    out.cookieEnabled = navigator.cookieEnabled;
    out.visibility = document.visibilityState;
    return JSON.stringify(out);
  } catch(e) { return 'ERR ' + e; } })()`,
  returnByValue: true
}))?.result?.result?.value;

console.log(fp);
if (outFile) fs.writeFileSync(outFile, String(fp || ''));
ws.close();
