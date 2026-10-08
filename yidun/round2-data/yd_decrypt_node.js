/* Node 侧解密器：全部使用 SDK 抽取出的原语，验证 Python 生成的密文 */
const M = require('./yd_crypto_extracted.js');
const R = M.raw;
const U = M.a0_0x1e60_utils;

const SBOX = R.SBOXHEX.match(/../g).map(h => parseInt(h,16));          // 256 字节
const SBOX_INV = new Array(256); SBOX.forEach((v,i)=>SBOX_INV[v]=i);

function pad64(a){                                             // _0x17d8ba
  if(!a.length) return new Array(64).fill(0);
  if(a.length>=64) return a.slice(0,64);
  const o=[]; for(let i=0;i<64;i++) o[i]=a[i%a.length]; return o;
}
function sub(a,b){ return a.map((v,i)=> (v - b[i%b.length]) & 0xff); }   // shifts 的逆
function roundInv(blk){                                        // ROUND_KEY 逆序 + 逆运算
  const ops=[]; for(let i=0;i<R.ROUNDKEY.length;i+=4)
    ops.push([parseInt(R.ROUNDKEY.substr(i,2),16), parseInt(R.ROUNDKEY.substr(i+2,2),16)]);
  let b = blk.map(x=>x&0xff);
  for(let k=ops.length-1;k>=0;k--){
    const [op,arg]=ops[k], a=arg;
    if(op===0){}
    else if(op===1) b=b.map(v=>v^(a&0xff));
    else if(op===2) b=b.map(v=>(v-(a&0xff))&0xff);
    else if(op===3) b=b.map((v,i)=>v^((a+i)&0xff));
    else if(op===4) b=b.map((v,i)=>(v-((a+i)&0xff))&0xff);
    else if(op===5) b=b.map((v,i)=>v^((a-i)&0xff));
    else if(op===6) b=b.map((v,i)=>(v-((a-i)&0xff))&0xff);
  }
  return b;
}
function deriveKey(rand4){
  const seed = U.stringToBytes(R.SEEDKEY);                     // 32 字节 ASCII
  let k = pad64(seed), r = pad64(rand4.map(x=>x&0xff));
  return U.xors(k, r);
}
function decrypt(cipher){
  const raw = R.privDecode(cipher, R.ALPHA.split(''), R.PAD).map(x=>x&0xff);
  if((raw.length-4)%64!==0) throw new Error('bad len '+raw.length);
  const rand4 = raw.slice(0,4), KEY = deriveKey(rand4);
  let prev = KEY.slice(), body = [];
  const nblk = (raw.length-4)/64;
  for(let i=0;i<nblk;i++){
    const cblk = raw.slice(4+64*i, 4+64*i+64);
    let t = cblk.map(v=>SBOX_INV[SBOX_INV[v]]);                // 逆 sbox²
    t = U.xors(t, prev);
    t = sub(t, prev);
    t = U.xors(t, KEY);
    body = body.concat(roundInv(t));
    prev = cblk;
  }
  const total = body.length;
  const dlen = (body[total-4]<<24)|(body[total-3]<<16)|(body[total-2]<<8)|body[total-1];
  const plainBytes = body.slice(0, dlen-8);
  const crc8 = body.slice(dlen-8, dlen).map(b=>String.fromCharCode(b)).join('');
  const expect = U.genCrc32(plainBytes);
  return { plain: U.bytesToString(plainBytes), crcOk: crc8===expect, nblk, crc8, expect };
}
module.exports = { decrypt };

if (require.main === module) {
  const fs=require('fs');
  const vecs = JSON.parse(fs.readFileSync(process.argv[2]||'round2-data/py_vectors.json','utf8'));
  let ok=0;
  for(const v of vecs){
    const r = decrypt(v.cipher);
    const good = r.plain===v.plain && r.crcOk;
    if(good) ok++;
    else console.log('MISMATCH', JSON.stringify(v.plain.slice(0,40)), '->', JSON.stringify(r.plain.slice(0,40)), r.crc8, r.expect);
  }
  console.log(`[Node 原语解密 Python 密文] ${ok}/${vecs.length} 通过  ${ok===vecs.length?'✅':'❌'}`);
}
