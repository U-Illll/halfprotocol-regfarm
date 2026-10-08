#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""z.ai VerifyCaptchaV3 协议提交器 (P2)
复用: verify_sig.py 的 rZ / HMAC-SHA1 规则 (对齐 r5 成功样本)
用法:
  python3 verify_submit.py check                     # 离线校验: 用 9/29 key 重算 r5 成功样本签名
  python3 verify_submit.py submit --cvp FILE [--key-file FILE] [--send] [--direct]
    --cvp       cvp JSON 文件 (或 {full:"..."} 包装) — 现场抓取产物
    --key-file  live-key.json (现场 __R4 HMAC 抓取的 key) ; 缺省用 9/29 key
    --send      真发 (默认 dry-run)
    --direct    直连 (默认走 127.0.0.1:7890 与浏览器同分流)
"""
import json, hmac, hashlib, base64, urllib.parse, uuid, sys, os, time

URL = 'https://no8xfe-verify.captcha-open-southeast.aliyuncs.com/'
R5 = os.environ.get('ZAI_R5_SAMPLE', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sig', 'verify-success.json'))
PROXY = os.environ.get('ZAI_PROXY', 'http://127.0.0.1:7890')  # 与浏览器同分流；env 可改
OUT_DIR = os.environ.get('ZAI_OUT', '/tmp/zai-recon-4')
KEY_9_29 = '222aiJodos2938JDdosko2djd82sf0&'   # hook2-log (2026-09-29)
AADUANE_9_29 = '111jdk439dJJIjd023823201'

def rZ(t):
    if t is None:
        return None
    return urllib.parse.quote(str(t), safe="!~*'()-_.")

def calc_sig(raw_params: dict, key: str):
    keys = sorted(raw_params.keys())
    i2 = '&'.join(rZ(k) + '=' + rZ(raw_params[k]) for k in keys)
    h = 'POST&' + rZ('/') + '&' + rZ(i2)
    sig = base64.b64encode(hmac.new(key.encode(), h.encode(), hashlib.sha1).digest()).decode()
    return sig, h

def check():
    d = json.load(open(R5))
    p = d['params']
    sig_sample = urllib.parse.unquote(p['Signature'])
    raw = {k: urllib.parse.unquote(str(v)) for k, v in p.items() if k != 'Signature'}
    print('[check] 参数量:', len(raw), '| 样本 sig:', sig_sample[:30])
    for label, key in [('raw', KEY_9_29), ('strip-&', KEY_9_29.rstrip('&'))]:
        sig, h = calc_sig(raw, key)
        ok = (sig == sig_sample)
        print(f"[check] key({label}, len={len(key)}, head={key[:12]}) -> sig={sig[:30]} match={ok}")
        if not ok:
            for j in range(min(len(sig), len(sig_sample))):
                if sig[j] != sig_sample[j]:
                    print(f"        first diff at {j}: mine={sig[j]!r} sample={sig_sample[j]!r}")
                    break
    print('[check] r5 resp 成功标记: VerifyResult=true, Code=Success (文件名即证据)')

def load_cvp(path):
    d = json.load(open(path))
    if isinstance(d, dict) and 'full' in d and isinstance(d['full'], str):
        d = json.loads(d['full'])
    return d

def submit(cvp_path, key_path=None, send=False, direct=False):
    cvp = load_cvp(cvp_path)
    key = KEY_9_29
    if key_path and os.path.exists(key_path):
        kd = json.load(open(key_path))
        key = kd.get('key') or key
        print('[submit] 使用现场 key (len %d, head %s)' % (len(key), key[:12]))
    aaduane = AADUANE_9_29
    kf = os.path.join(os.path.dirname(os.path.abspath(cvp_path)), 'live-aaduane.txt')
    if os.path.exists(kf):
        aaduane = open(kf).read().strip()
        print('[submit] 使用现场 AaduaneId:', aaduane[:16], '...')
    print('[submit] cvp keys:', list(cvp.keys()))
    print('[submit] sceneId:', cvp.get('sceneId'), '| certifyId:', cvp.get('certifyId'))
    print('[submit] deviceToken len:', len(cvp.get('deviceToken', '')), '| data len:', len(cvp.get('data', '') or ''))
    cvp_str = json.dumps(cvp, ensure_ascii=False, separators=(',', ':'))
    raw = {
        'AaduaneId': aaduane,
        'SignatureMethod': 'HMAC-SHA1',
        'SignatureVersion': '1.0',
        'Format': 'JSON',
        'Timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'Version': '2023-03-05',
        'Action': 'VerifyCaptchaV3',
        'SceneId': cvp.get('sceneId'),
        'CertifyId': cvp.get('certifyId'),
        'CaptchaVerifyParam': cvp_str,
        'SignatureNonce': str(uuid.uuid4()),
    }
    sig, h = calc_sig(raw, key)
    params = dict(raw)
    params['Signature'] = sig
    body = '&'.join(rZ(k) + '=' + rZ(v) for k, v in params.items())  # 与签名同编码规则
    print('[submit] body len:', len(body), '| sig head:', sig[:20])
    print('[submit] [DRY-RUN] body 前 260:', body[:260])
    if not send:
        print('[submit] dry-run。加 --send 真发。')
        return
    from urllib.request import Request, build_opener, ProxyHandler
    if direct:
        opener = build_opener(ProxyHandler({}))
        print('[submit] 直连发送')
    else:
        opener = build_opener(ProxyHandler({'http': PROXY, 'https': PROXY}))
        print('[submit] 走代理', PROXY, '(与浏览器同分流)')
    req = Request(URL, data=body.encode(), method='POST')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.4258.48')
    t0 = time.time()
    try:
        r = opener.open(req, timeout=30)
        resp = r.read().decode()
        print(f'[submit] HTTP {r.status} in {time.time()-t0:.2f}s')
        print('[submit] resp:', resp[:700])
        outp = os.path.join(OUT_DIR, 'verify-submit-resp-%d.json' % int(t0))
        open(outp, 'w').write(resp)
        print('[submit] 响应存档:', outp)
    except Exception as e:
        body_err = ''
        try:
            body_err = e.read().decode()[:400]
        except Exception:
            pass
        print('[submit] ERR:', e, '| body:', body_err)

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'check'
    if cmd == 'check':
        check()
    elif cmd == 'submit':
        import argparse
        ap = argparse.ArgumentParser()
        ap.add_argument('--cvp', required=True)
        ap.add_argument('--key-file')
        ap.add_argument('--send', action='store_true')
        ap.add_argument('--direct', action='store_true')
        a = ap.parse_args(sys.argv[2:])
        submit(a.cvp, a.key_file, a.send, a.direct)
    else:
        print('unknown cmd:', cmd)
