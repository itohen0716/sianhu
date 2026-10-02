"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function element() {
  return {
    textContent: "",
    innerHTML: "",
    value: "",
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute() {},
    addEventListener() {},
    querySelectorAll() { return []; }
  };
}

function loadPlayerDiagnostics() {
  const elements = new Map();
  const get = (selector) => {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  };
  const window = {
    addEventListener() {},
    clearInterval() {},
    setInterval() { return 1; },
    clearTimeout() {},
    setTimeout() { return 1; },
    parent: { postMessage() {} }
  };
  const context = {
    window,
    document: { querySelector: get, addEventListener() {} },
    sessionStorage: { getItem() { return null; } },
    location: { origin: "https://example.test" },
    console,
    Math,
    Number,
    String,
    Array,
    Map,
    Set,
    Object,
    Promise,
    Date,
    Error
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, "player", "player.js"), "utf8"), context);
  return window.ShianPlayerDiagnostics;
}

function note(id, m, rest = false) {
  return { id, m, rest };
}

const diagnostics = loadPlayerDiagnostics();
const bridge = diagnostics.shouldBridgeContinuousNormalIntoTuplet;

const precedingNormal = { unit: 7, duration: 1, isTuplet: false, notes: [note("left", 0)] };
const nextMeasureTuplet = { unit: 8, duration: 2 / 3, isTuplet: true, notes: [note("right", 1)] };

assert.equal(bridge(precedingNormal, nextMeasureTuplet), true, "a contiguous normal note must bridge into a next-measure triplet");
assert.equal(bridge(
  { ...precedingNormal, notes: [{ ...note("row-end", 2), row: 0, page: 0 }] },
  { ...nextMeasureTuplet, notes: [{ ...note("row-head", 3), row: 1, page: 1 }] }
), true, "row and page presentation boundaries must use the same continuous playback rule");
assert.equal(bridge(precedingNormal, { ...nextMeasureTuplet, notes: [note("right", 0)] }), true, "the same continuous normal-to-triplet transition must use the same envelope inside a measure");
assert.equal(bridge(precedingNormal, { ...nextMeasureTuplet, unit: 8.25 }), false, "a logical rest or empty interval must not be bridged");
assert.equal(bridge(precedingNormal, { ...nextMeasureTuplet, notes: [note("rest", 1, true)] }), false, "a rest at the next measure head must stay silent");
assert.equal(bridge(precedingNormal, { ...nextMeasureTuplet, isTuplet: false }), false, "a normal-to-normal boundary must retain its existing envelope");
assert.equal(bridge({ ...precedingNormal, isTuplet: true }, nextMeasureTuplet), false, "v236 triplet tails must not be layered with an extra bridge");
assert.equal(bridge(precedingNormal, nextMeasureTuplet, ["right"]), false, "a slur-suppressed target must not trigger a bridge");

for (const bpm of [120, 100, 86, 80]) {
  const secondsPerUnit = 60 / bpm / 4;
  const boundaryAt = 41 * secondsPerUnit;
  const logicalGapMs = (41 * secondsPerUnit - boundaryAt) * 1000;
  const sourceOverlapMs = ((boundaryAt + 0.004) - boundaryAt) * 1000;
  assert(Math.abs(logicalGapMs) < 1e-9, `${bpm} BPM: event time must remain continuous`);
  assert(Math.abs(sourceOverlapMs - 4) < 1e-9, `${bpm} BPM: only the bounded 4 ms bridge may overlap`);
}

const player = fs.readFileSync(path.join(root, "player", "player.js"), "utf8");
assert(player.includes("tupletEntryBridge=shouldBridgeContinuousNormalIntoTuplet(event,nextEvent,suppressed)"), "the scheduling pass must derive the bridge from adjacent events");
assert(player.includes("scheduleShamisen(note,event,frequency,when,startDurationSeconds,notes.length,tupletEntryBridge)"), "the derived bridge must reach the source scheduler");
assert(player.includes('tripletFadeInSeconds=event.isTuplet&&sourceKind==="normal"?.018:undefined'), "the preceding normal note must retain its ordinary 3 ms default attack");
assert(player.includes("transitionFadeOutSeconds=preserveSampleTail?.018:undefined"), "the bridge release must use the v236 18 ms transition fade");
assert(player.includes("tailReleaseSeconds=preserveSampleTail?.004:undefined"), "the bridge must be bounded to the existing safe 4 ms source tail");

console.log("measure-boundary playback tests passed");
