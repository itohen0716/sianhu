const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"..","print-v2.js"),"utf8");
const window={};
const document={createElement(){return{getContext(){return{font:"",measureText(text){return{width:String(text).length*8}}}}}},querySelector(){return null},querySelectorAll(){return[]}};
vm.runInNewContext(source,{window,document,console});
const rhythm=window.ShianPrintV2.printRhythmDuration;

function durations(notes){return notes.map(note=>rhythm(note,notes))}

assert.deepEqual(durations([{m:0,p:0,s:1,d:2,v:"0"}]),[2],"single eighth note keeps its rhythm line");
assert.deepEqual(durations([{m:0,p:0,s:2,d:2,v:"4"},{m:0,p:0,s:1,d:2,v:"0"}]),[4,2],"two strings share one eighth-note line on the lowest displayed note");
assert.deepEqual(durations([{m:0,p:0,s:3,d:1,v:"10"},{m:0,p:0,s:2,d:1,v:"4"},{m:0,p:0,s:1,d:1,v:"0"}]),[4,4,1],"three strings share one sixteenth-note line");
assert.deepEqual(durations([{m:0,p:0,s:3,d:2,v:"3"},{m:0,p:0,s:1,d:1,v:"12"}]),[4,1],"one-and-three string chord uses the shortest column duration once");
assert.deepEqual(durations([{m:0,p:0,s:3,d:2,v:"3"},{m:0,p:0,s:2,d:4,v:"6"}]),[4,2],"the visually lowest occupied string receives the column rhythm line");
assert.deepEqual(durations([{m:0,p:0,s:3,d:2,v:"3"},{m:0,p:1,s:2,d:2,v:"6"}]),[2,2],"different logical positions remain independent");
assert.deepEqual(durations([{m:0,p:0,s:3,d:2,v:"●",rest:true},{m:0,p:0,s:1,d:2,v:"0"}]),[2,2],"rests keep their own duration and do not join note columns");

console.log("print rhythm-column tests passed");
