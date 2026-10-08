# zai — 阿里云验证码 V2「半协议 + 点火式」研究集

z.ai（chat.z.ai/auth）登录/注册页阿里云验证码 V2（INPAINTING/PUZZLE 滑块）的协议化研究。

**本模块 = 半协议三层 + 点火式（引用劫持）**：

1. **签名层**（✅ 100% 复现）：`HMAC-SHA1` 的 message 构造与 key 派生已逐字节复刻；
2. **协议层**（✅ 网关全通）：`InitCaptchaV3` / `VerifyCaptchaV3` 请求可构造直发（签名+参数）；
3. **视觉层**（✅）：PUZZLE/INPAINTING 两类题的自研缺口检测器；
4. **点火式（引用劫持）**（✅ 已命中）：在页面「组装点」断点命中后保存组装函数引用
   （`ts`/`th` 等，名字随版本漂移），之后可**程序化调用 `ts(op=25, 素材)` 生成 `data`**
   ——即只需一次「点火」（触发组装发生），此后脱离手工拖动。

## 目录

| 路径 | 内容 |
|---|---|
| `sig/verify_sig.py` | ★ 签名端到端复刻验证（对 hook2-log.json 双样本，运行后应全 match） |
| `sig/hook2-log.json` | 签名样本（HMAC.finalize 捕获：key/message/结果）——历史会话数据 |
| `sig/hook-log-1.json` | AES/deviceToken 4 链捕获（环境字段已掩码） |
| `sig/verify-success.json` | VerifyCaptchaV3 成功样本（`Result.VerifyResult=true` 全程记录） |
| `sig/cvp-r5.json` / `data-success.txt` / `data-r5.txt` | cvp 与 data 样本（成功版 + 失败版对照） |
| `sig/gp-net-r2/r3.json` | 完整网络链记录（device Log → Init → Verify） |
| `detect/gap_detect_puzzle.py` / `gap_detect.py` | PUZZLE / INPAINTING 缺口检测器 |
| `submit/verify_submit.py` | 协议提交器（签名复算 + POST VerifyCaptchaV3；默认 dry-run） |
| `submit/hook_verify_intercept.js` | XHR/fetch verify 拦截 hook（记录完整 body + 阻断 + 假响应） |
| `submit/replay_vip.py` | 拦截记录原样重放器（观察服务端真实响应） |
| `align/drag_align3.mjs` | 自然对照版对齐拖动（不注入任何 hook，CDP 直捕 verify 请求/响应） |
| `align/fresh_target.mjs` | 干净目标管理器（新标签、bare 模式零注入） |
| `align/fetch_imgs.mjs` | 取当前题的背景/块图（data URL → png） |
| `align/strike_natural.sh` | 自然对照一键 SOP（开标 → 取图 → 检测 → 拖动观察） |
| `ignite/za11_hijack*.mjs` | ★ 引用劫持（点火力）：断点命中组装点 → 保存函数引用 → 程序化生成 data → 与真样本对比 |
| `ignite/za11_s9d_chain.mjs` | S9d 帧内探查链（多帧评分 + 组装链试调用，已命中 `ts(op=25,mat)`） |
| `ignite/za11_s6a/s8_multi/s8b/s9_probe2/s4_drag_center.mjs` | 布点/多停快照/栈快照/拖动中心校准 子工具 |
| `ignite/S9-RESULTS.md` | ★ S9 命中全记录（data 形态产出的逐轮证据表） |
| `docs/00-阿里云V2加密算法全链.md` | ★ 权威总纲：签名/AES 链/请求链/实例注入/复刻骨架 |
| `docs/协议化首攻-REPORT.md` | 协议化首攻执行报告（网关 100% 全通 ×3 + 自然对照） |

## 运行

```bash
cd zai

# 1) 签名离线验证（不需要浏览器；预期全 True/match）
python3 sig/verify_sig.py

# 2) 协议提交（dry-run 看 body；--send 真发，需浏览器同款出口）
python3 submit/verify_submit.py submit --cvp sig/verify-success.json
python3 submit/verify_submit.py submit --cvp <你的现场 cvp>.json --send

# 3) 自然对照（浏览器 CDP 9226 已开、目标页已登录态）
bash align/strike_natural.sh
#   按输出推荐值执行：
node align/drag_align3.mjs <L> 12

# 4) 点火力（引用劫持）：需要一个已注入 4-in-1 fixture（或改用自带断点布点法）
#    典型序列：
node ignite/za11_s6a_locate.mjs          # 定位组装点候选
node ignite/za11_hijack2.mjs             # 劫持 + 程序化生成 + 对照
node ignite/za11_s9d_chain.mjs           # S9d 帧内探查（多帧）
```

环境变量：`CDP_PORT`（默认 9226）、`ZAI_PROXY`（默认 `http://127.0.0.1:7890`，`--direct` 可绕）、
`ZAI_OUT`（输出目录）、`ZAI_PYTHON`、`ZAI_R5_SAMPLE`。

## 已知边界与风控事实（务必先读）

- **错误码谱系**：`T001`=通过；`F014`=无初始化记录/位置；`F015`=验证交互不通过；`F001`=风控类
  （经验：同环境 ~3 连 verify → ~10 分钟冷却）。
- **出口属性影响判定**：历史观察「对齐正确仍 F015」疑似出口 IP 属性所致——
  换干净出口/住宅 IP 是本仓库交给第三方实验的**首要变量**。
- **deviceToken 不可离线伪造**：服务端签发、请求时校验——必须由页面侧提供（本模块的浏览器层）。
- **全协议闭环的最后 20%**：`data` 字段的完整离线生成依赖点火式（引用劫持）拿到的组装函数引用；
  S9 已在帧内命中 `ts(op=25, mat)` 产出正确形态（`JRMnXw` 前缀 844 字符）。未完成的验证步骤：
  用点火生成的 data 实际提交 verify 并观察判定（见 `ignite/S9-RESULTS.md` 边界记录）。
- 样本（`sig/`）为历史会话数据（一次性、已过期），仅用于算法验证；环境字段已掩码。

## 验证记录

- 签名：双样本逐字节 match（`sig/verify_sig.py` 直接跑通）。
- 网关层：构造/重放/自然提交 ×4 全部 `Code:"Success"`（业务残差收敛于风控层，见 `docs/协议化首攻-REPORT.md`）。
- 点火式：S9d 命中 `ts(op=25,mat)` → 844 字符 data 形态（见 `ignite/S9-RESULTS.md`）。
