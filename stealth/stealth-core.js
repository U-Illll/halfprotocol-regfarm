(() => {
  'use strict';
  // stealth-core.js — 通用"零痕迹"环境加固（stealth-kit · 2026-10-03）
  // 哲学（B 轨实践定稿）：真机环境 = 最好的伪装。本脚本只在【环境异常】时做条件修补，
  // 干净环境上零改动、零类痕迹遗留。任何"无条件硬覆盖"（如伪造插件数/硬件参数）都会留下
  // self-property 痕迹，是反检测。通用场景请勿添加硬覆盖；平台专属需求另行分层。
  //
  // 用法：Page.addScriptToEvaluateOnNewDocument({ source: <本文件全文> })
  //   —— 确保在页面任何脚本之前生效（对所有后续导航/iframe）。

  // 1) navigator.webdriver — 仅当异常为 true 时修补（原生真机 Edge 为 false，不动）。
  try {
    if (navigator.webdriver === true) {
      Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
    }
  } catch (e) {}

  // 2) window.chrome backstop — Chromium/Edge 恒有；仅缺失时填充。
  try {
    if (!window.chrome) {
      const now = Date.now();
      window.chrome = {
        app: {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        },
        runtime: {},
        csi: () => ({ onloadT: now, startE: now, tran: 15 }),
        loadTimes: () => ({}),
      };
    }
  } catch (e) {}

  // 3) 防御性清除常见自动化残留（裸 Edge 会话上为 no-op）。
  try {
    for (const k of ['__playwright__binding__', '__pwInitScripts', '__puppeteer_utility_world__']) {
      if (k in window) { try { delete window[k]; } catch (e) {} }
    }
  } catch (e) {}
})();
