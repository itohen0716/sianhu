const assert=require("assert");
const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");

for(const page of ["index.html","annotations.html"]){
  const html=read(page);
  assert(html.includes("scale(var(--note-scale-x,1),1.20);transform-origin:center center"),`${page}: screen note glyph must use scaleY 1.20 around its center`);
  assert(html.includes(".note.rest b{transform:translate(-50%,-50%) scaleX(var(--note-scale-x,1))}"),`${page}: rests must not use the vertical scale`);
  assert(html.includes("scaleY(1.20)!important;transform-origin:center center!important}.note.rest b{transform:translate(-50%,-50%)!important}"),`${page}: print CSS must scale pitched digits once and exclude rests`);
  assert(html.includes(".note.d2:not(.rest)::after,.note.d1:not(.rest)::after{z-index:3;top:calc(50% + 9px)"),`${page}: eighth and sixteenth lines must share the common +9px baseline`);
  assert(!html.includes(".string:last-child .note.d2:not(.rest)::after"),`${page}: the first string must not have a separate raised rhythm line`);
  assert(html.includes('paper.style.setProperty("--screen-rhythm-offset",`${(9*scale).toFixed(2)}px`)'),`${page}: the common rhythm-line offset must follow the PC score scale`);
  assert(!html.includes("--screen-bottom-rhythm-offset"),`${page}: the obsolete first-string rhythm-line offset must be removed`);
}

const printCss=read("print-v2.css");
assert(printCss.includes("transform:scaleY(1.20);transform-origin:center center"),"print-v2 digit glyph must use scaleY 1.20 around its center");
assert(printCss.includes(".pv2-note.rest .pv2-glyph")&&printCss.includes("font-size:14px;transform:none"),"print-v2 rests must not use the vertical scale");
assert(printCss.includes(".pv2-note.d2::after,.pv2-note.d1::after")&&printCss.includes("top:17px"),"print-v2 rhythm line must leave space below the 120% glyph");

console.log("note vertical scale tests passed");
