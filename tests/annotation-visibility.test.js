"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const vm=require("vm");

const context={window:{}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,"..","annotation-visibility.js"),"utf8"),context);
const api=context.window.ShianAnnotationVisibility;

const layers=[
  {id:"technique-layer",visible:false,printEnabled:true,items:[{id:"tech",type:"text",text:"奏法"}]},
  {id:"saved-comment",visible:false,printEnabled:true,items:[{id:"comment-1",type:"text",text:"保存済みコメント"}]},
  {id:"screen-comment",visible:true,printEnabled:true,items:[{id:"comment-2",type:"text",text:"表示中"}]},
  {id:"print-off",visible:false,printEnabled:false,items:[{id:"comment-3",type:"text",text:"印刷対象外"}]},
  {id:"drawing-only",visible:false,printEnabled:true,items:[{id:"rect-1",type:"rect",x1:0,y1:0,x2:10,y2:10}]},
  {id:"blank-comment",visible:false,printEnabled:true,items:[{id:"comment-4",type:"text",text:" \n\u3000"}]}
];
const itemCounts=layers.map(layer=>layer.items.length);
const restored=api.restoreSavedCommentLayers(layers);

assert.deepStrictEqual(Array.from(restored),["saved-comment"]);
assert.strictEqual(layers[1].visible,true,"a saved printable comment layer must return to screen display");
assert.strictEqual(layers[0].visible,false,"the technique layer is not a personal saved-comment recovery target");
assert.strictEqual(layers[3].visible,false,"a print-disabled layer must retain its explicit hidden state");
assert.strictEqual(layers[4].visible,false,"a drawing-only hidden layer must not be changed");
assert.strictEqual(layers[5].visible,false,"blank text is not a saved visible comment");
assert.deepStrictEqual(layers.map(layer=>layer.items.length),itemCounts,"recovery must not copy or delete comment data");
assert.deepStrictEqual(Array.from(api.restoreSavedCommentLayers(layers)),[],"repeated restoration must be idempotent");

const indexHtml=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const annotationsHtml=fs.readFileSync(path.join(__dirname,"..","annotations.html"),"utf8");
const printJs=fs.readFileSync(path.join(__dirname,"..","print-v2.js"),"utf8");
[indexHtml,annotationsHtml].forEach(html=>{
  assert(html.includes("annotation-visibility.js?v=234"));
  assert(html.includes("ShianAnnotationVisibility.restoreSavedCommentLayers(state.layers)"));
  assert.match(html,/addEventListener\("pageshow"[\s\S]{0,600}restoreSavedCommentLayers\(state\.layers\)/,
    "pageshow rehydration must not overwrite the restored screen visibility");
  assert.match(html,/addEventListener\("storage"[\s\S]{0,600}restoreSavedCommentLayers\(state\.layers\)/,
    "cross-page storage rehydration must keep printable saved comments visible");
});
assert(printJs.includes('layer.id!=="technique-layer"&&layer.printEnabled!==false'),"print must keep using the existing saved comment objects");

console.log("annotation visibility tests passed");
