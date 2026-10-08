#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""探测 /api/a 是否可直连（不依赖浏览器）"""
import json, random, time, urllib.request, urllib.parse, sys

AK = "99de95ad1f23597c23b3558d932ded3c"
C = "6ac45e92ZNi9AwoH4hzRvN7PogivypXxvRczR8d1"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0"

def main():
    ts = int(time.time() * 1000)
    aid = "dx-%d-%d-%d" % (ts, random.randint(1000000, 99999999), 3)
    q = {
        'w': '380', 'h': '165', 's': '50', 'ak': AK, 'c': C, 'jsv': '5.1.53',
        'aid': aid, 'wp': '1', 'de': '0', 'uid': '', 'lf': '0', 'tpc': '', 't': '',
        'cid': '74729939', '_r': '%.17f' % random.random(),
    }
    url = 'https://cap.dingxiang-inc.com/api/a?' + urllib.parse.urlencode(q)
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Referer': 'https://www.dingxiang-inc.com/',
        'Accept': '*/*',
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            body = r.read()
            print('HTTP', r.status)
            print(body.decode('utf-8', 'replace')[:800])
            open('out/probe-apia.json', 'wb').write(body)
    except Exception as e:
        print('ERR', type(e).__name__, e)
        if hasattr(e, 'read'):
            print(e.read().decode('utf-8','replace')[:500])

main()
