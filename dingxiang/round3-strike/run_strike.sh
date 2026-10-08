#!/usr/bin/env bash
# run_strike.sh — 顶象滑块「协议直打」一键入口
#   页面采集（干净新标签→点验证条→取题/canvas/缺口定位） → 离线构造 ac+form → POST /api/v1 → 判读
#   全程零拖动；POST 每次记 logs/strike.jsonl
# 用法:
#   ./run_strike.sh [TAG]            默认 TAG=S<HHMMSS>
#   MODE=scratch ./run_strike.sh J9  从零构造模式（dx_from_scratch.py，全字段重加密）
#   CDP_PORT=9231 ./run_strike.sh I1 端口默认 9231
# 依赖: node(>=18) / python3(需 cv2, 可用 DX_PYTHON 指定) / 浏览器 CDP 9231 已开
set -euo pipefail
export CDP_PORT="${CDP_PORT:-9231}"
MODE="${MODE:-full}"
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
TAG="${1:-S$(date +%H%M%S)}"

echo "== [1/3] 页面采集: TAG=$TAG MODE=$MODE (端口 $CDP_PORT, 零拖动) =="
node scripts/dx_strike_page.mjs "$TAG"

echo "== [2/3] 离线构造 + 直发 POST ($MODE) =="
if [ "$MODE" = "scratch" ]; then
  python3 scripts/dx_from_scratch.py --ctx "out/ctx-${TAG}.json" --tag "${TAG}-z"
else
  python3 scripts/dx_strike.py --ctx "out/ctx-${TAG}.json" --tag "${TAG}-a"
fi

echo "== [3/3] 判读 =="
if [ "$MODE" = "scratch" ]; then VTG="${TAG}-z"; else VTG="${TAG}-a"; fi
if python3 scripts/verdict.py --tag "$VTG"; then
  echo "== STRIKE OK: $TAG ($MODE) =="
else
  echo "== STRIKE FAIL: $TAG ($MODE)（看 out/strike-${VTG}.json / ctx-${TAG}.log） =="
  exit 1
fi
