"use strict";

const assert=require("assert");
const fs=require("fs");
const http=require("http");
const path=require("path");
const {chromium}=require("playwright");

const root=path.join(__dirname,"..");
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
  try{browser=await chromium.launch({headless:true})}
  catch(error){
    if(String(error?.message||error).includes("Executable doesn't exist")){
      console.log("comment screen visibility browser test skipped: Playwright browser is not installed");
      await new Promise(resolve=>server.close(resolve));
      return;
    }
    throw error;
  }
  try{
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    const base=`http://127.0.0.1:${server.address().port}`;
    const saved={
      notes:[],rows:1,measuresPerRow:4,rowMeasureCounts:[4],title:"コメント復旧テスト",
      layers:[
        {id:"technique-layer",name:"奏法",visible:true,fixed:true,items:[]},
        {id:"saved-comment-layer",name:"書き込み1",visible:false,printEnabled:true,items:[{id:"saved-comment-1",type:"text",text:"保存済みコメント",x:120,y:280,size:20,color:"#222222",background:"white"}]}
      ],
      activeLayerId:"saved-comment-layer"
    };

    await page.goto(`${base}/index.html`);
    await page.evaluate(value=>localStorage.setItem("shian-bunkafu-editor-v2",JSON.stringify(value)),saved);
    await page.reload();
    await page.waitForSelector('[data-item="saved-comment-1"]');
    assert.strictEqual(await page.locator('[data-item="saved-comment-1"]').count(),1,"score page must draw the saved comment once");

    const afterScore=await page.evaluate(()=>JSON.parse(localStorage.getItem("shian-bunkafu-editor-v2")));
    const scoreLayer=afterScore.layers.find(layer=>layer.id==="saved-comment-layer");
    assert.strictEqual(scoreLayer.visible,true,"score load must restore the printable saved-comment layer");
    assert.strictEqual(scoreLayer.items.length,1,"score load must not duplicate the saved comment");
    assert.strictEqual(scoreLayer.items[0].id,"saved-comment-1");

    await page.evaluate(()=>{
      const value=JSON.parse(localStorage.getItem("shian-bunkafu-editor-v2"));
      value.layers.find(layer=>layer.id==="saved-comment-layer").visible=false;
      localStorage.setItem("shian-bunkafu-editor-v2",JSON.stringify(value));
      window.dispatchEvent(new PageTransitionEvent("pageshow"));
    });
    await page.waitForSelector('[data-item="saved-comment-1"]');
    assert.strictEqual(await page.locator('[data-item="saved-comment-1"]').count(),1,"score pageshow must redraw the same saved comment once");

    await page.goto(`${base}/annotations.html`);
    await page.waitForSelector('[data-item="saved-comment-1"]');
    assert.strictEqual(await page.locator('[data-item="saved-comment-1"]').count(),1,"writing page must draw the same saved comment once");
    assert.strictEqual(await page.locator('[data-layer-visible="saved-comment-layer"]').isChecked(),true,"writing layer display control must agree with the restored state");

    await page.evaluate(()=>{
      const value=JSON.parse(localStorage.getItem("shian-bunkafu-editor-v2"));
      value.layers.find(layer=>layer.id==="saved-comment-layer").visible=false;
      localStorage.setItem("shian-bunkafu-editor-v2",JSON.stringify(value));
      window.dispatchEvent(new PageTransitionEvent("pageshow"));
    });
    await page.waitForSelector('[data-item="saved-comment-1"]');
    assert.strictEqual(await page.locator('[data-item="saved-comment-1"]').count(),1,"writing pageshow must redraw the same editable comment once");

    const afterWriting=await page.evaluate(()=>JSON.parse(localStorage.getItem("shian-bunkafu-editor-v2")));
    const writingLayer=afterWriting.layers.find(layer=>layer.id==="saved-comment-layer");
    assert.strictEqual(writingLayer.items.length,1,"page switching must not copy or delete the comment");
    assert.strictEqual(writingLayer.items[0].text,"保存済みコメント");
    console.log("comment screen visibility browser test passed");
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1});
