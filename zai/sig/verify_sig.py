"""签名算法端到端复刻验证（feilin rX/r1/rZ 规则）

对 hook2-log.json 中全部 HMAC.finalize 样本做三步验证：
  1) 从捕获的 message（h）反解出原始 kv 参数；
  2) 用 rZ 规则重拼 message，比对与捕获逐字符一致；
  3) 用捕获 key 重算 HMAC-SHA1 digest(hex)，比对捕获结果。
预期输出：两条样本均 `h recomputed == hook h: True` 且 `sig full match: True`。
"""
import json, hmac, hashlib, base64, urllib.parse, os

HERE = os.path.dirname(os.path.abspath(__file__))
log = json.load(open(os.path.join(HERE, 'hook2-log.json')))


def rZ(t):
    if t is None:
        return None
    s = urllib.parse.quote(str(t), safe="!~*'()-_.")
    return s


samples = [e for e in log
           if e.get('fn') == 'HMAC.finalize' and str(e['args'][1]).startswith('POST')]
print(f'[i] HMAC 样本数: {len(samples)}')

ok_all = True
for i, e in enumerate(samples):
    h_hook = str(e['args'][1])
    key_hook = str(e['args'][0])
    sig_hook_hex = str(e['res'])[3:]  # 去掉 "WA:" 前缀
    print(f'\n== 样本 {i + 1} ==')
    print('h len:', len(h_hook), '| key:', repr(key_hook))
    print('h head:', repr(h_hook[:60]))

    # 1) h → 反向解出原始 kv
    assert h_hook.startswith('POST&%2F&'), '不认识的 message 头'
    i_enc = h_hook[len('POST&%2F&'):]
    i_str = urllib.parse.unquote(i_enc)
    kv_raw = {}
    for seg in i_str.split('&'):
        k, _, v = seg.partition('=')
        kv_raw[urllib.parse.unquote(k)] = urllib.parse.unquote(v)
    print('recovered params:', sorted(kv_raw.keys()))

    # 2) 重算 h
    keys = sorted(kv_raw.keys())
    i2 = '&'.join(rZ(k) + '=' + rZ(kv_raw[k]) for k in keys)
    h2 = 'POST&' + rZ('/') + '&' + rZ(i2)
    match_h = (h2 == h_hook)
    print('h recomputed == hook h:', match_h)

    # 3) 签名
    sig = hmac.new(key_hook.encode(), h2.encode(), hashlib.sha1).digest().hex()
    match_sig = (sig == sig_hook_hex)
    print('sig(hex) recomputed:', sig[:24], '...')
    print('sig(hex) hook      :', sig_hook_hex[:24], '...')
    print('sig full match:', match_sig)
    ok_all = ok_all and match_h and match_sig

print('\n===== 总结:', 'ALL PASS' if ok_all else 'FAIL', '=====')
raise SystemExit(0 if ok_all else 1)
