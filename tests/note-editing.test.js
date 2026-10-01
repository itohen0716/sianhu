const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "note-position.js"), "utf8"), context);
const position = context.window.ShianNotePosition;

const wideLeft = position.measureDisplayOffsetBounds(160, 8, 6, 14, 5);
assert.equal(wideLeft.min, -118, "a late logical position can be moved across the same measure");
assert.equal(wideLeft.max, 18, "the glyph remains inside the right measure edge");
assert(wideLeft.min < -50, "the PC editing range reaches the half-measure area");
assert.deepEqual(
  JSON.parse(JSON.stringify(position.measureDisplayOffsetBounds(160, 8, 1, 14, 5))),
  { min: -18, max: 118 },
  "the same formula keeps early positions inside the measure"
);

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert(html.includes("measureDisplayOffsetBounds(measureRect.width,capacity,p,moving.width,5)"), "drag and keyboard movement share stable measure-relative bounds");
assert(html.includes('window.innerWidth>=900?"#scoreArea .note[data-note]":"#scoreArea .note[data-note]:not(.rest)"'), "PC range selection includes rests without changing the non-PC selector");
assert(html.includes('window.innerWidth>=900?"数字・開放弦・休符":"数字・開放弦"'), "the PC selection status identifies rests");
assert(!/scoreDrag\.type==="note"[\s\S]{0,500}state\.p\s*=/.test(html), "dragging display x must not rewrite logical p");
assert(!/function noteMoveBounds[\s\S]{0,1800}note\.p\s*=/.test(html), "movement bounds must not rewrite logical p");

console.log("note editing tests passed");
