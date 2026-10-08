#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""dx_from_scratch.py — 顶象直打·从零构造试验（不复制 run4 模板的任何密文字节）
做法:
  1) 字段清单（顺序/类型）与 5949 源码 app() 调用点一致：8,15,6,18,4,14,1,9,16,10,3,4,3,4,7×35,12
  2) 每个字段的明文全部重新生成后，用 dx_fields 重新加密：
     - 会话相关（自建）: t8=tm, t9=sid, t6=location(href 本次), t7=35 点轨迹(本次 M0/x/dx 合成),
       t3#2=slider 记录(pageX/pageY 本次), t12=大 JSON(x/y 本次; title 等取同页面常量)
     - 页面/环境常量（明文复用模板解密值, 重新加密）: t15,t18,t16,t14,t1,t4,t10,t3#1
       （时间头 u32 与 UA 版本等环境项无法从会话推导 → 明文沿用模板, 见报告『方法边界』）
  3) 自检: --selftest 用 run4 的真实参数重建, 与模板逐字段明文比对
用法:
  python3 dx_from_scratch.py --selftest
  python3 dx_from_scratch.py --ctx out/ctx-J1.json --tag J1-z1 [--dry]
"""
import argparse, json, os, random, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import dx_ac as D       # noqa
import dx_fields as F   # noqa

TEMPLATE = os.path.join(ROOT, 'round2-hook/samples/run4/_ua_before.bin')
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0"
POST_URL = "https://cap.dingxiang-inc.com/api/v1"
RUN4 = dict(aid_ts=1791259931641, tm=1791259931673, x=152, y=44, M0=358, sid='9fb303e8f965572100c4ba6c5e21bdb5')


def load_template_plain():
    """[ (idx, type, plain_bytes, cipher_bytes) ]  按模板顺序"""
    raw = open(TEMPLATE, 'rb').read()
    out = []
    for i, (ty, pl, tr) in enumerate(D.parse_tlv(raw)):
        out.append((i, ty, F.dec_field(ty, pl), pl))
    return out


def synth_track(M0, x, y, tm, n=35, dt0=3959, dt1=4995, seed=None):
    """合成 35 点 (dt, pageX, pageY)：pageX 从 M0+10 到 M0+(x-20)，先快后慢；末 5 点持平"""
    rnd = random.Random(seed)
    dx = x - 20
    px0, px1 = M0 + 10, M0 + dx
    pts = []
    for i in range(n):
        t = i / (n - 1.0)
        if i >= n - 5:                       # 末 5 点停手持平
            prog = 1.0
        else:
            prog = 1 - (1 - t) ** 1.6        # 缓出
        px = int(round(px0 + (px1 - px0) * prog)) + (rnd.randint(-1, 1) if i not in (0, n - 1) else 0)
        py = int(round(y)) + rnd.randint(-1, 1)
        dt = int(round(dt0 + (dt1 - dt0) * t)) + (rnd.randint(-3, 3) if 0 < i < n - 1 else 0)
        pts.append((dt, px, py))
    for i in range(1, n):                    # dt 严格递增
        if pts[i][0] <= pts[i - 1][0]:
            pts[i] = (pts[i - 1][0] + 12,) + pts[i][1:]
    return pts


def build(fields_plain, tm, x, y, M0, seed=2026):
    """fields_plain: 模板顺序的 (idx, ty, plain) 列表（其中会话相关项已被调用方替换）"""
    out = []
    for idx, ty, plain in fields_plain:
        out.append((ty, F.enc_field(ty, plain)))
    return out


def make_plain(tctx, tm, keep=None, seed=2026, selfcheck=False):
    """tctx: dict(x, y, M0, sid, href, ref, unk) -> 返回模板顺序的 (idx,ty,plain) 列表
    keep: 若给定 (类型集合)，只保留这些类型的字段（用于最小字段集实验）"""
    tpl = load_template_plain()
    plain = []
    track = synth_track(tctx['M0'], tctx['x'], tctx['y'], tm, seed=seed)
    it7 = 0
    for idx, ty, pt, _cp in tpl:
        if keep is not None and ty not in keep:
            continue
        if ty == 7:
            dt, px, py = track[it7 % 35]; it7 += 1
            plain.append((idx, ty, D.bs4(dt) + D.bs2(px) + D.bs2(py)))
        elif ty == 8:
            plain.append((idx, ty, tm.to_bytes(8, 'big')))
        elif ty == 9:
            s = tctx['sid'].encode('latin1')
            plain.append((idx, ty, D.bs2(len(s)) + s))
        elif ty == 6:
            h = tctx['href'].encode('latin1'); r = tctx['ref'].encode('latin1')
            plain.append((idx, ty, b'\x00' + bytes([len(h)]) + h + b'\x00' + bytes([len(r)]) + r))
        elif ty == 3 and idx == 12:
            # slider 记录: [u32 t][u16 pageX][u16 pageY][u16 0][u8 len][str]
            path = pt[11:].decode('latin1') if pt[10] == len(pt) - 11 else 'dx_captcha_basic_slider-img-normal_4'
            body = D.bs4(int.from_bytes(pt[0:4], 'big')) + D.bs2(tctx['M0']) + D.bs2(tctx['ySlider']) + b'\x00\x00' + bytes([len(path)]) + path.encode('latin1')
            plain.append((idx, ty, body))
        elif ty == 12:
            js = pt[2:2 + int.from_bytes(pt[0:2], 'big')].decode('latin1')
            import re as _re
            js = _re.sub(r'"x":-?\d+', '"x":%d' % tctx['x'], js, count=1)
            js = _re.sub(r'"y":-?\d+', '"y":%d' % tctx['y'], js, count=1)
            b = js.encode('latin1')
            plain.append((idx, ty, D.bs2(len(b)) + b))
        else:
            plain.append((idx, ty, pt))
    return plain


def selftest():
    tpl = load_template_plain()
    tc = dict(x=RUN4['x'], y=RUN4['y'], M0=RUN4['M0'], sid=RUN4['sid'],
              href='https://www.dingxiang-inc.com/business/captcha',
              ref='https://www.dingxiang-inc.com/', ySlider=558)
    plain = make_plain(tc, RUN4['tm'], seed=4)
    diff = 0
    for (idx, ty, pt), (j, t2, p2, cp) in zip(plain, tpl):
        same = (pt == p2)
        if not same:
            diff += 1
            if ty in (7, 8, 12) and idx < 14:
                pass
            if ty != 7:
                print('#%-2d t=%-2d same=%s\n   new=%s\n   tpl=%s' % (idx, ty, same, pt.hex(), p2.hex()))
    print('selftest: 字段数=%d 不等=%d（预期: 轨迹 35 点 + t8 tm 边界 + t12 x/y → 可接受）' % (len(plain), diff))
    # roundtrip: 重新加密→解密
    ok = all(F.dec_field(ty, F.enc_field(ty, pt)) == pt for idx, ty, pt in plain)
    print('selftest: 加解密往返 =', ok)
    return diff


def post(url, form):
    data = urllib.parse.urlencode(form).encode()
    h = {'User-Agent': UA, 'Referer': 'https://www.dingxiang-inc.com/',
         'Content-type': 'application/x-www-form-urlencoded', 'Accept': '*/*',
         'Origin': 'https://www.dingxiang-inc.com', 'sec-ch-ua-platform': '"Windows"',
         'sec-ch-ua': '"Chromium";v="154", "Microsoft Edge";v="154", "Not A(Brand";v="99"',
         'sec-ch-ua-mobile': '?0'}
    req = urllib.request.Request(url, data=data, headers=h, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')
    except Exception as e:
        return -1, 'ERR %s: %s' % (type(e).__name__, e)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ctx'); ap.add_argument('--tag'); ap.add_argument('--dry', action='store_true')
    ap.add_argument('--selftest', action='store_true')
    ap.add_argument('--fields', default=None, help='只保留这些类型(逗号分隔), 默认全字段')
    a = ap.parse_args()
    if a.selftest:
        selftest(); return
    assert a.ctx, 'need --ctx'
    ctx = json.load(open(a.ctx, encoding='utf-8'))
    tag = a.tag or ('z' + str(int(time.time())))
    q = urllib.parse.parse_qs(urllib.parse.urlparse(ctx['apiAUrl']).query)
    sid = ctx['apiAResp']['sid']; y = int(round(ctx['yApi']))
    ak, c = q['ak'][0], q['c'][0]
    w = q.get('w', ['380'])[0]; h = q.get('h', ['165'])[0]
    aid = ctx.get('apiAAid') or q.get('aid', [''])[0]
    aid_ts = int(aid.split('-')[1]) if aid.startswith('dx-') else int(time.time() * 1000)
    loc = ctx.get('locate') or {}
    top = (loc.get('chamfer_y_candidates') or loc.get('chamfer_top') or [])
    x = int(round(top[0]['ui_x']))
    g = ctx.get('geom') or {}
    hd = g.get('handle') or {}
    M0 = int(round(hd.get('x', 358) + hd.get('w', 70) / 2.0))
    ySlider = int(round(hd.get('y', 557))) + 1
    tm = aid_ts + 32
    tc = dict(x=x, y=y, M0=M0, sid=sid, href=g.get('pageUrl', 'https://www.dingxiang-inc.com/business/captcha'),
              ref=g.get('ref') or 'https://www.dingxiang-inc.com/', ySlider=ySlider)
    keep = set(int(s) for s in a.fields.split(',')) if a.fields else None
    plain = make_plain(tc, tm, keep=keep)
    fields = [(ty, F.enc_field(ty, pt)) for idx, ty, pt in plain]
    ac = D.build_ac(fields, version=5949)
    form = {'ac': ac, 'ak': ak, 'c': c, 'uid': '', 'jsv': '5.1.53', 'sid': sid,
            'aid': aid, 'x': str(x), 'y': str(y), 'w': w, 'h': h}
    rec = {'tag': tag, 'ts': int(time.time() * 1000), 'mode': 'scratch', 'x': x, 'y': y, 'sid': sid,
           'aid': aid, 'aid_ts': aid_ts, 'tm': tm, 'M0': M0, 'ySlider': ySlider,
           'ac_len': len(ac), 'n_fields': len(fields),
           'plain_hex': [(ty, pt.hex()) for idx, ty, pt in plain if ty != 7],
           'form': form}
    # 自检：所有字段可解密还原
    ver, raw, fl = D.parse_ac(ac)
    ok_rt = all(F.dec_field(t, p) == pt for (t, p, _), (idx, ty, pt) in zip(fl, plain))
    rec['selfcheck_decrypt_all'] = ok_rt
    print('构造: ac=%dch fields=%d decrypt_all=%s x=%d y=%d M0=%d' % (len(ac), len(fields), ok_rt, x, y, M0))
    outdir = os.path.join(HERE, '..', 'out'); logdir = os.path.join(HERE, '..', 'logs')
    if not a.dry:
        st, body = post(POST_URL, form)
        rec['http_status'] = st; rec['resp_raw'] = body
        print('POST ->', st, body[:300])
    json.dump(rec, open(os.path.join(outdir, 'strike-%s.json' % tag), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if not a.dry:
        with open(os.path.join(logdir, 'strike.jsonl'), 'a', encoding='utf-8') as f:
            f.write(json.dumps({k: rec.get(k) for k in ('tag', 'ts', 'mode', 'x', 'y', 'sid', 'aid', 'aid_ts',
                                                        'http_status', 'resp_raw')}, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main()
