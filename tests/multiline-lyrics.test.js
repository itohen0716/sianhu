"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const index=read("index.html"),annotations=read("annotations.html"),printJs=read("print-v2.js"),printCss=read("print-v2.css");

for(const [name,source] of [["score",index],["writing",annotations]]){
  assert.match(source,/<textarea class="lyrics-input"[^>]*data-lyrics-lines=/,`${name} page uses a multiline lyric editor`);
  assert.doesNotMatch(source,/<input class="lyrics-input"/,`${name} page no longer forces lyrics into one line`);
  assert.match(source,/lyricLines\(input\.value,\{preserveTrailing:true\}\)/,`${name} page derives its live height from actual lines`);
  assert.match(source,/\(lineCount-1\)\*22\*screenScale/,`${name} page adds one compact 22px step per extra line`);
  assert.match(source,/dataset\.lyricLine=String\(line\)/,`${name} page keeps each glyph's line identity`);
  assert.match(source,/lyricsGlyphAnchors\[row\]=null/,`${name} page rebuilds anchors after lyric edits`);
}

assert.match(printJs,/PRINT_LYRICS_BASE_HEIGHT=25,PRINT_LYRICS_LINE_STEP=22,PRINT_LYRICS_MARGIN_TOP=10/);
assert.match(printJs,/item\.lyricsHeight=item\.showLyrics\?PRINT_LYRICS_BASE_HEIGHT\+Math\.max\(0,item\.lyricsLineCount-1\)\*PRINT_LYRICS_LINE_STEP:0/);
assert.match(printJs,/rowSongBand=printLyricsBandHeight\(row\)\+\(row\.showVocal\?42:0\)/,"print row height uses the real lyric height independently of the vocal band");
assert.match(printJs,/targetHeight=target==="lyrics"\?printLyricsHeight\(row\)/,"lyric-anchored writing items use the real lyric region height");
assert.match(printCss,/height:var\(--pv2-lyrics-height,25px\)/,"print CSS consumes the calculated lyric height");
assert.doesNotMatch(printJs,/row\.showLyrics\?35:0/,"fixed one-line lyric bands are removed from print layout calculations");

const context={window:{ShianRowContent:{lyricLineCount(value){const lines=String(value||"").split("\n");while(lines.length>1&&!lines.at(-1).trim())lines.pop();return String(value||"").trim()?lines.length:0}}},document:{createElement(){return{getContext(){return{font:"",measureText(){return{width:8}}}}}},querySelector(){return null},querySelectorAll(){return[]}},console};
vm.createContext(context);vm.runInContext(printJs,context);
assert.equal(context.window.ShianPrintV2.printLyricLineCount("一行目"),1);
assert.equal(context.window.ShianPrintV2.printLyricLineCount("一行目\n二行目\n三行目"),3);
assert.equal(context.window.ShianPrintV2.printLyricsHeight({showLyrics:true,lyricsHeight:69}),69);
assert.equal(context.window.ShianPrintV2.printLyricsHeight({showLyrics:false,lyricsHeight:69}),0,"empty or hidden lyric rows reserve no print height");

console.log("multiline lyrics tests passed");
