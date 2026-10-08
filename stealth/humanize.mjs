// humanize.mjs — 人性化输入原语（stealth-kit）
// 从 B 轨实战抽取：eased 拖动轨迹（cubic ease-out + 微抖动 + 步间节奏）。
// 用法（在你的 CDP 脚本内）：
//   import { dragEased } from './humanize.mjs';
//   await dragEased(send, sleep, { x: cx, y: cy, delta: 205 });
// 约定：send(method, params) 与 sleep(ms) 由调用方注入（保持零依赖）。

export async function dragEased(send, sleep, { x, y, delta, stepMs = 38, stepPx = 8, jitterY = 1.6 } = {}) {
  // 接近 → 按下 → 缓动拖移（cubic ease-out）→ 松手
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await sleep(160);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(120);
  const steps = Math.max(20, Math.round(Math.abs(delta) / stepPx));
  let cx = x;
  for (let i = 1; i <= steps; i++) {
    const p = i / steps;
    const eased = 1 - Math.pow(1 - p, 3);
    cx = x + delta * eased;
    const yy = y + (Math.random() - 0.5) * jitterY;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: yy, button: 'left', buttons: 1 });
    await sleep(stepMs + Math.random() * 8);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + delta, y, button: 'left', buttons: 1 });
  await sleep(80);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + delta, y, button: 'left', clickCount: 1 });
}
