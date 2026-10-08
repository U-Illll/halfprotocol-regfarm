# -*- coding: utf-8 -*-
"""尾字符 '7' 专题：padding 假设的数学检验 + 可证伪预测"""
import sys, os, json
BASE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,BASE)
from yd_crypto import *

PAD='7'
def pred_padcount(nbytes):
    """自定义 base64（无 padding 时 4*ceil(n/3) 字符），padding 数 = 补足 4 的倍数"""
    return (4 - (nbytes % 3) * 4 % 4) % 4 if False else ((3 - nbytes % 3) % 3)

def tail7_analysis(cipher):
    n = len(cipher) - cipher.count(PAD) - 0
    # 先统计尾部连续 '7'
    t = 0
    for ch in reversed(cipher):
        if ch == PAD: t += 1
        else: break
    raw = b64_decode_private(cipher)
    return {'chars': len(cipher), 'trail_pad': t, 'bytes': len(raw),
            'nblk': (len(raw)-4)//64, 'pred_pad': pred_padcount(len(raw)),
            'len_mod4': len(cipher) % 4}

print('='*104)
print('A) 真实样本：长度模型 n = 4 + 64k 与 padding 数的一致性')
print('='*104)
S=json.load(open(os.path.join(BASE,'samples.json'),encoding='utf-8'))
print('%-10s %-6s %-7s %-7s %-6s %-9s %-8s' % ('field','chars','trail7','bytes','k','pred_pad','OK'))
allok=True
for s in S['samples']:
    a=tail7_analysis(s['raw'])
    ok = (a['trail_pad']==a['pred_pad']) and (a['bytes']-4)%64==0 and a['len_mod4']==0
    allok &= ok
    print('%-10s %-6d %-7d %-7d %-6d %-9d %-8s' % (s['field'], a['chars'], a['trail_pad'], a['bytes'], a['nblk'], a['pred_pad'], '✅' if ok else '❌'))
print('>>> 全部一致:', allok)

print()
print('='*104)
print("B) 可证伪预测：k ≡ 2 (mod 3) ⇒ 密文尾字符 ≠ '7' 且无 padding")
print('    n=4+64k, k≡2 mod3 ⇒ n≡0 mod3 ⇒ padding=0')
print('='*104)
import random
hits=0
rows=[]
for trial in range(24):
    k_target = trial % 6                       # 覆盖 k%3 ∈ {0,1,2}
    if k_target == 0: k_target = 3             # k 至少 1
    if k_target == 2: k_target = 2
    # 构造明文长度使块数 = k_target
    # M = plain+8 ; padlen 使 M+padlen+4 = 64k  → 随机挑 M 使其落入
    for _try in range(200):
        plen = random.randrange(0, 400)
        M = plen + 8
        padlen = (64 - M % 64 - 4) if (M % 64 <= 60) else (128 - M % 64 - 4)
        if (M + padlen + 4)//64 == k_target: break
    msg = 'a'*plen
    c = yd_aes_encrypt(msg)
    a = tail7_analysis(c)
    pred_last = (a['pred_pad'] > 0)
    rows.append((k_target, len(c), a['nblk'], a['pred_pad'], c[-1]))
print('%-4s %-8s %-6s %-8s %-8s' % ('k','chars','nblk','pred_pad','lastchar'))
seen=set()
for r in rows:
    key=(r[0]%3, r[3]>0)
    if key in seen: continue
    seen.add(key)
    print('%-4d %-8d %-6d %-8d %-8s' % r)
print()
k2 = [r for r in rows if r[0]%3==2]
k0 = [r for r in rows if r[0]%3==0]
k1 = [r for r in rows if r[0]%3==1]
def lastset(rs): return sorted(set(r[4] for r in rs))
print('k%3==0 (期望 2 个 7):  末字符集合 =', lastset(k0), ' 样本数', len(k0))
print('k%3==1 (期望 1 个 7):  末字符集合 =', lastset(k1), ' 样本数', len(k1))
print('k%3==2 (期望无 7):     末字符集合 =', lastset(k2), ' 样本数', len(k2))
print()
print(">>> 预测检验：k%3==2 时末字符应 != '7'；实测 =", all(r[4] != '7' for r in k2))
print(">>> 预测检验：k%3!=2 时末字符应 == '7'；实测 =", all(r[4] == '7' for r in k0+k1))
