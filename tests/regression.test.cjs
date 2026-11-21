const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function fn(name){
 const start=script.indexOf('function '+name+'('); assert.ok(start>=0);
 let depth=0, end=script.indexOf('{',start);
 for(let i=end;i<script.length;i++) {if(script[i]==='{')depth++; if(script[i]==='}'&&--depth===0)return script.slice(start,i+1);}
 throw Error(name);
}
test('inline JavaScript syntax remains valid',()=>new vm.Script(script));
test('integer division includes exactly divisible lower bound',()=>{
 const ctx={BigInt,Math,Number,rnd:()=>9,randBetween:lo=>lo,tryDivDec:()=>null};
 vm.createContext(ctx);vm.runInContext('var TEN=BigInt(10);'+fn('p10')+fn('tryDiv'),ctx);
 const q=ctx.tryDiv(2,1);assert.equal(q.a,10n);assert.equal(q.b,2n);assert.equal(q.ans,5n);
});
test('late answer is timeout even before interval fires',()=>{
 let args;const ctx={S:{locked:false,limit:1,t0:0},performance:{now:()=>1000},resolve:(...a)=>args=a};
 vm.createContext(ctx);vm.runInContext(fn('submit'),ctx);ctx.submit();assert.deepEqual(args,[false,null,true]);
});
test('valid in-time integer answer still passes',()=>{
 let args;const ctx={S:{locked:false,limit:1,t0:0,cur:{op:'+',ans:42n}},els:{answer:{value:'42'}},performance:{now:()=>999},resolve:(...a)=>args=a};
 vm.createContext(ctx);vm.runInContext(fn('submit'),ctx);ctx.submit();assert.deepEqual(args,[true,'42',false,false]);
});
test('records reject wrong shape, corrupt JSON and malformed entries; cap at 2000',()=>{
 const ctx={S:{},opsOrder:['+','−','×','÷'],localStorage:{getItem:()=>raw}};let raw;
 vm.createContext(ctx);vm.runInContext(fn('loadRecords'),ctx);
 for(raw of ['{}','null','broken','[null,{}, {"op":"<script>"}]']){ctx.loadRecords();assert.equal(ctx.S.records.length,0);}
 const valid={t:1,op:'+',la:2,lb:2,ok:1,sec:0.5,carry:0};
 raw=JSON.stringify(Array.from({length:2005},()=>valid));ctx.loadRecords();assert.equal(ctx.S.records.length,2000);
});
test('finish invalidates pending callbacks and supports large infinite sessions',()=>{
 const ctx={S:{qid:4,hideTimer:1,ok:0,bad:0,times:Array(150000).fill(0.1),startAt:Date.now(),log:[]},stopTimer(){},clearTimeout(){},Date,fmtTime:String,show(){},els:{scoreBig:{},scoreSub:{},kpiAvg:{},kpiStreak:{},kpiFast:{},kpiTotal:{},wrongCard:{style:{}},retryWrongBtn:{style:{}}}};
 vm.createContext(ctx);vm.runInContext(fn('finish'),ctx);ctx.finish();assert.equal(ctx.S.qid,5);assert.equal(ctx.S.locked,true);assert.equal(ctx.els.kpiFast.textContent,'0.1');
});
