// hook_verify_intercept.js — 拦截 upload/verify 请求（记录完整 body + 阻断 + 假成功响应）
(() => {
  if (window.__VIP) return 'ALREADY:' + window.__VIP.length;
  window.__VIP = [];
  const MATCH = u => /captcha-open[^/]*\/($|\?)/i.test(u) && /upload|verify/i.test(u) || /no8xfe-verify/i.test(u) || /upload\.captcha-open/i.test(u);

  const oOpen = XMLHttpRequest.prototype.open;
  const oSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) {
    try { this.__vurl = String(u); this.__vm = String(m); } catch (e) {}
    return oOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    try {
      const u = this.__vurl || '';
      if (MATCH(u)) {
        window.__VIP.push({ t: Date.now(), url: u, method: this.__vm || 'POST', via: 'xhr', body: String(body || ''), len: String(body || '').length });
        const self = this;
        setTimeout(() => {
          try {
            Object.defineProperty(self, 'readyState', { value: 4, configurable: true });
            Object.defineProperty(self, 'status', { value: 200, configurable: true });
            Object.defineProperty(self, 'responseText', { value: '{"Code":"Success","Success":true,"Message":"success"}', configurable: true });
            Object.defineProperty(self, 'response', { value: self.responseText, configurable: true });
            if (self.onreadystatechange) self.onreadystatechange();
            if (self.onload) self.onload();
          } catch (e) {}
        }, 40);
        return;
      }
    } catch (e) {}
    return oSend.apply(this, arguments);
  };

  const oFetch = window.fetch;
  window.fetch = function () {
    try {
      const ar0 = arguments[0];
      const u = String((ar0 && ar0.url) || ar0 || '');
      if (MATCH(u)) {
        const init = arguments[1] || {};
        window.__VIP.push({ t: Date.now(), url: u, method: (init.method || (ar0 && ar0.method) || 'GET'), via: 'fetch', body: String(init.body || ''), len: String(init.body || '').length });
        return Promise.resolve(new Response('{"Code":"Success","Success":true,"Message":"success"}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
    } catch (e) {}
    return oFetch.apply(this, arguments);
  };

  return 'VIP-INSTALLED';
})()
