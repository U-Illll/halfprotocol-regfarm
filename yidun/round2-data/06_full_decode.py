# -*- coding: utf-8 -*-
"""全链路解码：custom-base64 → yd_aes → (内层) 公表base64 → XOR token → 明文"""
import sys, os, json, re
BASE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,BASE)
from yd_crypto import *
from urllib.parse import urlparse, parse_qs

def xor_with_token(s_b64):
    """xorEncode 的逆：s 是公表 base64 → bytes → XOR tokenBytes → utf8 字符串"""
    b = b64_decode_pub(s_b64)
    out = bytes((b[i] ^ (ord(TOKEN[i % len(TOKEN)]) & 0xff)) for i in range(len(b)))
    return out.decode('utf-8', 'replace')

# 采集 token
tokmap = {}
ROOT=os.path.dirname(BASE)
for fn in ('out/yd-net-drag.json','out/yd-net-drag2.json'):
    d=json.load(open(os.path.join(ROOT,fn),encoding='utf-8'))
    for r in d:
        u=r.get('url','')
        if 'api/v3/check' in u:
            q=parse_qs(urlparse(u).query)
            tag = 'drag1' if fn.endswith('drag.json') else 'drag2'
            tokmap[tag]={'token':q['token'][0],'data':q['data'][0],'cb':q.get('cb',[''])[0]}
print('tokens:', {k:v['token'] for k,v in tokmap.items()})

S=json.load(open(os.path.join(BASE,'samples.json'),encoding='utf-8'))
byd={}
for s in S['samples']:
    tag = 'drag1' if 'drag.json' in s['source'] else ('drag2' if 'drag2' in s['source'] else s['source'])
    byd.setdefault(tag,{})[s['field']]=s['raw']

report={}
for tag, fields in byd.items():
    TOKEN = tokmap[tag]['token']
    print('\n' + '#'*100); print('### %s   token=%s' % (tag, TOKEN)); print('#'*100)
    report[tag]={'token':TOKEN,'fields':{}}
    for f in ('d','p','f','ext','cb'):
        if f not in fields: continue
        c = fields[f]
        try:
            mid, meta = yd_aes_decrypt(c)
        except Exception as e:
            print('%-4s AES-FAIL %s' % (f, e)); continue
        info={'outer_len':len(c),'nblk':meta['nblk'],'crc_ok':meta['crc_ok'],'mid':mid}
        try:
            if f in ('d',):
                parts = mid.split(':')
                dec = [xor_with_token(p) for p in parts]
                info['decoded'] = dec
                print('--- %-4s nblk=%-2d 采样点数=%-3d  明文: %s' % (f, meta['nblk'], len(dec), ' | '.join(dec[:8]) + (' ...' if len(dec)>8 else '')))
                print('     前3点: %s' % (dec[:3],))
                print('     后3点: %s' % (dec[-3:],))
            elif f in ('p','f','ext'):
                dec = xor_with_token(mid)
                info['decoded'] = dec
                print('--- %-4s nblk=%-2d  明文: %r' % (f, meta['nblk'], dec[:600]))
            else:
                info['decoded'] = None
                print('--- %-4s nblk=%-2d  mid=%r  (cb 非 xorEncode 通道)' % (f, meta['nblk'], mid))
        except Exception as e:
            info['decoded_err'] = str(e)
            print('--- %-4s 内层解码失败: %s  mid=%r' % (f, e, mid[:120]))
        report[tag]['fields'][f]=info

json.dump(report, open(os.path.join(BASE,'full_decode.json'),'w',encoding='utf-8'), ensure_ascii=False, indent=1)
print('\n[saved] full_decode.json')
