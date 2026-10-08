#!/usr/bin/env python3
"""replay_vip.py — 原样重放被拦截的请求（vip-capture.json），观察服务器真实响应"""
import json, os, sys, time
from urllib.request import Request, build_opener, ProxyHandler

CAP = os.environ.get('ZAI_CAPTURE', '/tmp/zai-recon-4/vip-capture.json')  # 拦截 hook 落盘的捕获文件
PROXY = os.environ.get('ZAI_PROXY', 'http://127.0.0.1:7890')
OUT_DIR = os.environ.get('ZAI_OUT', '/tmp/zai-recon-4')
cap = json.load(open(CAP))
idx = int(sys.argv[1]) if len(sys.argv) > 1 else -1
it = cap[idx]
age_s = time.time() - it['t'] / 1000.0 if it['t'] > 1e12 else -1
print('[replay] capture age: %.1f s' % age_s)
print('[replay] url =', it['url'])
print('[replay] method =', it.get('method'), '| body len =', it['len'])
body = it['body'].encode()
opener = build_opener(ProxyHandler({'http': PROXY, 'https': PROXY}))
req = Request(it['url'], data=body, method='POST')
req.add_header('Content-Type', 'application/x-www-form-urlencoded')
req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.4258.48')
t0 = time.time()
try:
    r = opener.open(req, timeout=30)
    resp = r.read().decode()
    print(f'[replay] HTTP {r.status} in {time.time()-t0:.2f}s')
    print('[replay] resp:', resp[:800])
    open(os.path.join(OUT_DIR, 'replay-resp-%d.json' % int(t0)), 'w').write(resp)
    print('[replay] 响应已存', os.path.join(OUT_DIR, 'replay-resp-%d.json' % int(t0)))
except Exception as e:
    body_err = ''
    try:
        body_err = e.read().decode()[:500]
    except Exception:
        pass
    print('[replay] ERR:', e, '| body:', body_err)
