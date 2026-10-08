# 顶象滑块「ac 生成链」运行时 hook 取证报告（Round 2-DX）

- 日期：2026-10-06 12:03–12:13（北京时间）
- 环境：Edge CDP **9231**（profile=dx-recon），node v22.22.1，python3（含 cv2/numpy）
- 页面：https://www.dingxiang-inc.com/business/captcha（「滑动拼图」tab，appKey `99de95ad1f23597c23b3558d932ded3c`）
- 目录：`agent-顶象/round2-hook/`
- 结论一句话：**ac = greenseer 实例方法 `z.getUA()` 的返回值 = `"<构建号>#" + base64(变换(_ua))`；4 次拖动 4 次 success（含 token）；`5949#` 前缀 = greenseer.js 构建版本号（round1 的 5948 对应 `?_t=497570`/10-05 19:00 构建）。**

---

## 一、样本清单（全部 success）

| # | 目录 | 提交 x/y | Δ(px) | xhr 响应 | token | 备注 |
|---|---|---|---|---|---|---|
| 0 | `samples/dry1/` | — | — | — | — | 干跑（无拖动）：验证 hook 注入与面板流程 |
| 1 | `samples/run1/` | x=162,y=63 | 141.5 | `{"success":true,"token":"68594DAA…A9",...}` | ✓ | 第 1 组完整样本 |
| 2 | `samples/run2/` | x=235,y=36 | 214.6 | `{"success":true,"token":"8100C084…16"}` | ✓ | + `z` 内部结构（断点@`z.sendSA()`） |
| 3 | `samples/run3/` | x=141,y=44 | 120.6 | `{"success":true,"token":"543A4D84…64"}` | ✓ | + **getUA()==POST ac 恒等证明**（1793ch） |
| 4 | `samples/run4/` | x=152,y=44 | 132.0 | `{"success":true,"token":"5DD837E8…10"}` | ✓ | + `_ua` 全量 1332B、`_sa` 35 条、getUA 源码 |

每目录含：`net.json`（全网络+POST body+响应）、`hook-recs.{init,pre,drag1,final}.json`（hook 全记录）、`hook-extra.*.json`、`canvas.png`/`frag.webp`、`locate.json`、截图、`meta.json`；run2/3/4 另有 `paused.jsonl`、`ac-debug.json`/`ac3-ua.json`/`ac4.json`。

拖动预算：**4/4 全部用尽**（dry1 未拖动）；4 次全部 success（命中率 100%，Chamfer 定位+deltas=[定位值, +6, -6, +12] 策略中第 1 次即命中）。

## 二、ac 生成链（源码级 + 运行时双重证据）

### 2.1 提交构造点（源码，`basic-Captcha-js.js` line3 col≈113589–114158）
> 该文件为滑动拼图专用 SDK（webpack 包 `basic-Captcha-js`，随 tab 点击动态加载，**round1 未收集**）；本轮已抓取：`sdk/basic-Captcha-js-5.1.53.js`（187,160B，CDN，经浏览器 CORS fetch 取得）。

```js
var rn = Math.round(t.dx) + (en===Z.TYPE_BASIC||en===Z.TYPE_BASIC_SENSE ? 20 : 0),
    on = Math.round(n.ty || 0);                       // on = y
if (z) { z.sendSA(); var an=""; try{an=L(n.el)}catch(e){}
         an ? z.sendTemp({"xpath":an,"x":rn,"y":on}) : z.sendTemp("x="+rn+"&y="+on); }
if (!F.isDown()) {
  var ln = { "ac": z ? z.getUA() : "", "ak": J.appId, "c": nn||"", "uid": J.uid,
             "jsv": V, "sid": K, "aid": D, "x": rn, "y": on, "w": dn, "h": un };
  ... P.POST(n.options[...], {"body": ln}, ...)      // → captcha-ui POST → XHR POST /api/v1
}
```
- 证据：`samples/run1/hook-recs.drag1.json` 中 `xhr.send`(POST /api/v1) 的 `st` 栈：
  `basic-Captcha-js.js:3:114158 → captcha-ui/v5/index.js:4:86409/86886/61197/60897 → XMLHttpRequest.open`。
- **x 语义钉死**：`x = Math.round(t.dx)+20`（t.dx=拖动位移，TYPE_BASIC 固定 +20 偏移）；`y = Math.round(n.ty)`。run4 实测 dx=132→x=152 ✓；run2 dx=215→x=235 ✓。

### 2.2 ac 的来源（运行时断点证据）
在 `basic-Captcha-js.js:3:113589`（`z.sendSA()`）与 `3:113805`（`z.getUA()`）设置 CDP 断点，命中后在暂停帧内求值：

- run2 `paused.jsonl`：`zKeys=["ua","_ua","_sa","_ca","tm","counters","option","binded","recordSA","isMouseDown"]`
  - `ua = STR(417):"5949#YXXnOPrVc6r…"`
  - `_ua = STR(309):"\b\0\bdx4?h#¿ä…"`（**原始二进制/半明文数据**）
  - `_sa = LIN(41)`（行为记录数组）
- run4 `ac4.json`：`_ua` 全量 **1332 字符**、`_sa` 35 条、`out1(getUA())=1781 字符`、`uaAfterSame=true`（getUA 幂等无副作用）
- **恒等式（决定性）**：
  - run3：`z.getUA()` 输出 **与 POST ac 逐字符相同**（1793ch，0 差异）
  - run4：`z.getUA()` 输出 1781ch **与 POST ac 相同**（`equal=True`）
  - 长度公式：`len(ac) = 5("5949#") + ceil(len(_ua)/3)*4`：1332→1781 ✓；309→417 ✓
  - ⇒ **ac = "5949#" + 标准base64( 变换(_ua) )**，变换**保持长度**（非压缩）。

- getUA 源码（run4）：`function(){return this[mr(t[133])]}` —— getUA 只是取 `z.ua` 属性（真正编码发生在 recordSA/process 中）。

### 2.3 数据收集侧（hook 证据）
- **事件绑定**（`hook-recs` 的 `addEventListener` 记录，源码含栈 `captcha-ui/v5/index.js:4:10891`）：
  - `DIV#dx_captcha_basic_slider_N` **mousedown** → `n.act("dragStart", g(i))`；**touchstart** → `n["trails"]=[]; n.act("dragStart",g(t))`
  - `DIV#dx_captcha_oneclick_one-step_N` **mousemove** → `n.is_sliding && n.act("dragging",g(t)) && m(t)`
  - `document` **mouseup** → `n.is_sliding && n.act("dragEnd", g(t))`
- **`_sa` 记录**（run4，35 条，与拖动采样次数一致），每条 8 字节，例：
  `e1c26a6720f6072b` / `e1c26a9920ff0729` / `e1c26abd20040729` … （首 2 字节固定 `e1c2`，第 4 字节随拖动单调递增 0x67/0x99/0xbd…≈鼠标 x 低位，尾字节为时间递增）
- **环境/指纹数据**经 greenseer 自研 TLV 编码（`00 00 <len16> payload`）逐字节构造：
  例 `join/fromCharCode` 记录 `0,0,36,"dx_captcha_basic_slider-img-normal_4"`、`0,0,7,197,3,54,0,165 …`；栈 `greenseer.js:2:2931 [as process]` / `[as recordSA]` / `[as getSC]`。
- **变换算法未定**：`ac主体base64解码` 与 `_ua` 逐字节对照（`crack.py`/`map_check.py`）
  - 非单表替换（映射冲突 995/1332）；非直接 XOR（`raw^p` keystream 237 个唯一值、0 个 0）；非链式 XOR；
  - 但密文重复段与明文重复段**位置一一对应**（如 `raw[27..32]==raw[75..80]` 与 `p[26..31]==p[74..79]`）⇒ **位置无关/上下文相关**的逐字节编码，密钥流疑与 `tm`(ms 时间戳) 或会话随机数相关。
  - 无 WebCrypto（`crypto.subtle` 全程 0 调用）、无 WASM、无 CryptoJS；SDK 内 `btoa` 未被顶象侧调用 ⇒ base64 为自研实现 ⇒ **加密路径 = JS 自研（非 WebCrypto）**。

## 三、`5949#` 前缀语义（已解决）

| 会话 | greenseer.js URL | 构建时间 | 文件内常量 | 实测 ac 前缀 |
|---|---|---|---|---|
| round1（10:44/10:49） | `…greenseer.js?_t=497570` | 2026-10-05 19:00:02 | **5948**（`artifacts/bodies/body-002.txt`） | `5948#`（2/2 样本） |
| round2（12:03–12:12） | `…greenseer.js?_t=497572` | 2026-10-06 10:00:02 | **5949**（`grep` 命中 1 次；与 2333 同表） | `5949#`（4/4 样本） |

- 同构佐证：constid 的请求头 `Param: 5880#…` 与其版本号 `/*! v1.5880.0(6394) */` 精确一致 ⇒ **「4 位数字 + #」= 该 SDK 的构建/版本号**。
- 结论：**`5948#`/`5949#` 是 greenseer 的构建版本号**，随 CDN 构建递增（`_t` 构建序号 497570→497572 同步递增）；**不是**时间/通道 id、**不是**逐次随机（同会话多次提交不变）。

## 四、hook 脚本（可复跑，document-start 注入版）

- `round2-hook/hook_inject.js`（34KB）：XHR/fetch/URLSearchParams/FormData/btoa/atob/TextEncoder/JSON.*/fromCharCode/join/split/replace/slice/concat/charCodeAt/WebCrypto/getRandomValues/addEventListener(含事件流与 handler 源码)/Worker 全量包装，**严格透传原行为 + toString 伪装**；产物 `window.__DXH__`。
- 驱动：
  - `run_hook.mjs`（注入→reload→点tab→点条→定位→拖动→落盘；`--no-drag` 干跑）
  - `run2_break.mjs` / `run3_break.mjs`（+CDP Debugger 断点取证 z 对象）
  - `locate.py`（Chamfer+NCC 缺口定位，需 cv2）、`fetch_js.mjs`（经浏览器抓 CDN 源码）、`crack.py`/`map_check.py`（ac↔_ua 变换分析）
- 复跑：`node run_hook.mjs runX`（默认最多 4 次拖动，Δ=[定位, +6, -6, +12]）。

## 五、阻力与建议

1. **变换算法未完全还原**（唯一未闭环项）：需要 ≥2 组「同一 `_ua` 输入 → 两段不同密钥流」或「微改一字节的差分样本」。建议下一步：在断点暂停帧内做**受控差分实验**（同会话中修改 `z._ua` 一个字节后调用 getUA，对比输出偏移模式）——本轮受「只观察不改变」约束未做。
2. 协议直打要点已具备：`x=⌊dx⌋+20`、`y=⌊ty⌋`、`ac=z.getUA()`、`c`=constid token、会话 <30s；**但 ac 现在只能靠页面生成**，离线构造需先还原 2.3 的变换（或直接在页面内调用 `z.getUA()`——该对象可由 `basic-Captcha-js` 内部取得，本轮未做全局导出）。
3. 反调试：全程未触发任何 debugger 陷阱/检测（含 4 次 Debugger 断点暂停）；客服 iframe 遮挡仍由 safePoint 逻辑绕开。
