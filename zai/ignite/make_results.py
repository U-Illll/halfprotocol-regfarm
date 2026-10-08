import glob,json,os,collections
out='/tmp/zai-recon-5'
files=sorted(glob.glob(out+'/s9d-*.json'))
rows=[]; all_non=[]; hits=[]
for p in files:
 d=json.load(open(p)); ver=os.path.basename(d['pe']).split('.')[1] if '/pe.' in d['pe'] else d['pe']
 non=[]
 for x in d.get('probes',[]):
  r=x.get('result',{}); typ=r.get('type'); ln=r.get('len'); head=r.get('head','')
  if typ not in (None,'undefined') or r.get('ok')==0:
   non.append((x['frame'],x['kind'],typ,ln,head[:60],r.get('error','')))
  if x in d.get('hits',[]): hits.append((ver,x))
 rows.append((os.path.basename(p),ver,len(d.get('frames',[])),len(d.get('probes',[])),len(d.get('hits',[])),non))
 all_non += [(ver,)+z for _,ver,_,_,_,ns in rows for z in ns]
# summarize stable matrix by exact kind
agg=collections.defaultdict(list)
for ver,fr,kind,typ,ln,head,err in all_non:
 if typ not in (None,'undefined'): agg[(kind,typ,ln,head)].append(ver)
lines=[]
lines += ['# S9 帧内探查结果（S9d）','',f'执行时间：2026-10-02；脚本：`/tmp/zt/za11_s9d_chain.mjs`；输出目录：`{out}`','',
'## 结论','',f'命中 data 形态：**是**。在 `pe.063` 的 frame 3，`ts(op=25, mat)` 产出 844 字符、前缀 `JRMnXw`；同一帧的 `mat_json`=860、`mat_cvp`=848、`mat_data`=844。另有 `ts(op=25, cvp)` 产出 3036 字符、前缀 `JRMkRw`，属于另一形态。','',
'边界记录：未执行 verify 提交，未点击页面重试；只在 `/tmp/zt` 与 `/tmp/zai-recon-5` 写入。','', '## 逐轮记录','', '|轮次/文件|pe|帧数|试调用数|data 命中|','|---|---|---:|---:|---:|']
for i,(fn,ver,nf,np,nh,ns) in enumerate(rows,1): lines.append(f'|{i} `{fn}`|`{ver}`|{nf}|{np}|{nh}|')
lines += ['', '## 命中明细','', '|pe|frame|组合|type|len|head 前 60|','|---|---:|---|---|---:|---|']
for ver,x in hits:
 r=x['result']; lines.append(f"|`{ver}`|{x['frame']}|`{x['kind']}`|`{r.get('type')}`|{r.get('len')}|`{r.get('head','')[:60]}`|")
lines += ['', '## 非空输出矩阵（跨轮汇总）','', '以下仅列出结果不是 `undefined` 的调用；`undefined` 说明该函数/参数/帧组合没有可观察返回值。','', '|组合|输出 type|len|head|出现 pe 轮数|','|---|---|---:|---|---:|']
for (kind,typ,ln,head),vs in sorted(agg.items(), key=lambda kv:(kv[0][0],str(kv[0][1]),kv[0][2] or -1)):
 lines.append(f"|`{kind}`|`{typ}`|{ln}|`{head}`|{len(set(vs))}|")
lines += ['', '## 各轮负结论与新线索','']
for i,(fn,ver,nf,np,nh,ns) in enumerate(rows,1):
 if nh: lines.append(f'- 第 {i} 轮 `{ver}`：已命中；入口线索收敛到 frame 3 的 `ts/op=25`，素材变量为该帧 `materials[0]`。')
 else: lines.append(f'- 第 {i} 轮 `{ver}`：未命中 data；本轮共 {nf} 个暂停帧、{np} 个试调用。新线索：优先保留素材帧与大函数帧的交集，并继续扫描 `ts` 的 op 25；前四轮脚本早期采用异步包装时结果记录为 undefined/raw 空对象，已在脚本中改成暂停帧内同步取值。')
lines += ['', '## 入口/形态矩阵解释','', '- `ts(op, mat)`：本轮唯一稳定命中 data 的入口是 `op=25`；mat 变体输出约 844 字符。','- `ts(op, mat_json)`：同 op 产出约 860 字符，仍为 `JRMnXw`。','- `ts(op, mat_cvp)` / `ts(op, mat_data)`：分别约 848/844 字符，仍为 `JRMnXw`。','- `ts(op, cvp)`：op 25 产出 3036 字符、`JRMkRw`，证明 cvp 输入会切换到长数据形态。','- 其余 `th/tu/np/nh/e/s/tl/tc` 与 op 0-31 的大量组合在本批帧中主要为 undefined、标量或短字符串；既有 `tl(op=19, mat)` 的 3436 字符 `V0VCI2Fi` 证据保持有效，但不是本轮 data 命中。','', '## 下轮入口','', '1. 固定 `ts`、`op=25`，继续对素材对象、JSON 素材、cvp 与 cvp.data 做版本抽样。','2. 在新 pe 版本中优先命中包含 `TrackList/TrackStartTime` 的帧；若同帧存在多个素材变量，逐个替换 `materials[0]`。','3. 对 `ts(25,*)` 保存完整 type/len/head，并以 `^JRMnXw` 与 700-800 字符为自动验收条件。','', '## 产物','', '- 改造脚本：`/tmp/zt/za11_s9d_chain.mjs`','- 本轮 JSON：`/tmp/zai-recon-5/s9d-*.json`','- 最后一轮快照：`/tmp/zai-recon-5/S9-LAST.json`']
open(out+'/S9-RESULTS.md','w').write('\n'.join(lines)+'\n')
