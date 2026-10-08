// hook_inject.js — 顶象（dingxiang-inc.com）ac 生成链「运行时 hook 取证」注入脚本（document-start）
// 设计原则：只观察不改变 —— 所有 wrapper 均调用原函数并原样透传返回值/异常；
//           wrapper 伪造 toString 指向原函数，避免 toString/instanceof 检测。
// 用法：CDP Page.addScriptToEvaluateOnNewDocument({ source: <本文件文本> })
// 产物：window.__DXH__ = { v, recs:[...], counts:{...}, probe:{...}, notes:[], err:[] }
(function () {
  'use strict';
  try {
    var W = window, D = document;
    // 仅主文档生效（客服 iframe 不注入，降噪）
    try { if (W.top !== W) return; } catch (e) { return; }
    if (W.__DXH__ && W.__DXH__.v === 1) return;

    var T0 = Date.now();
    var S = {
      v: 1,
      runId: Math.random().toString(36).slice(2, 10),
      t0: T0,
      url: String(location.href),
      ua: navigator.userAgent,
      recs: [],
      counts: {},
      notes: [],
      probe: null,
      err: [],
      cfg: { maxRecs: 60000, maxStr: 2200, maxBody: 6000, maxArr: 400 }
    };
    W.__DXH__ = S;
    var dirty = 0;

    // ---------- 原始引用（hook 前保存，内部一律用原始函数，避免递归） ----------
    var OSLICE = String.prototype.slice;
    var OJOIN = Array.prototype.join;
    var OSTR = String;

    // ---------- 基础工具 ----------
    function T() { return Date.now() - T0; }
    function rep(k) { S.counts[k] = (S.counts[k] || 0) + 1; return S.counts[k]; }
    function cut(s, n) { try { s = (typeof s === 'string') ? s : OSTR(s); } catch (e) { s = '(unstr)'; } n = n || 640; return s.length > n ? OSLICE.call(s, 0, n) + '\u2026[' + s.length + ']' : s; }
    function err(e) { try { S.err.push(cut(OSTR((e && e.stack) || e), 400)); } catch (x) {} }
    function safe(fn, d) { try { var r = fn(); return r === undefined ? d : r; } catch (e) { return d; } }
    function hide(f, orig) { try { var s = orig.toString.bind(orig); Object.defineProperty(f, 'toString', { value: function () { return s(); }, configurable: true }); } catch (e) {} return f; }
    function rec(o) { if (S.recs.length < S.cfg.maxRecs) { S.recs.push(o); dirty = 1; } }
    function mark(kind, o) {
      var r = { k: kind, t: T() };
      if (o) for (var p in o) { try { r[p] = o[p]; } catch (e) {} }
      rec(r);
      return r;
    }
    function stack(skip, frames) {
      try {
        var lines = OSTR(new Error().stack || '').split('\n'), out = [];
        for (var i = 1 + (skip || 0); i < lines.length && out.length < (frames || 3); i++) {
          var L = lines[i].trim();
          if (L) out.push(cut(L, 200));
        }
        return out;
      } catch (e) { return []; }
    }
    function bytesInfo(x, maxBytes) {
      try {
        if (x == null) return null;
        if (typeof x === 'string') return { s: cut(x, maxBytes || 512) };
        var u = null;
        if (x instanceof Uint8Array) u = x;
        else if (x instanceof ArrayBuffer) u = new Uint8Array(x);
        else if (ArrayBuffer.isView(x)) u = new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
        else if (Array.isArray(x)) return { arr: x.slice(0, 48), len: x.length };
        else if (x.buffer instanceof ArrayBuffer) u = new Uint8Array(x.buffer, x.byteOffset || 0, x.byteLength || 0);
        else return { t: Object.prototype.toString.call(x), len: x && x.length };
        var n = Math.min(u.length, maxBytes || 512), hex = '', asc = '';
        for (var i = 0; i < n; i++) {
          var b = u[i];
          hex += (b < 16 ? '0' : '') + b.toString(16);
          asc += (b >= 32 && b < 127) ? String.fromCharCode(b) : '.';
        }
        return { len: u.length, hex: hex, ascii: asc };
      } catch (e) { return { err: String(e) }; }
    }
    function keyInfo(k) {
      try {
        if (!k) return null;
        if (typeof k === 'string') return { s: cut(k, 200) };
        if (ArrayBuffer.isView(k) || k instanceof ArrayBuffer) return bytesInfo(k, 96);
        var o = {};
        if (k.type) o.type = k.type;
        if (k.extractable !== undefined) o.ex = k.extractable;
        if (k.usages) o.usages = k.usages;
        var al = k.algorithm;
        if (al) {
          o.alg = al.name;
          if (al.length) o.bl = al.length;
          if (al.hash) o.hash = (al.hash.name || al.hash);
          if (al.iv) o.ivHex = (bytesInfo(al.iv, 64) || {}).hex;
          if (al.tagLength) o.tagLen = al.tagLength;
          if (al.namedCurve) o.curve = al.namedCurve;
        }
        return o;
      } catch (e) { return { err: String(e) }; }
    }

    // ---------- 密文/前缀特征 ----------
    // ac 实测形态：`5948#<base64ish 长串>`（数字+#前缀）；另设宽口径 base64ish
    var AC_RE = /^\d{3,6}#[A-Za-z0-9+\/=]{40,}$/;
    var B64_RE = /^[A-Za-z0-9+\/]{96,}={0,2}$/;
    var HASH_RE = /^\d{3,6}#/;
    function looksAC(s) { try { return typeof s === 'string' && AC_RE.test(s); } catch (e) { return false; } }
    function looksB64(s) { try { return typeof s === 'string' && B64_RE.test(s); } catch (e) { return false; } }
    function hasAChash(s) { try { return typeof s === 'string' && HASH_RE.test(s); } catch (e) { return false; } }

    // ---------- 1. WebCrypto ----------
    var ORIG = {};
    var CS = W.crypto && W.crypto.subtle;
    function tryExport(key, tag) {
      try {
        if (!key || key.extractable !== true || typeof ORIG.exportKey !== 'function') return;
        var p = null;
        try { p = ORIG.exportKey.call(CS, 'raw', key); } catch (e) { p = null; }
        if (!p || typeof p.then !== 'function') { try { p = ORIG.exportKey.call(CS, 'jwk', key); } catch (e2) { p = null; } }
        if (p && typeof p.then === 'function') {
          p.then(function (r) { mark('key.export', { tag: tag, val: (typeof r === 'string') ? cut(r, 500) : bytesInfo(r, 160) }); }, function () {});
        }
      } catch (e) {}
    }
    if (CS) {
      ['encrypt', 'decrypt', 'sign', 'verify', 'digest', 'deriveBits', 'deriveKey', 'importKey', 'exportKey', 'generateKey', 'wrapKey', 'unwrapKey'].forEach(function (m) {
        var orig = CS[m];
        if (typeof orig !== 'function') return;
        ORIG[m] = orig;
        var w = function () {
          var args = Array.prototype.slice.call(arguments);
          var info = { k: 'subtle.' + m, st: stack(0, 4), argc: args.length };
          try {
            var a0 = args[0];
            if (typeof a0 === 'string') info.algo = a0;
            else if (a0 && typeof a0 === 'object') {
              info.algo = {};
              for (var p in a0) {
                var v = a0[p];
                if (v && typeof v === 'object' && v.byteLength != null) info.algo[p] = { byteLength: v.byteLength, hex: (bytesInfo(v, 64) || {}).hex };
                else if (v && typeof v === 'object') info.algo[p] = cut(safe(function () { return JSON.stringify(v); }, ''), 200);
                else info.algo[p] = v;
              }
            }
            if (m === 'importKey') {
              info.fmt = args[1]; info.keyData = bytesInfo(args[2], 300);
              info.keyAlgo = typeof args[3] === 'string' ? args[3] : (args[3] && args[3].name);
              info.usages = args[4];
            } else if (m === 'deriveBits') {
              info.baseKey = keyInfo(args[1]); info.len = args[2];
            } else if (m === 'encrypt' || m === 'decrypt' || m === 'sign') {
              info.key = keyInfo(args[1]);
              var bi = bytesInfo(args[2], 900) || {};
              info.dataLen = bi.len; info.dataAscii = bi.ascii; info.dataHex0 = cut(bi.hex, 96);
              if (bi.len > 900) info.dataTrunc = 1;
            }
          } catch (e) { info.infoErr = String(e); }
          var ret;
          try { ret = orig.apply(CS, args); } catch (e) { info.thrown = cut(String(e), 200); rec(info); throw e; }
          if (ret && typeof ret.then === 'function') {
            ret.then(function (r) {
              try {
                info.ok = 1;
                if (m === 'exportKey') info.out = (typeof r === 'string') ? cut(r, 500) : bytesInfo(r, 160);
                else if (m === 'generateKey' || m === 'importKey' || m === 'deriveKey') { info.outKey = keyInfo(r); tryExport(r, m); }
                else { var o = bytesInfo(r, 256) || {}; info.outLen = o.len; info.outHex = cut(o.hex, 192); info.outAscii = o.ascii; }
                rec(info);
              } catch (e) { err(e); }
            }, function (e) { try { info.rej = cut(String(e), 200); rec(info); } catch (e2) {} });
            return ret;
          }
          try { info.out = (ret && ret.type) ? keyInfo(ret) : bytesInfo(ret, 96); } catch (e) {}
          rec(info);
          return ret;
        };
        try { CS[m] = hide(w, orig); } catch (e) {}
      });
    }
    try {
      var GRV = W.crypto && W.crypto.getRandomValues;
      if (typeof GRV === 'function') {
        W.crypto.getRandomValues = hide(function (arr) {
          var r = GRV.apply(W.crypto, arguments);
          try {
            if (rep('grv') <= 200) {
              var bi = bytesInfo(arr, 96) || {};
              mark('getRandomValues', { kind: arr && arr.constructor && arr.constructor.name, len: bi.len, hex: bi.hex, st: stack(0, 3) });
            }
          } catch (e) {}
          return r;
        }, GRV);
      }
    } catch (e) {}

    // ---------- 2. 明文编码点 ----------
    try {
      if (W.TextEncoder) {
        var TE = TextEncoder.prototype.encode;
        TextEncoder.prototype.encode = hide(function (s) {
          var r = TE.apply(this, arguments);
          try {
            if (typeof s === 'string' && s.length >= 8 && rep('te') <= 500) mark('TextEncoder.encode', { outLen: r && r.length, src: cut(s, S.cfg.maxStr), st: stack(0, 4) });
          } catch (e) {}
          return r;
        }, TE);
        var TEI = TextEncoder.prototype.encodeInto;
        if (typeof TEI === 'function') {
          TextEncoder.prototype.encodeInto = hide(function (s) {
            var r = TEI.apply(this, arguments);
            try { if (typeof s === 'string' && s.length >= 8 && rep('tei') <= 300) mark('TextEncoder.encodeInto', { src: cut(s, S.cfg.maxStr), st: stack(0, 3) }); } catch (e) {}
            return r;
          }, TEI);
        }
      }
      var TD = W.TextDecoder && TextDecoder.prototype.decode;
      if (typeof TD === 'function') {
        TextDecoder.prototype.decode = hide(function (buf) {
          var r = TD.apply(this, arguments);
          try {
            var bi = bytesInfo(buf, 120) || {};
            if (bi.len >= 24 && rep('td') <= 300) mark('TextDecoder.decode', { inLen: bi.len, inHex: cut(bi.hex, 160), outHead: cut(r, 700), st: stack(0, 4) });
          } catch (e) {}
          return r;
        }, TD);
      }
    } catch (e) {}
    try {
      var BTOA = W.btoa;
      W.btoa = hide(function (s) {
        var r = BTOA.apply(W, arguments);
        try {
          var cp = looksB64(r) || looksAC(r);
          if (cp ? rep('cipher.rec') <= 800 : rep('btoa') <= 500) {
            mark(cp ? 'btoa.CIPHER' : 'btoa', { inLen: (OSTR(s) || '').length, inAscii: cut(s, S.cfg.maxStr), out: cp ? cut(r, S.cfg.maxStr) : cut(r, 400), st: stack(0, 4) });
          }
        } catch (e) {}
        return r;
      }, BTOA);
      var ATOA = W.atob;
      W.atob = hide(function (s) {
        var r = ATOA.apply(W, arguments);
        try { if (rep('atob') <= 500) mark('atob', { inHead: cut(s, 300), outLen: (OSTR(r) || '').length, outAscii: cut(r, 600), st: stack(0, 4) }); } catch (e) {}
        return r;
      }, ATOA);
    } catch (e) {}
    try {
      var EUC = W.encodeURIComponent;
      W.encodeURIComponent = hide(function (s) {
        var r = EUC.apply(W, arguments);
        try {
          var ss = OSTR(s);
          var isAC = /5948%23|^\d{3,6}%23/.test(ss) || ss.length >= 400;
          if (isAC && rep('euc.big') <= 500) {
            mark('encodeURIComponent', { len: ss.length, inHead: cut(ss, 700), inTail: cut(OSLICE.call(ss, -60), 60), outLen: (OSTR(r) || '').length, st: stack(0, 5) });
          }
        } catch (e) {}
        return r;
      }, EUC);
      var DUC = W.decodeURIComponent;
      W.decodeURIComponent = hide(function (s) {
        var r = DUC.apply(W, arguments);
        try { if (OSTR(s).length >= 60 && rep('duc') <= 300) mark('decodeURIComponent', { inHead: cut(s, 400), st: stack(0, 3) }); } catch (e) {}
        return r;
      }, DUC);
      var ESC = W.escape, UNS = W.unescape;
      if (typeof ESC === 'function') {
        W.escape = hide(function (s) {
          var r = ESC.apply(W, arguments);
          try { if (OSTR(s).length >= 80 && rep('esc') <= 200) mark('escape', { inLen: OSTR(s).length, inHead: cut(s, 300), outHead: cut(r, 300), st: stack(0, 3) }); } catch (e) {}
          return r;
        }, ESC);
      }
      if (typeof UNS === 'function') {
        W.unescape = hide(function (s) {
          var r = UNS.apply(W, arguments);
          try { if (OSTR(s).length >= 24 && rep('unesc') <= 300) mark('unescape', { inHead: cut(s, 400), outAscii: cut(r, 400), st: stack(0, 3) }); } catch (e) {}
          return r;
        }, UNS);
      }
    } catch (e) {}

    // ---------- 3. 序列化点 ----------
    try {
      var JSs = JSON.stringify, seen = {};
      JSON.stringify = hide(function (v) {
        var r = JSs.apply(this, arguments);
        try {
          if (v && typeof v === 'object' && typeof r === 'string' && r.length >= 60 && r.length <= 200000) {
            var key = r.length + '|' + OSLICE.call(r, 0, 48) + '|' + OSLICE.call(r, -16);
            if (!seen[key]) {
              seen[key] = 1;
              var isArr = Array.isArray(v);
              if (rep('js') <= 900) mark('JSON.stringify', { len: r.length, isArr: isArr ? 1 : 0, out: cut(r, S.cfg.maxStr), outTail: cut(OSLICE.call(r, -220), 220), st: stack(1, 4) });
            }
          }
        } catch (e) {}
        return r;
      }, JSs);
      var JP = JSON.parse;
      JSON.parse = hide(function (t) {
        var r = JP.apply(this, arguments);
        try {
          if (typeof t === 'string' && t.length >= 24 && rep('json.parse') <= 500) {
            if (/"(x|y|t|px|py|time|track|slide|move|dx|dy|path|trace)"/.test(OSLICE.call(t, 0, 500))) {
              mark('JSON.parse', { len: t.length, head: cut(t, 900), st: stack(1, 4) });
            }
          }
        } catch (e) {}
        return r;
      }, JP);
    } catch (e) {}

    // ---------- 4. 字符构造点 ----------
    try {
      var SFC = String.fromCharCode;
      String.fromCharCode = hide(function () {
        var r = SFC.apply(String, arguments);
        try {
          var cp = looksB64(r) || looksAC(r);
          if (arguments.length >= 8 && (cp ? rep('cipher.rec') <= 800 : rep('sfc') <= 400)) {
            mark(cp ? 'fromCharCode.CIPHER' : 'fromCharCode', { n: arguments.length, argsHead: cut(Array.prototype.slice.call(arguments, 0, 48).join(','), 500), out: cp ? cut(r, S.cfg.maxStr) : cut(r, 300), st: stack(1, 4) });
          }
        } catch (e) {}
        return r;
      }, SFC);
    } catch (e) {}
    try {
      var SJ = String.fromCharCode.apply ? null : null; // placeholder
    } catch (e) {}
    try {
      var AJ = Array.prototype.join;
      Array.prototype.join = hide(function (sep) {
        var r = AJ.apply(this, arguments);
        try {
          if ((sep === '' || sep === undefined || sep === ',') && this.length >= 24 && typeof r === 'string' && r.length >= 96 && r.length <= 400000) {
            var cp = looksB64(r) || looksAC(r);
            if (cp ? rep('join.cipher') <= 500 : rep('join') <= 400) {
              mark(cp ? 'join.CIPHER' : 'join', { sep: sep === undefined ? '(def)' : sep, n: this.length, elemT: typeof this[0], first: cut(this[0], 60), out: cp ? cut(r, S.cfg.maxStr) : cut(r, 500), outTail: cut(OSLICE.call(r, -80), 80), st: stack(1, 4) });
            }
          }
        } catch (e) {}
        return r;
      }, AJ);
    } catch (e) {}
    try {
      var AP = Array.prototype.push;
      Array.prototype.push = hide(function () {
        try {
          var n = arguments.length;
          if (n >= 1 && n <= 4) {
            var a0 = arguments[0];
            if (a0 && typeof a0 === 'object' && !(a0.k && a0.t !== undefined)) {   // 排除本 hook 自己的记录对象
              var isPt = (typeof a0.x === 'number' || typeof a0.y === 'number');
              var isArrPt = Array.isArray(a0) && a0.length >= 2 && a0.length <= 8 && typeof a0[0] === 'number' && typeof a0[1] === 'number';
              if ((isPt || isArrPt) && rep('push.point') <= 600) {
                var o;
                if (isArrPt) o = a0.slice(0, 8).map(function (v) { return (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') ? v : typeof v; });
                else { o = {}; for (var kk in a0) { var vv = a0[kk]; if (typeof vv === 'number' || typeof vv === 'boolean' || typeof vv === 'string') o[kk] = typeof vv === 'string' ? cut(vv, 40) : vv; } }
                mark('push.point', { pt: o, arrLenAfter: this.length + n, st: stack(1, 4) });
              }
            }
          }
        } catch (e) {}
        return AP.apply(this, arguments);
      }, AP);
    } catch (e) {}
    // 字符串 replace（自定义字母表/密文特征）
    try {
      var SRP = String.prototype.replace;
      String.prototype.replace = hide(function (a, b) {
        var r = SRP.apply(this, arguments);
        try {
          if (typeof r === 'string' && r.length >= 60) {
            var cp = looksB64(r) || looksAC(r);
            if (cp && rep('replace.cipher') <= 300) {
              mark('replace.CIPHER', { inLen: OSTR(this).length, inHead: cut(this, 300), a: typeof a === 'string' ? cut(a, 80) : 're', outLen: r.length, outHead: cut(r, 500), outTail: cut(OSLICE.call(r, -50), 50), st: stack(1, 4) });
            }
          }
        } catch (e) {}
        return r;
      }, SRP);
    } catch (e) {}
    // split：抓自定义 base64 字母表
    try {
      var SSPLIT = String.prototype.split;
      String.prototype.split = hide(function (sep, lim) {
        var r = SSPLIT.apply(this, arguments);
        try {
          if (sep === '' && r && r.length >= 58 && r.length <= 72 && typeof r[0] === 'string' && r[0].length === 1 && rep('split.alpha') <= 120) {
            mark('split.alpha', { srcLen: OSTR(this).length, n: r.length, val: cut(OJOIN.call(r, ''), 300), st: stack(1, 5) });
          }
        } catch (e) {}
        return r;
      }, SSPLIT);
    } catch (e) {}
    // slice：抓长密文产物的产生点（性能敏感，条件严 + 限流）
    try {
      var SSL = String.prototype.slice;
      String.prototype.slice = hide(function () {
        var r = SSL.apply(this, arguments);
        try {
          if (typeof r === 'string' && r.length >= 160) {
            if (looksAC(r) || hasAChash(r)) {
              if (rep('slice.ac') <= 300) mark('slice.AC', { inLen: OSTR(this).length, a: arguments[0], b: arguments[1], outLen: r.length, outHead: cut(r, 400), outTail: cut(OSLICE.call(r, -50), 50), st: stack(1, 5) });
            } else if (looksB64(r) && rep('slice.b64') <= 300) {
              mark('slice.b64', { inLen: OSTR(this).length, a: arguments[0], b: arguments[1], outLen: r.length, outHead: cut(r, 300), st: stack(1, 5) });
            }
          }
        } catch (e) {}
        return r;
      }, SSL);
    } catch (e) {}
    // concat：ac 组装若经 concat 可见
    try {
      var SCT = String.prototype.concat;
      String.prototype.concat = hide(function () {
        var r = SCT.apply(this, arguments);
        try {
          if (typeof r === 'string' && r.length >= 300 && (hasAChash(r) || looksAC(r) || looksB64(r)) && rep('concat.cipher') <= 300) {
            mark('concat.CIPHER', { argc: arguments.length, outLen: r.length, outHead: cut(r, 500), outTail: cut(OSLICE.call(r, -60), 60), st: stack(1, 5) });
          }
        } catch (e) {}
        return r;
      }, SCT);
    } catch (e) {}
    // charCodeAt 于长字符串（自研编码器信号；按内容去重，避免字符串表解码刷屏）
    var CCA_SEEN = {};
    try {
      var SCCA = String.prototype.charCodeAt;
      String.prototype.charCodeAt = hide(function (i) {
        try {
          if (this.length >= 128) {
            var key2 = this.length + '|' + OSLICE.call(this, 0, 24) + '|' + OSLICE.call(this, -12);
            if (!CCA_SEEN[key2] && rep('cca') <= 80) {
              CCA_SEEN[key2] = 1;
              mark('charCodeAt.big', { len: this.length, i: i, head: cut(this, 240), st: stack(1, 4) });
            }
          }
        } catch (e) {}
        return SCCA.apply(this, arguments);
      }, SCCA);
    } catch (e) {}

    // ---------- 5. 表单序列化出口 ----------
    try {
      if (W.URLSearchParams) {
        var USPA = URLSearchParams.prototype.append, USPS = URLSearchParams.prototype.set, USPT = URLSearchParams.prototype.toString;
        URLSearchParams.prototype.append = hide(function (k, v) {
          try {
            var sv = OSTR(v);
            if ((OSTR(k) === 'ac' || sv.length >= 300) && rep('usp.app') <= 300) mark('USP.append', { k: OSTR(k), vLen: sv.length, v: cut(sv, S.cfg.maxBody), st: stack(1, 6) });
          } catch (e) {}
          return USPA.apply(this, arguments);
        }, USPA);
        URLSearchParams.prototype.set = hide(function (k, v) {
          try {
            var sv = OSTR(v);
            if ((OSTR(k) === 'ac' || sv.length >= 300) && rep('usp.set') <= 300) mark('USP.set', { k: OSTR(k), vLen: sv.length, v: cut(sv, S.cfg.maxBody), st: stack(1, 6) });
          } catch (e) {}
          return USPS.apply(this, arguments);
        }, USPS);
        URLSearchParams.prototype.toString = hide(function () {
          var r = USPT.apply(this, arguments);
          try {
            if (typeof r === 'string' && r.length >= 300 && rep('usp.tostr') <= 300) mark('USP.toString', { len: r.length, out: cut(r, S.cfg.maxBody), st: stack(1, 6) });
          } catch (e) {}
          return r;
        }, USPT);
      }
      if (W.FormData) {
        var FDA = FormData.prototype.append;
        FormData.prototype.append = hide(function (k, v) {
          try {
            var sv = OSTR(v);
            if ((OSTR(k) === 'ac' || sv.length >= 300) && rep('fd.app') <= 200) mark('FormData.append', { k: OSTR(k), vLen: sv.length, v: cut(sv, S.cfg.maxBody), st: stack(1, 6) });
          } catch (e) {}
          return FDA.apply(this, arguments);
        }, FDA);
      }
    } catch (e) {}

    // ---------- 6. 网络出口 ----------
    var DXRE = /dingxiang-inc\.com|captcha|greenseer|constid/;
    try {
      var desc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
      if (desc && desc.set) {
        Object.defineProperty(HTMLScriptElement.prototype, 'src', {
          configurable: true, enumerable: desc.enumerable,
          get: function () { return desc.get.call(this); },
          set: function (v) {
            try {
              var s = OSTR(v);
              if (DXRE.test(s) && rep('script.src') <= 200) mark('script.src', { u: cut(s, 2000), st: stack(1, 6) });
            } catch (e) {}
            return desc.set.call(this, v);
          }
        });
      }
    } catch (e) {}
    try {
      var XO = XMLHttpRequest.prototype.open, XS = XMLHttpRequest.prototype.send, XSH = XMLHttpRequest.prototype.setRequestHeader, SSY = Symbol('dx');
      XMLHttpRequest.prototype.open = hide(function (m, u) {
        try { this[SSY] = { m: OSTR(m), u: OSTR(u), t: T(), st: stack(1, 6) }; } catch (e) {}
        return XO.apply(this, arguments);
      }, XO);
      XMLHttpRequest.prototype.setRequestHeader = hide(function (k, v) {
        try { if (this[SSY]) { this[SSY].hdrs = this[SSY].hdrs || []; this[SSY].hdrs.push(OSTR(k) + ': ' + cut(OSTR(v), 200)); } } catch (e) {}
        return XSH.apply(this, arguments);
      }, XSH);
      XMLHttpRequest.prototype.send = hide(function (b) {
        try {
          var d = this[SSY] || {}, self = this;
          var body = null;
          try {
            if (b == null) body = null;
            else if (typeof b === 'string') body = cut(b, S.cfg.maxBody);
            else if (W.URLSearchParams && b instanceof URLSearchParams) body = cut(b.toString(), S.cfg.maxBody);
            else if (W.FormData && b instanceof FormData) { body = '{FormData:'; try { b.forEach(function (v, k) { body += k + '=' + cut(OSTR(v), 900) + ';'; }); } catch (e2) {} body += '}'; }
            else body = Object.prototype.toString.call(b);
          } catch (e3) { body = '(bodyerr:' + e3 + ')'; }
          if (rep('xhr.send') <= 500) mark('xhr.send', { m: d.m, u: cut(d.u, 1500), tOpen: d.t, hdrs: d.hdrs || null, body: body, st: d.st || [] });
          try {
            if (DXRE.test(d.u || '')) {
              self.addEventListener('loadend', function () {
                try { mark('xhr.done', { u: cut(d.u, 1500), status: self.status, respType: self.responseType, resp: cut(self.responseText, 2000) }); } catch (e4) { try { mark('xhr.done', { u: cut(d.u, 1500), status: self.status, respType: self.responseType, noText: 1 }); } catch (e5) {} }
              });
            }
          } catch (e6) {}
        } catch (e7) {}
        return XS.apply(this, arguments);
      }, XS);
    } catch (e) {}
    try {
      var FE = W.fetch;
      if (typeof FE === 'function') {
        W.fetch = hide(function (input, init) {
          try {
            var u = (typeof input === 'string') ? input : (input && input.url);
            if (DXRE.test(OSTR(u)) && rep('fetch') <= 200) {
              var bd = null;
              try { bd = init && init.body ? (typeof init.body === 'string' ? cut(init.body, S.cfg.maxBody) : Object.prototype.toString.call(init.body)) : null; } catch (e) {}
              mark('fetch', { u: cut(u, 1200), body: bd, st: stack(1, 6) });
            }
          } catch (e) {}
          var p = FE.apply(W, arguments);
          try {
            if (p && typeof p.then === 'function' && DXRE.test(OSTR(typeof input === 'string' ? input : input && input.url))) {
              p.then(function (r) { try { var c = r && r.clone && r.clone(); if (c) c.text().then(function (t) { mark('fetch.resp', { u: cut(r.url, 800), status: r.status, body: cut(t, 1500) }); }, function () {}); } catch (e) {} return r; }, function () {});
            }
          } catch (e) {}
          return p;
        }, FE);
      }
      var SB = W.navigator && W.navigator.sendBeacon;
      if (typeof SB === 'function') {
        W.navigator.sendBeacon = hide(function (u, d) {
          try { if (rep('beacon') <= 100) mark('sendBeacon', { u: cut(u, 800), body: cut(d, 600), st: stack(1, 4) }); } catch (e) {}
          return SB.apply(W.navigator, arguments);
        }, SB);
      }
    } catch (e) {}
    // Worker 检测
    try {
      var WK = W.Worker;
      if (WK) {
        W.Worker = hide(function (u, o) {
          try { mark('newWorker', { u: cut(u, 500), st: stack(1, 5) }); } catch (e) {}
          return new WK(u, o);
        }, WK);
      }
    } catch (e) {}

    // ---------- 7. 事件轨迹层 ----------
    try {
      var AEL = EventTarget.prototype.addEventListener, REL = EventTarget.prototype.removeEventListener;
      var ORIG2WRAP = new WeakMap(), SEENH = {};
      function targetName(t) {
        try {
          if (!t) return 'null';
          if (t === W) return 'window';
          if (t === D) return 'document';
          if (t.tagName) return t.tagName + (t.id ? '#' + t.id : '') + (t.className ? '.' + OSTR(t.className).split(' ')[0] : '');
          return Object.prototype.toString.call(t);
        } catch (e) { return '?'; }
      }
      EventTarget.prototype.addEventListener = hide(function (type, fn, opts) {
        try {
          var st = OSTR(type);
          if (fn && typeof fn === 'function' && /mousemove|pointermove|mousedown|mouseup|pointerdown|pointerup|touchmove|touchstart|touchend|drag|input|keydown|keyup/i.test(st)) {
            var wrap = ORIG2WRAP.get(fn);
            if (!wrap) {
              wrap = function (ev) {
                try {
                  var nm = rep('ev:' + st);
                  var hi = /down|up|end|start/i.test(st);
                  if (hi || nm % 3 === 0) {
                    var pts = safe(function () {
                      if (ev && ev.touches && ev.touches.length) return Array.prototype.map.call(ev.touches, function (t) { return [Math.round(t.clientX * 10) / 10, Math.round(t.clientY * 10) / 10]; });
                      return null;
                    }, null);
                    mark('ev', { type: st, cx: ev && ev.clientX, cy: ev && ev.clientY, ts: ev && Math.round(ev.timeStamp * 100) / 100, btn: ev && ev.buttons, tgt: targetName(this), touches: pts });
                  }
                } catch (e) {}
                return fn.apply(this, arguments);
              };
              try { var s0 = fn.toString.bind(fn); Object.defineProperty(wrap, 'toString', { value: function () { return s0(); }, configurable: true }); } catch (e) {}
              ORIG2WRAP.set(fn, wrap);
              var src = safe(function () { return String(fn); }, '');
              var hk = 'H|' + st + '|' + src.length + '|' + OSLICE.call(src, 0, 96);
              if (!SEENH[hk]) { SEENH[hk] = 1; if (rep('ael.new') <= 400) mark('addEventListener', { type: st, tgt: targetName(this), cap: !!(opts && (opts === true || opts.capture)), src: cut(src, 1800), st: stack(1, 5) }); }
            }
            return AEL.call(this, type, wrap, opts);
          }
        } catch (e) {}
        return AEL.apply(this, arguments);
      }, AEL);
      EventTarget.prototype.removeEventListener = hide(function (type, fn, opts) {
        try {
          var wrap = fn && typeof fn === 'function' ? ORIG2WRAP.get(fn) : null;
          if (wrap) return REL.call(this, type, wrap, opts);
        } catch (e) {}
        return REL.apply(this, arguments);
      }, REL);
    } catch (e) {}

    // ---------- 8. 页面探针 ----------
    function probeRun() {
      var out = { at: T(), libs: {}, globals: [], scripts: [], misc: {} };
      try {
        ['CryptoJS', 'JSEncrypt', 'asmCrypto', 'forge', 'pako', 'SJCL', 'smCrypto', 'jsrsasign', 'RSAKey', 'aesjs', 'dx', 'DXCaptcha', '$', 'jQuery', 'window.__dx', 'captchaObj'].forEach(function (n) {
          try { if (n.indexOf('.') < 0 && n in W) out.libs[n] = typeof W[n]; } catch (e) {}
        });
        var keys = Object.keys(W);
        var interesting = /crypt|encrypt|decrypt|aes|des|rsa|md5|sha|hash|cipher|base64|b64|util|tools|dx|dingxiang|captcha|greenseer|constid|__/i;
        for (var i = 0; i < keys.length && out.globals.length < 200; i++) {
          var k = keys[i];
          if (interesting.test(k)) {
            var v = null;
            try { v = W[k]; } catch (e) { v = '(throw)'; }
            var desc2 = '';
            try {
              if (typeof v === 'function') desc2 = 'fn:' + (v.name || '?') + ' len=' + v.length;
              else if (v && typeof v === 'object') desc2 = '{' + Object.keys(v).slice(0, 14).join(',') + '}';
              else desc2 = String(v);
            } catch (e) {}
            out.globals.push({ k: k, t: typeof v, d: cut(desc2, 220) });
          }
        }
        out.scripts = Array.prototype.map.call(D.scripts || [], function (s) { return s.src || ('inline:' + (s.textContent || '').length); });
        out.misc.hasSubtle = !!(W.crypto && W.crypto.subtle);
        out.misc.subtleEncryptStr = safe(function () { return cut(W.crypto.subtle.encrypt.toString(), 120); }, null);
        out.misc.btoaStr = safe(function () { return cut(W.btoa.toString(), 100); }, null);
        out.misc.uspStr = safe(function () { return cut(W.URLSearchParams.toString(), 100); }, null);
        out.misc.wasm = typeof W.WebAssembly;
        out.misc.dpt = W.devicePixelRatio;
        out.misc.href = location.href;
        out.misc.resources = performance.getEntriesByType('resource').map(function (r) { return r.name; }).filter(function (u) { return /captcha|dingxiang|constid|greenseer/.test(u); });
      } catch (e) { out.err = String(e); }
      S.probe = out; dirty = 1;
    }
    setTimeout(probeRun, 1000);
    setTimeout(probeRun, 6000);
    setTimeout(probeRun, 20000);

    // 源文本线索（inline 脚本常量扫描）
    setTimeout(function () {
      try {
        var hits = [];
        var reList = [
          ['AES_SBOX_C', '0x63\\s*,\\s*0x7c\\s*,\\s*0x77|99,124,119,123,242,107,111,197'],
          ['AES_RCON', '0x8d,1,2,4,8,16,32,64,128,27,54'],
          ['MD5_T', 'd76aa478|e8c7b756|242070db'],
          ['SHA256_K', '428a2f98|71374491|b5c0fbcf'],
          ['RC4_HINT', 'sbox|S\\[i\\]\\^S\\[j\\]'],
          ['B64_ALPHA_STD', 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'],
          ['WASM', 'WebAssembly\\.instantiate|\\.wasm'],
          ['TEA_CNST', '0x9e3779b9|2654435769'],
          ['AC_PREFIX', '5948'],
          ['HASH_PREFIX', "'#'|\"#\""]
        ];
        var texts = [];
        for (var i = 0; i < D.scripts.length; i++) {
          var sc = D.scripts[i];
          if (!sc.src && sc.textContent && sc.textContent.length > 200) texts.push({ name: 'inline[' + i + ']', t: sc.textContent });
        }
        for (var j = 0; j < texts.length; j++) {
          for (var r2 = 0; r2 < reList.length; r2++) {
            if (new RegExp(reList[r2][1]).test(texts[j].t)) hits.push({ file: texts[j].name, tag: reList[r2][0] });
          }
        }
        S.notes.push({ t: T(), kind: 'sourceScan', hits: hits, inlineScripts: texts.map(function (x) { return x.name + ':' + x.t.length; }) });
        dirty = 1;
      } catch (e) { err(e); }
    }, 2500);

    W.addEventListener('error', function (e) { try { S.err.push('onerror: ' + cut(String(e.message) + '@' + e.filename + ':' + e.lineno, 240)); dirty = 1; } catch (x) {} });
    S.notes.push({ t: T(), kind: 'injected', readyState: D.readyState });
  } catch (e) {
    try { (window.__DXH__ = window.__DXH__ || { v: 1, recs: [], counts: {}, err: [] }).err.push('inject-fatal: ' + String((e && e.stack) || e)); } catch (x) {}
  }
})();
