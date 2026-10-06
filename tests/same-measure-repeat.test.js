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

function note(m, v, p = 0, d = 4) {
  return { m, s: 3, p, d, v, rest: false };
}

function payload({ notes, scoreParts, measureCount, measureSpecials = {}, tuplets = [] }) {
  return {
    format: "shian-live-score",
    version: 6,
    score: {
      title: "同じ記号試験",
      tuning: "二上り",
      meter: "2/4",
      measureCount,
      measureSpecials,
      repeatBarlines: [],
      scoreParts,
      notes,
      tuplets,
      shamisenSlurs: [],
      shamisenTechniques: [],
      vocalNotes: [],
      vocalSlurs: []
    }
  };
}

function playback(diagnostics, value) {
  const result = diagnostics.buildTimeMapForPayload(value);
  return {
    score: result.score,
    events: result.events.filter((event) => event.voice === "shamisen")
  };
}

function sources(score) {
  return Array.from(score.playbackSegments, (segment) => Number(segment.sourceM));
}

function displays(score) {
  return Array.from(score.playbackSegments, (segment) => Number(segment.displayM));
}

function values(events) {
  return Array.from(events, (event) => event.notes[0]?.v);
}

const diagnostics = loadDiagnostics();

{
  const result = playback(diagnostics, payload({
    notes: [note(0, "1")],
    scoreParts: [{ type: "measureRepeat", kind: "same1", m: 1, repeatCount: 1 }],
    measureCount: 2
  }));
  assert.deepEqual(sources(result.score), [0, 0], "同じ1は直前1小節を1回だけ参照する");
  assert.deepEqual(displays(result.score), [0, 1], "参照音は同じ1記号の表示小節として追跡される");
  assert.deepEqual(values(result.events), ["1", "1"], "A｜同じ1 は A→A になる");
  assert.equal(result.score.playbackEndUnit, 16, "同じ1の再生時間を曲終了時刻へ含める");
}

{
  const result = playback(diagnostics, payload({
    notes: [note(0, "1"), note(1, "7")],
    scoreParts: [{ type: "measureRepeat", kind: "same2", m: 2, repeatCount: 1, sourceMeasureOffset: -2, playbackMeasureSpan: 2 }],
    measureCount: 3
  }));
  assert.deepEqual(sources(result.score), [0, 1, 0, 1], "同じ2は直前2小節を元の順番で1回参照する");
  assert.deepEqual(displays(result.score), [0, 1, 2, 2], "同じ2の2小節分は同じ2記号の表示小節として追跡される");
  assert.deepEqual(values(result.events), ["1", "7", "1", "7"], "A｜B｜同じ2 は A→B→A→B になる");
  assert.notDeepEqual(values(result.events), ["1", "7", "7", "7"], "同じ2を直前1小節の2回反復として扱わない");
  assert.equal(result.score.playbackEndUnit, 32, "同じ2の2小節分を曲終了時刻へ含める");
}

{
  const oldMetadata = playback(diagnostics, payload({
    notes: [note(0, "2"), note(1, "8")],
    scoreParts: [{ type: "measureRepeat", kind: "same2", m: 2, repeatCount: 2, sourceMeasureOffset: -1, playbackMeasureSpan: 2 }],
    measureCount: 3
  }));
  assert.deepEqual(values(oldMetadata.events), ["2", "8", "2", "8"], "旧メタデータでも kind=同じ2 を正しい新仕様で読む");

  const legacyWithoutKind = playback(diagnostics, payload({
    notes: [note(0, "3"), note(1, "9")],
    scoreParts: [{ type: "measureRepeat", m: 2, repeatCount: 2 }],
    measureCount: 3
  }));
  assert.deepEqual(values(legacyWithoutKind.events), ["3", "9", "3", "9"], "kindのない旧JSONも repeatCount=2 から同じ2として互換読込する");
}

{
  const result = playback(diagnostics, payload({
    notes: [note(0, "4"), note(1, "10")],
    scoreParts: [{ type: "measureRepeat", kind: "same2", m: 2 }],
    measureCount: 3,
    measureSpecials: { "0": { type: "hanma", lengthRatio: 0.5 } }
  }));
  assert.deepEqual(Array.from(result.score.playbackSegments, ({ start, end }) => [start, end]), [[0, 4], [4, 12], [12, 16], [16, 24]], "同じ2は各参照元小節の半間／通常長をそのまま再利用する");
  assert.equal(result.score.playbackEndUnit, 24, "半間を含む同じ2の実時間を曲終了へ反映する");
}

{
  const triplet = { type: "triplet", start: { m: 1, s: 3, p: 0 }, end: { m: 1, s: 3, p: 2 }, targetBeats: 1 };
  const result = playback(diagnostics, payload({
    notes: [note(0, "5"), note(1, "11", 0, 2), note(1, "12", 2, 1), note(1, "13", 4, 4)],
    scoreParts: [{ type: "measureRepeat", kind: "same2", m: 2 }],
    measureCount: 3,
    tuplets: [triplet]
  }));
  const tripletEvents = result.events.filter((event) => event.isTuplet);
  assert.equal(tripletEvents.length, 4, "参照元の三連符2音を元小節と同じ2内の双方で展開する");
  assert.deepEqual(Array.from(tripletEvents, (event) => Number(event.duration.toFixed(12))), [8 / 3, 4 / 3, 8 / 3, 4 / 3].map((value) => Number(value.toFixed(12))), "同じ2側で三連符時間を独自再計算しない");
}

{
  const invalidAtSecondMeasure = playback(diagnostics, payload({
    notes: [note(0, "6"), note(1, "14")],
    scoreParts: [{ type: "measureRepeat", kind: "same2", m: 1 }],
    measureCount: 2
  }));
  assert.deepEqual(values(invalidAtSecondMeasure.events), ["6", "14"], "参照元が2小節ない旧データは安全に通常小節として扱う");
}

{
  const chained = playback(diagnostics, payload({
    notes: [note(0, "1"), note(1, "7")],
    scoreParts: [
      { type: "measureRepeat", kind: "same2", m: 2 },
      { type: "measureRepeat", kind: "same1", m: 3 }
    ],
    measureCount: 4
  }));
  assert.deepEqual(sources(chained.score), [0, 1, 0, 1, 1], "連続記号では既存どおり直前表示小節が解決した最後の実小節を参照する");
}

{
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const annotations = fs.readFileSync(path.join(root, "annotations.html"), "utf8");
  assert(index.includes('data-score-part="same1"') && index.includes('data-score-part="same2"'), "既存の同じ1／同じ2入力UIを維持する");
  assert(index.includes('repeatCount:1,sourceMeasureOffset:-sourceMeasureSpan'), "写譜側は訂正済みメタデータを保存・送信する");
  assert(annotations.includes('repeatCount:1,sourceMeasureOffset:-sourceMeasureSpan'), "書き込み側も訂正済みメタデータを保存・送信する");
  assert(index.includes('leftRatio:.5'), "小節中央の印刷表示を維持する");
  assert(index.includes('kind==="same2"?"同じ2":"同じ1"'), "同じ1／同じ2の既存表示を維持する");
}

console.log("same measure repeat tests passed");
