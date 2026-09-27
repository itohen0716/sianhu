"use strict";
const assert=require("node:assert/strict");
const density=require("../note-density.js");
const measureText=(text,size)=>String(text).length*size*.55+2;
const select=(notes,measureWidth=120,capacity=8)=>density.select({notes,measureWidth,capacity,measureText});

assert.equal(select([0,4].map(p=>({p,v:"3"}))).size,18,"4分中心の低密度小節は18px");
assert.equal(select([0,2,4,6].map(p=>({p,v:"3"}))).size,17,"8分中心の標準小節は17px");
assert.equal(select([0,1,2,3,4,5].map(p=>({p,v:"3"}))).size,16,"やや高密度小節は16px");
assert.equal(select([0,1,2,3,4,5,6,7].map(p=>({p,v:"3"}))).size,15,"16分中心の高密度小節は15px");

const oneDigit=select([0,2,4,6].map(p=>({p,v:"3"}))),twoDigits=select([0,2,4,6].map(p=>({p,v:"18"})));
assert.ok(twoDigits.size<oneDigit.size,"同じ音位置数なら2桁数字を重く評価する");

const stacked=select([{p:0,s:1,v:"18"},{p:0,s:2,v:"18"},{p:4,s:1,v:"3"}]);
const unstacked=select([{p:0,s:1,v:"18"},{p:2,s:2,v:"18"},{p:4,s:1,v:"3"}]);
assert.equal(stacked.columns,2,"同じpの複数弦は横1列として数える");
assert.equal(unstacked.columns,3,"異なるpは別の横列として数える");
assert.ok(stacked.size>=unstacked.size,"縦積みだけで過剰縮小しない");

assert.ok(select([0,2,4,6].map(p=>({p,v:"18"})),180).size>=twoDigits.size,"同じ音列でも小節幅が広ければ同等以上のサイズになる");
const normalScale=density.select({notes:[0,2,4,6].map(p=>({p,v:"3"})),measureWidth:120,capacity:8,measureText,displayScale:1});
const expandedScale=density.select({notes:[0,2,4,6].map(p=>({p,v:"3"})),measureWidth:138,capacity:8,measureText,displayScale:1.15});
assert.equal(expandedScale.size,normalScale.size,"縦横が同比率なら密度段階は安定する");
assert.ok(expandedScale.finalSize>normalScale.finalSize,"拡大時は密度段階を保ったまま最終数字サイズが拡大する");
assert.equal(select([{p:0,v:"3",x:-20},{p:4,v:"6",x:15}]).size,select([{p:0,v:"3"},{p:4,v:"6"}]).size,"表示微調整xは密度段階を変えない");
assert.equal(select([{p:0,v:"3"},{p:1,v:"3",rest:true}]).columns,1,"休符は音価数字密度へ含めない");
console.log("note-density tests: ok");
