# shumei — 数美滑块 + 注册机（CDP 直连全链）

数美（fengkongcloud.cn）注册流程的自动化实现：
**服务端接受「对齐的 CDP 拖动」**（无深层风控拒绝）→ 不需要协议纯算，完整链路 = 缺口检测 + 人类化对齐拖动 + 表单自动化。

全链已验证（历史记录）：滑块 **2/2 PASS** → 短信 → 两步表单 → `applyTry` **申请成功** → 注册即登录。

## 链路与脚本

按序执行（每一步都假定浏览器 CDP 上停着目标注册页）：

| # | 脚本 | 作用 |
|---|---|---|
| 0 | `sm_rerun1.mjs` | reload 重走：填手机号 → 触发验证码弹层 → 抓题图（**每单必须全新会话**） |
| 1 | `sm_drag3.mjs` | ★ 对齐拖动 v3：缺口检测 + 人类化拖动 + 过程截图 + 全量抓包 |
| 2 | `sm_resend.mjs` | 真实点击「获取验证码」重发 + 抓 `sendsms` |
| 3 | `sm_getmes.mjs` | 读取短信码（配合 `../stealth` 之外的短信工具或手动读取） |
| 4 | `sm_submit.mjs` | second-step 填表（邮箱/公司名）+ 提交 |
| 5 | `sm_submit2.mjs` | 勾选协议（`div.checkbox.unchecked` → `.checked`）+ 再次提交 |

辅助脚本：`sm_recon1/2.mjs`（协议侦察）、`sm_dump1.mjs`/`sm_btn_dump.mjs`（DOM 快照）、
`sm_click_diag.mjs`（点击诊断）、`sm_drag1/2.mjs`（拖动实验版）、`sm_shot.mjs`（截图）、`sm_cont2.mjs`（续跑）。

## 运行

```bash
cd shumei
CDP_PORT=9229 SM_PHONE=<你的手机号> node sm_rerun1.mjs
node sm_drag3.mjs          # 拖动过验证
node sm_resend.mjs         # 发短信
node sm_submit.mjs         # 填表提交
node sm_submit2.mjs        # 勾协议 + 再提交
```

环境变量：
- `SM_PHONE` / `SM_EMAIL` / `SM_COMPANY`：注册表单值（无默认值，必须传入）
- `SM_OUT`：输出目录（默认 `/tmp/non-ali`）
- `CDP_PORT`：浏览器调试端口（默认 9229）

## 已知坑（工程价值）

1. **长会话脏状态**：页面开 ~1 小时后（含多次失败）闭包标志被污染，「继续」点击链路静默失效 ——
   修法 = reload 重走（注册机应每单全新会话）。
2. **协议复选框**：非原生控件（`div.checkbox.unchecked`）；真实鼠标点击后变 `.checked`，**提交前必须勾**。
3. CDP 拖动/点击全链被数美接受（无检测拦截迹象）。
4. 拖动成功映射稳定可复现（历史 122.5px / 210px 两题独立过关）。

## 机制参考（协议链）

```
初始化: POST captcha1.fengkongcloud.cn/ca/v1/log (sendConf) → GET /ca/v1/conf
取题:   GET  /ca/v1/register → detail { bg, fg, k, l, rid }
判定:   GET  /ca/v2/fverify   → {"code":1100,"riskLevel":"PASS"}
提交:   GET  console.ishumei.com/Account/Account/applyTry?rid=...&sign=...&tel=...
        → {"code":1100,"message":"申请成功","content":{"tokenId":"..."}}
```
（`rid` = 本次滑块会话 id，通过后用于换发短信与提交。）
