# halfprotocol-regfarm

人机验证「**半协议层**」注册机 / 打验证研究集。

> **半协议（half-protocol）定义**：利用对验证接口协议的逆向，**直接构造数据提交接口**（而非拖滑块交互）；
> 浏览器的作用仅剩两件事——**提供 token** 与**模拟正常用户环境**。
> 相比全协议模拟（需完整离线伪造设备指纹与签名链），半协议以极低复杂度拿到大部分收益；
> 相比纯自动化拖动，它的触发路径与真实客户端逐字节一致、可离线性复现。

本仓库把 5 个平台/系统的半协议实现在此归档（脱敏、可运行版），并附带一套**全链路伪装工具包**（stealth/）。
每一节都提供可独立运行的管线与机制说明。

---

## 模块一览

| 模块 | 目标平台 | 半协议形态 | 关键机制 | 入口 |
|---|---|---|---|---|
| [`yidun/`](yidun/) | 网易易盾 v2.28.5 滑块 | 协议直打（0 拖动） | 64B 链式自研加密复刻 + 私有 base64 + XOR(token)；离线缺口检测 + 本地轨迹合成 | `node round3-strike/protocol_strike.mjs` |
| [`dingxiang/`](dingxiang/) | 顶象 5.1.53 滑块 | 协议直打（0 拖动，含从零构造） | `ac` 字段流：`[type][len][自研 XOR 加密]` + 私有字母表 base64；字段级重加密 | `bash round3-strike/run_strike.sh` |
| [`shumei/`](shumei/) | 数美 滑块 + 注册 | CDP 直连（服务端接受对齐拖动） | 缺口检测 + 人类化对齐拖动 + 全链表单自动化 | `node sm_rerun1.mjs` → `sm_drag3.mjs` |
| [`sustech-cas/`](sustech-cas/) | 某高校 CAS（aj-captcha 定制版滑块） | 纯坐标协议（无轨迹上报） | AES-128-ECB(secretKey) 两字段构造；get/check/login 同会话 | `node full-chain2.cjs` |
| [`zai/`](zai/) | 阿里云验证码 V2（z.ai 登录/注册） | 半协议 + **点火式**（引用劫持） | HMAC-SHA1 签名复刻；断点劫持组装函数引用 → 程序化生成 `data` | `python3 submit/verify_submit.py check` |
| [`stealth/`](stealth/) | （通用工具包） | 全链路伪装 | 零痕迹条件修补 + 暖场导航 + 指纹体检 + 人性化拖动 | `node reg-init.mjs <url>` |

> 每个模块目录内有独立 README：机制细节、运行依赖、配置项、已知边界。

---

## 快速开始

### 0. 环境要求（通用）

- Node.js ≥ 18（`yidun`/`dingxiang`/`stealth`/`sustech-cas` 用）
- Python 3（`dingxiang` 定位需 `cv2 + numpy`；`zai` 检测需 `Pillow + numpy`；`sustech-cas` 识别需 `cv2 + numpy`）
- 一个可调试的 Chromium 系浏览器（Edge/Chrome），以 `--remote-debugging-port=<PORT>` 启动
  （各模块端口：yidun 无（纯协议）、dingxiang 9231、shumei 9229、sustech-cas 无（纯 HTTP）、zai 9226、stealth 9228）

### 1. 逐模块最小跑法

```bash
# —— 易盾：协议直打（需要先自备 ir 凭据，见 yidun/README.md §凭据）
cd yidun && node round3-strike/protocol_strike.mjs demo1

# —— 顶象：协议直打（浏览器 9231 已开）
cd dingxiang && bash round3-strike/run_strike.sh demo1        # 模板法
MODE=scratch bash round3-strike/run_strike.sh demo2           # 从零构造

# —— 数美：注册重走（浏览器 9229 停在注册页）
cd shumei && SM_PHONE=<你的手机号> node sm_rerun1.mjs && node sm_drag3.mjs

# —— 南科大 CAS：全链（先准备凭据文件）
cd sustech-cas && echo -e "用户名\n密码" > cas-cred.txt && node full-chain2.cjs

# —— z.ai：签名离线校验（先跑通，再谈提交）
cd zai && python3 submit/verify_submit.py check               # 应输出 match=True

# —— 伪装工具包：初始化一个受控会话
cd stealth && CDP_PORT=9228 node reg-init.mjs https://example.com warmup.example.com
```

### 2. 配置一览（全部走环境变量，仓库内无任何凭据）

| 变量 | 用于 | 说明 |
|---|---|---|
| `SM_PHONE` / `SM_EMAIL` / `SM_COMPANY` / `SM_OUT` | shumei | 注册表单值 + 输出目录 |
| `CAS_CRED_FILE` / `CAS_PYTHON` | sustech-cas | 凭据文件路径（默认 `./cas-cred.txt`）/ 识别用 python |
| `CDP_PORT` | dingxiang / shumei / zai / stealth | 浏览器调试端口 |
| `DX_PYTHON` | dingxiang | 定位用 python（需 cv2+numpy，默认 `python3`） |
| `ZAI_PROXY` / `ZAI_OUT` / `ZAI_PYTHON` / `ZAI_R5_SAMPLE` | zai | 出口代理 / 输出目录 / python / 校验样本路径 |

### 3. 浏览器准备

```bash
# Windows 侧（示例）：指定端口 + 独立 profile 启动 Edge
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" \
  --remote-debugging-port=9231 --user-data-dir=%TEMP%\edge-dx-lab "about:blank"
```

各模块对浏览器状态要求不同（目标页已打开/停在特定页面），详见模块 README「运行前提」。

---

## 目录结构

```
halfprotocol-regfarm/
├── yidun/            # 易盾协议直打（管线 + 加密库 + 去混淆产物 + 格式文档）
├── dingxiang/        # 顶象协议直打（管线 + ac 编解码 + run4 模板 + 去混淆产物）
├── shumei/           # 数美注册机（重走/拖过/短信/提交 全脚本集）
├── sustech-cas/      # CAS 滑块（NCC 识别 + 全链登录）
├── zai/              # 阿里云 V2（签名复刻 / 检测器 / 提交器 / 点火力）
├── stealth/          # 全链路伪装工具包（零痕迹修补 + 指纹体检 + humanize）
└── docs/             # 跨模块方法论与机制说明
```

---

## 关于「脱敏」

- 本仓库**不包含任何账号、密码、token、cookie 或订阅凭据**。所有此类值已改为环境变量 / 占位符 / 删除。
- 随附样本（`zai/sig/`、`dingxiang/artifacts/` 等）为研究期间的**历史会话数据**（一次性、已过期），仅用于算法验证与格式参考；样本中的个人环境字段（IP、屏幕参数等）已做掩码。
- 各模块 `REPORT*.md` 为研究过程记录，原样保留技术结论；内部基础设施路径已泛化。
- 第三方 SDK 的反混淆产物（`deob-*.js`）仅作为逆向研究样本随附；原始 SDK 与其版权归各平台所有。

## 免责声明

本项目**仅供网络安全研究、反爬-反反爬技术学习与教学演示使用**。使用者应在自己拥有或获授权的
环境与账号上进行实验，并自行承担因使用本项目产生的一切责任与法律后果。
严禁用于非法侵入、批量化灰产注册或其他违反法律法规的用途。

## 致谢与来源

- 各平台验证码 SDK 的公开前端代码（本仓库的逆向对象）；
- 通用开源组件：`jpeg-js`、`pngjs`（随 `yidun/round3-strike/lib/` 内嵌，MIT / BSD 许可）。

## License

[MIT](LICENSE)
