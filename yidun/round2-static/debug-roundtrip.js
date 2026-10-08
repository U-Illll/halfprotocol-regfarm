global.window={encodeURIComponent,decodeURIComponent,parseInt,parseFloat,Math,location:{},navigator:{}};
global.document={getElementById:()=>null,createElement:()=>({setAttribute(){},style:{},contentWindow:undefined}),createTextNode:()=>({}),body:{appendChild(){},removeChild(){}}};
const {req}=require('./extract-crypto.js');
const U=req(0x1a),C=req(0x1b),B=req(0x3a),A=req(0xa);
const SBOX=U.hexsToBytes(C.__SBOX__).map(b=>b&0xff);
const hex=(a)=>a.map(b=>(b&0xff).toString(16).padStart(2,'0')).join('');
const plain='vfnv46'+'A'.repeat(26);
const enc=A.aes(plain);
console.log('enc',enc,'len',enc.length);
// 我的 b64 解码
const ALPHA=C.__BASE64_ALPHABET__;
function dec64(str){const cut=str.indexOf('7');const body=cut===-1?str:str.slice(0,cut);const out=[];let i=0;
 for(;i+4<=body.length;i+=4){const n=(ALPHA.indexOf(body[i])<<18)|(ALPHA.indexOf(body[i+1])<<12)|(ALPHA.indexOf(body[i+2])<<6)|ALPHA.indexOf(body[i+3]);out.push((n>>>16)&0xff,(n>>>8)&0xff,n&0xff);}
 const rem=body.length-i;
 if(rem===2){const n=(ALPHA.indexOf(body[i])<<12)|(ALPHA.indexOf(body[i+1])<<6);out.push((n>>>10)&0xff);}
 else if(rem===3){const n=(ALPHA.indexOf(body[i])<<12)|(ALPHA.indexOf(body[i+1])<<6)|ALPHA.indexOf(body[i+2]);out.push((n>>>10)&0xff,(n>>>2)&0xff);}
 return out;}
const bytes=dec64(enc);
console.log('cipher bytes len',bytes.length,hex(bytes));
const iv=bytes.slice(0,4);
console.log('iv',hex(iv));
const expand64=(arr)=>{if(!arr.length)return new Array(64).fill(0); if(arr.length>=64) return arr.slice(0,64); const o=[];for(let i=0;i<64;i++)o[i]=arr[i%arr.length];return o;};
const rk=U.xors(expand64(U.stringToBytes(C.__SEED_KEY__)),expand64(iv));
console.log('rk',hex(rk));
// 用 SDK 的 F 复刻做正向加密验证（需要 ops）
const ops=[];const R=C.__ROUND_KEY__;
for(let p=0;p<R.length;p+=4){const seg=R.substring(p,p+4);ops.push({kind:U.hexToByte(seg.substring(0,2)),arg:U.hexToByte(seg.substring(2,4))});}
console.log('ops',JSON.stringify(ops));
function opFwd(o,arr){let b=U.toByte(o.arg);
 if(o.kind===3)return arr.map(v=>U.xor(v,b++));
 if(o.kind===2)return arr.map(v=>U.shift(v,b));
 if(o.kind===6)return arr.map(v=>U.shift(v,b--));
 if(o.kind===5)return arr.map(v=>U.xor(v,b--));
 throw new Error('kind '+o.kind);}
function opInv(o,arr){let b=U.toByte(o.arg);
 if(o.kind===3)return arr.map(v=>U.xor(v,b++));
 if(o.kind===2)return arr.map(v=>U.shift(v,-b));
 if(o.kind===6)return arr.map(v=>U.shift(v,-b--));
 if(o.kind===5)return arr.map(v=>U.xor(v,b--));
 throw new Error('kind '+o.kind);}
// 重建明文 buffer（用 SDK genCrc32 + 我复刻的 pad）
const data=U.stringToBytes(plain);
const crc=U.stringToBytes(U.genCrc32(data));
const buf=[...data,...crc];
const gap=64-(buf.length%64)-4;
const padded=[...buf,...new Array(gap).fill(0),...U.intToBytes(buf.length)];
console.log('padded len',padded.length,hex(padded));
// 正向加密
const blocks=[];for(let i=0;i<padded.length;i+=64)blocks.push(padded.slice(i,i+64));
let prev=rk; const out=[...iv];
for(const blk of blocks){
  let t=U.xors(ops.reduce((a,o)=>opFwd(o,a),blk),rk);
  let u=U.shifts(t,prev);
  t=U.xors(u,prev);
  const S=(arr)=>arr.map(b=>SBOX[0x10*((b>>>4)&0xf)+(0xf&b)]);
  prev=S(S(t));
  out.push(...prev);
}
console.log('my enc bytes',hex(out));
console.log('match cipher:',hex(out)===hex(bytes));
// 解密验证
const INV=new Array(256);for(let i=0;i<256;i++)INV[SBOX[i]]=i;
const Sinv=(arr)=>arr.map(b=>INV[b&0xff]);
const subShift=(arr,key)=>arr.map((v,i)=>U.shift(v,-key[i%key.length]));
let p2=rk; const plainOut=[];
for(let i=4;i+64<=bytes.length;i+=64){
  const c=bytes.slice(i,i+64);
  let t=Sinv(Sinv(c));
  let a=U.xors(t,p2);
  let y=subShift(a,p2);
  let f=U.xors(y,rk);
  const P=[...ops].reverse().reduce((acc,o)=>opInv(o,acc),f);
  plainOut.push(...P);
  p2=c;
}
console.log('dec plain hex',hex(plainOut));
