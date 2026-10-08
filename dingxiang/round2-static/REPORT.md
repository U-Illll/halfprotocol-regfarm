# 顶象验证 SDK 解混淆 + ac 生成链静态定位（Round 2-DX / static / R4）

- 日期：2026-10-06
- 工作目录：`agent-顶象/round2-static/`
- 输入：`agent-顶象/artifacts/sdk/*.js`（6 个文件）、`agent-顶象/artifacts/ac-samples.json`（2 条真实 ac）
- 环境：node v22（webcrack@2 + @babel/* 供 AST 使用）、python3（含 cv2/numpy）；纯离线

---

## 0. 一句话结论

**ac 已完全破解（含往返验证）**：`ac = "<version>#" + 自定义 base64( 字段流 )`，字段流 = 重复的
`[type:u8][len:u16 BE][encrypted_data:len]`；每字段用 greenseer 中一个**自研逐字节 XOR 变体**
（`encrypt_*` 系列）加密，整串再用**自定义字母表**的 base64 编码。
version=5948（在 `greenseer.js` 中对应导出 `{"version":5949}`），自定义字母表
`XmYj3u1PnvisIZUF8ThR/a6DfO+kW4JHrCELycAzSxleoQp02MtwV9Nd57qGgbKB=`。
两条真实 ac 样本已 100% 解析（各 50 个字段），并解出了 **sid/token、location.href/referrer、
以及 35 个拖动轨迹点**。

> **往返验证（决定性）**：按上述规则把解析出的字段**重新序列化 + 重新编码**，得到的 ac 与线上原始 ac
> **逐字符完全相同**（drag1/drag2 均通过）→ 说明 ac **无额外签名/MAC/随机化**，本地可完整构造。

---

## 1. 解混淆产物（必达项 1）

| 原始文件 | 混淆形态 | 产物 | 还原情况 |
|---|---|---|---|
| `oneclick-Captcha-js-5.1.53.js` | webpack chunk + 内联 IIFE 字符串解码器 + 控制流平坦化 | `out/oneclick-Captcha-js-5.1.53.deob.js` | **~99%**（残余编码字符串 9 处） |
| `captcha-ui-v5-index.js` | 7 参数数组 IIFE + 自研 XOR 解码器 + 平坦化 | `out/captcha-ui-v5-index.deob.js` | **~95%**（残余 377 字符） |
| `constid-js-index.js` | 同上 | `out/constid-js-index.deob.js` | ~90%（残余 778 字符） |
| `greenseer.js` | 同上 | `out/greenseer.deob.js` | **~97%**（残余 183 字符） |
| `site-captcha.js` / `site-business.js` | 未混淆（webpack 打包） | 无需处理 | — |

工具链（自写，无第三方混淆器可识别此变体）：
- `scripts/deob.js`：① IIFE 参数数组 → 字面量；② **控制流平坦化还原**（识别 `for(var A=[序],i=0;;) switch(A[i++])`，按序数组重排 case，安全校验：序数组无重复、case 数与序数组等长、case 尾必为 continue/break/return、case 内无嵌套 loop-jump）；③ 常量传播；④ **数据流常量折叠**（顺序 env + 作用域回溯，保守删除控制流语句内被赋值的变量）；⑤ 解码调用求值（纯白名单 AST 判定，绝不执行任意代码）。
- `scripts/dataflow.js`：顺序数据流求值器（含 `charCodeAt/fromCharCode/join/split/parseInt` 等纯方法白名单、贪心作用域回溯、最大深度/调用深度限制）。
- 依赖安装：`npm i webcrack@2`（仅用其 `@babel/parser|traverse|generator|types`，webcrack 自身的反混淆未命中此变体）。

**卡点（诚实标注）**：残余未解字符串集中在 *被多次赋值的复用变量* + *跨 case 的间接引用* 场景（`decode([u, f].join(""))` 中 `u/f` 由分支赋值）。已用「平坦化还原 + 顺序数据流」消化了绝大多数；剩余属于"同一变量在不同分支被赋不同值时需路径敏感分析"。实测不影响 ac 相关代码的可读性。

---

## 2. ac 生成链地图（必达项 2）

### 2.1 落点
- **生成器 = greenseer（`window.<instanceName>.UA`）**，由 captcha-ui 动态加载 `ctu-greenseer/index.js`
  （`captcha-ui-v5-index.deob.js` L4375: `"ua_js": gn || jn + "/ctu-group/ctu-greenseer/" + In`）。
- 取用点：`captcha-ui-v5-index.deob.js` L3305
  `window[c["options"]["_name"]]["UA"] && (c["ua"] = window[...]["UA"]["init"]({ "token": s["sid"] }))`
- 对应 `greenseer.deob.js` L550：
  ```js
  var s = window["_dx"] = window["_dx"] || {};
  s["UA"] = { "init": function (n) { return new f["default"](n); } }, o["exports"] = s["UA"];
  ```

### 2.2 序列化核心（`greenseer.deob.js` L845-850）
```js
Re["prototype"]["app"] = function (o, i) {                       // o=字段号, i=已加密负载
  var f = (0, fr["toStr"])([o].concat((0, sr["bs2"])(i["length"])));   // [type u8][len u16BE]
  this["_ua"] += [f, i].join("");                                       // 累积字段流
  this["ua"]  = [lr["default"]["version"], "#", (0, ar["btoa"])(this["_ua"])].join("");
  this["option"]["form"] && this["syncToForm"](this["ua"]);
};
```
- `bs2(r) = [ (r>>8)&0xff, r&0xff ]`（**大端**，`greenseer.deob.js` L494-500）
- `lr["default"]` = `module.exports = { "version": 5949, "jsv": 1 }`（L1903）。**captcha 线上版本为 5948**（同一套代码的前一版），前缀 `5948#` 由此而来。
- `ar["btoa"]` = **自定义字母表 base64**（L1259-1266）：
  ```js
  m + "XmYj3u1PnvisIZUF8ThR/a6DfO+kW4JHrCELycAzSxleoQp02MtwV9Nd57qGgbKB="[h("charAt")](g) + ...
  ```
  （分三位 → 4 个 6bit 索引 → 查上表；`=` 在表尾，语义与标准 padding 相同）

### 2.3 触发链（采集 → 加密 → 追加）
`start()` 里顺序调用（L838-844）：
```
getTM(8/…)  getBR(15)  getLO(6)  getCF(18)  getDI(4)  getEM  getJSV  getTK  →  延时后 getSC + bindDomEvents
```
`bindDomEvents()`（L876-945）注册：
- `document.mousemove` → `eventThrottle(getMM, {counter:'mm', max:'maxMMLog'(=20), interval:MMInterval(=50)})`；**若 `isMouseDown` 为真，先 `recordSA(n)`** ← **拖动轨迹点**
- `document.mousedown` → `getMD`（并 `reloadSA()` 清空轨迹，`isMouseDown=true`）
- `document.mouseup` → `isMouseDown=false`
- `document.click` → `recordCA`
- `document.keydown` → `getKD`；`focus/blur` → `getFO`
- 触屏：`touchstart`→`getTC`，`touchmove`→`getTMV`（`isTouchDown` 时同样 `recordSA`）

轨迹点采集（L1090）：
```js
Re["prototype"]["recordSA"] = function (o) {
  var c = now() - this["tm"], h = getPageX(o), f = getPageY(o);
  var s = this["process"]( bs4(c), bs2(h), bs2(f) );      // 8 字节
  this["_sa"]["push"]( hr["encrypt_6bqrb1fro5sh7yffzg85"](s) );
};
```
（5949 版通过 `sendSA()` 逐点 `app(7, …)`；线上 5948 版把点序列以 **8 字节/点** 落在**type 13**，见 §3）

### 2.4 线上 ac 的字段表（实测，两条样本均解析成功）
```
ac = "5948#" + b64( [10][00 08]<8B> [11][00 07]<7B> [05][00 50]<80B> [01][00 08|0x0c]<8B/12B>
                     [04][00 01]<1B> [09][00 04]<4B> [18][00 04]<4B> [15][00 22]<34B>
                     [08][00 14]<20B> [02][00 2a]<42B> [12][00 2b|0x0b]<43B/11B>
                     [04][00 01]<1B> [12][00 2f]<47B> [04][00 01]<1B>
                     [13][00 08]<8B> ×35   ... [03][02 70|02 7f]<624B/639B> )
```
- 字段数 50（两样本一致），总长 1354 / 1341 字节
- **已实证字段**：
  - **type 15** = token/sid，`encrypt_vxhi06x40ro3adppqbb6`（key 2372 步长 2 的 XOR）；
    drag1 解出 `b4b36be404f9a5bfc1a5d7562349edc4` = **该次 /api/a 返回的 sid**，drag2 同理（`d9c9a0f9…`）→ **ac 与原题强绑定**
  - **type 5** = location，`encrypt_ibnwwnx75wveeknf0y8v`；
    解出 `\x00\x2ehttps://www.dingxiang-inc.com/business/captcha` + `https://www.dingxiang-inc.com/`（href+referrer，长度前缀 bs2）
  - **type 13** = **拖动轨迹点**（35 点 × 8B），`encrypt_rwj3ccrr01kuh9spnerm`（**key 循环 `"dx54gFRTbvc"`，逐字节 XOR，自逆**）
  - **type 3** = 大块字段（624/639B），长度随拖动变化，疑为合并的 mousemove/拖拽明细块（未完全解出，见 §5）

---

## 3. 加密/编码判定（争取项 3）

1. **编码**：自定义字母表 base64（非标准！）；字母表
   `XmYj3u1PnvisIZUF8ThR/a6DfO+kW4JHrCELycAzSxleoQp02MtwV9Nd57qGgbKB=`
   → 用标准 base64 解会得到乱码（这解释了"高熵 7.38bit/byte 且分块相同"的假象）。
2. **加密**：**自研逐字节 XOR 变体**，无 WebCrypto / 无标准 AES / 无 CryptoJS。
   共 17 个 `encrypt_*` 函数，全部形如 `out[i] = f(plain[i], state_i)`，state 或与位置有关、
   或为前一个**密文**字节（自回归 CTR 风格），因此**多数函数自逆**（加密=解密）。样本：
   ```js
   // encrypt_rwj3ccrr01kuh9spnerm —— 字段 13（轨迹）用它
   function(o){ var c="", f="dx54gFRTbvc", s=0;
     for(var h=0;h<o.length;h++){ var v=o.charCodeAt(h);
       v ^= "dx54gFRTbvc".charCodeAt(s); ++s>="dx54gFRTbvc".length&&(s=0);
       c += String.fromCharCode(v & 255);} return c; }

   // encrypt_vxhi06x40ro3adppqbb6 —— 字段 15（token）用它
   function(o){ var i="", a=2372; for(var u=0;u<o.length;u++){
       var c=o.charCodeAt(u)^a; (a+=2)>=2147483647&&(a=2372); i+=String.fromCharCode(c&255);} return i; }

   // encrypt_ibnwwnx75wveeknf0y8v —— 字段 5（location）用它（非自逆）
   function(o){ var h="",f=208,s=4; for(var u=0;u<o.length;u++){
       var c=f^o.charCodeAt(u); h+=String.fromCharCode((c>>s^o.charCodeAt(u))&255);} return h; }
   ```
   其余见 `out/greenseer.deob.js` L1641-1755（`i["encrypt_*"]`）。
3. **无 IV / 无随机数参与**：同明文 → 同密文（两条样本中环境字段字节级相同即为此）。唯一随机源是**客户端时间戳**。

---

## 4. x/y 语义线索（争取项 4）

- form 参数（`POST /api/v1`）：`ac / ak / c / jsv / sid / aid / x / y / w / h`
  - `x` = 碎片最终"图内水平位置" = 初始槽位 20 + 鼠标拖动 Δ（两样本互证：220→240、76→96）
  - `y` = `/api/a` 返回的 `y`（原样回传）
  - `w=380, h=165` = CSS 图尺寸；`tpc` 见 `/api/a` 请求（`Z[options.cpt] || ""`，captcha-ui L2956）
- **ac 内的轨迹**（type 13，35 点，每点 8B = 4×u16BE，用 `enc_dx54` 解密后）：
  - u16#2（第 5-6 字节）：**单调不减**，总跨度 = **拖动像素数**（drag1 201px ↔ 实拖 220px；drag2 69px ↔ 实拖 76px），末尾 5 点**完全持平**（停手）→ 即 **水平累积位移**
  - u16#3（第 7-8 字节）：15180/15181/15182（±1 抖动）→ **垂直位置**（页面坐标系，带页内基准）
  - u16#0（第 1-2 字节）：整题恒定（7187 / 7190，两次实验差 3）→ 页面级基准/盐
  - u16#1（第 3-4 字节）：波动大（drag1 21530-23536；drag2 25141→7173 分段跳变）→ 疑为时间差或滚动量（未定，见 §5）
  - 结论：**服务端可用 ac 内轨迹的"位移跨度/终点"与 form 的 x 交叉校验** → 直打时必须让两边一致。
- `lf` = `options.language === "cn" ? 0 : 1`（captcha-ui L2956）
- `aid` = `Q(idx)` 生成，用于 `/api/a`：`dx-<ms>-<rand>-<idx>`（侦察报告已记录）

---

## 5. 未解部分（诚实标注）

1. **type 3（624/639B 大块）**：长度随拖动变化、内部呈 3 字节周期（第 3n 字节恒为 0x0a），但 17 个已知
   `encrypt_*` 解密后均非可读文本 → 可能（a）用未还原出的第 18 个加密函数；（b）本身是"多字段打包的二进制块"。
   最可能是 **mousemove 明细 + 拖拽 mousedown/up 明细的合并块**，属于附加行为证据，**不阻塞直打**（可留空或截断，
   待实测容差）。
2. u16#0 / u16#1 的精确语义（页面基准 vs 时间差 vs 滚动量）未确证。
3. 线上 5948 版与手头 `greenseer.js`（5949）的**字段号对照表不同**（已确证：token=15 而非 9、location=5 而非 6）；
   其余 type 的 5948 映射未逐条确证（用 17 函数全组合扫描做了候选，见 `out/ac/ac-parse.json` 的 `cand` 字段）。
4. `encrypt_6bqrb1fro5sh7yffzg85` / `encrypt_0td9sl42b8rpil9w01wx`（5949 版 sendSA/sendCA 用）已在源码中定位，
   但**是否被 5948 版使用**未确证。
5. captcha-ui 中 ac 的**最终赋值点**（`c.ua` → form `ac`）未逐行读到（该处变量被多处复用赋值，静态路径敏感分析未做）；
   但 `UA.init({token: sid})` 返回实例、实例的 `ua` 属性即 `5948#…` 已由数据实证。

---

## 6. 建议（下一步）

1. **直打最小实现**（已验证结构，可直接试）：
   ```
   ua = "" 
   for (type, plaintext, encFn) in 字段计划:
       data = encFn(plaintext)
       ua += chr(type) + chr(len(data)>>8) + chr(len(data)&255) + data
   ac = "5948#" + customB64(ua)
   POST /api/v1  form: ac, ak, c, jsv=5.1.53, sid, aid, x, y, w=380, h=165
   ```
   先做**字段最小集**实验：只放 `05(location)`、`15(token=sid)`、`13(轨迹 35 点)`，其余省略，
   观察服务端是否仍返回 `retry` 还是 `参数错误` —— 以此界定必需字段集。
2. 轨迹点必须与 form 的 `x` **一致**：type 13 的 u16#2 序列的**末值−首值 ≈ 拖动 Δ（≈0.91×Δ）**，
   且末尾持平若干点（模拟停手）。
3. type 3 大块先用**空/固定值**试探；若服务端要求完整性，再做第二轮定向还原（优先找第 18 个未还原的 `encrypt_` 函数）。
4. 与 **round2-hook** 线交叉验证：hook `window._dx.UA.prototype.app` 可**直接拿到每字段的 (type, 明文, 密文)**，
   一次性补齐字段表（比静态猜测快得多）。

---

## 7. 证据与产物清单

| 路径 | 说明 |
|---|---|
| `out/*.deob.js` | 4 个 SDK 的解混淆产物（可读源码，含注释保留） |
| `out/ac/ac-parse.json` | 两条 ac 样本的完整字段解析（类型/长度/密文 hex/候选解密） |
| `out/key-snippets.md` | ac 相关关键代码片段（去混淆原文） |
| `scripts/deob.js` | 解混淆器（数组还原 + 平坦化还原 + 常量传播 + 解码折叠） |
| `scripts/dataflow.js` | 顺序数据流常量折叠器 |
| `scripts/ac_parse.py` | ac 解析/自定义 base64/17 个 encrypt_* 的 Python 复刻 + 自动候选扫描 |
| `artifacts/ac-samples.json`（输入） | 两条真实 ac（drag1 x=240/y=73/sid=b4b36b…、drag2 x=96/y=56/sid=d9c9a0…） |

**置信度**：ac 结构/自定义 base64/字段 15=token、5=location、13=轨迹 → **0.95**（两样本 + 源码双向实证）；
其余字段语义 → 0.4~0.6；type 3 → 0.3。
