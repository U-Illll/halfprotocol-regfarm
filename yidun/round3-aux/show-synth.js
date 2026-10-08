// 读取 synth 输出并打印关键校验项
const fs = require('fs');
const txt = fs.readFileSync(process.argv[2], 'utf8');
const j = JSON.parse(txt.slice(txt.indexOf('{')));
console.log('keys:', Object.keys(j));
console.log('selfCheck:', JSON.stringify(j.selfCheck, null, 1));
console.log('encrypted:', JSON.stringify(j.encrypted, null, 1).slice(0, 1200));
console.log('atoms[:5]:', JSON.stringify(j.atoms.slice(0, 5)));
console.log('plain.ext:', j.plain.ext, '| d segs:', j.plain.d.split(':').length, '| f len:', j.plain.f.length);
if (j.encrypted && j.encrypted.f) {
  const L = require('./yd-lib.js');
  const token = j.params.token;
  console.log('本地 round-trip 解 d 字段:', JSON.stringify(L.aesDecrypt(j.encrypted.d).text.slice(0, 60)));
  console.log('本地 round-trip 解 f 字段:', JSON.stringify(L.aesDecrypt(j.encrypted.f).text.slice(0, 40)));
  console.log('解 f 二层:', JSON.stringify(L.xorDecode(token, L.aesDecrypt(j.encrypted.f).text).slice(0, 60)));
  console.log('解 ext 二层:', JSON.stringify(L.xorDecode(token, L.aesDecrypt(j.encrypted.ext).text)));
  console.log('解 p 二层:', JSON.stringify(L.xorDecode(token, L.aesDecrypt(j.encrypted.p).text)));
}
