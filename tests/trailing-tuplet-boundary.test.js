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

function payload({ notes, tuplets = [], measureSpecials = {}, measureCount = 2 }) {
  return {
    format: "shian-live-score",
    score: {
      title: "test",
      tuning: "二上り",
      meter: "2/4",
      measureCount,
      measureSpecials,
      scoreParts: [],
      notes,
      tuplets,
      shamisenSlurs: [],
      shamisenTechniques: [],
      vocalNotes: [],
      vocalSlurs: []
    }
  };
}

function note(m, p, d, { rest = false, s = 3, v = "0" } = {}) {
  return { m, s, p, d, v, rest };
}

function triplet(m, startP, endP) {
  return {
    type: "triplet",
    start: { m, s: 3, p: startP },
    end: { m, s: 3, p: endP },
    targetBeats: 1
  };
}

function shamisenEvents(diagnostics, scorePayload) {
  return diagnostics.buildTimeMapForPayload(scorePayload).events.filter((event) => event.voice === "shamisen");
}

const diagnostics = loadDiagnostics();

{
  const events = shamisenEvents(diagnostics, payload({
    notes: [
      note(0, 0, 2), note(0, 2, 1),
      note(0, 3, 2), note(0, 5, 1),
      note(1, 0, 4)
    ],
    tuplets: [triplet(0, 0, 2), triplet(0, 3, 5)]
  }));
  const finalTriplet = events.filter((event) => event.notes[0].displayM === 0).at(-1);
  const nextMeasure = events.find((event) => event.notes[0].displayM === 1);
  assert(Math.abs(finalTriplet.duration - 4 / 3) < 1e-9, "the second triplet note must remain 1/3 beat");
  assert(Math.abs(nextMeasure.unit - (finalTriplet.unit + finalTriplet.duration)) < 1e-9, "two complete triplet beats must meet the next measure without an implicit trailing-cell gap");
}

{
  const events = shamisenEvents(diagnostics, payload({
    notes: [note(0, 0, 2), note(0, 2, 1), note(1, 0, 4)],
    tuplets: [triplet(0, 0, 2)],
    measureSpecials: { "0": { type: "hanma", lengthRatio: 0.5 } }
  }));
  const finalTriplet = events.filter((event) => event.notes[0].displayM === 0).at(-1);
  const nextMeasure = events.find((event) => event.notes[0].displayM === 1);
  assert(Math.abs(nextMeasure.unit - 4) < 1e-9, "a half-measure triplet must still total exactly one beat");
  assert(Math.abs(nextMeasure.unit - (finalTriplet.unit + finalTriplet.duration)) < 1e-9, "a half-measure triplet must connect directly to the next measure");
}

{
  const events = shamisenEvents(diagnostics, payload({
    notes: [note(0, 0, 2), note(0, 2, 1), note(0, 6, 2, { rest: true }), note(1, 0, 4)],
    tuplets: [triplet(0, 0, 2)]
  }));
  const rest = events.find((event) => event.notes.some((entry) => entry.rest));
  const nextMeasure = events.find((event) => event.notes[0].displayM === 1);
  assert(rest, "an explicit trailing rest must remain in the playback event list");
  assert(nextMeasure.unit > rest.unit, "an explicit trailing rest must not be trimmed as empty layout space");
}

{
  const events = shamisenEvents(diagnostics, payload({
    notes: [note(0, 0, 4), note(1, 0, 4)]
  }));
  const current = events.find((event) => event.notes[0].displayM === 0);
  const next = events.find((event) => event.notes[0].displayM === 1);
  assert.equal(next.unit - (current.unit + current.duration), 4, "ordinary trailing empty time must retain its existing behavior; this fix is limited to completed trailing triplets");
}

for (const bpm of [120, 100, 86, 80]) {
  const events = shamisenEvents(diagnostics, payload({
    notes: [note(0, 0, 2), note(0, 2, 1), note(1, 0, 4)],
    tuplets: [triplet(0, 0, 2)],
    measureSpecials: { "0": { type: "hanma", lengthRatio: 0.5 } }
  }));
  const previous = events.filter((event) => event.notes[0].displayM === 0).at(-1);
  const next = events.find((event) => event.notes[0].displayM === 1);
  const secondsPerUnit = 60 / bpm / 4;
  const logicalGapMs = (next.unit - previous.unit - previous.duration) * secondsPerUnit * 1000;
  assert(Math.abs(logicalGapMs) < 1e-9, `${bpm} BPM: the boundary must remain continuous`);
}

console.log("trailing triplet boundary tests passed");
