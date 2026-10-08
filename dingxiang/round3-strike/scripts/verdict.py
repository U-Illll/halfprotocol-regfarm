#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""verdict.py — 直打结果判读：读 out/strike-<tag>.json（或 logs/strike.jsonl 末行）
用法: python3 verdict.py [--tag TAG] [--jsonl]
输出: 一行结论 + 退出码（0=success, 1=fail）
"""
import argparse, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tag', default=None)
    ap.add_argument('--jsonl', action='store_true', help='直接用 logs/strike.jsonl 最后一行')
    a = ap.parse_args()

    if a.jsonl or not a.tag:
        path = os.path.join(ROOT, 'logs', 'strike.jsonl')
        rec = json.loads(open(path, encoding='utf-8').read().strip().split('\n')[-1])
    else:
        path = os.path.join(ROOT, 'out', 'strike-%s.json' % a.tag)
        rec = json.load(open(path, encoding='utf-8'))

    resp = rec.get('resp')
    if resp is None:
        try:
            resp = json.loads(rec.get('resp_raw') or '{}')
        except Exception:
            resp = {}
    ok = bool(resp.get('success'))
    tok = resp.get('token') or ''
    print('VERDICT tag=%s mode=%s x=%s y=%s http=%s success=%s msg=%s token=%s' % (
        rec.get('tag'), rec.get('mode'), rec.get('x'), rec.get('y'), rec.get('http_status'),
        ok, resp.get('msg'), (tok[:24] + '…') if tok else '-'))
    if not ok:
        print('RESP_RAW: ' + str(rec.get('resp_raw'))[:400])
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
