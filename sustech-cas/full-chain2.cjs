// 终极全链 v2：jar 持久化 + TGC 复用 + 下载跟 302
const fs = require('fs');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const P = '/tmp/cas-captcha-recon/';
const JARF = P + 'cas-session-jar.json';
const PY = process.env.CAS_PYTHON || 'python3'; // 需要 cv2+numpy 的 python
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const SERVICE = 'https://bb.sustech.edu.cn/webapps/bb-sso-BBLEARN/index.jsp';
const LOGIN_URL = 'https://cas.sustech.edu.cn/cas/login?service=' + encodeURIComponent(SERVICE);
const CLIENT_UID = 'slider6c1e9a5f-1111-4222-8333-abcdef123456';

const FRESH = process.argv.includes('--fresh');

class Jar {
  constructor() { this.cookies = new Map(); }
  setFromResponse(resp, host) {
    const scs = resp.headers.getSetCookie ? resp.headers.getSetCookie() : [];
    for (const sc of scs) {
      const [pair] = sc.split(';');
      const eq = pair.indexOf('='); if (eq < 0) continue;
      const name = pair.slice(0, eq).trim(), value = pair.slice(eq + 1).trim();
      const domAttr = sc.split(';').map(a => a.trim()).find(a => /^domain=/i.test(a));
      const dom = (domAttr ? domAttr.slice(7).trim().replace(/^\./, '') : host);
      this.cookies.set(dom + '|' + name, { domain: dom, name, value });
    }
  }
  header(host) {
    const parts = [];
    for (const { domain, name, value } of this.cookies.values())
      if (host === domain || host.endsWith('.' + domain)) parts.push(name + '=' + value);
    return parts.join('; ');
  }
  has(domain, name) { return this.cookies.has(domain + '|' + name); }
  save() { fs.writeFileSync(JARF, JSON.stringify([...this.cookies.entries()])); }
  load() { if (fs.existsSync(JARF)) { for (const [k, v] of JSON.parse(fs.readFileSync(JARF, 'utf8'))) this.cookies.set(k, v); console.log('[jar] loaded, cookies:', this.cookies.size); } }
}

const jar = new Jar();
async function req(url, opts = {}) {
  const h = new URL(url).hostname;
  const headers = { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9', ...(opts.headers || {}) };
  const ch = jar.header(h); if (ch) headers.cookie = ch;
  const resp = await fetch(url, { ...opts, headers, redirect: 'manual' });
  jar.setFromResponse(resp, h);
  return resp;
}
function aes128EcbB64(plain, key16) {
  const c = crypto.createCipheriv('aes-128-ecb', Buffer.from(key16, 'utf8'), null);
  return Buffer.concat([c.update(plain, 'utf8'), c.final()]).toString('base64');
}
function textOf(h) { return h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
const JSONH = { 'Content-Type': 'application/json;charset=UTF-8', 'Accept-Language': 'zh-CN', 'Origin': 'https://cas.sustech.edu.cn', 'Referer': 'https://cas.sustech.edu.cn/cas/login' };

// SSO 跟随（处理多跳 + 检测失败回 login）
async function followSso(startUrl, maxHops = 8) {
  let url = startUrl, r;
  for (let hop = 0; hop < maxHops; hop++) {
    r = await req(url);
    const loc = r.headers.get('location');
    const isRedirect = [301, 302, 303, 307, 308].includes(r.status);
    console.log(`  hop${hop}: ${r.status}${loc ? ' → ' + loc.slice(0, 95) : ''}`);
    if (!isRedirect || !loc) break;
    url = new URL(loc, url).toString();
  }
  return { r, url };
}

(async () => {
  const t0 = Date.now();
  jar.load();

  // ===== TGC 复用快速路径（默认先试）=====
  if (!FRESH && jar.has('cas.sustech.edu.cn', 'TGC')) {
    console.log('[A] 尝试 TGC 复用 SSO…');
    const { r, url } = await followSso(SERVICE);
    const t = await r.text().catch(() => '');
    const stillLogin = /name="execution"/.test(t) && /password/.test(t);
    if (r.status === 200 && !stillLogin && jar.has('bb.sustech.edu.cn', 's_session_id')) {
      console.log('[A] TGC 复用成功（200 + s_session_id）');
      jar.save();
      console.log('[A] SSO 会话有效，登录链完成（此处可接任意 BB 业务请求）');
      console.log('总耗时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
      return;
    }
    console.log('[A] 复用失败（stillLogin=' + stillLogin + '），走完整登录');
  }

  // ===== 完整登录 =====
  let r = await req(LOGIN_URL);
  let html = await r.text();
  const execution = html.match(/name="execution"\s+value="([^"]+)"/)?.[1];
  if (!execution) { console.log('FAIL no execution'); process.exit(1); }
  console.log('[1] GET login ✓');

  let point = null, tokenObj = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    r = await req('https://cas.sustech.edu.cn/captcha/api/get', {
      method: 'POST', headers: JSONH,
      body: JSON.stringify({ captchaType: 'blockPuzzle', clientUid: CLIENT_UID, ts: Date.now(), projectCode: 'sustech_cas' }),
    });
    const gj = await r.json();
    if (!gj.success) { console.log('[2] get fail:', gj.repMsg); process.exit(2); }
    fs.writeFileSync(P + 'get-resp2.json', JSON.stringify(gj));
    const pr = spawnSync(PY, [P + 'identify-core.py'], { encoding: 'utf8' });
    console.log('[2.' + attempt + ']', (pr.stdout || '').trim());
    const pt = JSON.parse(fs.readFileSync(P + 'pending-point.json', 'utf8'));
    if (pt.ncc >= 0.35) { point = pt; tokenObj = gj.repData; break; }
  }
  if (!point) { console.log('FAIL 识别质量不足'); process.exit(3); }

  const { x, y } = point;
  const pointJson = aes128EcbB64(JSON.stringify({ x, y }), tokenObj.secretKey);
  const captchaVerification = aes128EcbB64(tokenObj.token + '---' + JSON.stringify({ x, y }), tokenObj.secretKey);
  r = await req('https://cas.sustech.edu.cn/captcha/api/check', {
    method: 'POST', headers: JSONH,
    body: JSON.stringify({ captchaType: 'blockPuzzle', pointJson, token: tokenObj.token, clientUid: CLIENT_UID, projectCode: 'sustech_cas', ts: Date.now() }),
  });
  const cj = await r.json();
  console.log('[3] check =', cj.success, cj.repMsg);
  if (!cj.success) process.exit(4);

  // 凭据文件：两行（用户名 / 密码），路径由 CAS_CRED_FILE 指定（默认 ./cas-cred.txt）
  const credPath = process.env.CAS_CRED_FILE || require('path').join(__dirname, 'cas-cred.txt');
  const cred = fs.readFileSync(credPath, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
  const form = new URLSearchParams();
  form.set('username', cred[0]); form.set('password', cred[1]);
  form.set('execution', execution); form.set('_eventId', 'submit');
  form.set('geolocation', ''); form.set('g-recaptcha-response', captchaVerification);
  r = await req(LOGIN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
  html = await r.text();
  let loc = r.headers.get('location');
  console.log('[4] POST login status=' + r.status + ' loc=' + (loc ? 'yes' : 'no'));

  if (r.status === 200 && html.includes('proceed')) {
    const m2 = html.match(/name="execution"\s+value="([^"]+)"/);
    const form2 = new URLSearchParams();
    form2.set('execution', m2[1]); form2.set('_eventId', 'proceed'); form2.set('continue', '继续'); form2.set('geolocation', '');
    r = await req(LOGIN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form2.toString() });
    html = await r.text(); loc = r.headers.get('location');
    console.log('[5] proceed status=' + r.status + ' loc=' + (loc ? 'yes' : 'no'));
  }
  if (!loc) { console.log('FAIL 未拿到 service 重定向 |', textOf(html).slice(0, 150)); 
    if (jar.has('cas.sustech.edu.cn', 'TGC')) { console.log('（但拿到 TGC，已保存，可稍后重试）'); jar.save(); }
    process.exit(5); }

  jar.save();
  console.log('[6] TGC 已保存。SSO…');
  const sso = await followSso(new URL(loc, LOGIN_URL).toString());
  console.log('[7] BB cookies: ' + [...jar.cookies.values()].map(c => c.domain + ':' + c.name).join(', '));
  jar.save();

  console.log('[8] 登录链完成（SSO 已跟随；本工具到此为止，业务请求由调用方自行发起）');
  console.log('总耗时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
})();
