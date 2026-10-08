# sustech-cas — 高校 CAS 滑块「纯坐标协议」全链

某高校统一认证（CAS, aj-captcha / anji-plus 定制版滑块）的完整攻克实现：
**滑块识别 + 协议提交 + 登录链 SSO**，全进程一气呵成（<10 秒）。

> aj-captcha 定制版特征：`/captcha/api/get` 取图 + `/captcha/api/check` 提交**纯坐标**（**无轨迹上报**），
> AES-128-ECB（key = 每次响应的 `secretKey`）。

## 机制摘要

- **识别**：1D NCC 条带扫描（jig 是竖条裁剪 → y 不变、x 滑窗做归一化互相关）。
  历史置信分布：0.97 / 0.93 / 0.86（正解）vs ≤0.4（错误位置）——**NCC>0.7 极稳**，<0.35 直接重取图。
- **协议**：
  - `pointJson = AES128ECB({"x":<x>,"y":5}, secretKey)`
  - `captchaVerification = AES128ECB("<token>---{\"x\":<x>,\"y\":5}", secretKey)` → 填入登录表单 `g-recaptcha-response`
- **会话一致性（大头坑）**：`/api/get` → `/api/check` → 登录 POST 必须**同一 cookie jar**（跨会话 = "验证码无效"）。
- **token 短时效**：get 到 check 必须秒级；SSO ticket 同样秒级（全链必须一个进程内完成）。
- **proceed 坑**：密码 POST 后可能出现「认证警告」中间页 → 需再 POST `_eventId=proceed&continue=继续`。

## 运行

```bash
cd sustech-cas
# 1) 准备凭据文件（两行：用户名 / 密码）
echo -e "USERNAME\nPASSWORD" > cas-cred.txt
# 2) 识别脚本依赖
python3 -m pip install opencv-python numpy
# 3) 全链
node full-chain2.cjs            # 完整登录
node full-chain2.cjs --fresh    # 强制忽略缓存的 TGC 重登
```

环境变量：
- `CAS_CRED_FILE`：凭据文件路径（默认 `./cas-cred.txt`，格式=第一行用户名、第二行密码）
- `CAS_PYTHON`：识别用 python（需 cv2；默认 `python3`）

产物：`/tmp/cas-captcha-recon/`（会话 jar、取题响应、识别结果、诊断截图）。

## 目录

| 路径 | 内容 |
|---|---|
| `full-chain2.cjs` | ★ 全链：滑块（get→识别→check）+ 登录 + SSO（TGC 复用快速路径 + 完整登录） |
| `identify-core.py` | 1D NCC 缺口识别（读 `get-resp2.json`，写 `pending-point.json` + overlay 可视化） |
| `cas-cred.txt` | **不入库**（.gitignore），自行创建 |

## 已知边界

- 滑块是**临时风控窗口**触发的（由高频登录触发，窗口内全站登录强制滑块；窗口后自动恢复）——
  没有风控窗口时此脚本会跳过滑块步骤。
- 登录链止于 SSO 会话建立（TGC/`s_session_id` 落盘）；业务请求（下载/查询）由调用方自行发起。
- 本模块面向**自有账号**的自动化登录研究；请勿用于非授权场景。

## 验证记录（历史）

- 滑块识别：NCC 0.97/0.93/0.86 三连正解；服务端 `success:true`。
- 全链：cas 登录 → TGC → SSO → BB cookies 全绿（详情见模块内注释与 `README` 历史版本）。
