# ac 生成链 · 关键代码片段（去混淆原文）

> 行号对应 `out/greenseer.deob.js` / `out/captcha-ui-v5-index.deob.js`（本次解混淆产物）


## 1. UA 全局导出（greenseer L548-556）
```js
    true && a(16);
    var s = window["_dx"] = window["_dx"] || {};
    s["UA"] = {
      "init": function (n) {
        return new f["default"](n);
      }
    }, o["exports"] = s["UA"];
  }, function (o, i, a) {
    "use strict";
```


## 2. 自定义 base64（greenseer L1259-1267）
```js
      var i = "cha",
        a = "rAt";
      if (!o) return "";
      for (var u, c, d, g, l, j, p, m = "", C = 0; C < o["length"];) u = o["charCodeAt"](C++), c = o["charCodeAt"](C++), d = o["charCodeAt"](C++), g = u >> 2, l = (u & 3) << 4 | c >> 4, j = (c & 15) << 2 | d >> 6, p = d & 63, isNaN(c) ? j = p = 64 : isNaN(d) && (p = 64), m = m + "XmYj3u1PnvisIZUF8ThR/a6DfO+kW4JHrCELycAzSxleoQp02MtwV9Nd57qGgbKB="[h("tArahc")](g) + "XmYj3u1PnvisIZUF8ThR/a6DfO+kW4JHrCELycAzSxleoQp02MtwV9Nd57qGgbKB="["charAt"](l) + "XmYj3u1PnvisIZUF8ThR/a6DfO+kW4JHrCELycAzSxleoQp02MtwV9Nd57qGgbKB="["charAt"](j) + "XmYj3u1PnvisIZUF8ThR/a6DfO+kW4JHrCELycAzSxleoQp02MtwV9Nd57qGgbKB="["charAt"](p);
      return m;
    };
    var v = "XmYj3u1PnvisIZUF8ThR/a6DfO+kW4JHrCELycAzSxleoQp02MtwV9Nd57qGgbKB=";
  }, function (o, i, a) {
    "use strict";
```


## 3. 长度编码 bs2/bs4/bs8/bss（greenseer L493-527）
```js
      return [p(r, 8), p(r, 0)];
    }
    function p(o, i, a) {
      return o >> i & Math["pow"](2, (typeof a == "undefined" ? 1 : a) * 8) - 1;
    }
    function m(r) {
      return j(p(r, 16, 2))["concat"](j(p(r, 0, 2)));
    }
    function C(n) {
      if (!n) return "";
      for (var o = "", i = 83629, a = 0; a < n.length; a++) {
        var u = n.charCodeAt(a),
          c = u ^ i;
        i = u, o += String.fromCharCode(c);
      }
      return o;
    }
    i[function (t) {
      if (!t) return "";
      var o = [];
      t = t.split(",");
      for (var i = 0; i < t.length; i++) o.push(String.fromCharCode(parseInt(t[i], 16)));
      return o.join("");
    }("5f,5f,65,73,4d,6f,64,75,6c,65")] = true, i["move"] = p, i["bs2"] = j, i["bs4"] = m, i["bs8"] = function (o) {
      var u = "f",
        c = "o",
        h = "o";
      var v = Math["floor"](o / Math["pow"](2, 32));
      var d = o - v * Math["pow"](2, 32);
      return m(v)["concat"](m(d));
    }, i["bss"] = function (o) {
      var i = "At",
        a = [];
      if (!o) return a;
      for (var u = 0; u < o["length"]; u++) a["push"](o["charCodeAt"](u));
```


## 4. ★ ac 序列化核心 app()（greenseer L845-858）
```js
      }, Re["prototype"]["app"] = function (o, i) {
        var a = "n",
          u = "i",
          c = "Fo",
          f = (0, fr["toStr"])([o]["concat"]((0, sr["bs2"])(i["length"])));
        this["_ua"] += [f, i]["join"](""), this["ua"] = [lr["default"]["version"], "#", (0, ar["btoa"])(this["_ua"])][rr("nioj")](""), this["option"]["form"] && this["syncToForm"](this["ua"]);
      }, Re["prototype"]["process"] = function (o) {
        var c = "़",
          f = "গ",
          s = "flatte";
        var u = []["slice"]["call"](arguments);
        o = u["length"] === 1 && (0, fr["isArray"])(o) ? o : u;
        o = (0, fr["flatten"])(o);
        return (0, fr["toStr"])(o);
```


## 5. 版本号（greenseer L1900-1906）—— 线上为 5948
```js
        return window["outerHeight"];
      }];
  }, function (o, i, a) {
    "use strict";

    i["__esModule"] = true, i["default"] = {
      "token": "",
```


## 6. 轨迹采集 recordSA / sendSA / sendCA（greenseer L1090-1128）
```js
      }, Re["prototype"]["recordSA"] = function (o) {
        var u = "w";
        var c = (0, fr[rr("won")])() - this["tm"];
        var h = (0, cr["getPageX"])(o);
        var f = (0, cr["getPageY"])(o);
        var s = this["process"]((0, sr["bs4"])(c), (0, sr["bs2"])(h), (0, sr["bs2"])(f));
        this["_sa"]["push"](hr["encrypt_6bqrb1fro5sh7yffzg85"](s));
      }, Re["prototype"]["sendSA"] = function () {
        var r = "a",
          o = this;
        (0, fr["each"])(this["_sa"], function (t) {
          var i = "p";
          o["app"](7, t);
        });
      }, Re["prototype"]["reloadSA"] = function () {
        this["counters"]["sa"] = 0, this["_sa"] = [];
      }, Re["prototype"][tr("72,65,63,6f,72,64,43,41")] = function (o) {
        var c = "etY",
          f = "bs";
        var s = (0, cr[tr("67,65,74,54,61,72,67,65,74")])(o);
        if (!new RegExp("captcha_clickword_hits")["test"](s["className"])) return;
        var u = (0, fr["now"])() - this["tm"];
        var v = (0, cr["getOffsetX"])(o);
        var h = (0, cr["getOffsetY"])(o);
        var d = this["process"]((0, sr["bs4"])(u), (0, sr[rr("2sb")])(v), (0, sr["bs2"])(h));
        this["_ca"]["push"](hr["encrypt_0td9sl42b8rpil9w01wx"](d));
      }, Re["prototype"]["spliceCA"] = function (n) {
        var o = "sp",
          i = "li",
          a = "ce";
        this["_ca"]["splice"](n, this["_ca"]["length"] - n);
      }, Re["prototype"]["sendCA"] = function () {
        var r = this;
        (0, fr["each"])(this["_ca"], function (t) {
          r["app"](11, t);
        });
      }, Re["prototype"][tr("73,65,6e,64,54,65,6d,70")] = function (o) {
        if (typeof o !== "string") {
          var i = (0, fr["extend"])({}, (0, fr["getMetaInfo"])(), o);
```


## 7. 鼠标/触屏监听绑定 bindDomEvents 片段（greenseer L889-940）
```js
          m = "erv",
          C = "isTouchDo",
          w = this;
        if (!this["binded"]) {
          this["binded"] = true, (0, cr["addHandler"])(document, "mousemove", this["eventThrottle"](this["getMM"], {
            "before": function (n) {
              w["isMouseDown"] && w["recordSA"](n);
            },
            "counter": "mm",
            "max": "maxMMLog",
            "intervalCounter": "mmInterval",
            "interval": "MMInterval"
          })), (0, cr["addHandler"])(document, "click", function (n) {
            w["recordCA"]((0, cr["getEvent"])(n));
          }), (0, cr["addHandler"])(document, "mousedown", this["eventThrottle"](this["getMD"], {
            "before": function (i) {
              var a = "t",
                u = "re",
                c = "SA";
              (0, cr["getTarget"])(i);
              (0, cr["getButton"])(i) === 0 && jr() && (w["reloadSA"](), w["isMouseDown"] = true);
            },
            "counter": "md",
            "max": "maxMDLog"
          })), (0, cr["addHandler"])(document, "mouseup", function () {
            w["isMouseDown"] = false;
          }), (0, cr["addHandler"])(document, "keydown", this["eventThrottle"](this["getKD"], {
            "counter": "kd",
            "max": "maxKDLog"
          }));
          var b = this["eventThrottle"](this["getFO"], {
            "counter": "fo",
            "max": rr("goLsucoFxam")
          });
          document["addEventListener"] ? (document["addEventListener"]("focus", b, true), document["addEventListener"]("blur", b, true)) : document["attachEvent"] && (document["attachEvent"]("onfocusin", b), document["attachEvent"]("onfocusout", b)), fr["isTouchDevice"] && ((0, cr["addHandler"])(document, "touchstart", this["eventThrottle"](this["getTC"], {
            "before": function (o) {
              (0, cr["getTarget"])(o);
              jr() && (w["reloadSA"](), w["isTouchDown"] = true);
            },
            "counter": "tc",
            "max": "maxTCLog"
          })), (0, cr["addHandler"])(document, "touchmove", this["eventThrottle"](this["getTMV"], {
            "before": function (o) {
              var c = "isTouc",
                f = "hDown",
                s = "SA";
              var u = o["touches"] && o["touches"][0];
              u && w["isTouchDown"] && w["recordSA"](u);
            },
            "counter": rr("vmt"),
            "max": "maxTMVLog",
            "intervalCounter": "tmvInterval",
```


## 8. 字段号对照（greenseer 各 getXX → app(type) 调用）
```js
        u && (u = this["process"]((0, sr["bs2"])(u["length"]), (0, sr["bss"])(u)), this["app"](9, hr[tr("65,6e,63,72,79,70,74,5f,76,78,68,69,30,36,78,34,30,72,6f,33,61,64,70,70,71,62,62,36")](u)));
      }, Re["prototype"]["getMM"] = function (o) {
        var i = "ageY",
          a = pr((0, cr["getTarget"])(o)),
          u = (0, fr["now"])() - this["tm"],
          c = (0, cr["getPageX"])(o),
          f = (0, cr["getPageY"])(o),
          s = this[rr("ssecorp")]((0, sr["bs4"])(u), (0, sr["bs2"])(c), (0, sr["bs2"])(f), (0, sr["bs2"])(a["length"]), (0, sr["bss"])(a));
        this["app"](10, hr[tr("65,6e,63,72,79,70,74,5f,63,68,69,71,36,77,39,63,62,76,6e,67,6d,61,6b,6c,36,77,67,38")](s));
      }, Re["prototype"]["getMD"] = function (o) {
        var v = "getTa",
          d = "rget",
          g = "ge",
          l = "to",
          j = "n",
          p = "w";
        var h = (0, cr["getTarget"])(o);
        var m = pr(h);
        var s = (0, cr["getButton"])(o);
        var C = (0, fr["now"])() - this[rr("mt")];
        var f = (0, cr["getPageX"])(o);
        var c = (0, cr["getPageY"])(o);
        var u = this["process"]((0, sr[rr("4sb")])(C), (0, sr["bs2"])(f), (0, sr["bs2"])(c), s, (0, sr["bs2"])(m["length"]), (0, sr["bss"])(m));
        this["app"](3, hr["encrypt_sgwdkctstvny9q3p1248"](u));
        this["counters"]["md"] <= 2 && this["getDI"]();
      }, Re["prototype"]["getKD"] = function (o) {
        var i = ",74",
```


## 9. 17 个 encrypt_* 加密函数（greenseer L1641-1755 节选）
```js
    i[un("5f,5f,65,73,4d,6f,64,75,6c,65")] = true, i["encrypt_6dknua3bfnwbgs6k2ueg"] = function (r) {
      for (var o = "", i = 3519, a = 0; a < r["length"]; a++) {
        var u = (r["charCodeAt"](a) ^ i) & 255;
        o += String["fromCharCode"](u), i = u;
      }
      return o;
    }, i["encrypt_sgwdkctstvny9q3p1248"] = function (o) {
      for (var i = "fromChar", a = "", u = "NxMLsN8Ng7lA", c = 32, f = 0; f < o["length"]; f++) {
        var s = o["charCodeAt"](f);
        c = (c + 3) % "NxMLsN8Ng7lA"["length"], s ^= "NxMLsN8Ng7lA"["charCodeAt"](c), a += String["fromCharCode"](s & 255);
      }
      return a;
    }, i["encrypt_rwj3ccrr01kuh9spnerm"] = function (o) {
      for (var i = "len", a = "gth", u = "66,72,6f,6d,43,68,61,72,43,6f,64,", c = "", f = "dx54gFRTbvc", s = 0, h = 0; h < o["length"]; h++) {
        var v = o["charCodeAt"](h);
        v ^= "dx54gFRTbvc"["charCodeAt"](s), ++s >= "dx54gFRTbvc"[un("6c,65,6e,67,74,68")] && (s = 0), c += String[un("66,72,6f,6d,43,68,61,72,43,6f,64,65")](v & 255);
      }
      return c;
    }, i[an("xw10w9lipr8b24ls9dt0_tpyrcne")] = function (o) {
      for (var i = "", a = 2, u = 5, c = 0; c < o["length"]; c++) {
        var f = o["charCodeAt"](c) - 2 & 255,
          s = (f >> 5) + (f << 8 - 5) & 255;
        i += String["fromCharCode"](s);
      }
      return i;
    }, i[an("58gzffy7hs5orf1brqb6_tpyrcne")] = function (o) {
      for (var i = "t", a = "", u = 3127, c = 21473, f = 3127, s = 0; s < o["length"]; s++) {
        var h = o["charCodeAt"](s) ^ (f = f * s % 256 + 21473);
        a += String["fromCharCode"](h & 255);
      }
      return a;
    }, i["encrypt_43xivvl7s7518db0j0ku"] = function (o) {
      for (var i = "bhbX", a = "Saj6", u = "", c = "bhbXy6HJSaj67jk", f = 0; f < o["length"]; f++) {
        var s = o["charCodeAt"](f) ^ "bhbXy6HJSaj67jk"["charCodeAt"](f % "bhbXy6HJSaj67jk"["length"]);
        u += String["fromCharCode"](s & 255);
      }
      return u;
    }, i["encrypt_mjb470o7onmk7vtmtksp"] = function (o) {
      for (var i = "l", a = "e", u = "h", c = "charCod", f = "", s = 237, h = 8, v = 0; v < o["length"]; v++) {
        var d = 237 ^ o["charCodeAt"](v);
        f += String[un("66,72,6f,6d,43,68,61,72,43,6f,64,65")]((d >> 8 ^ o["charCodeAt"](v)) & 255);
      }
      return f;
    }, i["encrypt_p1tyxdx8rojx2fimmsva"] = function (o) {
      for (var i = "", a = 43521, u = 24351, c = 43521, f = 0; f < o["length"]; f++) {
        var s = o["charCodeAt"](f) ^ c;
        c = c * f % 256 + 24351, i += String["fromCharCode"](s & 255);
      }
      return i;
    }, i["encrypt_v6z3zw469kdzfxxha55r"] = function (e) {
      for (var t = "", o = 72439, i = 0; i < e["length"]; i++) {
        var a = e["charCodeAt"](i) ^ o;
        o = a, t += String["fromCharCode"](a & 255);
      }
      return t;
    }, i[an("bj7bnzly9ld4zfko9l8o_tpyrcne")] = function (o) {
      for (var i = "", a = 2319, u = 20630, c = 2319, f = 0; f < o["length"]; f++) {
        var s = o[un("63,68,61,72,43,6f,64,65,41,74")](f) ^ c;
        c = c * f % 256 + 20630, i += String["fromCharCode"](s & 255);
      }
```


## 10. captcha-ui 取用 UA（captcha-ui L3300-3312）
```js
          w = u("m5U1");
        function C(c, s, u) {
          var w = "U",
            C = c["act"];
          if (!s["success"]) return C("loadFail"), void u();
          s["result"] !== 0 ? (window[c["options"]["_name"]]["UA"] && (c["ua"] = window[c["options"]["_name"]]["UA"][hf("tini")]({
            "token": s["sid"]
          })), function (c, s) {
            var u = "Lh?Q",
              g = "is",
              v = "_o",
              w = s,
              C = {
```


## 11. captcha-ui 提交前的 /api/a 参数组装（captcha-ui L2951-2962）
```js
                "ak": Z["appId"],
                "c": c["const_id"],
                "jsv": O,
                "aid": q,
                "wp": Y ? 1 : 0,
                "de": P,
                "uid": Z["uid"],
                "lf": Z["language"] === "cn" ? 0 : 1,
                "tpc": Z[hf("cpt")] || ""
              },
              $ = M["get"]();
            $ && (_.t = $);
```
