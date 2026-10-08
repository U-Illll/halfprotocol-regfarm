#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""dx_inspect.py — dump run4 _ua 模板 / 任意 ac 的字段结构（类型、长度、解密预览）
用法: python3 dx_inspect.py [ac_or_bin_path]  默认 round2-hook/samples/run4/_ua_before.bin
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import dx_ac as D  # noqa

DEC = {
    8: ('enc_dx54', D.enc_dx54),
    9: ('enc_2372', D.enc_2372),
    7: ('enc_3127_21473', D.enc_3127_21473),
    12: ('enc_5547', D.enc_5547),
    10: ('enc_121', D.enc_121),
    3: ('enc_NxML', D.enc_NxML),
    2: ('enc_3519', D.enc_3519),
    1: ('enc_208', D.enc_208),
    4: ('enc_bhbX', D.enc_bhbX),
    5: ('enc_2_5', D.enc_2_5),
    6: ('enc_237', D.enc_237),
    11: ('enc_621', D.enc_621),
    13: ('?', None),
    14: ('enc_56737', D.enc_56737),
    15: ('enc_208', D.enc_208),
    16: ('enc_72439', D.enc_72439),
    17: ('enc_43521', D.enc_43521),
    18: ('enc_46317', D.enc_46317),
    19: ('enc_179', D.enc_179),
}


def load(path):
    raw = open(path, 'rb').read()
    if raw[:1] == b'5' or b'#' in raw[:12]:
        ver, body = raw.decode('latin1').split('#', 1)
        raw = D.dec_b64(body)
    else:
        ver = '?'
    return ver, raw


def main():
    p = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'round2-hook/samples/run4/_ua_before.bin')
    ver, raw = load(p)
    fields = D.parse_tlv(raw)
    print('file=%s version=%s raw=%dB fields=%d' % (os.path.basename(p), ver, len(raw), len(fields)))
    for i, f in enumerate(fields):
        ty, pl, tr = f
        name, dec = DEC.get(ty, ('UNKNOWN', None))
        line = '#%-2d type=%-2d len=%-4d %s' % (i, ty, len(pl), 'TRUNC' if tr else '')
        if dec is not None:
            pt = dec(pl)
            if ty == 8:
                line += 'plain=%d (tm)' % int.from_bytes(pt, 'big')
            elif ty == 9 and len(pt) > 2:
                n = int.from_bytes(pt[0:2], 'big')
                line += 'plain=sid:%s' % pt[2:2 + n].decode('latin1')
            elif ty == 7:
                pts = [D.sa_point(pt[i:i + 8]) for i in range(0, len(pt) - 7, 8)]
                line += 'pts=%d first=%s last=%s' % (len(pts), pts[0], pts[-1])
            else:
                s = pt.decode('latin1', 'replace')
                printable = sum(1 for ch in s if 32 <= ord(ch) < 127) / max(1, len(s))
                line += 'plain[%s]=' % ('ascii' if printable > 0.85 else 'bin') + s[:90].replace('\n', ' ')
        else:
            line += 'cipher=' + pl[:24].hex()
        print(line)


if __name__ == '__main__':
    main()
