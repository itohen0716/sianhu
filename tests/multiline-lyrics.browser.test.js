"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const {chromium}=require("playwright");

const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".ttf":"font/ttf",".json":"application/json"};
const server=http.createServer((request,response)=>{
  const pathname=new URL(request.url,"http://127.0.0.1").pathname;
  const relative=pathname==="/"?"index.html":pathname.replace(/^\/+/,"");
  const file=path.resolve(root,relative);
  if(!file.startsWith(`${root}${path.sep}`)&&file!==path.join(root,"index.html")){response.writeHead(403).end();return}
  fs.readFile(file,(error,data)=>{if(error){response.writeHead(404).end();return}response.writeHead(200,{"Content-Type":types[path.extname(file)]||"application/octet-stream"});response.end(data)});
});

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  let browser;
  try{
    const executablePath=process.env.SHIAN_CHROMIUM_EXECUTABLE||undefined;
    browser=await chromium.launch({headless:true,...(executablePath?{executablePath,args:["--no-sandbox"]}:{})});
  }catch(error){
    if(String(error?.message||error).includes("Executable doesn't exist")){
      console.log("multiline lyrics browser test skipped: Playwright browser is not installed");
      await new Promise(resolve=>server.close(resolve));
      return;
    }
    throw error;
  }

  try{
    const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
    page.on("pageerror",error=>errors.push(String(error)));
    const base=`http://127.0.0.1:${server.address().port}`;
    const score={
      notes:[{m:0,s:3,p:0,d:4,v:"1",x:0},{m:4,s:3,p:0,d:4,v:"2",x:0},{m:8,s:3,p:0,d:4,v:"3",x:0},{m:12,s:3,p:0,d:4,v:"4",x:0}],
      tuplets:[],vocalNotes:[],vocalSlurs:[],scoreParts:[],barlineKinds:{},measureSpecials:{},
      title:"複数段歌詞テスト",tuning:"二上り",meter:"2/4",rows:4,measuresPerRow:4,rowMeasureCounts:[4,4,4,4],measureOffsets:[],
      lyricsMode:true,lyricsVisible:true,vocalVisible:false,lyrics:["一行目","一行目\n二行目","一行目\n二行目\n三行目",""],lyricsGlyphAnchors:[],
      layers:[{id:"technique-layer",name:"奏法",visible:true,fixed:true,items:[]}],activeLayerId:"technique-layer",scoreEditLayer:"vocal"
    };
    await page.addInitScript(value=>localStorage.setItem("shian-bunkafu-editor-v2",JSON.stringify(value)),score);
    await page.goto(`${base}/index.html`);
    await page.waitForSelector('textarea[data-lyrics-row="2"]');

    const initial=await page.evaluate(()=>{
      const fields=[...document.querySelectorAll(".lyrics-field")].slice(0,3),inputs=[...document.querySelectorAll("textarea[data-lyrics-row]")].slice(0,3),staffs=[...document.querySelectorAll("#scoreArea .staff")];
      return{
        tags:inputs.map(input=>input.tagName),lines:inputs.map(input=>Number(input.dataset.lyricsLines)),heights:fields.map(field=>field.getBoundingClientRect().height),staffTops:staffs.map(staff=>staff.getBoundingClientRect().top),lineStep:Number.parseFloat(getComputedStyle(inputs[0]).lineHeight),glyphLines:[...document.querySelectorAll('[data-lyrics-display-row="2"] [data-lyric-line]')].map(glyph=>Number(glyph.dataset.lyricLine)),firstGlyphX:[0,1,2].map(line=>Number(document.querySelector(`[data-lyrics-display-row="2"] [data-lyric-line="${line}"]`)?.dataset.lyricX))
      };
    });
    assert.deepEqual(initial.tags,["TEXTAREA","TEXTAREA","TEXTAREA"]);
    assert.deepEqual(initial.lines,[1,2,3]);
    assert.ok(Math.abs((initial.heights[1]-initial.heights[0])-initial.lineStep)<1.5,"two lines add exactly one compact line step");
    assert.ok(Math.abs((initial.heights[2]-initial.heights[1])-initial.lineStep)<1.5,"three lines add exactly one further line step");
    assert.deepEqual([...new Set(initial.glyphLines)].sort(),[0,1,2]);
    assert.ok(Math.max(...initial.firstGlyphX)-Math.min(...initial.firstGlyphX)<.002,"each lyric line restarts from the same score position");

    const rowOneTopBefore=initial.staffTops[1];
    await page.locator('textarea[data-lyrics-row="0"]').fill("一行目\n二行目\n三行目");
    await page.waitForFunction(()=>document.querySelector('textarea[data-lyrics-row="0"]')?.dataset.lyricsLines==="3");
    const grown=await page.evaluate(()=>({field:document.querySelector('textarea[data-lyrics-row="0"]').closest(".lyrics-field").getBoundingClientRect().height,nextTop:document.querySelectorAll("#scoreArea .staff")[1].getBoundingClientRect().top}));
    assert.ok(Math.abs((grown.field-initial.heights[0])-initial.lineStep*2)<2,"adding two lines grows only the lyric area by two line steps");
    assert.ok(Math.abs((grown.nextTop-rowOneTopBefore)-initial.lineStep*2)<2,"the following score row moves by the same real lyric height");

    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shian-bunkafu-editor-v2")));
    assert.equal(saved.lyrics[0],"一行目\n二行目\n三行目");
    assert.ok(saved.lyricsGlyphAnchors[0].glyphs.every(glyph=>!Object.prototype.hasOwnProperty.call(glyph,"line")),"the existing glyph-anchor JSON shape stays unchanged");

    await page.reload();
    await page.waitForSelector('textarea[data-lyrics-row="0"]');
    assert.equal(await page.locator('textarea[data-lyrics-row="0"]').inputValue(),"一行目\n二行目\n三行目");
    assert.equal(await page.locator('textarea[data-lyrics-row="0"]').getAttribute("data-lyrics-lines"),"3");
    assert.ok(await page.locator('[data-lyrics-display-row="0"] [data-lyric-line="2"]').count()>0,"line identity is rebuilt from the saved lyric text after reload");

    await page.evaluate(()=>{window.print=()=>{document.documentElement.dataset.printCalled="true"}});
    await page.click("#printPreview");
    await page.click('#printForm button[type="submit"]');
    await page.waitForSelector("#printRootV2 .pv2-lyrics");
    await page.emulateMedia({media:"print"});
    const printed=await page.evaluate(()=>({heights:[...document.querySelectorAll("#printRootV2 .pv2-lyrics")].slice(0,3).map(item=>item.getBoundingClientRect().height),glyphTops:[...document.querySelectorAll('#printRootV2 [data-print-row="0"] .pv2-lyrics-glyph')].map(item=>Number.parseFloat(item.style.top)||0)}));
    assert.deepEqual(printed.heights.map(Math.round),[69,47,69],"print uses the same 25px base plus 22px per additional lyric line");
    assert.ok(printed.glyphTops.includes(44),"third-line print glyphs are positioned on the third lyric line");
    await page.emulateMedia({media:"screen"});

    await page.goto(`${base}/annotations.html`);
    await page.waitForSelector('textarea[data-lyrics-row="0"]');
    assert.equal(await page.locator('textarea[data-lyrics-row="0"]').inputValue(),"一行目\n二行目\n三行目");
    assert.equal(await page.locator('textarea[data-lyrics-row="0"]').getAttribute("data-lyrics-lines"),"3");
    assert.deepEqual(errors,[],"changed pages load without runtime errors");
    console.log("multiline lyrics browser test passed");
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1});
