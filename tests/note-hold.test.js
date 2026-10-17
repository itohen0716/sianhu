"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function loadHoldUtility() {
  const context = { globalThis: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, "note-hold.js"), "utf8"), context);
  return context.globalThis.ShianNoteHold;
}

function loadPlayerDiagnostics() {
  const elements = new Map();
  const element = () => ({
    textContent: "", innerHTML: "", value: "",
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute() {}, addEventListener() {}, querySelectorAll() { return []; }
  });
  const get = selector => {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  };
  const window = {
    addEventListener() {}, clearInterval() {}, setInterval() { return 1; },
    clearTimeout() {}, setTimeout() { return 1; }, parent: { postMessage() {} }
  };
  const context = {
    window, document: { querySelector: get, addEventListener() {} },
    sessionStorage: { getItem() { return null; } },
    location: { origin: "https://example.test" }, console,
    Math, Number, String, Array, Map, Set, Object, Promise, Date, Error
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, "player", "player.js"), "utf8"), context);
  return window.ShianPlayerDiagnostics;
}

const holds = loadHoldUtility();
const source = { m: 0, s: 2, p: 0 };
const sourceNote = { ...source, d: 4, v: "1" };
const created = holds.create({ source, notes: [sourceNote], holds: [], totalMeasures: 2, capacity: 8 });
assert.equal(created.ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(created.hold)), {
  type: "hold", m: 0, s: 2, p: 4, d: 4, source
});
assert.equal(holds.create({ source, notes: [sourceNote], holds: [created.hold], totalMeasures: 2, capacity: 8 }).reason, "duplicate");

const acrossBar = holds.create({
  source: { m: 0, s: 1, p: 4 },
  notes: [{ m: 0, s: 1, p: 4, d: 4 }],
  holds: [], totalMeasures: 3, capacity: 8
});
assert.equal(acrossBar.ok, true);
assert.equal(acrossBar.hold.m, 1);
assert.equal(acrossBar.hold.p, 0);

const shortMeasure = holds.create({
  source: { m: 0, s: 3, p: 0 },
  notes: [{ m: 0, s: 3, p: 0, d: 4 }], holds: [], totalMeasures: 2,
  capacity: 8, capacityFor: m => m === 0 ? 4 : 8
});
assert.equal(shortMeasure.ok, true);
assert.equal(shortMeasure.hold.m, 1);
assert.equal(shortMeasure.hold.p, 0);

const diagnostics = loadPlayerDiagnostics();
const payload = {
  format: "shian-live-score",
  score: {
    meter: "2/4", measureCount: 2, notes: [
      { m: 0, s: 2, p: 4, d: 8, v: "1", heldByHold: true, holdDuration: 4 },
      { m: 1, s: 2, p: 4, d: 4, v: "2" }
    ], scoreParts: [], measureSpecials: {},
    editorOnlyNoteHolds: true
  }
};
const { score, events } = diagnostics.buildTimeMapForPayload(payload);
const shamisenEvents = events.filter(event => event.voice === "shamisen");
assert.equal(score.notes.length, 2, "the held note and following note remain two attacks");
assert.deepEqual(Array.from(shamisenEvents, event => event.unit), [4, 12]);
assert.equal(shamisenEvents[0].duration, 8, "the hold spans two beats across the source measure and ends at the next attack");

const standalone = structuredClone(payload);
delete standalone.score.editorOnlyNoteHolds;
const normalScore = diagnostics.buildTimeMapForPayload(standalone).score;
assert.deepEqual(Array.from(normalScore.notes, note => note.d), [4], "standalone player rejects editor-only extended note values");

console.log("note hold tests passed");
