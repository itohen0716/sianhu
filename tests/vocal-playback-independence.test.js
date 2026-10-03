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

function loadDiagnostics() {
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

function payload(vocalNotes) {
  return {
    format: "shian-live-score",
    score: {
      title: "vocal independence",
      tuning: "二上り",
      meter: "2/4",
      measureCount: 2,
      measureSpecials: {},
      scoreParts: [],
      notes: [
        { m: 0, s: 3, p: 0, d: 2, v: "0", rest: false, row: 0, measureInRow: 0 },
        { m: 0, s: 3, p: 2, d: 1, v: "3", rest: false, row: 0, measureInRow: 0 },
        { m: 1, s: 3, p: 0, d: 4, v: "4", rest: false, row: 1, measureInRow: 0 }
      ],
      tuplets: [{
        type: "triplet",
        start: { m: 0, s: 3, p: 0 },
        end: { m: 0, s: 3, p: 2 },
        targetBeats: 1
      }],
      shamisenSlurs: [],
      shamisenTechniques: [],
      vocalNotes,
      vocalSlurs: []
    }
  };
}

function shamisenTimeline(diagnostics, value) {
  const result = diagnostics.buildTimeMapForPayload(value);
  return {
    result,
    events: result.events
      .filter((event) => event.voice === "shamisen")
      .map((event) => ({ unit: event.unit, duration: event.duration, displayM: event.notes[0].displayM }))
  };
}

const diagnostics = loadDiagnostics();
const withoutVocal = shamisenTimeline(diagnostics, payload([]));
const withVocal = shamisenTimeline(diagnostics, payload([
  { id: "vocal-at-triplet-end", m: 0, s: 3, p: 2, d: 2, v: "1", kind: "pitch" }
]));

assert.deepStrictEqual(
  withVocal.events,
  withoutVocal.events,
  "adding vocal notation must not alter any shamisen event start or duration"
);
assert.deepStrictEqual(
  withVocal.result.score.playbackSegments.map((segment) => segment.length),
  withoutVocal.result.score.playbackSegments.map((segment) => segment.length),
  "vocal notation must not extend a shamisen measure's effective playback length"
);
assert.equal(withVocal.result.score.vocalNotes.length, 1, "the vocal note must remain present after shamisen timing is calculated independently");

const lastTriplet = withVocal.result.events.filter((event) => event.voice === "shamisen" && event.notes[0].displayM === 0).at(-1);
const nextMeasure = withVocal.result.events.find((event) => event.voice === "shamisen" && event.notes[0].displayM === 1);
assert(Math.abs(nextMeasure.unit - (lastTriplet.unit + lastTriplet.duration)) < 1e-9, "a vocal note must not reintroduce a gap after a completed trailing triplet");

for (const bpm of [120, 100, 86, 80]) {
  const secondsPerUnit = 60 / bpm / 4;
  const gapMs = (nextMeasure.unit - lastTriplet.unit - lastTriplet.duration) * secondsPerUnit * 1000;
  assert(Math.abs(gapMs) < 1e-9, `${bpm} BPM: shamisen playback must remain continuous with vocal notation present`);
}

const playerSource = fs.readFileSync(path.join(root, "player", "player.js"), "utf8");
assert(!playerSource.includes("lyrics"), "display-only lyrics must stay outside the playback engine");

console.log("vocal playback independence tests passed");
