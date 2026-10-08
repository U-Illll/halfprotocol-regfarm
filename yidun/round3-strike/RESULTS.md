# round3-strike 结果索引（易盾滑块「协议直打」）

**状态：达成完成标准** —— 0 次拖动，本地构造 `data`+`cb` 直发 `/api/v3/check`，**7 次 `result:true`**（其中 6 次纯 node 全链）。
详细报告见 `REPORT-ROUND3.md`；机器可读汇总见 `RESULTS-raw.json`；每轮完整证据见 `runs/<run>/`。

## result:true 记录（时间均 UTC 2026-10-06）

| # | run 目录（证据） | 时间 | token | gapX / p | ir 凭据 | result |
|---|---|---|---|---|---|---|
| 1 | `runs/page1` | 03:47:53 | 9cd30a82823a43f1806f6cd1075ba0e0 | 107 / 33.4375 | 页面取图 | true |
| 2 | `runs/ir1791258507114` | 03:48:28 | ad799f5799a644748d206156e674f14b | 113 / 35.3125 | irToken+fp | true |
| 3 | `runs/strike5` | 03:48:35 | 0e038d96772a41ae9d99f1562d46a714 | 82 / 25.625 | 同上 | true |
| 4 | `runs/strike6-fpempty` | 03:48:44 | dfd8ce18f6b44c86b11b3be40b43ff5f | 153 / 47.8125 | irToken 真+fp 空 | true |
| 5 | `runs/strike7` | 03:48:53 | c626970e5ee04f11a70a05cefeccaac2 | 206 / 64.375 | irtoken.json | true |
| 6 | `runs/strike8-irTokenempty` | 03:49:04 | 4fb68ed312104e35976e28fb198979c6 | 108 / 33.75 | irToken 空+fp 真 | true |
| 7 | `runs/strike10-reuse-after-2min` | 03:49:56 | bc9a11300ec946018bbd8f07ca3858d0 | 104 / 32.5 | 复用（+2min） | true |

## result:false 记录（诊断用）

| run | 时间 | 变量 | result | 结论 |
|---|---|---|---|---|
| `runs/strike1` | 03:45:34 | irToken/fp 全空 | false | 无 ir 凭据必 false |
| `runs/strike1-retry1` | 03:45:4x | 同上 + 真实轨迹模板缩放 | false | 轨迹不是主因 |
| `runs/strike2` | 03:46:55 | irToken/fp 全空 + dragX 偏移修正 | false | 同上 |
| `runs/strike3` | 03:48:19 | 复用页面 dt、irToken/fp 全空 | false | dt 不是关键因子 |
| `runs/strike9-fakefp` | 03:49:10 | 伪造 fp | false | fp 必须是真值 |

## 关键自检证据（tmp/）

| 文件 | 内容 |
|---|---|
| `tmp/evidence_fgen_match.txt` | `f` 原生生成函数（`req(0x38)`）复刻 vs 真实通过样本：281 字符**逐字符一致** |
| `tmp/evidence_gap_detect_selftest.txt` | 离线缺口检测对 3 组已知图复现 83 / 216 / 240（与 round2 页面检测、真实通过 left 对齐） |
| `tmp/evidence_construct_roundtrip.txt` | 本地构造 data 的自检：加密→解密回读（d/p/f/ext/cb 全一致，长度与真实样本一致） |
| `tmp/evidence_probe_dt.txt` | getconf 的 dt 参数规律：随机值 → `param check error`；空值 → 服务端签发 |
| `tmp/evidence_probe_get_empty_irtoken.txt` | v3/get 空 irToken/fp 也能出图拿 token（差异在 check 阶段才体现） |
| `tmp/get_irtoken_probe.json` | irToken/fp 复用探针（A/B/C 三变体均能取图） |
