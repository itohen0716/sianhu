const assert=require("assert");
const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");

for(const page of ["index.html","annotations.html"]){
  const html=read(page);
  assert(html.includes("scale(var(--note-scale-x,1),1.10);transform-origin:center center"),`${page}: screen note glyph must use scaleY 1.10 around its center`);
  assert(html.includes(".note.rest b{transform:translate(-50%,-50%) scaleX(var(--note-scale-x,1))}"),`${page}: rests must not use the vertical scale`);
  assert(html.includes("scaleY(1.10)!important;transform-origin:center center!important}.note.rest b{transform:translate(-50%,-50%)!important}"),`${page}: print CSS must scale pitched digits once and exclude rests`);
}

const printCss=read("print-v2.css");
assert(printCss.includes("transform:scaleY(1.10);transform-origin:center center"),"print-v2 digit glyph must use scaleY 1.10 around its center");
assert(printCss.includes(".pv2-note.rest .pv2-glyph")&&printCss.includes("font-size:14px;transform:none"),"print-v2 rests must not use the vertical scale");

console.log("note vertical scale tests passed");
