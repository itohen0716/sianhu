"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

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

function payload(sentAt = 100) {
  return {
    format: "shian-live-score",
    version: 6,
    sentAt,
    score: {
      title: "開始競合試験",
      tuning: "二上り",
      meter: "2/4",
      measureCount: 2,
      notes: [
        { m: 1, s: 2, p: 0, d: 4, v: "5", rest: false },
        { m: 0, s: 3, p: 4, d: 2, v: "4", rest: false },
        { m: 0, s: 1, p: 0, d: 4, v: "3", rest: false },
        { m: 0, s: 3, p: 6, d: 1, v: "6", rest: false }
      ],
      tuplets: [
        { id: "random-triplet-id", type: "triplet", start: { m: 0, s: 3, p: 4 }, end: { m: 0, s: 3, p: 6 }, targetBeats: 1 }
      ],
      shamisenTechniques: [],
      shamisenSlurs: [],
      vocalNotes: [],
      vocalSlurs: [],
      scoreParts: [],
      repeatBarlines: [],
      measureSpecials: {}
    }
  };
}

function createHarness() {
  const loadGate = deferred();
  const scheduled = [];
  let loadManyCalls = 0;
  let asyncFallbackCalls = 0;
  const gainParam = () => ({ setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {} });
  const audioContext = {
    currentTime: 0,
    destination: {},
    createGain() { return { gain: gainParam(), connect() { return this; }, disconnect() {} }; }
  };
  const engine = {
    async resume() { return audioContext; },
    async loadMany() { loadManyCalls += 1; await loadGate.promise; },
    playFrequencyReady(frequency, options) {
      scheduled.push({ frequency, options: structuredClone({ ...options, destination: undefined }) });
      return { duration: options.duration, stop() {} };
    },
    async playFrequency() { asyncFallbackCalls += 1; throw new Error("the asynchronous fallback must not be used after preload"); },
    playFrequencyGlideReady(startFrequency, endFrequency, options) {
      scheduled.push({ startFrequency, endFrequency, options: structuredClone({ ...options, destination: undefined }) });
      return { duration: options.duration, stop() {} };
    },
    async playFrequencyGlide() { asyncFallbackCalls += 1; throw new Error("the asynchronous glide fallback must not be used after preload"); },
    stopAll() {},
    clearTrace() {},
    getTrace() { return []; }
  };
  const elements = new Map();
  const get = (selector) => {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  };
  const window = {
    ShianAudioEngine: engine,
    ShianTuningMasterReady: Promise.resolve(),
    ShianTuningMaster: {
      get() { return { frequencies: [110, 146.8323839587, 195.9977179909] }; }
    },
    addEventListener() {},
    clearInterval() {},
    setInterval() { return 1; },
    clearTimeout() {},
    setTimeout() { return 1; },
    parent: { postMessage() {} }
  };
  const context = {
    window,
    document: { querySelector: get, addEventListener() {}, hidden: false },
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
  return {
    diagnostics: window.ShianPlayerDiagnostics,
    audioContext,
    loadGate,
    scheduled,
    get loadManyCalls() { return loadManyCalls; },
    get asyncFallbackCalls() { return asyncFallbackCalls; }
  };
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
}

(async () => {
  const harness = createHarness();
  const { diagnostics } = harness;
  const scorePayload = payload(101);

  assert.equal(diagnostics.receivePayload(scorePayload), true, "the first delivery must load the score");
  const firstPlay = diagnostics.play();
  const secondPlay = diagnostics.play();
  await settle();
  assert.equal(harness.loadManyCalls, 1, "double-clicking play during preparation must start only one audio preparation");
  assert.equal(diagnostics.getPlaybackState().starting, true, "the player must expose one in-flight start request");

  const requestBeforeDuplicate = diagnostics.getPlaybackState().playRequest;
  assert.equal(diagnostics.receivePayload(scorePayload), false, "the iframe's duplicate delivery must be ignored");
  assert.equal(diagnostics.getPlaybackState().playRequest, requestBeforeDuplicate, "a duplicate payload must not cancel the in-flight start request");

  harness.audioContext.currentTime = 5;
  harness.loadGate.resolve();
  await Promise.all([firstPlay, secondPlay]);
  assert.equal(diagnostics.getPlaybackState().playing, true, "the original start request must complete after preload");
  assert.equal(diagnostics.getPlaybackState().startContextTime, 5.15, "the shared Web Audio clock must be selected after preparation completes");
  assert.equal(harness.asyncFallbackCalls, 0, "prepared sources must use the synchronous scheduler");
  assert.equal(harness.scheduled.length, 4, "each sounding note must be registered exactly once");
  assert.deepEqual(
    harness.scheduled.map((entry) => [entry.options.trace.sourceMeasure, Number(entry.options.trace.logicalStartBeat.toFixed(12)), entry.options.trace.string]),
    [[0, 0, 1], [0, 1, 3], [0, Number((5 / 3).toFixed(12)), 3], [1, 2, 2]],
    "source registration must follow canonical musical order, not the input array order"
  );
  assert(harness.scheduled.every((entry) => entry.options.when >= 5.15), "all nodes must be registered against the same future clock");

  const firstRelativeSchedule = harness.scheduled.map((entry) => ({
    when: Number((entry.options.when - diagnostics.getPlaybackState().startContextTime).toFixed(12)),
    duration: Number(entry.options.duration.toFixed(12)),
    fadeIn: entry.options.fadeInSeconds ?? null,
    fadeOut: entry.options.fadeOutSeconds ?? null,
    tail: entry.options.tailReleaseSeconds ?? null,
    bridge: Boolean(entry.options.trace.tupletEntryBridge)
  }));

  diagnostics.stop(true);
  harness.scheduled.length = 0;
  harness.audioContext.currentTime = 20;
  await diagnostics.play();
  const replayRelativeSchedule = harness.scheduled.map((entry) => ({
    when: Number((entry.options.when - diagnostics.getPlaybackState().startContextTime).toFixed(12)),
    duration: Number(entry.options.duration.toFixed(12)),
    fadeIn: entry.options.fadeInSeconds ?? null,
    fadeOut: entry.options.fadeOutSeconds ?? null,
    tail: entry.options.tailReleaseSeconds ?? null,
    bridge: Boolean(entry.options.trace.tupletEntryBridge)
  }));
  assert.deepEqual(replayRelativeSchedule, firstRelativeSchedule, "replaying the same JSON must produce the same relative schedule and envelope values");

  const stoppedHarness = createHarness();
  stoppedHarness.diagnostics.receivePayload(payload(202));
  const stalePlay = stoppedHarness.diagnostics.play();
  await settle();
  stoppedHarness.diagnostics.stop(true);
  stoppedHarness.loadGate.resolve();
  await stalePlay;
  assert.equal(stoppedHarness.scheduled.length, 0, "stop during preparation must invalidate the stale start request");
  assert.equal(stoppedHarness.diagnostics.getPlaybackState().playing, false, "a stale request must not revive playback");

  console.log("playback start race tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
