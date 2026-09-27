const assert=require("assert");
const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");

for(const page of ["index.html","annotations.html"]){
  const html=read(page);
  assert(html.includes("@media screen and (min-width:900px)")&&html.includes(".note:not(.rest) b{transform:translate(-50%,-50%) scale(var(--note-scale-x,1),1.30)}"),`${page}: PC note glyph must use scaleY 1.30 around its center`);
  assert(html.includes(".note.rest b{transform:translate(-50%,-50%) scaleX(var(--note-scale-x,1))}"),`${page}: rests must not use the vertical scale`);
  assert(html.includes("scaleY(1.30)!important;transform-origin:center center!important}.note.rest b{transform:translate(-50%,-50%)!important}"),`${page}: print CSS must scale pitched digits once and exclude rests`);
  assert(html.includes(".note.d2:not(.rest)::after,.note.d1:not(.rest)::after{z-index:3;top:calc(50% + 9px)"),`${page}: non-PC baseline must remain unchanged`);
  assert(!html.includes(".string:last-child .note.d2:not(.rest)::after"),`${page}: the first string must not have a separate raised rhythm line`);
  assert(html.includes("const rhythmOffset=window.innerWidth>=900?(14*1.30/2+2)*scale:9"),`${page}: the PC rhythm-line offset must derive from transformed note height plus a 2px gap without changing smaller screens`);
  assert(html.includes('paper.style.setProperty("--screen-rhythm-offset",`${rhythmOffset.toFixed(2)}px`)'),`${page}: the common rhythm-line offset must follow the PC score scale`);
  assert(!html.includes("--screen-bottom-rhythm-offset"),`${page}: the obsolete first-string rhythm-line offset must be removed`);
}

const printCss=read("print-v2.css");
assert(printCss.includes("transform:scaleY(1.30);transform-origin:center center"),"print-v2 digit glyph must use scaleY 1.30 around its center");
assert(printCss.includes(".pv2-note.rest .pv2-glyph")&&printCss.includes("font-size:14px;transform:none"),"print-v2 rests must not use the vertical scale");
assert(printCss.includes(".pv2-note.d2::after,.pv2-note.d1::after")&&printCss.includes("top:var(--pv2-rhythm-top)"),"print-v2 rhythm line must use the transformed print glyph size");
assert(printCss.includes(".pv2-note.open.d2::after,.pv2-note.open.d1::after{top:var(--pv2-open-rhythm-top)}"),"print-v2 open-string line must include the existing 1.07 visual correction");

const printJs=read("print-v2.js");
assert(printJs.includes("const PRINT_NOTE_SCALE_Y=1.30,PRINT_NOTE_CENTER_Y=7,PRINT_RHYTHM_GAP=2,OPEN_NOTE_SCALE=1.07"),"print-v2 must define one shared 130% glyph/2px-gap geometry");
assert(printJs.includes("const printRhythmTop=(noteSize,open=false)=>PRINT_NOTE_CENTER_Y+Math.max(14,Number(noteSize)||14)*(open?OPEN_NOTE_SCALE:1)*PRINT_NOTE_SCALE_Y/2+PRINT_RHYTHM_GAP"),"print-v2 line offset must derive from the density-selected note size");
assert(printJs.includes("--pv2-rhythm-top:${printRhythmTop(measure.noteSize).toFixed(3)}px")&&printJs.includes("--pv2-open-rhythm-top:${printRhythmTop(measure.noteSize,true).toFixed(3)}px"),"each print measure must receive normal/open rhythm offsets");
assert(!printCss.includes(".pv2-note.d2::after,.pv2-note.d1::after{content:\"\";position:absolute;left:50%;top:18px"),"print-v2 must not retain the fixed 18px line top");

console.log("note vertical scale tests passed");
