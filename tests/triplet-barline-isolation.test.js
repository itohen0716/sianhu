"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const desktopMedia = '@media screen and (min-width:900px){';
const broadTripletSelector = 'body.triplet-selecting.score-page[data-score-layer="technique"] #scoreArea{pointer-events:auto}';
const desktopScoreSelector = 'body.triplet-selecting.score-page[data-score-layer="technique"] #scoreArea{pointer-events:none}';
const noteOnlySelector = 'body.triplet-selecting.score-page[data-score-layer="technique"] #scoreArea .note{pointer-events:auto;cursor:pointer}';
const blockedBarlineSelector = 'body.triplet-selecting.score-page[data-score-layer="technique"] #scoreArea .barline-handle{pointer-events:none}';
const desktopRules = html.slice(html.indexOf(desktopMedia), html.indexOf("/* v159:"));

assert(
  html.includes(broadTripletSelector),
  "the existing non-PC triplet interaction must remain unchanged"
);
assert(
  desktopRules.includes(desktopScoreSelector),
  "PC triplet entry must keep the score surface inert"
);
assert(
  desktopRules.includes(noteOnlySelector),
  "PC triplet entry must keep its start/end note targets clickable"
);
assert(
  desktopRules.includes(blockedBarlineSelector),
  "PC triplet entry must explicitly keep barline hit areas disabled"
);
assert(
  html.includes('}else if(barline&&state.scoreEditLayer==="staff"){'),
  "ordinary barline selection must remain scoped to the staff layer"
);

console.log("triplet/barline isolation tests passed");
