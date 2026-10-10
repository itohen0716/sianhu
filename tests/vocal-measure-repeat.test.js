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

function shamisen(m, v, p = 0, d = 4) {
  return { m, s: 3, p, d, v, rest: false };
}

function vocal(id, m, v, p = 0, d = 4, extra = {}) {
  return { id, m, s: 3, p, d, v, kind: "pitch", ...extra };
}

function payload({
  notes,
  vocalNotes = [],
  vocalSlurs = [],
  scoreParts = [],
  repeatBarlines = [],
  measureSpecials = {},
  tuplets = [],
  measureCount,
  rhythmFeel = { type: "normal" }
}) {
  return {
    format: "shian-live-score",
    version: 6,
    score: {
      title: "唄譜小節反復試験",
      tuning: "二上り",
      meter: "2/4",
      rhythmFeel,
      measureCount,
      measureSpecials,
      repeatBarlines,
      scoreParts,
      notes,
      tuplets,
      shamisenSlurs: [],
      shamisenTechniques: [],
      vocalNotes,
      vocalSlurs
    }
  };
}

function resultFor(diagnostics, value) {
  return diagnostics.buildTimeMapForPayload(value);
}

function eventsFor(result, voice) {
  return Array.from(result.events).filter((event) => event.voice === voice);
}

function valuesFor(result, voice) {
  return Array.from(eventsFor(result, voice), (event) => event.notes[0]?.v);
}

function vocalCopies(result, displayM) {
  return Array.from(result.score.vocalNotes).filter((note) => note.displayM === displayM);
}

function shamisenSignature(result) {
  return Array.from(eventsFor(result, "shamisen"), (event) => ({
    rawUnit: event.rawUnit,
    unit: event.unit,
    duration: event.duration,
    values: event.notes.map((note) => note.v),
    sources: event.notes.map((note) => note.sourceM),
    displays: event.notes.map((note) => note.displayM)
  }));
}

const diagnostics = loadDiagnostics();

{
  const result = resultFor(diagnostics, payload({
    notes: [shamisen(0, "1")],
    vocalNotes: [vocal("v0", 0, "3"), vocal("v1", 1, "7")],
    scoreParts: [{ type: "measureRepeat", kind: "same1", m: 1 }],
    measureCount: 2
  }));
  assert.deepEqual(valuesFor(result, "shamisen"), ["1", "1"], "同じ1の三味線は従来どおり直前小節を反復する");
  assert.deepEqual(valuesFor(result, "vocal"), ["3", "7"], "同じ1小節の唄は表示小節に記載された固有音を使う");
  assert.deepEqual(Array.from(vocalCopies(result, 1), (note) => note.sourceM), [1], "同じ1の唄を三味線の参照元へ置き換えない");
}

{
  const result = resultFor(diagnostics, payload({
    notes: [shamisen(0, "1"), shamisen(1, "5")],
    vocalNotes: [vocal("v0", 0, "2"), vocal("v1", 1, "4"), vocal("v2", 2, "9")],
    scoreParts: [{ type: "measureRepeat", kind: "same2", m: 2 }],
    measureCount: 3
  }));
  assert.deepEqual(valuesFor(result, "shamisen"), ["1", "5", "1", "5"], "同じ2の三味線は直前2小節を元の順で反復する");
  assert.deepEqual(valuesFor(result, "vocal"), ["2", "4", "9"], "同じ2表示小節の唄は一度だけ再生し、2セグメントへ複製しない");
  assert.equal(vocalCopies(result, 2).length, 1, "同じ2の固有唄を重複生成しない");
}

{
  const result = resultFor(diagnostics, payload({
    notes: [shamisen(0, "1"), shamisen(1, "5")],
    vocalNotes: [vocal("v0", 0, "2"), vocal("v1", 1, "4")],
    scoreParts: [{ type: "measureRepeat", kind: "same2", m: 2 }],
    measureCount: 3
  }));
  assert.deepEqual(valuesFor(result, "vocal"), ["2", "4"], "唄が空欄の同じ2では参照元の唄を誤って追加しない");
  assert.equal(vocalCopies(result, 2).length, 0, "空欄小節は無音のままにする");
}

{
  const result = resultFor(diagnostics, payload({
    notes: [shamisen(0, "1"), shamisen(1, "5")],
    vocalNotes: [vocal("v0", 0, "2"), vocal("v1", 1, "4")],
    repeatBarlines: [{ boundary: 0, kind: "repeat-start" }, { boundary: 2, kind: "repeat-end" }],
    measureCount: 2
  }));
  assert.deepEqual(valuesFor(result, "shamisen"), ["1", "5", "1", "5"], "A/B区間反復の三味線を維持する");
  assert.deepEqual(valuesFor(result, "vocal"), ["2", "4", "2", "4"], "A/B区間反復では唄も区間順序どおり再演奏する");
}

{
  const result = resultFor(diagnostics, payload({
    notes: [shamisen(0, "1")],
    vocalNotes: [
      vocal("base", 0, "2"),
      vocal("rest", 1, "・", 0, 1, { kind: "rest" }),
      vocal("dotted", 1, "6", 1, 2, { dotted: true }),
      vocal("slur-end", 1, "7", 4, 2)
    ],
    vocalSlurs: [{ id: "slur", startId: "dotted", endId: "slur-end" }],
    scoreParts: [{ type: "measureRepeat", kind: "same1", m: 1 }],
    measureCount: 2
  }));
  const displayed = vocalCopies(result, 1);
  assert.deepEqual(Array.from(displayed, (note) => [note.v, note.rest, note.dotted]), [["・", true, false], ["6", false, true], ["7", false, false]], "同じ1小節固有の休符と付点を保持する");
  const dottedEvent = eventsFor(result, "vocal").find((event) => event.notes.some((note) => note.baseId === "dotted"));
  assert.equal(dottedEvent.duration, 3, "付点8分の3内部単位を保持する");
  assert.equal(result.score.vocalSlurs.length, 1, "固有唄のIDに対応するスラーを展開する");
}

{
  const value = payload({
    notes: [shamisen(0, "1"), shamisen(1, "5")],
    vocalNotes: [vocal("late", 2, "9", 6, 2)],
    scoreParts: [{ type: "measureRepeat", kind: "same2", m: 2 }],
    measureSpecials: { "0": { type: "hanma", lengthRatio: 0.5 } },
    measureCount: 3
  });
  const result = resultFor(diagnostics, value);
  const copy = vocalCopies(result, 2)[0];
  const same2Start = result.score.playbackSegments.find((segment) => segment.displayM === 2).start;
  assert.equal(copy.timelineUnit, same2Start + 6, "同じ2の先頭参照元が半間でも表示小節p=6の唄を欠落させない");
  assert.equal(result.score.playbackEndUnit, 24, "半間を含む同じ2の共通曲終了時刻を維持する");
}

{
  const tuplets = [{ type: "triplet", start: { m: 0, s: 3, p: 0 }, end: { m: 0, s: 3, p: 2 }, targetBeats: 1 }];
  const common = {
    notes: [shamisen(0, "1", 0, 2), shamisen(0, "2", 2, 1), shamisen(1, "5")],
    vocalNotes: [vocal("unique", 2, "9")],
    scoreParts: [{ type: "measureRepeat", kind: "same2", m: 2 }],
    tuplets,
    measureCount: 3
  };
  const withoutVocal = resultFor(diagnostics, payload({ ...common, vocalNotes: [] }));
  const withVocal = resultFor(diagnostics, payload(common));
  assert.deepEqual(shamisenSignature(withVocal), shamisenSignature(withoutVocal), "固有唄の展開は三連符を含む三味線時間軸を変更しない");
  assert.equal(vocalCopies(withVocal, 2)[0].sourceM, 2, "三連符境界でも唄の表示小節を保持する");
}

{
  const common = {
    notes: [shamisen(0, "1", 0, 2), shamisen(0, "2", 2, 2)],
    vocalNotes: [vocal("v0", 0, "3"), vocal("v1", 1, "8")],
    scoreParts: [{ type: "measureRepeat", kind: "same1", m: 1 }],
    measureCount: 2
  };
  const normal = resultFor(diagnostics, payload(common));
  const bounce = resultFor(diagnostics, payload({ ...common, rhythmFeel: { type: "bounce" } }));
  const vocalSignature = (result) => Array.from(eventsFor(result, "vocal"), (event) => [event.unit, event.duration, event.notes[0].v]);
  assert.deepEqual(vocalSignature(bounce), vocalSignature(normal), "弾む60:40補正を唄へ適用しない");
  assert.notDeepEqual(shamisenSignature(bounce), shamisenSignature(normal), "三味線の既存弾む補正は維持する");
}

console.log("vocal measure repeat tests passed");
