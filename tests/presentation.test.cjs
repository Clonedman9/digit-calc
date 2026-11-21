const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const script=fs.readFileSync(path.join(root,'assets/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/app.css'),'utf8');

const Core=require('../assets/core.js');
const {fn}=require('./helpers/app.cjs');
function state(){return {ops:['+','−','×'],dg:Object.fromEntries(['+','−','×','÷'].map(op=>[op,{a:2,b:2}])),cnt:{'+':10,'−':10,'×':10,'÷':10},unlimited:false,limit:0,carry:0,divTol:0,showMs:0,adaptShow:false,adaptMin:100};}
function settingsContext(raw){
 const ctx={S:state(),opsOrder:['+','−','×','÷'],localStorage:{getItem:()=>raw}};
 vm.createContext(ctx);vm.runInContext(fn('loadSettings'),ctx);return ctx;
}
function text(){return {textContent:''};}

test('presentation assets are separate and all referenced DOM IDs exist exactly once',()=>{
 assert.match(html,/<link rel="stylesheet" href="assets\/app\.css">/);
 assert.match(html,/<script src="assets\/app\.js" defer><\/script>/);
 assert.ok(html.indexOf('src="assets/core.js"')<html.indexOf('src="assets/app.js"'));
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(new Set(ids).size,ids.length);
 for(const [,id] of script.matchAll(/\$\("([^"]+)"\)/g))assert.ok(ids.includes(id),'Missing '+id);
});

test('inline theme initializer is valid and preserves the existing theme storage key',()=>{
 for(const [,src] of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(src);
 assert.match(html,/localStorage\.getItem\('drill\.theme'\)/);
 assert.match(script,/drill\.records\.v1/);
});

test('no runtime CDN dependencies, unsafe zoom restriction or inline event handlers',()=>{
 assert.doesNotMatch(html,/<(?:script|link)[^>]+(?:src|href)="https?:/);
 assert.doesNotMatch(css,/@import|url\(\s*["']?https?:/);
 assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1|\son\w+=/);
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
 assert.doesNotMatch(script,/addEventListener\("gesturestart"/);
});

test('all inputs have accessible names and views have titled landmarks',()=>{
 for(const [,attributes] of html.matchAll(/<input\b([^>]*)>/g)){
  const id=attributes.match(/\bid="([^"]+)"/)[1];
  assert.ok(attributes.includes('aria-label=')||html.includes('for="'+id+'"')||['cntAdd','cntSub','cntMul','cntDiv','unlimited','adaptShow'].includes(id),id);
 }
 for(const id of ['home','setup','drill','done','stats']){
  assert.match(html,new RegExp('<section[^>]*id="'+id+'View"[^>]*aria-labelledby="'));
 }
 assert.match(html,/id="toast" role="status" aria-live="polite"/);
});

test('saved preferences restore valid custom controls and preserve false/zero values',()=>{
 const ctx=settingsContext(JSON.stringify({ops:['÷','+','+','bogus'],dg:{'+':{a:6,b:3}},cnt:{'+':0,'÷':3},unlimited:true,limit:45.2,carry:2,divTol:5.3,showMs:800,adaptShow:true,adaptMin:60}));
 ctx.loadSettings();
 assert.deepEqual(Array.from(ctx.S.ops),['+','÷']);
 assert.equal(ctx.S.dg['+'].a,6);assert.equal(ctx.S.dg['+'].b,3);
 assert.equal(ctx.S.cnt['+'],0);assert.equal(ctx.S.cnt['÷'],3);
 assert.equal(ctx.S.unlimited,true);assert.equal(ctx.S.limit,45.2);
 assert.equal(ctx.S.carry,2);assert.equal(ctx.S.divTol,5.5);
 assert.equal(ctx.S.showMs,800);assert.equal(ctx.S.adaptShow,true);assert.equal(ctx.S.adaptMin,60);
});

test('corrupt or out-of-range preferences retain defaults and block malformed entries',()=>{
 for(const raw of ['broken','null','[]','"string"',JSON.stringify({ops:'÷',dg:{'+':{a:Infinity,b:-4}},cnt:{'+':10000},unlimited:'yes',limit:0.5,carry:9,divTol:99,showMs:10,adaptShow:true,adaptMin:-1})]){
  const ctx=settingsContext(raw);ctx.loadSettings();
  assert.equal(ctx.S.dg['+'].a,2);assert.equal(ctx.S.dg['+'].b,2);
  assert.equal(ctx.S.cnt['+'],10);assert.equal(ctx.S.limit,0);
  assert.equal(ctx.S.carry,0);assert.equal(ctx.S.showMs,0);
  assert.equal(ctx.S.adaptShow,false);assert.equal(ctx.S.adaptMin,100);
 }
 const ctx=settingsContext(JSON.stringify({showMs:0,adaptShow:true}));ctx.loadSettings();assert.equal(ctx.S.adaptShow,false);
});

test('preference writes wait until hydration is complete and contain no session answers',()=>{
 const saved=[];const ctx={S:state(),UI:{ready:false},clearTimeout(){},persistence:{settingsTimer:null,settingsJSON:null},localStorage:{setItem:(key,value)=>saved.push([key,JSON.parse(value)])}};
 vm.createContext(ctx);vm.runInContext(fn('saveSettings'),ctx);ctx.saveSettings();assert.equal(saved.length,0);
 ctx.UI.ready=true;ctx.S.log=[{ans:'42'}];ctx.saveSettings();assert.equal(saved.length,1);
 assert.equal(saved[0][0],'drill.settings.v1');assert.equal(saved[0][1].log,undefined);
});

test('storage failures leave preference persistence non-fatal',()=>{
 const ctx={S:state(),UI:{ready:true},clearTimeout(){},persistence:{settingsTimer:null,settingsJSON:null},localStorage:{setItem(){throw Error('blocked');}}};
 vm.createContext(ctx);vm.runInContext(fn('saveSettings'),ctx);assert.doesNotThrow(()=>ctx.saveSettings());
});

test('homepage metrics show genuine local records including today count',()=>{
 const UI={total:text(),accuracy:text(),average:text(),averageUnit:text(),today:text()};
 const ctx={UI,Date,Core,S:{records:[{t:Date.now(),op:'+',la:2,lb:2,carry:0,ok:1,sec:2},{t:Date.now(),op:'+',la:2,lb:2,carry:0,ok:0,sec:4}]}};
 ctx.getStats=()=>Core.aggregateRecords(ctx.S.records,0,Date.now());
 vm.createContext(ctx);vm.runInContext(fn('renderHomeStats'),ctx);ctx.renderHomeStats();
 assert.equal(UI.total.textContent,'2');assert.equal(UI.accuracy.textContent,'50%');
 assert.equal(UI.average.textContent,'3.0');assert.equal(UI.averageUnit.textContent,'秒');assert.equal(UI.today.textContent,'今天已练习 2 题');
 ctx.S.records=[];ctx.renderHomeStats();assert.equal(UI.accuracy.textContent,'—');assert.equal(UI.averageUnit.textContent,'');
});

test('range fill remains finite if adaptive limits collapse to the same value',()=>{
 let value;const ctx={};vm.createContext(ctx);vm.runInContext(fn('setFill'),ctx);
 ctx.setFill({min:20,max:20,value:20,style:{setProperty:(_,v)=>value=v}});assert.equal(value,'0%');
});

test('long equations shrink to their actual container width and reset on wider layouts',()=>{
 const expr={style:{},clientWidth:200,scrollWidth:400};
 const ctx={els:{drill:{classList:{contains:()=>true}},qExpr:expr},window:{getComputedStyle:()=>({fontSize:'40px'})}};
 vm.createContext(ctx);vm.runInContext(fn('fitEquation'),ctx);ctx.fitEquation();assert.equal(expr.style.fontSize,'20px');
 expr.scrollWidth=180;ctx.fitEquation();assert.equal(expr.style.fontSize,'');
});
