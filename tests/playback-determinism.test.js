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

function generator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffled(values, random) {
  const result = values.map((value) => structuredClone(value));
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function payloadFor(seed) {
  const random = generator(seed);
  const vocalIds = [`v-${seed}-a`, `v-${seed}-b`, `v-${seed}-c`];
  const notes = [
    { m: 0, s: 1, p: 0, d: 4, v: "3", rest: false },
    { m: 0, s: 3, p: 0, d: 4, v: "0", rest: false },
    { m: 0, s: 2, p: 4, d: 2, v: "5", rest: false },
    { m: 0, s: 2, p: 6, d: 1, v: "6", rest: false },
    { m: 1, s: 2, p: 0, d: 4, v: "7", rest: false },
    { m: 1, s: 1, p: 4, d: 2, v: "8", rest: false },
    { m: 1, s: 1, p: 6, d: 2, v: "9", rest: true },
    { m: 2, s: 3, p: 0, d: 4, v: "10", rest: false }
  ];
  const vocalNotes = [
    { id: vocalIds[0], m: 0, s: 3, p: 0, d: 4, v: "3", kind: "pitch" },
    { id: vocalIds[1], m: 0, s: 3, p: 4, d: 4, v: "5", kind: "pitch" },
    { id: vocalIds[2], m: 1, s: 3, p: 0, d: 4, v: "7", kind: "pitch" }
  ];
  return {
    format: "shian-live-score",
    version: 6,
    sentAt: 1000 + seed,
    score: {
      title: "決定性試験",
      tuning: "二上り",
      meter: "2/4",
      measureCount: 3,
      notes: shuffled(notes, random),
      tuplets: shuffled([
        { id: `triplet-${seed}`, type: "triplet", start: { m: 0, s: 2, p: 4 }, end: { m: 0, s: 2, p: 6 }, targetBeats: 1 }
      ], random),
      shamisenTechniques: shuffled([
        { id: `technique-${seed}`, type: "sukui", anchor: { m: 1, s: 2, p: 0 } }
      ], random),
      shamisenSlurs: shuffled([
        { id: `slur-${seed}`, start: { m: 1, s: 1, p: 4 }, end: { m: 2, s: 3, p: 0 } }
      ], random),
      vocalNotes: shuffled(vocalNotes, random),
      vocalSlurs: shuffled([
        { id: `vocal-slur-${seed}`, startId: vocalIds[0], endId: vocalIds[1] }
      ], random),
      scoreParts: [],
      repeatBarlines: [],
      measureSpecials: {}
    }
  };
}

function eventSignature(diagnostics, payload) {
  const { score, events } = diagnostics.buildTimeMapForPayload(payload);
  return JSON.stringify({
    tuplets: score.tuplets.map(({ type, start, writtenEnd, layoutEnd, targetUnits }) => ({ type, start, writtenEnd, layoutEnd, targetUnits })),
    shamisenSlurs: score.shamisenSlurs.map(({ startId, endId }) => ({ startId, endId })),
    events: events.map((event) => ({
      rawUnit: event.rawUnit,
      unit: event.unit,
      duration: event.duration,
      voice: event.voice,
      isTuplet: event.isTuplet,
      notes: event.notes.map((note) => ({
        sourceM: note.sourceM,
        displayM: note.displayM,
        timelineUnit: note.timelineUnit,
        s: note.s,
        p: note.p,
        d: note.d,
        v: note.v,
        rest: note.rest,
        technique: note.technique || null
      }))
    }))
  });
}

const diagnostics = loadDiagnostics();
const expected = eventSignature(diagnostics, payloadFor(1));

for (let creation = 2; creation <= 100; creation += 1) {
  assert.equal(
    eventSignature(diagnostics, payloadFor(creation)),
    expected,
    `equivalent new creation ${creation} must produce exactly the same playback event sequence`
  );
}

const repeatedPayload = payloadFor(777);
const repeated = new Set();
for (let replay = 0; replay < 100; replay += 1) repeated.add(eventSignature(diagnostics, repeatedPayload));
assert.equal(repeated.size, 1, "the same JSON must produce one stable event sequence across repeated loads");

const previous = { unit: 8, duration: 1, isTuplet: false, notes: [{ id: "previous", rest: false }] };
const nearTuplet = { unit: 9 + 5e-7, duration: 2 / 3, isTuplet: true, notes: [{ id: "next", rest: false }] };
const realGapTuplet = { ...nearTuplet, unit: 9.00001 };
assert.equal(diagnostics.explainContinuousNormalIntoTuplet(previous, nearTuplet).reason, "continuous-normal-into-triplet", "sub-epsilon arithmetic noise must remain a continuous connection");
assert.equal(diagnostics.explainContinuousNormalIntoTuplet(previous, realGapTuplet).reason, "not-continuous", "a real musical interval must not be hidden by the epsilon");

const player = fs.readFileSync(path.join(root, "player", "player.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "player", "audio-engine.js"), "utf8");
assert(player.includes("tripletFadeInSeconds=event.isTuplet&&sourceKind===\"normal\"?.018:undefined"), "the v236 18 ms triplet attack must remain unchanged");
assert(player.includes("tailReleaseSeconds=preserveSampleTail?.004:undefined"), "the v236 4 ms safe tail must remain unchanged");
assert(engine.includes("tripletReleaseSeconds: 0.004"), "the audio diagnostic constant must remain 4 ms");
assert(engine.includes("referenceFadeSeconds: 0.018"), "the audio diagnostic constant must remain 18 ms");

console.log("playback determinism tests passed");
