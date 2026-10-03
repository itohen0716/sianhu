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

function note(m, p, d, value = "0", rest = false) {
  return { m, s: rest ? 2 : 3, p, d, v: value, rest };
}

function triplet(m, startP, endP) {
  return {
    type: "triplet",
    start: { m, s: 3, p: startP },
    end: { m, s: 3, p: endP },
    targetBeats: 1
  };
}

function payload(notes, tuplets) {
  return {
    format: "shian-live-score",
    score: {
      title: "tuplet layout padding",
      tuning: "二上り",
      meter: "2/4",
      measureCount: 2,
      measureSpecials: {},
      scoreParts: [],
      repeatBarlines: [],
      notes,
      tuplets,
      shamisenSlurs: [],
      shamisenTechniques: [],
      vocalNotes: [],
      vocalSlurs: []
    }
  };
}

function eventsFor(diagnostics, value) {
  return diagnostics.buildTimeMapForPayload(value).events.filter((event) => event.voice === "shamisen");
}

function compact(events) {
  return events.map((event) => ({
    measure: event.notes[0].displayM,
    unit: event.unit,
    duration: event.duration,
    isTuplet: event.isTuplet
  }));
}

const diagnostics = loadDiagnostics();

const legacyPacked = eventsFor(diagnostics, payload([
  note(0, 0, 2), note(0, 2, 1),
  note(0, 3, 2), note(0, 5, 1),
  note(1, 0, 4)
], [triplet(0, 0, 2), triplet(0, 3, 5)]));

const beatGrid = eventsFor(diagnostics, payload([
  note(0, 0, 2), note(0, 2, 1),
  note(0, 4, 2), note(0, 6, 1),
  note(1, 0, 4)
], [triplet(0, 0, 2), triplet(0, 4, 6)]));

assert.deepStrictEqual(
  compact(beatGrid),
  compact(legacyPacked),
  "legacy packed triplets and newly entered beat-grid triplets must produce the same playback timeline"
);

const firstBeatEnd = beatGrid[1].unit + beatGrid[1].duration;
assert(Math.abs(beatGrid[2].unit - firstBeatEnd) < 1e-9, "the empty layout cell after a completed triplet must not become a playback gap");
assert(Math.abs(beatGrid[4].unit - (beatGrid[3].unit + beatGrid[3].duration)) < 1e-9, "the second completed triplet must still meet the next measure directly");

const explicitRest = eventsFor(diagnostics, payload([
  note(0, 0, 2), note(0, 2, 1), note(0, 3, 1, "", true),
  note(0, 4, 2), note(0, 6, 1),
  note(1, 0, 4)
], [triplet(0, 0, 2), triplet(0, 4, 6)]));
const restEvent = explicitRest.find((event) => event.notes.some((entry) => entry.rest));
const secondTriplet = explicitRest.find((event) => event.isTuplet && event.notes[0].p === 4);
assert(restEvent, "an explicit rest after a triplet must remain in the event list");
assert(Math.abs(secondTriplet.unit - (restEvent.unit + restEvent.duration)) < 1e-9, "explicit rest time must be preserved instead of collapsed as layout padding");

for (const bpm of [120, 100, 86, 80]) {
  const secondsPerUnit = 60 / bpm / 4;
  const implicitGapMs = (beatGrid[2].unit - firstBeatEnd) * secondsPerUnit * 1000;
  const explicitRestMs = restEvent.duration * secondsPerUnit * 1000;
  assert(Math.abs(implicitGapMs) < 1e-9, `${bpm} BPM: layout padding must stay at 0 ms`);
  assert(explicitRestMs > 0, `${bpm} BPM: an explicit rest must retain positive silence`);
}

console.log("tuplet layout padding tests passed");
