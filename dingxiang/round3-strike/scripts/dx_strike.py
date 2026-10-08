#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""dx_strike.py — 顶象滑块「协议直打」：离线构造 ac + form，直发 POST /api/v1
输入: out/ctx-<tag>.json（由 dx_strike_page.mjs 采集：sid/y/p1/p2/canvas/locate/aid/c）
输出: out/strike-<tag>.json + logs/strike.jsonl

不做任何鼠标拖动。核心：
  ac = "5949#" + customB64( TLV字段流 )
  模板 = run2-hook run4 的 _ua（同一浏览器 SDK 环境字段），替换：
    - type 8  : bs8(tm)            tm = aid_ts + 32
    - type 9  : bs2(32)+sid
    - type 7  : 35 × SA点(8B=dt,x,y)  —— 由 run4 真实轨迹按 (x-20)/132 水平缩放 + dt 平移
    - type 12 : 大块 JSON 中 "x"/"y" 替换为本次提交值
    - type 3/10/2/13: dt 做同一平移
"""
import argparse, json, os, random, re, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import dx_ac as D  # noqa

TEMPLATE = os.path.join(ROOT, 'round2-hook/samples/run4/_ua_before.bin')
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0"
POST_URL = "https://cap.dingxiang-inc.com/api/v1"
# run4 模板常量
RUN4_AID_TS = 1791259931641
RUN4_X = 152          # run4 提交的 x
RUN4_MD2_PX = 358     # run4 滑块按下时的 pageX
RUN4_DX = RUN4_X - 20  # 132


def dec_type8(pl):
    return int.from_bytes(D.enc_dx54(pl), 'big')


def enc_type8(tm):
    return D.enc_dx54(tm.to_bytes(8, 'big'))


def dec_type9(pl):
    p = D.enc_2372(pl)
    n = int.from_bytes(p[0:2], 'big')
    return p[2:2 + n].decode('latin1')


def enc_type9(sid):
    s = sid.encode('latin1')
    return D.enc_2372(len(s).to_bytes(2, 'big') + s)


def dec_type7(pl):
    p = D.enc_3127_21473(pl)
    return int.from_bytes(p[0:4], 'big'), int.from_bytes(p[4:6], 'big'), int.from_bytes(p[6:8], 'big')


def enc_type7(dt, x, y):
    return D.enc_3127_21473(dt.to_bytes(4, 'big') + x.to_bytes(2, 'big') + y.to_bytes(2, 'big'))


def dec_rec(ty, pl):
    """type10=getMM(enc_121), type3=getMD(enc_NxML), type2=getFO(enc_3519)"""
    if ty == 10:
        return D.enc_121(pl), 'enc_121'
    if ty == 3:
        return D.enc_NxML(pl), 'enc_NxML'
    if ty == 2:
        return D.enc_3519(pl), 'enc_3519'
    return None, None


def enc_rec(ty, raw):
    if ty == 10:
        return D.enc_121(raw)
    if ty == 3:
        return D.enc_NxML(raw)
    if ty == 2:
        return D.enc_3519(raw)
    return raw


def shift_rec_dt(ty, pl, k, delta_ms):
    """把记录字段里的相对时间 dt（前 4 字节 BE）先缩放 k 再整体减 delta_ms"""
    raw, en = dec_rec(ty, pl)
    if raw is None:
        return pl
    dt = int.from_bytes(raw[0:4], 'big')
    dt2 = max(50, int(dt * k - delta_ms))
    return enc_rec(ty, dt2.to_bytes(4, 'big') + raw[4:])


def dec_big(pl):
    p = D.enc_5547(pl)
    n = int.from_bytes(p[0:2], 'big')
    return p[2:2 + n].decode('latin1')


def enc_big(js):
    b = js.encode('latin1')
    return D.enc_5547(len(b).to_bytes(2, 'big') + b)


def load_template():
    ua = open(TEMPLATE, 'rb').read()
    fields = D.parse_tlv(ua)
    return [(ty, pl) for ty, pl, tr in fields]


def build_ac(fields, version=5949):
    return D.build_ac(fields, version=version)


def http_post(url, form, extra_headers=None):
    data = urllib.parse.urlencode(form).encode()
    h = {
        'User-Agent': UA,
        'Referer': 'https://www.dingxiang-inc.com/',
        'Content-type': 'application/x-www-form-urlencoded',
        'Accept': '*/*',
        'sec-ch-ua-platform': '"Windows"',
        'sec-ch-ua': '"Chromium";v="154", "Microsoft Edge";v="154", "Not A(Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
    }
    if extra_headers:
        h.update(extra_headers)
    req = urllib.request.Request(url, data=data, headers=h, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')
    except Exception as e:
        return -1, 'ERR %s: %s' % (type(e).__name__, e)


def build_strike_ac(sid, x, y, tm, k=1.0, delta_ms=0.0, mode='full', min_set=(6, 9, 7), verbose=False):
    """按模板构造 ac；返回 (ac, fields, info)"""
    T = load_template()
    pts = [dec_type7(pl) for ty, pl in T if ty == 7]
    assert len(pts) == 35, 'template points %d' % len(pts)
    scale = (x - 20) / float(RUN4_DX)
    new_pts = []
    for dt, px, py in pts:
        off = px - RUN4_MD2_PX
        npx = int(round(RUN4_MD2_PX + off * scale))
        ndt = max(50, int(dt * k - delta_ms))
        new_pts.append((ndt, npx, py))
    for i in range(1, len(new_pts)):
        if new_pts[i][0] <= new_pts[i - 1][0]:
            new_pts[i] = (new_pts[i - 1][0] + 12,) + new_pts[i][1:]

    o = []
    i7 = 0
    for ty, pl in T:
        if ty == 8:
            o.append((8, enc_type8(tm)))
        elif ty == 9:
            o.append((9, enc_type9(sid)))
        elif ty == 7:
            ndt, npx, npy = new_pts[i7]; i7 += 1
            o.append((7, enc_type7(ndt, npx, npy)))
        elif ty in (3, 10, 2, 13):
            o.append((ty, shift_rec_dt(ty, pl, k, delta_ms)))
        elif ty == 12:
            js = dec_big(pl)
            js2 = re.sub(r'"x":-?\d+', '"x":%d' % x, js, count=1)
            js2 = re.sub(r'"y":-?\d+', '"y":%d' % y, js2, count=1)
            o.append((12, enc_big(js2)))
        else:
            o.append((ty, pl))
    if mode == 'min':
        keep = set(int(s) for s in min_set)
        o = [(ty, pl) for ty, pl in o if ty in keep]
    ac = build_ac(o)
    return ac, o, {'pts_first': new_pts[0], 'pts_last': new_pts[-1], 'scale': scale}


def selftest_run4():
    """决定性自检：用 run4 的真实参数重放构造，应逐字符还原 run4 的 ac"""
    A = json.load(open(os.path.join(ROOT, 'round2-hook/samples/run4/ac4.json'), encoding='utf-8'))
    ac_ref = A['uaCache']
    sid = '9fb303e8f965572100c4ba6c5e21bdb5'
    tm = A['tm']                       # 1791259931673
    ac, o, info = build_strike_ac(sid, 152, 44, tm, k=1.0, delta_ms=0.0)
    ok = (ac == ac_ref)
    print('selftest run4: ac match =', ok, '| len', len(ac), 'vs ref', len(ac_ref))
    if not ok:
        n = min(len(ac), len(ac_ref))
        for i in range(n):
            if ac[i] != ac_ref[i]:
                print('  first diff at', i, repr(ac[i - 20:i + 20]), '|ref|', repr(ac_ref[i - 20:i + 20]))
                break
        # 逐字段比较
        _, raw1, f1 = D.parse_ac(ac)
        _, raw2, f2 = D.parse_ac(ac_ref)
        print('  raw len', len(raw1), len(raw2), 'fields', len(f1), len(f2))
        for i, ((t1, p1, _), (t2, p2, _)) in enumerate(zip(f1, f2)):
            if p1 != p2:
                print('  field#%d type %d/%d differs: %s vs %s' % (i, t1, t2, p1[:16].hex(), p2[:16].hex()))
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ctx', default=None, help='out/ctx-<tag>.json')
    ap.add_argument('--selftest', action='store_true', help='run4 全字段往返自检')
    ap.add_argument('--x', type=int, default=None, help='override x (default: round(locate ui_x))')
    ap.add_argument('--xoff', type=int, default=0, help='x offset added')
    ap.add_argument('--mode', default='full', choices=['full', 'min', 'noloc'])
    ap.add_argument('--min-set', default='6,9,7', help='min 模式的字段集')
    ap.add_argument('--tag', default=None)
    ap.add_argument('--dry', action='store_true', help='只构造不发送')
    a = ap.parse_args()
    if a.selftest:
        sys.exit(0 if selftest_run4() else 1)
    assert a.ctx, 'need --ctx'

    ctx = json.load(open(a.ctx, encoding='utf-8'))
    tag = a.tag or (ctx.get('tag', 'x') + '-s' + str(int(time.time())))
    apiA = ctx['apiAUrl']
    q = urllib.parse.parse_qs(urllib.parse.urlparse(apiA).query)
    sid = ctx['apiAResp']['sid']
    y = int(ctx['apiAResp']['y'])
    ak = q['ak'][0]
    c = q['c'][0]
    w = q.get('w', ['380'])[0]
    h = q.get('h', ['165'])[0]
    aid = ctx.get('apiAAid') or q.get('aid', [''])[0]
    aid_ts = int(aid.split('-')[1]) if aid.startswith('dx-') else int(time.time() * 1000)

    # ----- x 口径：x = round(locate.ui_x) = round(canvas_x*0.95) -----
    loc = ctx.get('locate') or {}
    if a.x is not None:
        x = a.x
    else:
        top = (loc.get('chamfer_y_candidates') or loc.get('chamfer_top') or [])
        assert top, 'no locate result: run dx_strike_page.mjs first'
        x = int(round(top[0]['ui_x']))
    x += a.xoff
    y_sub = ctx.get('yApi')
    if y_sub is not None:
        y = int(round(y_sub))
    if y > 99:  # subStyle margin-top 有时是 canvas 系(0.825)口径
        y = int(round(y * 0.825))

    # ----- 时间轴规划 -----
    now_ms = int(time.time() * 1000)
    tm = aid_ts + 32                       # 与 run4 同构: tm = aid_ts + 32
    W = now_ms + 700 - tm                  # 预计 POST 时刻到 tm 的可用窗口
    MAXDT = 4995                           # run4 模板末点 dt
    k = 1.0
    if W - 800 < MAXDT:
        k = max(0.15, (W - 800) / MAXDT)
    delta_ms = MAXDT * (1 - k)             # 平移量（先缩放后平移，使末点 = MAXDT*k）

    ac, o, info = build_strike_ac(sid, x, y, tm, k=k, delta_ms=delta_ms, mode=a.mode,
                                  min_set=tuple(int(s) for s in a.min_set.split(',')))
    form = {'ac': ac, 'ak': ak, 'c': c, 'uid': '', 'jsv': '5.1.53', 'sid': sid,
            'aid': aid, 'x': str(x), 'y': str(y), 'w': w, 'h': h}

    rec = {
        'tag': tag, 'ts': now_ms, 'mode': a.mode, 'x': x, 'y': y, 'sid': sid, 'aid': aid,
        'tm': tm, 'tm_iso': time.strftime('%H:%M:%S', time.localtime(tm / 1000)),
        'aid_ts': aid_ts, 'W_ms': W, 'dt_scale_k': k, 'dt_shift': delta_ms,
        'locate_top': (loc.get('chamfer_y_candidates') or loc.get('chamfer_top') or [])[:3],
        'ac_len': len(ac), 'n_fields': len(o), 'ua_len': len(D.dec_b64(ac.split('#')[1])),
        'form': form, 'canvas': ctx.get('canvasPath'), 'frag': ctx.get('fragPath'),
        'pts_first': info['pts_first'], 'pts_last': info['pts_last'], 'traj_scale': info['scale'],
    }
    # 自检：ac 往返一致
    ver, raw, fl = D.parse_ac(ac)
    rec['selfcheck_roundtrip'] = (D.build_ac([(t, p) for t, p, tr in fl], version=int(ver)) == ac)
    rec['selfcheck_fields'] = [(t, len(p)) for t, p, tr in fl]

    outdir = os.path.join(HERE, '..', 'out'); os.makedirs(outdir, exist_ok=True)
    logdir = os.path.join(HERE, '..', 'logs'); os.makedirs(logdir, exist_ok=True)
    if not a.dry:
        st, body = http_post(POST_URL, form, {'Origin': 'https://www.dingxiang-inc.com'})
        rec['http_status'] = st
        rec['resp_raw'] = body
        try:
            rec['resp'] = json.loads(body)
        except Exception:
            rec['resp'] = None
        print('POST ->', st, body[:300])
    else:
        print('[dry] ac_len=%d x=%d y=%d' % (len(ac), x, y))

    json.dump(rec, open(os.path.join(outdir, 'strike-%s.json' % tag), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    with open(os.path.join(logdir, 'strike.jsonl'), 'a', encoding='utf-8') as f:
        f.write(json.dumps({k: rec[k] for k in ('tag', 'ts', 'mode', 'x', 'y', 'sid', 'aid', 'aid_ts', 'W_ms', 'dt_scale_k',
                                                'http_status', 'resp_raw') if k in rec}, ensure_ascii=False) + '\n')
    print('RESULT', json.dumps({k: rec.get(k) for k in ('tag', 'x', 'y', 'http_status', 'resp_raw')}, ensure_ascii=False)[:400])
    return rec


if __name__ == '__main__':
    main()
