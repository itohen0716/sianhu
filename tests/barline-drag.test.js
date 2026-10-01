const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

assert(
  html.includes('measure.style.setProperty("--measure-grow",String(grow))'),
  "drag preview must use the same screenMeasureGrow ratio as the final render"
);
assert(
  html.includes('if(vocalMeasure)vocalMeasure.style.setProperty("--measure-grow",String(grow))'),
  "vocal measures must follow the score measure while dragging"
);
assert(
  html.includes("barlinePreviewFrame=requestAnimationFrame"),
  "pointer movement must be coalesced to one preview per animation frame"
);
assert(
  html.includes("if(window.innerWidth>=900)scheduleBarlineDragPreview(scoreDrag)"),
  "PC barline pointer movement must request a live score preview"
);
assert(
  html.includes("applyContentAwareMeasureWidths(measures)"),
  "only the two changed measures should recalculate note density during drag"
);
assert(
  html.includes("syncLyricsToScore();syncAnchoredVocalPositions();syncVocalSlurs();syncTuplets();renderLayers(true)"),
  "lyrics, vocal notation, tuplets and annotations must follow the live width"
);
assert(
  !html.includes('if(window.innerWidth>=900){const width=measureWidth'),
  "PC drag must never use absolute pixel width as flex-grow"
);

const barlineMove = html.slice(
  html.indexOf('}else{\n    state.measureOffsets=Array.isArray'),
  html.indexOf('q("#scoreArea").addEventListener("pointerup"')
);
assert(barlineMove.includes("state.measureOffsets[scoreDrag.left]=scoreDrag.leftOffset+bounded"));
assert(barlineMove.includes("state.measureOffsets[scoreDrag.right]=scoreDrag.rightOffset-bounded"));
assert(!/\.p\s*=/.test(barlineMove), "barline drag must not rewrite logical p");
assert(!/\.x\s*=/.test(barlineMove), "barline drag must not rewrite manual note x");

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const preview = (dx, leftWidth = 384, rightWidth = 384) => {
  const bounded = clamp(dx, 240 - leftWidth, rightWidth - 240);
  return {
    bounded,
    leftWidth: leftWidth + bounded,
    rightWidth: rightWidth - bounded,
    leftGrow: clamp(1 + bounded / 384, 0.35, 2),
    rightGrow: clamp(1 - bounded / 384, 0.35, 2),
  };
};

for (const dx of [-40, -3, 0, 2, 37]) {
  const result = preview(dx);
  assert.equal(result.bounded, dx, `fine reverse movement ${dx}px must remain continuous`);
  assert.equal(result.leftWidth + result.rightWidth, 768, "paired widths must keep the row total stable");
  assert.equal(result.leftGrow + result.rightGrow, 2, "preview and final flex ratios must keep the same total");
}
assert.equal(preview(-200).leftWidth, 240, "the existing left minimum width must remain active");
assert.equal(preview(200).rightWidth, 240, "the existing right minimum width must remain active");
assert(
  html.includes("cancelBarlineDragPreview();scoreDrag=null;save();render()"),
  "drop must commit the latest shared state and render the same final ratio"
);

console.log("barline drag tests passed");
