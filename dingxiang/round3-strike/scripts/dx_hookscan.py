#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""dx_hookscan.py — 扫描 round2-hook 记录，找字段级明文线索（app/process/sendSA/type 参数）
用法: python3 dx_hookscan.py <file.json> [pattern]
"""
import json, sys, re

p = sys.argv[1]
pat = re.compile(sys.argv[2] if len(sys.argv) > 2 else r'app|sendSA|process|recordSA|getSC|type', re.I)
d = json.load(open(p, encoding='utf-8'))
print('type=%s len=%s' % (type(d).__name__, len(d)))


def walk(o, depth=0, path='$'):
    if depth > 4:
        return
    if isinstance(o, dict):
        keys = list(o.keys())
        if depth == 0:
            print('sample keys:', keys[:25])
        for k in keys[:30]:
            v = o[k]
            if isinstance(v, (dict, list)):
                walk(v, depth + 1, path + '.' + str(k))
            else:
                s = str(v)
                if pat.search(s) and len(s) < 400:
                    print('%s.%s = %s' % (path, k, s[:300]))
    elif isinstance(o, list):
        for i, v in enumerate(o[:6]):
            walk(v, depth + 1, '%s[%d]' % (path, i))


walk(d)
