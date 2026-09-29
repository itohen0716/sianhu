"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

for(const file of ["index.html","annotations.html"]){
  const source=fs.readFileSync(path.join(__dirname,"..",file),"utf8");
  assert(!source.includes("measure.scrollIntoView("),`${file}: playback must not auto-follow the active measure`);
  assert(source.includes('measure.classList.add("playback-active")'),`${file}: active-measure highlighting must remain enabled`);
  assert(source.includes("@media screen and (min-width:900px){body.player-modal-open{overflow-y:auto;width:auto}"),`${file}: PC playback must retain manual vertical scrolling`);
  assert(source.includes("body.player-modal-open{overflow:hidden;width:var(--player-layout-width,auto)}"),`${file}: non-PC modal behavior must remain unchanged`);
}

const player=fs.readFileSync(path.join(__dirname,"..","player","player.js"),"utf8");
assert(player.includes("startFollow(timeMap,secondsPerUnit)"),"playback-position updates must remain active");
assert(player.includes("postPlaybackPosition(segments[index].displayM)"),"active-measure notifications must remain active");

console.log("manual scroll tests passed");
