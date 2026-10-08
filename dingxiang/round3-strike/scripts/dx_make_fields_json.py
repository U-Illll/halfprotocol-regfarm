#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""dx_make_fields_json.py — 生成 out/fields-5949.json（5949 版 50 字段语义表）
   附各字段的编码函数名/明文/是否可以自建（供报告引用）"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import dx_ac as D       # noqa
import dx_fields as F   # noqa

ENC_NAME = {
    1: 'encrypt_bj7bnzly9ld4zfko9l8o_tpyrcne', 2: 'encrypt_6dknua3bfnwbgs6k2ueg',
    3: 'encrypt_sgwdkctstvny9q3p1248', 4: 'encrypt_h2u66y2r9xpl77ycn0w5_tpyrcne',
    5: 'encrypt_d8nrtkn0j3gzw2bmq6xf', 6: 'encrypt_ibnwwnx75wveeknf0y8v',
    7: 'encrypt_6bqrb1fro5sh7yffzg85', 8: 'encrypt_rwj3ccrr01kuh9spnerm',
    9: 'encrypt_vxhi06x40ro3adppqbb6', 10: 'encrypt_chiq6w9cbvngmakl6wg8',
    11: 'encrypt_55nnt3ep9qwjkbpkcaj8_tpyrcne', 12: 'encrypt_vzigbys1175r5o30bywo',
    13: 'encrypt_55nnt3ep9qwjkbpkcaj8_tpyrcne', 14: 'encrypt_p1tyxdx8rojx2fimmsva',
    15: 'encrypt_v6z3zw469kdzfxxha55r', 16: 'encrypt_2eg33kdtkgouos5mfayu',
    17: 'encrypt_mjb470o7onmk7vtmtksp', 18: 'encrypt_43xivvl7s7518db0j0ku',
}
MEANING = {
    8: 'tm（8B 大端毫秒时间戳, = /api/a aid 的 ms + 32）',
    15: '环境: [01 07][00 03]"154"（浏览器主版本 154）',
    6: 'location: [00][len1]href[00][len2]referrer',
    18: '环境: [00 1d][00 03]"0]]\'"',
    4: '常量 1B: "Q"(0x51)（×3）',
    14: '数值: 00000000',
    1: '数值: 00000001',
    9: 'token: [00 20 hex]sid（32B sid）',
    16: '屏幕/窗口 10×u16: 1028/908(inner) 等',
    10: 'getMM: [u32 t=1977][u16 822][u16 165][u16 len]"dx_captcha_oneclick_bar-inform_3"',
    3: 'getMD: #1 [u32 t=2346][u16 822][u16 171][000000]; #2 [u32 t=3840][u16 pageX=358][u16 pageY=558][u16 0][u8 len]"dx_captcha_basic_slider-img-normal_4"',
    7: 'SA 轨迹点 ×35: [u32 dt][u16 pageX][u16 pageY]',
    12: '大 JSON(页面指纹+x/y): title/keywords/description/viewport/bodyLength/headLength/xpath/x/y/fragment',
}
SELF_BUILD = {
    8: 'yes(tm=aid_ts+32)', 9: 'yes', 6: 'yes(href 取自 ctx)', 7: 'yes(合成 35 点)',
    12: 'partial(x/y 本次; 页面常量复用同页值)', 3: 'partial(#2 坐标自建; #1 时间头未知)',
    10: 'partial(时间头未知)', 15: 'no(明文可解, 常量复用)', 18: 'no(同上)',
    16: 'no(屏幕常量)', 14: 'no(常量 0)', 1: 'no(常量 1)', 4: 'no(常量 0x51)',
}

raw = open(os.path.join(ROOT, 'round2-hook/samples/run4/_ua_before.bin'), 'rb').read()
fields = D.parse_tlv(raw)
out = []
for i, (ty, pl, tr) in enumerate(fields):
    pt = F.dec_field(ty, pl)
    out.append({'idx': i, 'type': ty, 'cipher_len': len(pl), 'enc': ENC_NAME.get(ty),
                'meaning': MEANING.get(ty, '?'), 'self_build': SELF_BUILD.get(ty, '?'),
                'plain_hex': pt.hex() if pt else None,
                'roundtrip_ok': (F.enc_field(ty, pt) == pl) if pt is not None else False})
doc = {'source': 'round2-hook/samples/run4 (_ua_before.bin, greenseer 5949)',
       'ac_format': 'ac = "5949#" + custom_b64( TLV(type u8, len u16 BE, enc_payload) )',
       'n_fields': len(fields), 'note': 'type7 共 35 条(轨迹点), 其余各 1 条; 明文=解密结果',
       'fields': out}
json.dump(doc, open(os.path.join(HERE, '..', 'out', 'fields-5949.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
n7 = sum(1 for f in out if f['type'] == 7)
print('fields-5949.json 已写: %d 字段(含 type7 ×%d) roundtrip 全通过=%s' % (
    len(out), n7, all(f['roundtrip_ok'] for f in out)))
