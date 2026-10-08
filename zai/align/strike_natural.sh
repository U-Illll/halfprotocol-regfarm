#!/bin/bash
# strike_natural.sh — 自然提交对照 SOP（干净目标 → 取图 → 检测 → 确认 L → 对齐拖动 + CDP 捕获）
# 前提: 浏览器 CDP 端口可连（CDP_PORT，默认 9226）；
#       同一出口的 F001 冷却已过（经验值 ~10 分钟）。
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
export CDP_PORT="${CDP_PORT:-9226}"

echo "===== [1/3] $(date +%H:%M:%S) 开新 target (BARE, 无 hook 无拦截) ====="
node "$HERE/fresh_target.mjs" bare

echo "===== [2/3] $(date +%H:%M:%S) 取图 + 缺口检测 ====="
node "$HERE/fetch_imgs.mjs"
"${ZAI_PYTHON:-python3}" "$HERE/../detect/gap_detect_puzzle.py" | tail -3

echo "===== [3/3] $(date +%H:%M:%S) 用上方推荐的 L 运行（观察 12s 捕获 verify 请求/响应）： ====="
echo "node $HERE/drag_align3.mjs <L> 12"
