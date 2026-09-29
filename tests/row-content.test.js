"use strict";

const assert=require("assert");
const fs=require("fs");
const vm=require("vm");

const context={window:{}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(require.resolve("../row-content.js"),"utf8"),context);
const api=context.window.ShianRowContent;

const state={
  rows:4,
  rowMeasureCounts:[2,2,2,2],
  lyricsVisible:true,
  vocalVisible:true,
  lyrics:["歌詞あり"," \n\u3000","","歌詞だけ"],
  vocalNotes:[{m:0,p:0,v:"4"},{m:3,p:0,v:"・"},{m:6,p:0,v:"7"}]
};

assert.deepStrictEqual(JSON.parse(JSON.stringify(api.rows(state))),[
  {row:0,lyrics:true,vocal:true,hasLyrics:true,hasVocal:true},
  {row:1,lyrics:false,vocal:true,hasLyrics:false,hasVocal:true},
  {row:2,lyrics:false,vocal:false,hasLyrics:false,hasVocal:false},
  {row:3,lyrics:true,vocal:true,hasLyrics:true,hasVocal:true}
]);

state.vocalVisible=false;
assert.strictEqual(api.visibility(state,0).lyrics,true);
assert.strictEqual(api.visibility(state,0).vocal,false);
assert.strictEqual(api.hasVocal(state,0),true);
assert.strictEqual(api.meaningfulText("\u200B\n "),false);
assert.strictEqual(api.meaningfulText("　あ　"),true);

const indexHtml=fs.readFileSync(require.resolve("../index.html"),"utf8");
const annotationsHtml=fs.readFileSync(require.resolve("../annotations.html"),"utf8");
const printJs=fs.readFileSync(require.resolve("../print-v2.js"),"utf8");
assert(indexHtml.includes("const rowContent=ShianRowContent.rows(state)"));
assert(annotationsHtml.includes("const rowContent=ShianRowContent.rows(state)"));
assert(printJs.includes("const rowContent=global.ShianRowContent.rows(state)"));
assert(printJs.includes("row.printHeight=row.basePrintHeight+row.printGapTotal"));
assert(printJs.includes("row.basePrintHeight=Math.max(intrinsicHeight,sharedStaffHeight)"));
assert(!printJs.includes("sharedStaffHeight-(maximumSongBand-rowSongBand)"));
assert(indexHtml.includes("requiredByBoundary"));
assert(indexHtml.includes("ShianAnnotationLayout.placementTopWithClearance"));
assert(annotationsHtml.includes("ShianAnnotationLayout.placementTopWithClearance"));
assert(indexHtml.includes('const placement=item?.type==="text"?item.layoutPlacement:null'));
assert(printJs.includes("row.showLyrics?`<div class=\"pv2-lyrics\""));
assert(printJs.includes("row.showVocal?`<div class=\"pv2-vocal\""));

console.log("row content tests passed");
