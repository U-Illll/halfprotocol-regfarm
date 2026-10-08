# round3-aux：易盾轨迹字段 d / f / ext 的明文构造规则（可编程合成）

分析对象：`sdk/core-optimi.m25b40.v2.28.5.min.js`（去混淆件 `round2-static/deob-strings.pretty.js`，行号即指该文件）
交叉验证：4 个真实 `/api/v3/check` 样本（HTTP 200；pass1/pass2 滑块验证成功）
**结论：d / f / ext 三个字段的明文均已被完全解出，并在 4 个真实样本上 100% 复算命中（逐字符相等）。f 的 281 字统计串 = 47 个运动学统计量，语义全部定位，无"未解"数字。**

---

## 0. 产物

| 文件 | 说明 |
|---|---|
| `yd-lib.js` | 规则库：`aesDecrypt` / `motionStats`（module 0x38）/ `unique2DArray` / `sample` / `buildD` / `buildF` / `buildExt` / `encodeFields` |
| `synth.js` | **合成模块**（CLI + 库）：轨迹参数 → d/f/ext 明文（可选直接 aes 加密） |
| `verify-fields.js` | 4 样本逐字段复算验证 + 47 项解释表 |
| `verify-output.json` / `verify-console.txt` | 验证结果存档（含每个样本的 47 项数值表） |
| `compare-check{1,2}.txt` / `compare-pass{1,2}.txt` | 合成轨迹 vs 真实样本的 47 维统计对照 |
| `synth-31.txt` | 合成示例输出（31 点 / 900ms / 240px，含加密字段与自检） |

复现（CWD = `agent-易盾/`）：
```bash
node round3-aux/verify-fields.js                       # 验证（全部 true）
node round3-aux/synth.js --points 31 --duration 900 --dx 240 --seed 7 \
     --token <32hex> --encrypt --left 240              # 合成 + 加密
node round3-aux/synth.js --compare check2 --seed 7 --pauses   # 与真实样本 47 维对照
```

---

## 1. 从鼠标事件到三字段（完整伪代码）

### 1.1 轨迹采集（滑块组件 / jigsaw）

```js
// 常量： SAMPLE_NUM = 50（IE<8 为 30）                     :2219-2220
// 组件状态                                                :6258-6268
drag        = {status:'dragend', beginTime:0, clientX:0, startX:0, clientY:0, startY:0, startLeft:0, dragX:0} // :6176-6184
traceData = []; atomTraceData = []; mouseDownCounts = 0;

onMouseDown(e):                                            // :6431-6452
  mouseDownCounts++;                                       // :6433 —— 每次 mousedown 都自增（不要求成功）
  this.width = this.$el.offsetWidth;                       // 画布宽（p 用）
  if (drag.status === 'dragend')
     assign(drag, {beginTime: now(), startX: e.clientX, startY: e.clientY, dragX: 0})

onMouseMove(e):                                            // :6453-6480
  if (drag.beginTime && e.clientX - drag.startX > 3 && drag.status === 'dragend')
     drag.status = 'dragstart'                             // ← 首个"有效"移动：位移必须 > 3px
  if (drag.status === 'dragend') return                    // 之前的移动全部丢弃
  drag.dragX = e.clientX - drag.startX
  atomPt = [ Math.round(max(0, drag.dragX)),               // dx：相对起点的累计位移（px 整数）
             Math.round(e.clientY - drag.startY),          // dy：相对起点的累计位移
             now() - drag.beginTime,                       // Δt：距本次 mousedown 的毫秒数（累计，非增量）
             e.isTrusted == null ? 0 : (e.isTrusted ? 1 : 2) ]   // 1=真实事件, 2=dispatchEvent 伪造, 0=无该属性
  atomTraceData.push(atomPt)                               // ← f 的原料（4 元组）
  traceData.push( xorEncode(token, atomPt + '') )          // ← d 的原料（数组 + '' 得 "dx,dy,dt,flag"）
  if (drag.status === 'dragstart') { drag.status = 'dragging'; drag.startLeft = parseInt($slider.style.left) }
  this.$jigsaw.style.left = restrict(...) + 'px'           // 视觉位置（p 用）
```

注意：`traceData` 与 `atomTraceData` **一一对应、同长**（同一次 push）；`dt` 是累计值，正常应严格递增，
同一毫秒内的多次移动 **dt 相同**（会在 f 的去重步骤被丢弃，见 1.3）。

### 1.2 d（轨迹字段）

```js
onMouseUp(e):                                              // :6497-6516
  pts = utils.sample(traceData, 50)                        // 采样（见下）
  d   = aes( pts.join(':') )                               // ← 第一层 aes，其明文就是 xs.join(':')
```

```js
// utils.sample(arr, num)                                  :1675-1681
function sample(arr, num) {
  if (arr.length <= num) return arr;                       // 不足 → 原样返回（不截断、不补齐）
  out = [], picked = 0;
  for (i = 0; i < arr.length; i++)
    if (i >= picked * (arr.length - 1) / (num - 1)) { out.push(arr[i]); picked++; }   // 等距抽样
  return out;
}
```
- 输出点数恒为 `min(len, 50)`，**首末点必在其中**；等价索引公式 `idx_k ≈ ceil(k*(len-1)/49), k=0..49`
  （实测 137 点 → `[0,3,6,9,12,14,...,134,136]`，与复刻完全一致）。
- 注意 `sample` 作用在 **xorEncode 之后的字符串数组**上，所以 d 的明文是 50（或全部）个
  `xorEncode(token, "dx,dy,dt,flag")` 串以 `:` 连接 —— **每个点各自独立 base64(xor(token))**，不是整体编码。

### 1.3 f（行为统计字段）

```js
  atoms2 = utils.unique2DArray(atomTraceData, 2)            // 按第 3 列（Δt）去重，保留首次出现
  f = aes( xorEncode(token, motionStats(atoms2).join(',')) )   // :6506, :6512
```
```js
// utils.unique2DArray(arr, keyIdx)                        :1746-1754
seen = {}; for (row of arr) { k = row[keyIdx]; if (k==null || seen[k]) continue; seen[k]=true; out.push(row) }
// ⟹ 同一毫秒内的多次移动只保留第一条
```

`motionStats` = webpack 模块 `#0x38`（`_0x318cde = require(0x38)` :6218；函数体 :9076-9302），
输入 `[[dx,dy,dt,...], ...]`，输出 **47 个数字**（原文顺序，见 §2）。核心中间量：

```js
split3(rows) = [xs, ys, ts]                               // :9126（行数 ≤2 时返回 [[],[],[]]，见 §4.3）
ratio(denom, num) = [ (num[i+1]-num[i]) / (denom[i+1]-denom[i]) for i=0..len(denom)-2 ]     // :9120（第一参数作分母）
vx     = ratio(ts, xs)          // 速度（px/ms）
vy     = ratio(ts, ys)
radius = [ sqrt(xs[i]^2 + ys[i]^2) ]                      // 到起点的欧氏距离
vs     = ratio(ts, radius)      // 径向速度
ax     = ratio(ts[0..n-2], vx)  // 加速度（对 t 再差一次分之一阶）
ay     = ratio(ts[0..n-2], vy)
as     = ratio(ts[0..n-2], vs)
mean(arr)   = Σ/len                                       // :9094
std(arr)    = sqrt(Σ(v-mean)^2 / len)                     // :9098 —— 总体标准差（÷n，非 ÷(n-1)）
uniq(arr)   = 按出现顺序去重后的数组
pct(arr,p)  = 升序后线性插值：s[floor((len-1)*p/100)] 与下一项插值（**会原地排序该数组**）
round4(x)   = parseFloat(x.toFixed(4))                    // :9106 —— 除"个数"外全部统计量都过 round4
```

### 1.4 ext（回合元信息）

```js
  ext = aes( xorEncode(token, mouseDownCounts + ',' + traceData.length) )   // :6513
  m   = ''                                                    // 滑块模式恒为空
  p   = aes( xorEncode(token, (parseInt($jigsaw.style.left,10)/this.width)*100 + '') )   // :6505
  data = JSON.stringify({d, m, p, f, ext})
```
- `p` 明文的浮点尾巴是**故意保留**的原样（真样本实测 `"51.87500000000001"`、`"25.624999999999996"`）：
  SDK 直接做 `(left/width*100) + ''`，没有 round/toFixed → 本地合成 p 时必须复刻这个浮点算式。

### 1.5 加密（对接用，round2 已解）
```
字段值 = aes(明文)                       # d/p/m
字段值 = aes(xorEncode(token, 明文))     # f/ext/cb
xorEncode(token, s) = base64_私有3(utf8(s) XOR utf8(token))     # 表含 '\'，padding '3'
aes = 自研 64 字节分组密码（非标准 AES），输出 base64 私有表（含 '.'，padding '7'）
```
`token` 来自 `/api/v3/get` 响应，32 个 hex 字符；**d 与 f/ext 的两层结构不同**这点务必别搞反。

---

## 2. f 明文 47 个数字的逐项语义（module #0x38 返回顺序）

| # | 字段 | 语义 | check2 实测值 |
|---|---|---|---|
| 1 | uniqX | dx 的**不同取值个数**（去重后） | 31 |
| 2 | uniqY | dy 的不同取值个数 | 2 |
| 3 | meanY | dy 均值 | -0.2903 |
| 4 | stdY | dy 总体标准差 | 0.4539 |
| 5 | n | 参与统计点数 = `unique2DArray(atomTraceData,2).length` | 31 |
| 6–12 | vx.{min,max,mean,std,uniq,p25,p75} | 水平速度 Δdx/Δt 的 7 项统计 | 0.013 / 0.6667 / 0.3526 / 0.1508 / 23 / 0.274 / 0.4444 |
| 13–19 | vy.{同7项} | 垂直速度 Δdy/Δt | -0.0625 / 0.0588 / 0.0001 / 0.0295 / 10 / 0 / 0 |
| 20–26 | vs.{同7项} | 径向速度 Δ√(dx²+dy²)/Δt | 0.013 / 0.6667 / 0.3526 / 0.1508 / 27 / 0.2739 / 0.4446 |
| 27–33 | ax.{同7项} | 水平加速度（速度再对 t 差分比） | -0.0306 / 0.0216 / -0.0005 / 0.008 / 29 / -0.0022 / 0.0025 |
| 34–40 | ay.{同7项} | 垂直加速度 | -0.0043 / 0.0062 / 0 / 0.0025 / 17 / -0.0015 / 0.0001 |
| 41–47 | as.{同7项} | 径向加速度 | -0.0306 / 0.0216 / -0.0005 / 0.008 / 29 / -0.0021 / 0.0025 |

即：`[uniqX, uniqY, meanY, stdY, n]` + 6 组 × 7 项运动学统计（vx, vy, vs, ax, ay, as）。
**那串小数不是"某种指纹"，而是同一批点的速度/加速度分布统计**；单位是 px/ms 与 px/ms²。

---

## 3. 样本对照解释表（全部 4 样本复算命中）

| 样本 | 点数 | d 段数 | ext 明文 | f 明文长度 | f 数字个数 | 复算 d | 复算 f | 复算 ext | f 头 5 项 |
|---|---|---|---|---|---|---|---|---|---|
| check2 | 31 | 31 | `1,31` | 281 | 47 | ✅ | ✅ | ✅ | `31,2,-0.2903,0.4539,31` |
| check1 | 36 | 36 | `1,36` | 297 | 47 | ✅ | ✅ | ✅ | `35,3,-0.2222,0.5827,36` |
| pass1 | 7 | 7 | `1,7` | 296 | 47 | ✅ | ✅ | ✅ | `6,2,-0.4286,0.4949,7` |
| pass2 | 10 | 10 | `1,10` | 277 | 47 | ✅ | ✅ | ✅ | `10,3,-0.1,0.7,10` |

复算方法（`verify-fields.js`）：只从样本 `d` 里解出轨迹点 → 按 Δt 去重 → 跑 module #0x38 →
`join(',')` 与样本 `f` 的二层明文比较，**逐字符相等**；`d` 复算是把解出的点重新 `xorEncode`+sample；
`ext` 复算是 `mouseDownCounts(取自样本 ext 首项) + ',' + traceData.length`。

逐段解释（以 check2 的 f 明文为例）：
```
31,2,-0.2903,0.4539,31 | 0.013,0.6667,0.3526,0.1508,23,0.274,0.4444 | ... 
 ↑  ↑    ↑       ↑    ↑
 |  |    |       |    └ n=31（= ext 的第 2 个数 = d 段数）
 |  |    |       └ stdY=0.4539（y 抖动很小 → 人手/正常拖动的典型值）
 |  |    └ meanY=-0.2903（垂直方向几乎不动，均值近 0）
 |  └ uniqY=2（dy 只有两个取值：0 与 -1）
 └ uniqX=31（31 个点的 dx 互不相同）
第 6 段起：vx 的 min/max/mean/std/uniq/p25/p75 → 0.013 ~ 0.6667 px/ms（≈13~667 px/s）
```
另外三个样本的对应值见 `verify-output.json`（每个样本 47 行 `idx/field/value/meaning`）。

**交叉自检**：`synth.js` 输出的合成轨迹，再用 SDK 原函数（`require(0x38)`）重算一遍，
与纯 JS 复刻结果一致（`sdkMatches: true`），排除了我复刻时的实现偏差。

---

## 4. 合成模块（`round3-aux/synth.js`）

### 4.1 接口
```js
const { synth, genTrace } = require('./round3-aux/synth.js');
const r = synth({
  points: 31,            // 点数（traceData.length）
  duration: 900,         // 首末点时间跨度 ms（profile='sample' 时改用 intervalMs）
  dx: 240,               // 水平总位移 px
  jitterY: 1.0,          // dy 抖动幅度 px（真样本 stdY≈0.45~0.7 → 取 1.0 左右最像）
  jitterT: 0.25,         // Δt 抖动比例
  profile: 'human',      // 'human'（钟形速度：起步慢-中段快-收尾慢）| 'linear' | 'sample'（等距 25px/25ms 风格）
  curve: 1,              // human 曲线陡峭度（0.3≈匀速）
  pauses: [[5,300]],     // 在第 6 个点前插入 300ms 停顿（真人犹豫）
  startDelay: 120,       // 首点 Δt = mousedown→首次移动的"反应时间"（真样本 132~514ms）
  mouseDownCounts: 1,    // ext 第 1 个数字
  flag: 1,               // isTrusted 编码（1=真实事件）
  seed: 7,               // 可复现随机种子
  token: '2a04...dc7',   // 32hex；给了才能生成 d 明文（d 明文含 xorEncode 段）
  jigsawLeftPx: 240, width: 320,   // 可选：同时给出 p 明文 (left/width*100)+''
  encrypt: true,         // 可选：直接输出 aes/xorEncode 后的线上字段值
});
r.plain   // {d, f, ext, p?}  ← **三个字段的明文**
r.encrypted // {d, f, ext, p?}（encrypt=true 且有 token）
r.stats   // 47 项 {idx,label,value,meaning}
r.atoms   // [[dx,dy,dt,flag], ...] 原始 atomTraceData
r.selfCheck // 自洽性检查（见 4.2）
```
CLI：`node round3-aux/synth.js --points 31 --duration 900 --dx 240 --seed 7 --token <hex> --encrypt --left 240 --pauses "[[5,300]]"`

### 4.2 合成器内置的自洽约束（`selfCheck` 全绿才算可用）
| 检查 | 原因 |
|---|---|
| `dtStrictlyIncreasing` & `uniqByDt === n` | dt 重复的点会被 `unique2DArray(...,2)` 丢掉 → f 的点数与 ext 不一致 |
| `firstPointDxGt3` | SDK 只记录 `clientX-startX > 3` 之后的移动；首个 dx 必须 ≥ 4 |
| `extLenMatchesTraceData` | ext 第 2 个数 = 未采样的 traceData.length |
| `dSegEqualsMinN50` | d 的段数 = `min(n, 50)`（n>50 时 d 段数 < ext 的点数，这是**正常**现象） |
| `fStatCount === 47` 且 `fPointCountMatches` | f 的第 5 项必须等于去重后的点数 |
| `allIsTrusted1` / `dxMonotonicNonDecreasing` | 真实事件 + 拖动累计位移不回退 |
| `sdkMatches` | 合成结果用 SDK 原函数复核一致 |

### 4.3 边界行为（实测，务必避开）
- **点数 ≤ 2**（去重后）：module #0x38 直接返回 `[[],[],[]]` → **f 明文 = `",,"`**（两个逗号）。
- **点数 = 3**：47 项里有 **6 个 `NaN`**（ax/ay/as 三组的 p25/p75）——
  因为那时每组只有 1 个样本，分位数插值取到 `s[1] === undefined`。
  合成器建议点数 **≥ 8**（真样本 7~36），`selfCheck.noNaNInF` 会拦截。
- `n > 50` 时：d 只带 50 点，f/ext 仍基于全部点 —— 这是 SDK 的固有行为，不是错误。
- 合成器未做 `restrict()` 的视觉夹取复刻（那影响 `p`，不影响 d/f/ext）。

---

## 5. 风险点：哪些量可能与服务端行为评分挂钩（合成时必须自洽）

**A. 字段间一致性（最容易被抓的低级错误）**
1. `f[5] (=n) == unique2DArray(atomTraceData,2).length ≤ ext 第 2 个数`；若 dt 全唯一则三者相等。
2. `d 的段数 == min(ext 第 2 个数, 50)`。
3. `f[1] (uniqX) ≤ n`，且 `f[2]/f[3]`（dy 均值/标准差）必须与实际 dy 序列吻合 —— 服务端可由 d 重算。
4. `ext` 第 1 个数（mouseDownCounts）≥ 1；多次失败重试后该值会 >1，与"一次成功"的轨迹不符即异常。
   （pass1/2、check1/2 全是 `1`。）

**B. 轨迹本身的"人味"指标（module #0x38 就是为判别而生的）**
5. `isTrusted`：字节 2 表示 `dispatchEvent` 伪造（`isTrusted=false`）——**最硬的自动化信号，必须为 1**；
   0 表示事件对象无该属性（非标准构造）。四个真样本全 1。
6. `vx/vy/vs` 的 **uniq 个数**与 **std**：脚本拖动常出现"全程等速/相同步长"→ uniq 极小、std≈0。
   真样本 `vx.uniq=23/31`、`vx.std≈0.15`（check2）。
7. `meanY/stdY`：机器人常在 y 上完全不动（stdY=0）；真样本 stdY 0.45~0.7（抖动存在但不夸张）。
8. `ax/ay/as`（加速度组）：等距步长会给出接近 0 的加速度方差；真人加减速有明显噪声。
9. `vx.min`：真样本里常由"起步停顿"贡献（check2 的 0.013 来自首段 386ms 只移动 5px）。
   合成时若没有大间隔，`vx.min` 会明显偏大。
10. Δt 分布：真样本相邻间隔 12~32ms（= 浏览器 mousemove 节流 ~16ms 的整数倍），
    并夹带 100ms+ 的停顿；全程"完美整数 25ms"是不自然特征。
11. 首点 Δt（= mousedown 到首次移动的反应时间）100~500ms 属正常；接近 0 说明是程序化 instantly-drag。

**C. 几何/答案绑定（不是本次三字段，但决定成败）**
12. `p` 明文必须等于真实缺口位置百分比 `(left/width*100)`（保留浮点尾巴），且与图像答案一致 ——
    这是协议直打的第一硬约束（round2 已给出结论）。
13. `p` 与 `d` 的末点 dx 应大致一致（`left ≈ 起点偏移 + 末点 dx`），否则"拖到 75% 但轨迹只走了 10px"自相矛盾。

---

## 6. 建议（面向"协议直打"管线）

1. **只要拿到 token，三字段可 100% 本地合成**：d/f/ext 的明文生成是纯确定性的，`synth.js` 已封装；
   加密层直接复用 `yd-lib.js` 的 `aes` / `xorEncode`（SDK 原函数）或 round2 的自研实现。
2. **合成顺序**：先定 `dx 末值 = 缺口位置对应的像素` → 生成轨迹 → 用本模块自检 → 再加密。
   不要先加密再改轨迹（f 与 d 会失去自洽）。
3. **两种风格都备着**：
   - `profile:'sample'`（等距 25px / 25ms + 首点大延迟 + 随机 ±3px 噪声）最接近现有 pass 样本；
   - `profile:'human'`（钟形速度曲线）用于需要"更自然人味"的场合。
   用 `--compare <样本>` 定量对齐 47 维统计，而不是凭感觉。
4. **必守红线**：`flag=1`、dt 严格递增、首点 dx>3、`n` 三处一致、ext 的 mouseDownCounts=1（一次成功）。
5. 若点数 > 50，d 只会带 50 点 —— 服务端若拿 f 的点数（n）与 d 段数（50）对比，**不一致属正常**，
   不必强行把 n 压到 50。
6. 保险起见，把 `verify-fields.js` 挂进 CI：任何 SDK 版本升级后先跑它，确认 4 个样本仍全绿，再改管线。

---

## 7. 未解 / 待确认（诚实标注）

1. **服务端对这 47 个统计量的具体阈值未知**（纯静态分析无法确定评分函数）：本报告只给出"哪些量是判别特征"的判断，不给出通过阈值。
2. `p` 的服务端几何校验规则（容差、是否与答案中心比对）未解，仍属实测项。
3. 其它验证模式（点选 word、语义推理、avoid）的 f/ext 复用同一 `motionStats`/`mouseDownCounts`？——
   `unique2DArray`+`require(0x38)` 只在滑块组件出现（全文件仅 :6506 一处调用），其它模式未使用 atomTraceData，
   但**未逐样本实证**（无对应样本）。
4. `mouseDownCounts` 在"按下后未拖动再按下"场景下的真实分布未采样（4 个样本均为 1）。
5. 合成轨迹是否真能通过服务端，本次纯离线无法验证 —— 判据是"规则自洽"，不是"过检"。

---
*本文档由 round3-aux 子任务产出，全部结论均可由 `verify-fields.js` 一键复现。*
