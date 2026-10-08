# 顶象滑块「协议直打」收尾报告（Round 3-DX）

- 日期：2026-10-06 12:54–13:05（北京时间，UTC+8）
- 目录：`agent-顶象/round3-strike/`
- 环境：Edge CDP **9231**（独占）｜node v22.22.1｜python3（定位需 cv2）
- 范围：`https://www.dingxiang-inc.com/business/captcha`「滑动拼图」tab（appKey `99de95ad1f23597c23b3558d932ded3c`），POST `https://cap.dingxiang-inc.com/api/v1`
- **一句话结论**：协议直打（不拖滑块、本地构造 `ac`+form 直发 POST）**已复跑验证 6/6 success（累计 9/9）**；5949 版 `ac` 的 **50 个字段全部完成源码级编解码复刻（90/90 往返）**，并在「从零构造」（不复制任何模板密文字节）下成功 3/3；最小必需字段集收窄为 **5 类 39 字段**。未解项：少数环境字段的语义与时间头基准。

---

## 一、达成判据

| 判据 | 结果 | 证据 |
|---|---|---|
| 复跑 ≥2 次新 `success:true`（每次新题） | ✅ **6 次**（H1-a/H2-a/I1-a full + J1-z1/K1-z2/L1-z scratch） | `logs/strike.jsonl` 第 9–15 行；`out/strike-*.json` |
| 完整报告 | ✅ 本文件 | — |
| 一键入口 `run_strike.sh` | ✅ 端到端实跑 2 次（I1=full、L1=scratch：采集→直发→判读=SUCCESS） | `bash run_strike.sh I1`、`MODE=scratch bash run_strike.sh L1` |
| 从零构造增强（争取项） | ✅ 达成：全字段重加密 3/3 success；必需集收窄到 5 类 39 字段 | `scripts/dx_from_scratch.py` |

约束遵守：浏览器仅 9231；**拖动 0 次**（页面侧只点了「验证条」开面板）；本轮 POST 6 次（预算 ≤15，每次落 jsonl）；未碰登录；失败/反例全部如实落盘。

---

## 二、管线结构（三段 + 一键）

```
run_strike.sh [TAG]                         # MODE=scratch 可切换从零模式
 ├─[1] 页面采集  node scripts/dx_strike_page.mjs <TAG>
 │     干净新标签(CDP Target.createTarget) → JS 切「滑动拼图」tab → CDP 真实鼠标点「验证条」
 │     → 面板出现 → 采集: canvas 截图 / frag.webp / /api/a 响应(sid,y,p1,p2,c,ak,aid) / geom(handle,sub…)
 │     → locate.py(CV2 Chamfer+NCC) 缺口定位 → out/ctx-<TAG>.json(+canvas.png/frag.webp/locate.json/log)
 ├─[2] 离线构造  python3 scripts/dx_strike.py --ctx …        （full：模板替换法）
 │               python3 scripts/dx_from_scratch.py --ctx …  （scratch：字段全部重加密）
 │     ac = "5949#" + customB64( TLV[type u8][len u16BE][enc_payload] ×N )
 │     form = ac / ak / c(干净) / uid="" / jsv=5.1.53 / sid / aid / x / y / w=380 / h=165
 ├─[3] POST 直发 https://cap.dingxiang-inc.com/api/v1（urllib，UA/Referer/Origin 对齐页面）
 │     → 落盘 out/strike-<TAG>.json + logs/strike.jsonl
 └─[4] 判读  python3 scripts/verdict.py --tag <TAG>   → success/token/msg + 退出码
```

- 页面侧 **零拖动**：点「验证条」只产生一次点击（用于触发 `/api/a` 发题），ac 内 35 个轨迹点由本地合成/缩放，**不产生任何 mousedown/mousemove 拖拽行为**。
- 时间窗口：`tm = aid_ts + 32`；可用窗口 `W = now+700−tm`，若 `W−800 < 4995` 则对模板/合成轨迹的 dt 等比例缩放 `k = (W−800)/4995`（full 模式实测 `k` 取 0.94~1.0 均可 success）。

---

## 三、复跑记录（证据表）

`logs/strike.jsonl`（14 行 = 前任 8 + 本轮 6，其中 success 共 **9**）：

| # | tag | mode | x | y | 说明 | success | token（前 16） |
|---|---|---|---|---|---|---|---|
| 2 | C1-a | full | 233 | 52 | 前任 | ✅ | D6639FE0E5D0DB94 |
| 3 | D1-a | full | 226 | 65 | 前任 | ✅ | 5A2C7FCF5BAC2D8A |
| 5 | F1b-a | full | 238 | 52 | 前任 | ✅ | 9DBACA85052BB8E0 |
| 9 | **H1-a** | full | 198 | 42 | 本轮新题 | ✅ | 60FF2DAFD7E29165 |
| 10 | **H2-a** | full | 218 | 30 | 本轮新题 | ✅ | 3F1796F8E0AC94C3 |
| 11 | **I1-a** | full | 234 | 33 | 本轮新题（经 `run_strike.sh` 一键） | ✅ | F5AACAEFD42087C8 |
| 12 | **J1-z1** | **scratch** | 222 | 75 | 本轮新题（50 字段全重加密） | ✅ | B2227F0935C093E6 |
| 14 | **K1-z2** | **scratch** | 270 | 61 | 本轮新题（39 字段=5 类核心） | ✅ | 6AF979589516DBB2 |
| 15 | **L1-z** | **scratch** | 141 | 44 | 本轮新题（`MODE=scratch run_strike.sh` 一键；**题图与 run3 相同**） | ✅ | 514A5E4FAFF9AEF4 |

> 同题复现强证据：L1 的 p1=`b2804effea02435c838a0cce2a456985.webp` 与 run3 完全相同（同缺口），run3 拖动提交 x=141、本轮直打提交 x=141、定位 ui_x=140.6 —— 三条线一致。

失败样本（如实保留）：`B1-s1`（首次实跑/管线初调期，x=248 定位 top1 d=0.88，返回 `retry`，失败原因未定位）、`E1-min`/`F1b-min6789`/`F1b-min+12`/`G1-min6789`（min 字段集 `{6,9,7}` → `error`/`请求超时`）。
每次 POST 的完整 `resp_raw`、构造参数（aid/aid_ts/tm/W_ms/k/ac 长度/字段表）在 `out/strike-<tag>.json`。

---

## 四、x 口径校准结论

**正确口径（可复现、双线验证）：`x_form = round(ui_x)`，其中 `ui_x = x_canvas × 0.95`（canvas 400×200 → CSS 380×165），缺口位置来自**页面 canvas 截图**（`dx_strike_page.mjs` 的 `canvas.toDataURL()` + `locate.py` Chamfer top-1）。x 与 y 均**直接对应**，无 +20 偏移。

| 验证线 | 样本 | ui_x | 提交 x | 结果 |
|---|---|---|---|---|
| 拖动历史（round2-hook） | run1/run2/run3/run4 | 161.5 / 234.6 / 140.6 / 152.0 | 162 / 235 / 141 / 152 | **4/4 精确命中** |
| 直打（full） | C1/D1/F1b/H1/H2/I1 | 232.8 / 226.1 / 237.5 / 198.5 / 218.5 / 233.7 | 233 / 226 / 238 / 198 / 218 / 234 | **6/6 success** |
| 直打（scratch） | J1/K1/L1 | 222.3 / 269.8 / 140.6 | 222 / 270 / 141 | **3/3 success** |

y 口径：`y = /api/a 的 y` 原样回传（`yApi` 与面板 `margin-top` 的 CSS 值一致；canvas 系换算 `yApi/0.825` **不需要**）。

**反例（重要，勿再使用）**：`out/calib/` 的「从 CDN 下载 p1 原图重定位」口径**不可用**——对 run4 重定位得 ui_x=82.6（真值 152），8 个候选里**没有**真值附近项，说明 **CDN 下载的背景图与页面 canvas 实际渲染内容不一致**（疑为裁剪/重绘制），故 `summary.json` 中的 `x_err`（−148.6 ~ +69.4）**不代表口径误差**，仅作反面记录。校准必须基于页面 canvas 截图。

---

## 五、最小字段集结论

| 字段集 | 字段数 | 次数 | 结果 |
|---|---|---|---|
| `{6,9,7}`（前任 min） | 3 类（location+sid+轨迹） | 3 | ❌ 全败（`error` / `请求超时`） |
| **full 50 字段**（模板替换） | 50 | 6 | ✅ 全成 |
| `{8,9,6,7,12}`（本轮 scratch-core） | **39**（35 轨迹+4） | 1 | ✅ **成功** |
| 全 50 字段（scratch，全重加密） | 50 | 1 | ✅ 成功 |

结论：**必需集 = {8: tm, 9: sid, 6: location, 7: 轨迹×35, 12: 大 JSON}**；
`{tm, 大JSON}` 是 min 失败的关键缺口；环境类字段 `{15,18,16,14,1,4,10,3}` **可整体省略**（服务端不强制）。
「大 JSON (type12)」内含 `x/y`，必须与 form 的 x/y 一致（替换后才会 success，见 full 模式）。

---

## 六、从零构造（本轮增强，争取项达成）

### 6.1 字段编解码全解（5949）
- **字段→加密函数映射**：从 `round2-static/out/greenseer.deob.js`（5949 源码）`app(<type>, encrypt_xxx(...))` 调用点（L950–L1135）逐一取证，**18 个 `encrypt_*` 函数全部复刻**到 `scripts/dx_fields.py`，**90/90 随机往返（enc→dec）通过**。
- 全 50 字段已可解密，语义表落盘 `out/fields-5949.json`。样例：
  - `t8`=tm（8B 大端 ms）；`t9`=`[00 20]`+sid；`t6`=location（`[00][len]href[00][len]ref`）；
  - `t7`=SA 轨迹点 `[u32 dt][u16 pageX][u16 pageY]`×35；
  - `t12`=635B 大 JSON：`title/keywords/description/viewport/bodyLength/headLength/xpath/x/y/fragment`；
  - `t10`/`t3`=元素记录（`[u32 t][u16][u16][len][xpath]`，路径为 `dx_captcha_*` 常量）；
  - `t16`=屏幕/窗口 10×u16；`t15`/`t18`=短环境串；`t14/t1/t4`=常量 0/1/0x51。
- **self-test（决定性）**：用 run4 真实参数重建，除 35 个轨迹点（合成序列）外，**其余 15 个字段与模板明文逐字节一致** → 说明抽取的生成规则正确。

### 6.2 实验
- `J1-z1`：**50 字段全部重新加密**（不复制任何密文；t8/t9/t6/t7/t12 完全新造）→ **success ✅**
- `K1-z2`：只留 5 类核心（39 字段），其余环境字段整体剔除 → **success ✅**
- `L1-z`：一键入口 scratch 全链路（含新题、`MODE=scratch`）→ **success ✅**（题图与 run3 相同，x=141 与拖动样本完全一致）
  ⇒ **"从零构造"达成（3/3）**：核心字段流不再依赖任何 run4 采样数据即可生成。

### 6.3 与"从零"的剩余距离（诚实标注）
1. `t15/t18/t16/t14/t1/t4/t10/t3#1` 的**明文**在 scratch-full 中仍复用 run4 解密值（属同页面/同浏览器环境常量）；**但 K1-z2 已证明它们全部可省略**，故纯从零版不受影响。
2. `t12` 大 JSON 的页面常量（title/bodyLength/fragment 等）取自 run4 同页面采样；本次会话只替换 `x/y`。这些值在同页面/同窗口下恒等，理论上可由页面侧采集补齐（未做）。
3. 轨迹：本次为**合成序列**（缓出曲线 + 停手持平 + dt 单调），dt 值域沿用模板 `3959..4995`；dt 的**绝对基准**（相对哪个会话时刻）未确证（见 §八）。
4. `t10/t3#1` 的 `u32` 时间头（1977/2346）沿用模板值，未按本次会话重建。

---

## 七、方法边界（如实说明）

1. **full 模式（历史成功路径）= 模板替换法**：以 run4 `_ua`（1332B）为底，替换 `t8(tm)/t9(sid)/t12(x,y)`，轨迹按 `(x−20)/132` 水平缩放 + dt 平移/缩放。其**成功不能证明**"所有字段都是本次会话原生生成"——环境字段密文原样复用（无 IV，同环境恒等，故等价）。
2. **scratch 模式（本轮）把模板依赖降级到"明文常量级"**：所有密文重新计算；但如 §6.3 所列，环境常量明文与 t12 页面常量仍源自同页面采样。**"完全无采样依赖"的极限形态尚未实现**（需要页面侧实时采集 meta/HTML 长度等）。
3. **与前轮结论的关系**：round2-static 已证明 `ac` 结构（自定义 base64 + TLV + 17 函数）可解析且可往返，并给出 5948 版部分字段语义；本轮在其上补全 5949 版**全部**字段映射与编解码，并把"只解析"推进到"可构造、可直发、可复跑"。
4. **服务端校验强度未知**：只知必需五类字段 + x/y 一致性 + 时间窗口（~30s 内），无法逐字节定位服务端校验点（无对照实验预算）。

---

## 八、未解项

1. `t10`/`t3#1` 记录中 `u32` 时间头的**基准时刻**与 `u16` 字段（822/165/171 等）的精确语义（疑为元素几何/事件时刻），当前沿用模板值即可通过 → 非阻塞。
2. `t15`（`[01 07][00 03]"154"`）与 `t18`（`[00 1d][00 03]"0]]'"`）的字段语义（`154` 疑为浏览器主版本；`"0]]'"` 未定）。
3. `t16` 的 10×u16 组合中多数项与 `innerWidth/innerHeight` 之外的值（1707/1067/549/270…）未逐项确认（疑 `outerWidth/availWidth/screenTop` 等）。
4. 轨迹 `dt` 的绝对基准与 35 点的**服务端合理性阈值**未做对照实验（合成序列已成功，说明容差宽）。
5. `t12` 的 `fragment/bodyLength/headLength` 是否逐次重算（页面变动时）未验证。
6. 5948↔5949 字段号映射未逐条确证（如 5948 `type3`(624B 大块) 在 5949 里对应 `type12`；5948 `type13` 轨迹 ↔ 5949 `type7`）；5948 线上流量重放未做。
7. `B1-s1` 单例失败（retry）未归因（定位/时间窗二者之一，样本量不足以区分）。

---

## 九、一键入口与复现

```bash
cd dingxiang/round3-strike

# full 模式（模板替换法）：采集→直发→判读
bash run_strike.sh H9

# 从零构造模式（全字段重加密）
MODE=scratch bash run_strike.sh H10

# 单步
node scripts/dx_strike_page.mjs T1                                   # ① 采集（零拖动）
python3 scripts/dx_strike.py --ctx out/ctx-T1.json --tag T1-a        # ② full 直发
python3 scripts/dx_from_scratch.py --ctx out/ctx-T1.json --tag T1-z  # ②' scratch 直发
python3 scripts/verdict.py --tag T1-a                                # ③ 判读（退出码 0=success）

# 离线自检（不耗费 POST）
python3 scripts/dx_strike.py --selftest        # run4 ac 逐字符还原 = True
python3 scripts/dx_from_scratch.py --selftest  # 50 字段重建，除轨迹外逐字节一致
python3 scripts/dx_fields.py                   # 18 函数 90/90 往返
python3 scripts/dx_make_fields_json.py         # 重生成 out/fields-5949.json
```

前提：浏览器 9231 已开；`DX_PYTHON` 或 `python3` 可用（定位需 cv2）。

---

## 十、产物清单（本轮新增/关键）

| 路径 | 说明 |
|---|---|
| `REPORT-ROUND3-DX.md` | 本报告 |
| `run_strike.sh` | 一键入口（full / scratch） |
| `scripts/dx_strike_page.mjs` | 页面采集（零拖动） |
| `scripts/dx_strike.py` | full 直发（模板替换法）+ run4 逐字符自检 |
| `scripts/dx_from_scratch.py` | **从零构造直发**（全字段重加密、字段集可裁剪） |
| `scripts/dx_fields.py` | **5949 十八个 encrypt_* 复刻 + 字段↔函数映射 + 双向编解码（90/90）** |
| `scripts/dx_ac.py` | ac 结构/自定义 base64/TLV |
| `scripts/dx_probe_fields.py` / `dx_hexfield.py` / `dx_inspect.py` / `dx_dump_t12.py` / `dx_make_fields_json.py` / `dx_hookscan.py` | 字段取证/分析工具 |
| `scripts/verdict.py` | 判读 |
| `scripts/dx_calib_x.py` | x 口径校准（**结论已被 §四修正：下载图口径不可用**） |
| `out/fields-5949.json` | 50 字段语义表（明文 hex/编码函数/可否自建） |
| `out/ctx-*.json` `out/strike-*.json` `out/calib/` | 采集/直发/校准证据 |
| `logs/strike.jsonl` | 14 次 POST 记录（9 success） |

---

## 十一、建议

1. **关闭"下载图校准"路线**：定位一律走页面 canvas 截图口径（§四），删除/标注 `out/calib` 的误导性。
2. **若追求"零采样"极限**：在 `dx_strike_page.mjs` 里补采 `document.title/meta/keywords/body.innerHTML.length/head.innerHTML.length` 与 HTML 片段，替换 `t12` 的页面常量（工作量约 1h，非阻塞）。
3. **压缩字段集**：生产用 5 类 39 字段即可（ac 1545B，更稳），full 50 字段留作对照。
4. **时间头语义**（`t10/t3#1` 的 u32 与轨迹 dt 基准）可在采集时同步记录"面板创建时刻/点击时刻"做一次对照实验解析。
5. 稳性观察：9/9 success 中定位 top1 `d`（越小越好）范围为 0.57~0.90；唯一失败样本 `B1-s1` 的 `d`=0.88（弱区），建议保留 top-2 候选、`d>0.85` 告警并优先换题。
