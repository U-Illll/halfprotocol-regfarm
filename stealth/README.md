# stealth — 全链路伪装工具包

从实战（注册机自动化）提炼的通用环境伪装与浏览器操作工具集。
哲学：**真机环境 = 最好的伪装**——所有补丁仅在**环境异常时条件生效**，
干净环境上零改动、零痕迹遗留；一切「无条件硬覆盖」（伪造插件数 / 硬件参数等）都会留下
self-property 痕迹，是反检测，通用场景禁止使用。

## 组件

| 文件 | 作用 | 用法 |
|---|---|---|
| `stealth-core.js` | 零痕迹注入核心（webdriver / chrome / 自动化残留 三件套条件修补） | 由 reg-init 自动注入；也可手动 `Page.addScriptToEvaluateOnNewDocument` |
| `reg-init.mjs` | 初始化器：注入 → 暖场导航 → 目标页 → 就绪探测 → 截图 | `CDP_PORT=9228 node reg-init.mjs <target-url> [warmup1,warmup2]` |
| `fpcheck.mjs` | 指纹体检（输出 JSON，可跨会话对比基线） | `CDP_PORT=9228 node fpcheck.mjs [urlMatch] [outFile]` |
| `humanize.mjs` | 人性化输入原语：eased 拖动轨迹（cubic ease-out + 抖动 + 节奏） | 库：`import { dragEased } from './humanize.mjs'` |
| `click-text.mjs` | 按文本查找元素并真实点击 | `node click-text.mjs <文本>` |
| `dump-form.mjs` | 表单结构快照（输入框/按钮/属性） | `node dump-form.mjs` |
| `gt-*.mjs` | 极验（geetest）控件触发/诊断系列（点击链实验） | 见各文件头部注释 |
| `pw-lab/` | patchright A/B 实验（connectOverCDP 探测 + 协议抓取） | 结论：**不接入主链路**（默认 evaluate 走 isolated world，读数失真） |

## 关键纪律（实战总结）

1. 拖动前焦点三件套：窗口 normal + `Page.bringToFront` + `Emulation.setFocusEmulationEnabled`。
2. CDP 合成鼠标事件（`Input.dispatchMouseEvent`）在多数站点有效；
   但 React 场景的 DOM 点击用 `element.click()` 更稳（合成事件偶发被忽略）。
3. 改网络出口/代理前：备份配置 + 校验 + 重载。
4. `humanize.mjs` 的 `dragEased(ws, {from, to, duration})` 提供 eased 轨迹——先冒烟再上真目标
   （`pw-lab/smoke-humanize.mjs`）。

## 运行

```bash
cd stealth
# 初始化一个受控会话（注入 + 暖场 + 目标页 + 截图）
CDP_PORT=9228 node reg-init.mjs "https://example.com/register" "https://example.com"
# 指纹体检
CDP_PORT=9228 node fpcheck.mjs
```

运行前提：浏览器以 `--remote-debugging-port=9228` 启动；clean profile 效果最佳。
