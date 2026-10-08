# S9 帧内探查结果（S9d）

执行时间：2026-10-02；脚本：`/tmp/zt/za11_s9d_chain.mjs`；输出目录：`/tmp/zai-recon-5`

## 结论

命中 data 形态：**是**。在 `pe.063` 的 frame 3，`ts(op=25, mat)` 产出 844 字符、前缀 `JRMnXw`；同一帧的 `mat_json`=860、`mat_cvp`=848、`mat_data`=844。另有 `ts(op=25, cvp)` 产出 3036 字符、前缀 `JRMkRw`，属于另一形态。

边界记录：未执行 verify 提交，未点击页面重试；只在 `/tmp/zt` 与 `/tmp/zai-recon-5` 写入。

## 逐轮记录

|轮次/文件|pe|帧数|试调用数|data 命中|
|---|---|---:|---:|---:|
|1 `s9d-1790933143844.json`|`078`|1|1605|0|
|2 `s9d-1790933345748.json`|`065`|6|6420|0|
|3 `s9d-1790933527361.json`|`059`|1|1605|0|
|4 `s9d-1790933767911.json`|`096`|5|6100|0|
|5 `s9d-1790933859382.json`|`063`|4|5780|5|

## 命中明细

|pe|frame|组合|type|len|head 前 60|
|---|---:|---|---|---:|---|
|`063`|3|`ts op=25 mat`|`string`|844|`JRMnXw8pAioKLwILVQKxNlIOt38AfSRtVjU3MnWmHxcHi16gDXR7XWcVdK5+`|
|`063`|3|`ts op=25 mat_json`|`string`|860|`JRMnXw8pAi4KLwIXVQJENh4ApUUAZzR9SRgVMnWuDBMxa1Rdw1JvYiZRFoRg`|
|`063`|3|`ts op=25 cvp`|`string`|3036|`JRMkRw8wGQBIeQIVRXqxEEsvvkMac8I7YjkncEJQD+Yzhlu/DEVtSR9xM5Jg`|
|`063`|3|`ts op=25 mat_cvp`|`string`|848|`JRMnXw8pDS4KLwIXRQJENgQAu0VBPxpzR28jL3JT0RcudD1DwahoGSt0aodu`|
|`063`|3|`ts op=25 mat_data`|`string`|844|`JRMnXw8pDS4KLwIXRQJENgQAu0VBPxpzR28jL3JT0RcudD1DwbJoGTt0aodu`|

## 非空输出矩阵（跨轮汇总）

以下仅列出结果不是 `undefined` 的调用；`undefined` 说明该函数/参数/帧组合没有可观察返回值。

|组合|输出 type|len|head|出现 pe 轮数|
|---|---|---:|---|---:|
|`s op=0 cvp`|`boolean`|None|`false`|1|
|`s op=0 mat`|`boolean`|None|`false`|1|
|`s op=0 mat_cvp`|`boolean`|None|`false`|1|
|`s op=0 mat_data`|`boolean`|None|`false`|1|
|`s op=0 mat_json`|`boolean`|None|`false`|1|
|`s op=1 cvp`|`boolean`|None|`false`|1|
|`s op=1 mat`|`boolean`|None|`false`|1|
|`s op=1 mat_cvp`|`boolean`|None|`false`|1|
|`s op=1 mat_data`|`boolean`|None|`false`|1|
|`s op=1 mat_json`|`boolean`|None|`false`|1|
|`s op=10 cvp`|`boolean`|None|`false`|1|
|`s op=10 mat`|`boolean`|None|`false`|1|
|`s op=10 mat_cvp`|`boolean`|None|`false`|1|
|`s op=10 mat_data`|`boolean`|None|`false`|1|
|`s op=10 mat_json`|`boolean`|None|`false`|1|
|`s op=11 cvp`|`boolean`|None|`false`|1|
|`s op=11 mat`|`boolean`|None|`false`|1|
|`s op=11 mat_cvp`|`boolean`|None|`false`|1|
|`s op=11 mat_data`|`boolean`|None|`false`|1|
|`s op=11 mat_json`|`boolean`|None|`false`|1|
|`s op=12 cvp`|`boolean`|None|`false`|1|
|`s op=12 mat`|`boolean`|None|`false`|1|
|`s op=12 mat_cvp`|`boolean`|None|`false`|1|
|`s op=12 mat_data`|`boolean`|None|`false`|1|
|`s op=12 mat_json`|`boolean`|None|`false`|1|
|`s op=13 cvp`|`boolean`|None|`false`|1|
|`s op=13 mat`|`boolean`|None|`false`|1|
|`s op=13 mat_cvp`|`boolean`|None|`false`|1|
|`s op=13 mat_data`|`boolean`|None|`false`|1|
|`s op=13 mat_json`|`boolean`|None|`false`|1|
|`s op=14 cvp`|`boolean`|None|`false`|1|
|`s op=14 mat`|`boolean`|None|`false`|1|
|`s op=14 mat_cvp`|`boolean`|None|`false`|1|
|`s op=14 mat_data`|`boolean`|None|`false`|1|
|`s op=14 mat_json`|`boolean`|None|`false`|1|
|`s op=15 cvp`|`boolean`|None|`false`|1|
|`s op=15 mat`|`boolean`|None|`false`|1|
|`s op=15 mat_cvp`|`boolean`|None|`false`|1|
|`s op=15 mat_data`|`boolean`|None|`false`|1|
|`s op=15 mat_json`|`boolean`|None|`false`|1|
|`s op=16 cvp`|`boolean`|None|`false`|1|
|`s op=16 mat`|`boolean`|None|`false`|1|
|`s op=16 mat_cvp`|`boolean`|None|`false`|1|
|`s op=16 mat_data`|`boolean`|None|`false`|1|
|`s op=16 mat_json`|`boolean`|None|`false`|1|
|`s op=17 cvp`|`boolean`|None|`false`|1|
|`s op=17 mat`|`boolean`|None|`false`|1|
|`s op=17 mat_cvp`|`boolean`|None|`false`|1|
|`s op=17 mat_data`|`boolean`|None|`false`|1|
|`s op=17 mat_json`|`boolean`|None|`false`|1|
|`s op=18 cvp`|`boolean`|None|`false`|1|
|`s op=18 mat`|`boolean`|None|`false`|1|
|`s op=18 mat_cvp`|`boolean`|None|`false`|1|
|`s op=18 mat_data`|`boolean`|None|`false`|1|
|`s op=18 mat_json`|`boolean`|None|`false`|1|
|`s op=19 cvp`|`boolean`|None|`false`|1|
|`s op=19 mat`|`boolean`|None|`false`|1|
|`s op=19 mat_cvp`|`boolean`|None|`false`|1|
|`s op=19 mat_data`|`boolean`|None|`false`|1|
|`s op=19 mat_json`|`boolean`|None|`false`|1|
|`s op=2 cvp`|`boolean`|None|`false`|1|
|`s op=2 mat`|`boolean`|None|`false`|1|
|`s op=2 mat_cvp`|`boolean`|None|`false`|1|
|`s op=2 mat_data`|`boolean`|None|`false`|1|
|`s op=2 mat_json`|`boolean`|None|`false`|1|
|`s op=20 cvp`|`boolean`|None|`false`|1|
|`s op=20 mat`|`boolean`|None|`false`|1|
|`s op=20 mat_cvp`|`boolean`|None|`false`|1|
|`s op=20 mat_data`|`boolean`|None|`false`|1|
|`s op=20 mat_json`|`boolean`|None|`false`|1|
|`s op=21 cvp`|`boolean`|None|`false`|1|
|`s op=21 mat`|`boolean`|None|`false`|1|
|`s op=21 mat_cvp`|`boolean`|None|`false`|1|
|`s op=21 mat_data`|`boolean`|None|`false`|1|
|`s op=21 mat_json`|`boolean`|None|`false`|1|
|`s op=22 cvp`|`boolean`|None|`false`|1|
|`s op=22 mat`|`boolean`|None|`false`|1|
|`s op=22 mat_cvp`|`boolean`|None|`false`|1|
|`s op=22 mat_data`|`boolean`|None|`false`|1|
|`s op=22 mat_json`|`boolean`|None|`false`|1|
|`s op=23 cvp`|`boolean`|None|`false`|1|
|`s op=23 mat`|`boolean`|None|`false`|1|
|`s op=23 mat_cvp`|`boolean`|None|`false`|1|
|`s op=23 mat_data`|`boolean`|None|`false`|1|
|`s op=23 mat_json`|`boolean`|None|`false`|1|
|`s op=24 cvp`|`boolean`|None|`false`|1|
|`s op=24 mat`|`boolean`|None|`false`|1|
|`s op=24 mat_cvp`|`boolean`|None|`false`|1|
|`s op=24 mat_data`|`boolean`|None|`false`|1|
|`s op=24 mat_json`|`boolean`|None|`false`|1|
|`s op=25 cvp`|`boolean`|None|`false`|1|
|`s op=25 mat`|`boolean`|None|`false`|1|
|`s op=25 mat_cvp`|`boolean`|None|`false`|1|
|`s op=25 mat_data`|`boolean`|None|`false`|1|
|`s op=25 mat_json`|`boolean`|None|`false`|1|
|`s op=26 cvp`|`boolean`|None|`false`|1|
|`s op=26 mat`|`boolean`|None|`false`|1|
|`s op=26 mat_cvp`|`boolean`|None|`false`|1|
|`s op=26 mat_data`|`boolean`|None|`false`|1|
|`s op=26 mat_json`|`boolean`|None|`false`|1|
|`s op=27 cvp`|`boolean`|None|`false`|1|
|`s op=27 mat`|`boolean`|None|`false`|1|
|`s op=27 mat_cvp`|`boolean`|None|`false`|1|
|`s op=27 mat_data`|`boolean`|None|`false`|1|
|`s op=27 mat_json`|`boolean`|None|`false`|1|
|`s op=28 cvp`|`boolean`|None|`false`|1|
|`s op=28 mat`|`boolean`|None|`false`|1|
|`s op=28 mat_cvp`|`boolean`|None|`false`|1|
|`s op=28 mat_data`|`boolean`|None|`false`|1|
|`s op=28 mat_json`|`boolean`|None|`false`|1|
|`s op=29 cvp`|`boolean`|None|`false`|1|
|`s op=29 mat`|`boolean`|None|`false`|1|
|`s op=29 mat_cvp`|`boolean`|None|`false`|1|
|`s op=29 mat_data`|`boolean`|None|`false`|1|
|`s op=29 mat_json`|`boolean`|None|`false`|1|
|`s op=3 cvp`|`boolean`|None|`false`|1|
|`s op=3 mat`|`boolean`|None|`false`|1|
|`s op=3 mat_cvp`|`boolean`|None|`false`|1|
|`s op=3 mat_data`|`boolean`|None|`false`|1|
|`s op=3 mat_json`|`boolean`|None|`false`|1|
|`s op=30 cvp`|`boolean`|None|`false`|1|
|`s op=30 mat`|`boolean`|None|`false`|1|
|`s op=30 mat_cvp`|`boolean`|None|`false`|1|
|`s op=30 mat_data`|`boolean`|None|`false`|1|
|`s op=30 mat_json`|`boolean`|None|`false`|1|
|`s op=31 cvp`|`boolean`|None|`false`|1|
|`s op=31 mat`|`boolean`|None|`false`|1|
|`s op=31 mat_cvp`|`boolean`|None|`false`|1|
|`s op=31 mat_data`|`boolean`|None|`false`|1|
|`s op=31 mat_json`|`boolean`|None|`false`|1|
|`s op=4 cvp`|`boolean`|None|`false`|1|
|`s op=4 mat`|`boolean`|None|`false`|1|
|`s op=4 mat_cvp`|`boolean`|None|`false`|1|
|`s op=4 mat_data`|`boolean`|None|`false`|1|
|`s op=4 mat_json`|`boolean`|None|`false`|1|
|`s op=5 cvp`|`boolean`|None|`false`|1|
|`s op=5 mat`|`boolean`|None|`false`|1|
|`s op=5 mat_cvp`|`boolean`|None|`false`|1|
|`s op=5 mat_data`|`boolean`|None|`false`|1|
|`s op=5 mat_json`|`boolean`|None|`false`|1|
|`s op=6 cvp`|`boolean`|None|`false`|1|
|`s op=6 mat`|`boolean`|None|`false`|1|
|`s op=6 mat_cvp`|`boolean`|None|`false`|1|
|`s op=6 mat_data`|`boolean`|None|`false`|1|
|`s op=6 mat_json`|`boolean`|None|`false`|1|
|`s op=7 cvp`|`boolean`|None|`false`|1|
|`s op=7 mat`|`boolean`|None|`false`|1|
|`s op=7 mat_cvp`|`boolean`|None|`false`|1|
|`s op=7 mat_data`|`boolean`|None|`false`|1|
|`s op=7 mat_json`|`boolean`|None|`false`|1|
|`s op=8 cvp`|`boolean`|None|`false`|1|
|`s op=8 mat`|`boolean`|None|`false`|1|
|`s op=8 mat_cvp`|`boolean`|None|`false`|1|
|`s op=8 mat_data`|`boolean`|None|`false`|1|
|`s op=8 mat_json`|`boolean`|None|`false`|1|
|`s op=9 cvp`|`boolean`|None|`false`|1|
|`s op=9 mat`|`boolean`|None|`false`|1|
|`s op=9 mat_cvp`|`boolean`|None|`false`|1|
|`s op=9 mat_data`|`boolean`|None|`false`|1|
|`s op=9 mat_json`|`boolean`|None|`false`|1|
|`ts op=10 cvp`|`number`|None|`0`|1|
|`ts op=10 mat`|`number`|None|`0`|1|
|`ts op=10 mat_cvp`|`number`|None|`0`|1|
|`ts op=10 mat_data`|`number`|None|`0`|1|
|`ts op=10 mat_json`|`number`|None|`0`|1|
|`ts op=11 mat_json`|`object`|None|`[object Object]`|1|
|`ts op=12 cvp`|`object`|None|`[object Promise]`|1|
|`ts op=12 mat`|`object`|None|`[object Promise]`|1|
|`ts op=12 mat_cvp`|`object`|None|`[object Promise]`|1|
|`ts op=12 mat_data`|`object`|None|`[object Promise]`|1|
|`ts op=12 mat_json`|`object`|None|`[object Promise]`|1|
|`ts op=14 cvp`|`string`|16|`ad05f6c219e79c77`|1|
|`ts op=14 mat`|`string`|16|`6f3cc81cce2ac51f`|1|
|`ts op=14 mat_cvp`|`string`|16|`bd40a63b1e50f867`|1|
|`ts op=14 mat_data`|`string`|16|`46e9673fd26533dd`|1|
|`ts op=14 mat_json`|`string`|16|`1e2e64e836bace59`|1|
|`ts op=15 cvp`|`object`|15|`91,111,98,106,101,99,116,32,79,98,106,101,99,116,93`|1|
|`ts op=15 mat`|`object`|15|`91,111,98,106,101,99,116,32,79,98,106,101,99,116,93`|1|
|`ts op=15 mat_cvp`|`object`|15|`91,111,98,106,101,99,116,32,79,98,106,101,99,116,93`|1|
|`ts op=15 mat_data`|`object`|15|`91,111,98,106,101,99,116,32,79,98,106,101,99,116,93`|1|
|`ts op=15 mat_json`|`object`|1426|`123,34,84,114,97,99,107,76,105,115,116,34,58,123,34,109,99,3`|1|
|`ts op=16 cvp`|`string`|5028|`V0VCI2FiMDM0ZWMwNjQzZjkxMzk5ZWIzM2UwNjJkYzdmYWUxLWgtMTc5MDkz`|1|
|`ts op=16 mat`|`string`|3548|`V0VCI2FiMDM0ZWMwNjQzZjkxMzk5ZWIzM2UwNjJkYzdmYWUxLWgtMTc5MDkz`|1|
|`ts op=16 mat_cvp`|`string`|3692|`V0VCI2FiMDM0ZWMwNjQzZjkxMzk5ZWIzM2UwNjJkYzdmYWUxLWgtMTc5MDkz`|1|
|`ts op=16 mat_data`|`string`|3692|`V0VCI2FiMDM0ZWMwNjQzZjkxMzk5ZWIzM2UwNjJkYzdmYWUxLWgtMTc5MDkz`|1|
|`ts op=16 mat_json`|`string`|3804|`V0VCI2FiMDM0ZWMwNjQzZjkxMzk5ZWIzM2UwNjJkYzdmYWUxLWgtMTc5MDkz`|1|
|`ts op=17 cvp`|`object`|None|``|1|
|`ts op=17 mat`|`object`|None|``|1|
|`ts op=17 mat_cvp`|`object`|None|``|1|
|`ts op=17 mat_data`|`object`|None|``|1|
|`ts op=17 mat_json`|`object`|None|``|1|
|`ts op=18 cvp`|`object`|None|`[object Promise]`|1|
|`ts op=18 mat`|`object`|None|`[object Promise]`|1|
|`ts op=18 mat_cvp`|`object`|None|`[object Promise]`|1|
|`ts op=18 mat_data`|`object`|None|`[object Promise]`|1|
|`ts op=18 mat_json`|`object`|None|`[object Promise]`|1|
|`ts op=19 cvp`|`number`|None|`0`|1|
|`ts op=19 mat`|`number`|None|`0`|1|
|`ts op=19 mat_cvp`|`number`|None|`0`|1|
|`ts op=19 mat_data`|`number`|None|`0`|1|
|`ts op=19 mat_json`|`number`|None|`-58777001`|1|
|`ts op=24 cvp`|`string`|5|`f6351`|1|
|`ts op=24 mat`|`string`|5|`8f4fd`|1|
|`ts op=24 mat_cvp`|`string`|5|`a025b`|1|
|`ts op=24 mat_data`|`string`|5|`dced1`|1|
|`ts op=24 mat_json`|`string`|5|`7ca27`|1|
|`ts op=25 cvp`|`string`|3036|`JRMkRw8wGQBIeQIVRXqxEEsvvkMac8I7YjkncEJQD+Yzhlu/DEVtSR9xM5Jg`|1|
|`ts op=25 mat`|`string`|844|`JRMnXw8pAioKLwILVQKxNlIOt38AfSRtVjU3MnWmHxcHi16gDXR7XWcVdK5+`|1|
|`ts op=25 mat_cvp`|`string`|848|`JRMnXw8pDS4KLwIXRQJENgQAu0VBPxpzR28jL3JT0RcudD1DwahoGSt0aodu`|1|
|`ts op=25 mat_data`|`string`|844|`JRMnXw8pDS4KLwIXRQJENgQAu0VBPxpzR28jL3JT0RcudD1DwbJoGTt0aodu`|1|
|`ts op=25 mat_json`|`string`|860|`JRMnXw8pAi4KLwIXVQJENh4ApUUAZzR9SRgVMnWuDBMxa1Rdw1JvYiZRFoRg`|1|
|`ts op=26 cvp`|`object`|None|`[object Promise]`|1|
|`ts op=26 mat`|`object`|None|`[object Promise]`|1|
|`ts op=26 mat_cvp`|`object`|None|`[object Promise]`|1|
|`ts op=26 mat_data`|`object`|None|`[object Promise]`|1|
|`ts op=26 mat_json`|`object`|None|`[object Promise]`|1|
|`ts op=27 cvp`|`object`|None|`[object Promise]`|1|
|`ts op=27 mat`|`object`|None|`[object Promise]`|1|
|`ts op=27 mat_cvp`|`object`|None|`[object Promise]`|1|
|`ts op=27 mat_data`|`object`|None|`[object Promise]`|1|
|`ts op=27 mat_json`|`object`|None|`[object Promise]`|1|
|`ts op=28 cvp`|`object`|None|``|1|
|`ts op=28 mat`|`object`|None|``|1|
|`ts op=28 mat_cvp`|`object`|None|``|1|
|`ts op=28 mat_data`|`object`|None|``|1|
|`ts op=28 mat_json`|`object`|None|``|1|
|`ts op=30 cvp`|`string`|21|`%5Bobject%20Object%5D`|1|
|`ts op=30 mat`|`string`|21|`%5Bobject%20Object%5D`|1|
|`ts op=30 mat_cvp`|`string`|21|`%5Bobject%20Object%5D`|1|
|`ts op=30 mat_data`|`string`|21|`%5Bobject%20Object%5D`|1|
|`ts op=30 mat_json`|`string`|2190|`%7B%22TrackList%22%3A%7B%22mc%22%3A%22509%2C483%2C34415%2C%2`|1|
|`ts op=4 cvp`|`object`|None|`[object Promise]`|1|
|`ts op=4 mat`|`object`|None|`[object Promise]`|1|
|`ts op=4 mat_cvp`|`object`|None|`[object Promise]`|1|
|`ts op=4 mat_data`|`object`|None|`[object Promise]`|1|
|`ts op=4 mat_json`|`object`|None|`[object Promise]`|1|
|`ts op=5 cvp`|`number`|None|`31`|1|
|`ts op=5 mat`|`number`|None|`31`|1|
|`ts op=5 mat_cvp`|`number`|None|`31`|1|
|`ts op=5 mat_data`|`number`|None|`31`|1|
|`ts op=5 mat_json`|`number`|None|`31`|1|
|`ts op=6 cvp`|`string`|16|`6162303334656330`|1|
|`ts op=6 mat`|`string`|16|`6162303334656330`|1|
|`ts op=6 mat_cvp`|`string`|16|`6162303334656330`|1|
|`ts op=6 mat_data`|`string`|16|`6162303334656330`|1|
|`ts op=6 mat_json`|`string`|16|`6162303334656330`|1|
|`ts op=7 cvp`|`boolean`|None|`false`|1|
|`ts op=7 mat`|`boolean`|None|`false`|1|
|`ts op=7 mat_json`|`boolean`|None|`false`|1|
|`ts op=9 cvp`|`string`|40|`Fkmqok4IZ2m33o5XjbdseBegUPYaNBwU7R6i0ffq`|1|
|`ts op=9 mat`|`string`|40|`Fkmqok4IZ2m33o5XjbdseBegUPYaNBwU7R6i0ffq`|1|
|`ts op=9 mat_cvp`|`string`|40|`Fkmqok4IZ2m33o5XjbdseBegUPYaNBwU7R6i0ffq`|1|
|`ts op=9 mat_data`|`string`|40|`Fkmqok4IZ2m33o5XjbdseBegUPYaNBwU7R6i0ffq`|1|
|`ts op=9 mat_json`|`string`|40|`sCgmPsZrdmE3nkUSZJWNAfeYS3xspBspymkTayqs`|1|
|`tu op=1 cvp`|`string`|8|`,isTrust`|1|
|`tu op=1 mat`|`string`|8|`,isTrust`|1|
|`tu op=1 mat_cvp`|`string`|8|`,isTrust`|1|
|`tu op=1 mat_data`|`string`|8|`,isTrust`|1|
|`tu op=1 mat_json`|`string`|8|`,isTrust`|1|
|`tu op=10 cvp`|`string`|8|`time,typ`|1|
|`tu op=10 mat`|`string`|8|`time,typ`|1|
|`tu op=10 mat_cvp`|`string`|8|`time,typ`|1|
|`tu op=10 mat_data`|`string`|8|`time,typ`|1|
|`tu op=10 mat_json`|`string`|8|`time,typ`|1|
|`tu op=11 cvp`|`string`|8|`xk|ghw\k`|1|
|`tu op=11 mat`|`string`|8|`xk|ghw\k`|1|
|`tu op=11 mat_cvp`|`string`|8|`xk|ghw\k`|1|
|`tu op=11 mat_data`|`string`|8|`xk|ghw\k`|1|
|`tu op=11 mat_json`|`string`|8|`xk|ghw\k`|1|
|`tu op=12 cvp`|`string`|6|`KXOT[D`|1|
|`tu op=12 mat`|`string`|6|`KXOT[D`|1|
|`tu op=12 mat_cvp`|`string`|6|`KXOT[D`|1|
|`tu op=12 mat_data`|`string`|6|`KXOT[D`|1|
|`tu op=12 mat_json`|`string`|6|`KXOT[D`|1|
|`tu op=13 cvp`|`string`|8|`ba2dik3j`|1|
|`tu op=13 mat`|`string`|8|`ba2dik3j`|1|
|`tu op=13 mat_cvp`|`string`|8|`ba2dik3j`|1|
|`tu op=13 mat_data`|`string`|8|`ba2dik3j`|1|
|`tu op=13 mat_json`|`string`|8|`ba2dik3j`|1|
|`tu op=14 cvp`|`string`|3|`R@V`|1|
|`tu op=14 mat`|`string`|3|`R@V`|1|
|`tu op=14 mat_cvp`|`string`|3|`R@V`|1|
|`tu op=14 mat_data`|`string`|3|`R@V`|1|
|`tu op=14 mat_json`|`string`|3|`R@V`|1|
|`tu op=15 cvp`|`string`|6|`/`|1|
|`tu op=15 mat`|`string`|6|`/`|1|
|`tu op=15 mat_cvp`|`string`|6|`/`|1|
|`tu op=15 mat_data`|`string`|6|`/`|1|
|`tu op=15 mat_json`|`string`|6|`/`|1|
|`tu op=16 cvp`|`string`|7|`m||sgiu`|1|
|`tu op=16 mat`|`string`|7|`m||sgiu`|1|
|`tu op=16 mat_cvp`|`string`|7|`m||sgiu`|1|
|`tu op=16 mat_data`|`string`|7|`m||sgiu`|1|
|`tu op=16 mat_json`|`string`|7|`m||sgiu`|1|
|`tu op=17 cvp`|`string`|8|`pLKQdWW`|1|
|`tu op=17 mat`|`string`|8|`pLKQdWW`|1|
|`tu op=17 mat_cvp`|`string`|8|`pLKQdWW`|1|
|`tu op=17 mat_data`|`string`|8|`pLKQdWW`|1|
|`tu op=17 mat_json`|`string`|8|`pLKQdWW`|1|
|`tu op=18 cvp`|`string`|6|`AES_IV`|1|
|`tu op=18 mat`|`string`|6|`AES_IV`|1|
|`tu op=18 mat_cvp`|`string`|6|`AES_IV`|1|
|`tu op=18 mat_data`|`string`|6|`AES_IV`|1|
|`tu op=18 mat_json`|`string`|6|`AES_IV`|1|
|`tu op=19 cvp`|`string`|8|`Q@UI`|1|
|`tu op=19 mat`|`string`|8|`Q@UI`|1|
|`tu op=19 mat_cvp`|`string`|8|`Q@UI`|1|
|`tu op=19 mat_data`|`string`|8|`Q@UI`|1|
|`tu op=19 mat_json`|`string`|8|`Q@UI`|1|
|`tu op=2 cvp`|`string`|8|`%6)#%/`|1|
|`tu op=2 mat`|`string`|8|`%6)#%/`|1|
|`tu op=2 mat_cvp`|`string`|8|`%6)#%/`|1|
|`tu op=2 mat_data`|`string`|8|`%6)#%/`|1|
|`tu op=2 mat_json`|`string`|8|`%6)#%/`|1|
|`tu op=20 cvp`|`string`|6|`#3 /%2`|1|
|`tu op=20 mat`|`string`|6|`#3 /%2`|1|
|`tu op=20 mat_cvp`|`string`|6|`#3 /%2`|1|
|`tu op=20 mat_data`|`string`|6|`#3 /%2`|1|
|`tu op=20 mat_json`|`string`|6|`#3 /%2`|1|
|`tu op=21 cvp`|`string`|8|`,outerHe`|1|
|`tu op=21 mat`|`string`|8|`,outerHe`|1|
|`tu op=21 mat_cvp`|`string`|8|`,outerHe`|1|
|`tu op=21 mat_data`|`string`|8|`,outerHe`|1|
|`tu op=21 mat_json`|`string`|8|`,outerHe`|1|
|`tu op=22 cvp`|`string`|8|`+',* `|1|
|`tu op=22 mat`|`string`|8|`+',* `|1|
|`tu op=22 mat_cvp`|`string`|8|`+',* `|1|
|`tu op=22 mat_data`|`string`|8|`+',* `|1|
|`tu op=22 mat_json`|`string`|8|`+',* `|1|
|`tu op=23 cvp`|`string`|4|` `|1|
|`tu op=23 mat`|`string`|4|` `|1|
|`tu op=23 mat_cvp`|`string`|4|` `|1|
|`tu op=23 mat_data`|`string`|4|` `|1|
|`tu op=23 mat_json`|`string`|4|` `|1|
|`tu op=24 cvp`|`string`|8|`ACCESS_S`|1|
|`tu op=24 mat`|`string`|8|`ACCESS_S`|1|
|`tu op=24 mat_cvp`|`string`|8|`ACCESS_S`|1|
|`tu op=24 mat_data`|`string`|8|`ACCESS_S`|1|
|`tu op=24 mat_json`|`string`|8|`ACCESS_S`|1|
|`tu op=25 cvp`|`string`|8|`ht,clien`|1|
|`tu op=25 mat`|`string`|8|`ht,clien`|1|
|`tu op=25 mat_cvp`|`string`|8|`ht,clien`|1|
|`tu op=25 mat_data`|`string`|8|`ht,clien`|1|
|`tu op=25 mat_json`|`string`|8|`ht,clien`|1|
|`tu op=26 cvp`|`string`|4|`Zv}|`|1|
|`tu op=26 mat`|`string`|4|`Zv}|`|1|
|`tu op=26 mat_cvp`|`string`|4|`Zv}|`|1|
|`tu op=26 mat_data`|`string`|4|`Zv}|`|1|
|`tu op=26 mat_json`|`string`|4|`Zv}|`|1|
|`tu op=27 cvp`|`string`|7|`Wdsrhno`|1|
|`tu op=27 mat`|`string`|7|`Wdsrhno`|1|
|`tu op=27 mat_cvp`|`string`|7|`Wdsrhno`|1|
|`tu op=27 mat_data`|`string`|7|`Wdsrhno`|1|
|`tu op=27 mat_json`|`string`|7|`Wdsrhno`|1|
|`tu op=28 cvp`|`string`|8|`toString`|1|
|`tu op=28 mat`|`string`|8|`toString`|1|
|`tu op=28 mat_cvp`|`string`|8|`toString`|1|
|`tu op=28 mat_data`|`string`|8|`toString`|1|
|`tu op=28 mat_json`|`string`|8|`toString`|1|
|`tu op=29 cvp`|`string`|4|`push`|1|
|`tu op=29 mat`|`string`|4|`push`|1|
|`tu op=29 mat_cvp`|`string`|4|`push`|1|
|`tu op=29 mat_data`|`string`|4|`push`|1|
|`tu op=29 mat_json`|`string`|4|`push`|1|
|`tu op=3 cvp`|`string`|8|`f8mb7ov5`|1|
|`tu op=3 mat`|`string`|8|`f8mb7ov5`|1|
|`tu op=3 mat_cvp`|`string`|8|`f8mb7ov5`|1|
|`tu op=3 mat_data`|`string`|8|`f8mb7ov5`|1|
|`tu op=3 mat_json`|`string`|8|`f8mb7ov5`|1|
|`tu op=30 cvp`|`string`|6|`encode`|1|
|`tu op=30 mat`|`string`|6|`encode`|1|
|`tu op=30 mat_cvp`|`string`|6|`encode`|1|
|`tu op=30 mat_data`|`string`|6|`encode`|1|
|`tu op=30 mat_json`|`string`|6|`encode`|1|
|`tu op=31 cvp`|`string`|8|`z9brro23`|1|
|`tu op=31 mat`|`string`|8|`z9brro23`|1|
|`tu op=31 mat_cvp`|`string`|8|`z9brro23`|1|
|`tu op=31 mat_data`|`string`|8|`z9brro23`|1|
|`tu op=31 mat_json`|`string`|8|`z9brro23`|1|
|`tu op=4 cvp`|`string`|3|`0<-`|1|
|`tu op=4 mat`|`string`|3|`0<-`|1|
|`tu op=4 mat_cvp`|`string`|3|`0<-`|1|
|`tu op=4 mat_data`|`string`|3|`0<-`|1|
|`tu op=4 mat_json`|`string`|3|`0<-`|1|
|`tu op=5 cvp`|`string`|7|`V]GAZV@`|1|
|`tu op=5 mat`|`string`|7|`V]GAZV@`|1|
|`tu op=5 mat_cvp`|`string`|7|`V]GAZV@`|1|
|`tu op=5 mat_data`|`string`|7|`V]GAZV@`|1|
|`tu op=5 mat_json`|`string`|7|`V]GAZV@`|1|
|`tu op=6 cvp`|`string`|8|`-:!.1):`|1|
|`tu op=6 mat`|`string`|8|`-:!.1):`|1|
|`tu op=6 mat_cvp`|`string`|8|`-:!.1):`|1|
|`tu op=6 mat_data`|`string`|8|`-:!.1):`|1|
|`tu op=6 mat_json`|`string`|8|`-:!.1):`|1|
|`tu op=7 cvp`|`string`|8|`[YH~NSKO`|1|
|`tu op=7 mat`|`string`|8|`[YH~NSKO`|1|
|`tu op=7 mat_cvp`|`string`|8|`[YH~NSKO`|1|
|`tu op=7 mat_data`|`string`|8|`[YH~NSKO`|1|
|`tu op=7 mat_json`|`string`|8|`[YH~NSKO`|1|
|`tu op=8 cvp`|`string`|6|`trict;`|1|
|`tu op=8 mat`|`string`|6|`trict;`|1|
|`tu op=8 mat_cvp`|`string`|6|`trict;`|1|
|`tu op=8 mat_data`|`string`|6|`trict;`|1|
|`tu op=8 mat_json`|`string`|6|`trict;`|1|
|`tu op=9 cvp`|`string`|7|`Vy{lo`q`|1|
|`tu op=9 mat`|`string`|7|`Vy{lo`q`|1|
|`tu op=9 mat_cvp`|`string`|7|`Vy{lo`q`|1|
|`tu op=9 mat_data`|`string`|7|`Vy{lo`q`|1|
|`tu op=9 mat_json`|`string`|7|`Vy{lo`q`|1|

## 各轮负结论与新线索

- 第 1 轮 `078`：未命中 data；本轮共 1 个暂停帧、1605 个试调用。新线索：优先保留素材帧与大函数帧的交集，并继续扫描 `ts` 的 op 25；前四轮脚本早期采用异步包装时结果记录为 undefined/raw 空对象，已在脚本中改成暂停帧内同步取值。
- 第 2 轮 `065`：未命中 data；本轮共 6 个暂停帧、6420 个试调用。新线索：优先保留素材帧与大函数帧的交集，并继续扫描 `ts` 的 op 25；前四轮脚本早期采用异步包装时结果记录为 undefined/raw 空对象，已在脚本中改成暂停帧内同步取值。
- 第 3 轮 `059`：未命中 data；本轮共 1 个暂停帧、1605 个试调用。新线索：优先保留素材帧与大函数帧的交集，并继续扫描 `ts` 的 op 25；前四轮脚本早期采用异步包装时结果记录为 undefined/raw 空对象，已在脚本中改成暂停帧内同步取值。
- 第 4 轮 `096`：未命中 data；本轮共 5 个暂停帧、6100 个试调用。新线索：优先保留素材帧与大函数帧的交集，并继续扫描 `ts` 的 op 25；前四轮脚本早期采用异步包装时结果记录为 undefined/raw 空对象，已在脚本中改成暂停帧内同步取值。
- 第 5 轮 `063`：已命中；入口线索收敛到 frame 3 的 `ts/op=25`，素材变量为该帧 `materials[0]`。

## 入口/形态矩阵解释

- `ts(op, mat)`：本轮唯一稳定命中 data 的入口是 `op=25`；mat 变体输出约 844 字符。
- `ts(op, mat_json)`：同 op 产出约 860 字符，仍为 `JRMnXw`。
- `ts(op, mat_cvp)` / `ts(op, mat_data)`：分别约 848/844 字符，仍为 `JRMnXw`。
- `ts(op, cvp)`：op 25 产出 3036 字符、`JRMkRw`，证明 cvp 输入会切换到长数据形态。
- 其余 `th/tu/np/nh/e/s/tl/tc` 与 op 0-31 的大量组合在本批帧中主要为 undefined、标量或短字符串；既有 `tl(op=19, mat)` 的 3436 字符 `V0VCI2Fi` 证据保持有效，但不是本轮 data 命中。

## 下轮入口

1. 固定 `ts`、`op=25`，继续对素材对象、JSON 素材、cvp 与 cvp.data 做版本抽样。
2. 在新 pe 版本中优先命中包含 `TrackList/TrackStartTime` 的帧；若同帧存在多个素材变量，逐个替换 `materials[0]`。
3. 对 `ts(25,*)` 保存完整 type/len/head，并以 `^JRMnXw` 与 700-800 字符为自动验收条件。

## 产物

- 改造脚本：`/tmp/zt/za11_s9d_chain.mjs`
- 本轮 JSON：`/tmp/zai-recon-5/s9d-*.json`
- 最后一轮快照：`/tmp/zai-recon-5/S9-LAST.json`
