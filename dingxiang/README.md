# dingxiang — 顶象滑块「协议直打」（0 拖动，含从零构造）

顶象（dingxiang-inc.com）5.1.53 滑块的**协议层直打**实现：
页面侧**零拖动**（仅点击验证条取题 + canvas 定位）→ 离线构造 `ac` 与 form → 直接 POST `/api/v1`。

## 机制摘要

- **ac 格式**：`"<version>#" + 私有字母表 base64( 字段流 )`；
  字段流 = 重复的 `[type:u8][len:u16 BE][加密数据]`，每字段用**自研逐字节 XOR 变体**加密（18 个 `encrypt_*` 函数家族）。
- **无签名/MAC**：字段按规则重序列化 + 重编码后与线上原始 `ac` **逐字符一致**（往返验证通过）→ 本地可完整构造。
- **两种模式**：
  - `full`（模板法）：字段明文/密文复用 `round2-hook/samples/run4/` 的采样模板，仅会话相关字段重加密；
  - `scratch`（从零构造）：**全字段明文重新生成后重加密**（不复制模板的任何密文字节）——历史会话字段除外。
- **定位**：Chamfer 形状匹配 + y 约束（`round2-hook/locate.py`，需 cv2+numpy）；
  UI 坐标必须用 canvas 口径换算（下载图校准路线已证伪）。

## 运行

```bash
cd dingxiang
bash round3-strike/run_strike.sh [TAG]              # 模板法（默认）
MODE=scratch bash round3-strike/run_strike.sh [TAG] # 从零构造
```

运行前提：
- Node ≥ 18；Python 3（含 `cv2` + `numpy`，可用 `DX_PYTHON` 指定）。
- **浏览器 CDP 已开**（默认端口 9231，`CDP_PORT` 可改），且**目标页已在调试标签上打开**
  （官方演示：`https://www.dingxiang-inc.com/...` 带滑块组件的页面；脚本会自行开新标签并点击验证条）。

产物：`round3-strike/out/ctx-<TAG>.json`（页面采集）→ `out/strike-<TAG>.json` + `logs/strike.jsonl`（提交记录）。

## 目录

| 路径 | 内容 |
|---|---|
| `round3-strike/run_strike.sh` | ★ 一键入口（采集 → 构造 → 提交 → 判读） |
| `round3-strike/scripts/dx_ac.py` | ac 编解码核心（parse/build + 18 个 encrypt_* 复刻） |
| `round3-strike/scripts/dx_fields.py` | 字段级明文编解码（dec_field/enc_field） |
| `round3-strike/scripts/dx_strike.py` | 模板法构造 + 直发 POST |
| `round3-strike/scripts/dx_from_scratch.py` | 从零构造（含 `--selftest` 与 run4 逐字段比对） |
| `round3-strike/scripts/dx_strike_page.mjs` | 页面侧采集（干净新标签 → 点验证条 → canvas/碎片 → 定位） |
| `round3-strike/scripts/verdict.py` | 结果判读（退出码 0=success） |
| `round2-hook/` | 采样工具链（hook_inject.js + run_hook.mjs + locate.py）+ `samples/run4/` 模板 |
| `round2-static/` | 去混淆产物（greenseer / captcha-ui 等）+ ac 解析脚本 + 关键片段 |
| `round2-data/` | AC 结构分析报告 + 二进制结构分析脚本 |
| `artifacts/ac-samples.json` | 2 条历史请求的参数形态记录（ac 为节略值，展示字段布局用） |

## 已知边界

- 定位依赖 canvas 口径（`--selftest` 内置回归）。
- 部分环境常量（时间头 u32、UA 版本等）无法从会话推导 → scratch 模式下明文沿用模板（见 REPORT 的「方法边界」）。
- `t3` 字段未解（可省）；轨迹 dt 时间基准未完全确证。

## 验证记录

见 `round3-strike/REPORT-ROUND3-DX.md`：**0 拖动 · 9/9 `success:true`**（full 模板法 6 次 + scratch 从零构造 3 次）。
