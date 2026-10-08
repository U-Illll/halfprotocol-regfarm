# -*- coding: utf-8 -*-
import sys, os, json
BASE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,BASE)
from yd_crypto import *

S=json.load(open(os.path.join(BASE,'samples.json'),encoding='utf-8'))
repo={}
for s in S['samples']:
    srcdir = s['source']
    key = srcdir.split('/')[1].replace('yd-net-','').replace('.json','').replace('check-request-full.txt','drag1').replace('check2-request-full.txt','drag2')
    repo.setdefault(key,{})[s['field']] = s['raw']

results={}
for run, fields in sorted(repo.items()):
    print('='*100)
    print('### RUN:', run)
    results[run]={}
    for f, c in sorted(fields.items()):
        try:
            plain, meta = yd_aes_decrypt(c)
            results[run][f]={'ok':True,'plain':plain,'meta':meta}
            print('--- %-4s len=%-4d cipher_bytes=%-4d nblk=%-2d crc=%-5s' % (f, len(c), meta['cipher_bytes'], meta['nblk'], meta['crc_ok']))
            print('    PLAIN:', plain[:1200])
        except Exception as e:
            results[run][f]={'ok':False,'err':str(e)}
            print('--- %-4s len=%-4d  FAILED: %s' % (f, len(c), e))
    print()
json.dump(results, open(os.path.join(BASE,'decrypted.json'),'w',encoding='utf-8'), ensure_ascii=False, indent=1, default=str)
print('[saved] decrypted.json')
