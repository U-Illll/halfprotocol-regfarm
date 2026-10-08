// pw-eval-ab.mjs — 验证：patchright evaluate 的 isolated world 观测偏差 + 新页主世界痕迹
// 用法: CDP_PORT=9228 node pw-eval-ab.mjs
import { chromium } from 'patchright';

const PORT = process.env.CDP_PORT || '9228';
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => (p.url() || '').includes('example')) || ctx.pages()[0];
console.log('[ab] page:', page.url());

const probe = () => {
  const out = {
    chromeKeys: Object.keys(window.chrome || {}),
    chromeApp: !!(window.chrome && window.chrome.app),
    chromeRuntime: !!(window.chrome && window.chrome.runtime),
    webdriverOwn: Object.getOwnPropertyDescriptor(navigator, 'webdriver') ? 'HAS_OWN' : 'no-own',
  };
  return out;
};

// 1) 同一页面：默认（isolated world） vs main world（isolatedContext=false）
const iso = await page.evaluate(probe);
const main = await page.evaluate(probe, undefined, undefined, false);
console.log('[ab][same-page] iso :', JSON.stringify(iso));
console.log('[ab][same-page] main:', JSON.stringify(main));

// 2) 新页（patchright 自己开的 tab）→ 主世界痕迹探查
const p2 = await ctx.newPage();
await p2.goto('https://www.example.com', { waitUntil: 'domcontentloaded' });
const fresh = await p2.evaluate(() => {
  const out = {
    pwInit: '__pwInitScripts' in window,
    binding: '__playwright__binding__' in window,
    pwGlobals: Object.keys(window).filter(k => k.startsWith('__pw')),
    chromeKeys: Object.keys(window.chrome || {}),
    chromeApp: !!(window.chrome && window.chrome.app),
    webdriverOwn: Object.getOwnPropertyDescriptor(navigator, 'webdriver') ? 'HAS_OWN' : 'no-own',
  };
  return out;
}, undefined, undefined, false);
console.log('[ab][fresh-page-main]', JSON.stringify(fresh));
await p2.close();

// 3) 收尾：列出当前 pages 状态（确认原页未损）
console.log('[ab] final pages:', JSON.stringify(ctx.pages().map(p => (p.url() || '').slice(0, 60))));
process.exit(0);
