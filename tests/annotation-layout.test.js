"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const vm=require("vm");

const context={window:{document:{querySelector:()=>null}}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(require.resolve("../annotation-layout.js"),"utf8"),context);
const api=context.window.ShianAnnotationLayout;
const spaces=new Map(["afterScore","afterLyrics","afterVocal"].map(name=>[name,{}]));
const staff={querySelector(selector){return spaces.get(selector.match(/="([^"]+)"/)?.[1])||null}};
const geometry={rows:[
  {row:0,staff,scoreRect:{top:20,bottom:74,left:0,right:800},lineTop:29,lineBottom:65,lineSpacing:18,rect:{top:20,bottom:102}},
  {row:1,staff:{querySelector:()=>null},scoreRect:{top:102,bottom:156,left:0,right:800},lineTop:111,lineBottom:147,lineSpacing:18,rect:{top:102,bottom:184}}
]};
const placement={row:0,lane:"afterScore",boundaryKey:"0:afterScore",offsetTop:-0.5,offsetFromNextTop:-2,heightLines:1.5,clearanceTop:.25,clearanceBottom:.25};
const top=api.placementTopWithClearance(geometry,placement);
assert.equal(top,69.5,"comment top must remain below the previous score plus its saved clearance");
assert.equal(api.placementTopWithClearance(geometry,placement),top,"repeated layout must not accumulate a Y shift");

const crowdedPlacement={...placement,heightLines:3};
const effective=api.effectivePixelGaps(geometry,{boundaries:{"0:afterScore":{gap:.25}}},[{type:"text",layoutPlacement:crowdedPlacement}]);
assert.equal(effective.gaps.get("0:afterScore"),17,"screen pages must share the saved-gap plus comment-clearance calculation");
assert.equal(api.effectivePixelGaps(geometry,{boundaries:{"0:afterScore":{gap:.25}}},[{type:"text",layoutPlacement:crowdedPlacement}]).gaps.get("0:afterScore"),17,"shared row layout must be stable across repeated page renders");

const annotationPage=fs.readFileSync(path.join(__dirname,"..","annotations.html"),"utf8");
assert.match(annotationPage,/function snap\(\)[^{]*\{[^}]*annotationLayoutDirty=true/,
  "a real user edit must request an annotation-layout commit");
assert.match(annotationPage,/if\(annotationLayoutDirty\)\{\s*state\.annotationLayout=nextLayout;/,
  "stable page rendering must not overwrite shared annotation layout");
assert.doesNotMatch(annotationPage,/state\.annotationLayout=nextLayout;\s*\/\* ドラッグ中/,
  "the old unconditional page-open layout write must stay removed");
assert.match(annotationPage,/if\(!annotationLayoutDirty\)return applySavedAnnotationEditGaps\(\)/,
  "the writing page must use the same shared score layout before an edit starts");

console.log("annotation layout tests passed");
