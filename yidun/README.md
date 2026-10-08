# yidun — 易盾滑块「协议直打」（0 拖动）

网易易盾（dun.163.com）v2.28.5 滑块验证码的**协议层直打**实现：
全程不拖鼠标——取配置 → 取图 → 离线缺口检测 → 本地合成轨迹 → 本地加密构造 `data/cb` → 直接 POST `check`。

## 机制摘要

- **加密**：SDK 自研 64 字节分组「白盒 AES」链式加密（CRC32 校验 + 随机 IV 前缀 + CBC 链），
  本仓库的 `round2-static/extract-crypto.js` 直接从去混淆产物中**调用 SDK 原生函数**，保证与页面逐字节一致。
- **编码**：私有字符表 base64（padding 字符为 `7`，即所有密文尾字符固定 `7`）+ 内层 XOR(token)。
- **生成链**：`d = aes(pts.join(':'))`、`p = aes(xorEncode(token,'left'))` 等五字段（`d/m/p/f/ext`）合成。
- **凭据**：`v3/get` 请求必须携带有效的 `irToken` 或 `fp`（ir 凭据来自易盾 ir-SDK 页面侧；
  全空则 `check` 必 false）。凭据获取方式见下。

## 运行

```bash
cd yidun
node round3-strike/protocol_strike.mjs [runName]     # 默认 runs/<时间戳>
```

运行前提：
- Node ≥ 18，`curl` 可用（脚本用 curl 派生请求）。
- **ir 凭据**（二选一）：
  - 环境变量：`YD_IRTOKEN=... YD_FP=... node ...`
  - 文件：`round3-strike/irtoken.json` 内容 `{"irToken":"...","fp":"..."}`
  - 获取方式：浏览器打开 `dun.163.com/trial/jigsaw`，reload 页面后在 Network 里抓
    `ir.dun.163.com/v4/j/up` / SDK 初始化请求中的 `irToken` 与 `fp`（零鼠标，纯页面侧）。
- 可选：`YD_DT=<已知 dt>` 复用会话；不设则服务端签发新 dt。

产物：`round3-strike/runs/<runName>/`（01_getconf → 06_check 全链落盘 + 图片 + SUMMARY.json）。

## 目录

| 路径 | 内容 |
|---|---|
| `round3-strike/protocol_strike.mjs` | ★ 主管线（协议直打五步） |
| `round3-strike/lib_yd.cjs` | 加密/构造库（buildData/buildCb，调用 SDK 原生函数） |
| `round3-strike/gap_detect.cjs` | 离线缺口检测（前景块缩放匹配 + 精修） |
| `round3-strike/page_strike.mjs` | 页面侧辅助采集版（对照用） |
| `round3-strike/lib/` | 内嵌依赖 jpeg-js / pngjs（MIT / BSD 许可） |
| `round2-static/` | 字符串表解码器 + 去混淆产物 + 格式规范（FORMAT.md）+ 生成链地图 |
| `round3-aux/` | 轨迹合成器 synth.js + 明文构造库 yd-lib.js |
| `round2-data/` | v3 check 密文格式规范（FORMAT.md）+ 全链解码/统计脚本 |

## 已知边界

- **每 token 最多提交 2 次**（服务端限制）——主管线每次运行只提交 1 次。
- ir 凭据会过期：重新在页面侧抓取即可（零鼠标操作）。
- 本实现对 `dun.163.com/trial/jigsaw`（官方试用页，固定 demo bid）实打验证；
  换站点时把 `ID`（bid）与 `referer` 换成目标站点的对应值。
- 去混淆产物（`deob-strings.pretty.js`）为 SDK 的反混淆样本，仅作研究参考。

## 验证记录

见 `round3-strike/REPORT-ROUND3.md` 与 `RESULTS.md`：
**0 拖动 · 7 次 `result:true`**（6 次纯 node 全链，含 `gapX=206 → p="64.375"` 数学吻合抽查）。
