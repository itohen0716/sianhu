"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function loadEngine() {
  class AudioParamMock {
    constructor() { this.value = 1; }
    setValueAtTime(value) { this.value = value; }
    linearRampToValueAtTime(value) { this.value = value; }
    exponentialRampToValueAtTime(value) { this.value = value; }
    cancelScheduledValues() {}
    setTargetAtTime() {}
  }
  class SourceMock {
    constructor() { this.playbackRate = new AudioParamMock(); }
    connect() { return { connect() {} }; }
    addEventListener() {}
    disconnect() {}
    start() {}
    stop() {}
  }
  class GainMock {
    constructor() { this.gain = new AudioParamMock(); }
    connect() { return this; }
    disconnect() {}
  }
  class AudioContextMock {
    constructor() { this.currentTime = 0; this.state = "running"; this.destination = {}; }
    createBufferSource() { return new SourceMock(); }
    createGain() { return new GainMock(); }
    async decodeAudioData() { return { duration: 82, sampleRate: 48000 }; }
    async resume() {}
  }
  const window = { AudioContext: AudioContextMock };
  window.top = window;
  const context = {
    window,
    location: { origin: "https://example.test" },
    fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
    Date,
    Math,
    Number,
    Promise,
    Object,
    Array,
    Set,
    Map,
    console
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, "player", "sound-segments.js"), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(path.join(root, "player", "audio-engine.js"), "utf8"), context);
  return window;
}

(async () => {
  const window = loadEngine();
  const engine = window.ShianAudioEngine;
  const segment = window.ShianSoundSegments[6];

  for (const bpm of [120, 100, 86, 80]) {
    for (const durationBeat of [2 / 3, 1 / 3]) {
      engine.clearTrace();
      const logicalDuration = durationBeat * 60 / bpm;
      await engine.playSegment(segment, {
        when: 0,
        duration: logicalDuration,
        playbackRate: 1,
        exclusive: false,
        preserveSampleTail: true,
        fadeInSeconds: 0.018,
        fadeOutSeconds: 0.018,
        tailReleaseSeconds: 0.004,
        trace: { id: `${bpm}-${durationBeat}` }
      });
      const trace = engine.getTrace()[0];
      assert(Math.abs(trace.logicalOutputDuration - logicalDuration) < 1e-9, `${bpm} BPM: logical duration must stay unchanged`);
      assert(Math.abs(trace.tailReleaseSeconds - 0.004) < 1e-9, `${bpm} BPM: only the bounded 4 ms safe tail is retained`);
      assert(Math.abs(trace.sourceStopAt - (logicalDuration + 0.004)) < 1e-9, `${bpm} BPM: source stop must follow the safe release`);
      assert(Math.abs(trace.gainFadeOutStartAt - (logicalDuration + 0.004 - 0.018)) < 1e-9, `${bpm} BPM: reference 18 ms fade must straddle the boundary`);
    }
  }

  engine.clearTrace();
  await engine.playSegment(segment, { when: 0, duration: 0.5, playbackRate: 1, exclusive: false, trace: { id: "normal" } });
  const normal = engine.getTrace()[0];
  assert.equal(normal.preserveSampleTail, false, "ordinary notes must not opt into the triplet tail profile");
  assert(Math.abs(normal.outputDuration - 0.5) < 1e-9, "ordinary-note duration must remain unchanged");

  engine.clearTrace();
  await engine.playSegment(segment, {
    when: 0,
    duration: 0.5,
    playbackRate: 1,
    exclusive: false,
    preserveSampleTail: true,
    fadeOutSeconds: 0.018,
    tailReleaseSeconds: 0.004,
    trace: { id: "measure-boundary-bridge" }
  });
  const boundaryBridge = engine.getTrace()[0];
  assert(Math.abs(boundaryBridge.gainAttackEndAt - 0.003) < 1e-9, "the preceding normal note must retain its ordinary 3 ms attack");
  assert(Math.abs(boundaryBridge.tailReleaseSeconds - 0.004) < 1e-9, "the boundary bridge must use only the bounded 4 ms tail");
  assert(Math.abs(boundaryBridge.sourceStopAt - 0.504) < 1e-9, "the boundary bridge source must stop 4 ms after the logical end");
  assert(Math.abs(boundaryBridge.gainFadeOutStartAt - 0.486) < 1e-9, "the 18 ms release must begin 14 ms before the logical boundary");

  const player = fs.readFileSync(path.join(root, "player", "player.js"), "utf8");
  assert(player.includes('preserveSampleTail=Boolean(sourceKind==="normal"&&(event.isTuplet||tupletEntryBridge))'), "sample-tail preservation must stay limited to normal-source triplets and the explicit tuplet-entry bridge");
  assert(player.includes('tripletFadeInSeconds=event.isTuplet&&sourceKind==="normal"?.018:undefined'), "triplet attacks must keep the compared 18 ms fade");
  assert(player.includes("transitionFadeOutSeconds=preserveSampleTail?.018:undefined"), "triplets must keep the compared 18 ms release fade");
  assert(player.includes("tailReleaseSeconds=preserveSampleTail?.004:undefined"), "triplets must keep only the bounded safe tail");
  assert(player.includes("scale=tuplet.targetUnits/written"), "triplet time mapping must remain 2/3 + 1/3 = one beat");

  console.log("triplet playback tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
