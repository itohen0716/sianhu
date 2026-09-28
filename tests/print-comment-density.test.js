const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"..","print-v2.js"),"utf8");
const window={};
const document={createElement(){return{getContext(){return{font:"",measureText(text){return{width:String(text).length*8}}}}}},querySelector(){return null},querySelectorAll(){return[]}};
vm.runInNewContext(source,{window,document,console});
const {horizontalFitScale,screenRelativeCommentPlacement}=window.ShianPrintV2;

const before=screenRelativeCommentPlacement(
  {row:0,lane:"beforeScore",offsetFromNextTop:-.25,heightLines:1},
  {top:64,bottom:82},
  {scoreTop:100,scoreBottom:136},
  18
);
assert.equal(before.offsetFromNextTop,-2,"the rendered screen position, not a stale saved offset, drives print placement");
assert.equal(before.heightLines,1,"comment height remains expressed in staff-line units");

const after=screenRelativeCommentPlacement(
  {row:2,lane:"afterScore",offsetTop:0,heightLines:1},
  {top:245,bottom:272},
  {scoreTop:180,scoreBottom:218},
  18
);
assert.equal(after.offsetTop,1.5,"lower-row comments preserve their row-relative distance");
assert.equal(after.heightLines,1.5,"multi-line comments keep their rendered height ratio");

const loose=horizontalFitScale([{left:.2,w:14},{left:.8,w:14}],180,column=>column.w);
assert.equal(loose,1,"low-density measures are not reduced");
const dense=horizontalFitScale([{left:.40,w:18},{left:.46,w:18}],160,column=>column.w);
assert.ok(dense<1&&dense>=.68,"only colliding print columns receive a bounded fit correction");
assert.match(source,/if\(target==="page"\)[\s\S]*return applyPrintPlacement\(mapped,placement\)/,"page-anchored comments must use the same row-relative print Y placement as staff comments");

console.log("print comment/density tests passed");
