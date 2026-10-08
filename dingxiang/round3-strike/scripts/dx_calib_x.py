#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""x 口径校准：对 run1-4 的题图离线重定位，与实际提交的 x 对照。
结论口径：x_form = round(canvas_x * 0.95)  (canvas=400x200 → CSS=380x165)
"""
import json, os, subprocess, sys, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
SAMPLES = os.path.join(ROOT, 'round2-hook/samples')
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../out/calib'))
IMG_BASE = 'https://static4.dingxiang-inc.com/picture'
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0"
os.makedirs(OUT, exist_ok=True)


def fetch(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = r.read()
    open(path, 'wb').write(data)
    return path


def apia_of(run):
    net = json.load(open(os.path.join(SAMPLES, run, 'net.json'), encoding='utf-8'))
    for r in net:
        u = r.get('url', '')
        if '/api/a?' in u and '99de95ad1f23597c23b3558d932ded3c' in u:
            b = r.get('body')
            d = json.loads(b) if isinstance(b, str) else b
            return d
    return None


def post_of(run):
    net = json.load(open(os.path.join(SAMPLES, run, 'net.json'), encoding='utf-8'))
    import urllib.parse
    for r in net:
        if r.get('url', '').endswith('/api/v1'):
            return urllib.parse.parse_qs(r.get('postData') or '', keep_blank_values=True)
    return None


def main():
    res = {}
    for run in ['run1', 'run2', 'run3', 'run4']:
        d = apia_of(run)
        post = post_of(run)
        if not d:
            continue
        y = d.get('y'); p1 = d.get('p1'); p2 = d.get('p2')
        bg = fetch(IMG_BASE + p1, os.path.join(OUT, run + '-bg.webp'))
        fr = fetch(IMG_BASE + p2, os.path.join(OUT, run + '-frag.webp'))
        jout = os.path.join(OUT, run + '-locate.json')
        subprocess.run([sys.executable, os.path.join(ROOT, 'round2-hook/locate.py'),
                        '--canvas', bg, '--frag', fr, '--y-api', str(y), '--out', jout], check=True,
                       stdout=subprocess.DEVNULL)
        loc = json.load(open(jout))
        top = loc['chamfer_top'][0]
        entry = {
            'run': run, 'y_api': y, 'p1': p1, 'p2': p2,
            'canvas_x': top['x'], 'canvas_y': top['y'],
            'ui_x': top['ui_x'], 'ui_y': top['ui_y'],
            'x_recorded': int(post['x'][0]) if post else None,
            'y_recorded': int(post['y'][0]) if post else None,
            'delta_recorded': post['x'][0] if post else None,
        }
        entry['x_err'] = (entry['x_recorded'] - entry['ui_x']) if entry['x_recorded'] is not None else None
        res[run] = entry
        print(json.dumps(entry, ensure_ascii=False))
    json.dump(res, open(os.path.join(OUT, 'summary.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
