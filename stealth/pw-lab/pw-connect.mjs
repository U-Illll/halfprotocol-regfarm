// pw-connect.mjs — patchright connectOverCDP 真机 Edge A/B 探测（stealth-kit · B3）
// 用法:
//   CDP_PORT=9228 node pw-connect.mjs [urlMatch]
// 抓 CDP 协议流量（查 Runtime.enable 等）:
//   DEBUG=pw:protocol CDP_PORT=9228 node pw-connect.mjs 2> /tmp/stealth-kit-out/pw-protocol.log
import { chromium } from 'patchright';
import fs from 'node:fs';

const PORT = process.env.CDP_PORT || '9228';
const urlMatch = process.argv[2] || '';
const OUT = process.env.OUT_DIR || '/tmp/stealth-kit-out';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
console.log('[pw] connected | contexts:', browser.contexts().length);
const ctx = browser.contexts()[0];
const pages = ctx.pages();
console.log('[pw] pages:', JSON.stringify(pages.map(p => (p.url() || '').slice(0, 70))));

const page = urlMatch
  ? pages.find(p => (p.url() || '').includes(urlMatch))
  : (pages.find(p => !(p.url() || '').startsWith('about:')) || pages[0]);
if (!page) { console.log('NO_PAGE'); process.exit(1); }
console.log('[pw] target:', (page.url() || '').slice(0, 80));

// 1) 指纹体检（与 stealth-kit/fpcheck.mjs 相同清单，便于对比）
const fp = await page.evaluate(() => {
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
    out.gl = gl.getParameter(d.UNMASKED_VENDOR_WEBGL) + ' / ' + gl.getParameter(d.UNMASKED_RENDERER_WEBGL); } catch (e) { out.gl = 'ERR ' + e; }
  const tr = [];
  for (const k of ['__playwright__binding__', '__pwInitScripts', '__puppeteer_utility_world__', '_phantom', 'callSelenium', '__selenium_unwrapped', '__webdriver_evaluate', '__driver_evaluate', '__fxdriver_evaluate', '_Selenium_IDE_Recorder', 'cdc_adoQpoasnfa76pfcZLmcfl_Array']) {
    if (k in window || k in document) tr.push(k);
  }
  out.automationGlobals = tr;
  out.notif = (typeof Notification !== 'undefined') ? Notification.permission : 'n/a';
  out.hasFocus = document.hasFocus();
  out.cookieEnabled = navigator.cookieEnabled;
  out.visibility = document.visibilityState;
  return out;
});
console.log('[pw][FP]', JSON.stringify(fp));
fs.writeFileSync(`${OUT}/fp-pw.json`, JSON.stringify(fp));

// 2) 功能回归小测（定位/求值/鼠标——在无害页面上进行）
const title = await page.title();
console.log('[pw] title:', title);
const bodyVisible = await page.locator('body').isVisible().catch(e => 'ERR ' + String(e).slice(0, 80));
console.log('[pw] body.isVisible:', bodyVisible);
const box = await page.locator('body').boundingBox().catch(() => null);
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 10, { steps: 8 });
  console.log('[pw] mouse.move OK (2 moves, 8 steps)');
}

// 3) 注入能力探测：addInitScript 后新导航是否带 __pw 痕迹（注册一个标记，导航 about:blank 子页测试）
//    —— 用临时 page（不改动目标页）
try {
  const p2 = await ctx.newPage();
  await p2.goto('about:blank');
  const mark = await p2.evaluate(() => ({
    hasPwInit: '__pwInitScripts' in window,
    hasBinding: '__playwright__binding__' in window,
    hasPwGlobal: Object.keys(window).filter(k => k.startsWith('__pw')).slice(0, 8),
  }));
  console.log('[pw] fresh-page probe:', JSON.stringify(mark));
  fs.writeFileSync(`${OUT}/pw-fresh-probe.json`, JSON.stringify(mark));
  await p2.close();
} catch (e) { console.log('[pw] fresh-page probe ERR:', String(e).slice(0, 150)); }

// 注意：不调用 browser.close()（避免影响真机浏览器会话）；进程退出 = 断开 CDP 连接。
console.log('[pw] DONE (disconnecting without browser.close)');
process.exit(0);
