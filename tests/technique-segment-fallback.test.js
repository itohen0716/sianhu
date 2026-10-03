"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function decodedPcmDuration(file) {
  const data = fs.readFileSync(file);
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataBytes = 0;
  let cursor = 12;
  while (cursor + 8 <= data.length) {
    const id = data.toString("ascii", cursor, cursor + 4);
    const declaredSize = data.readUInt32LE(cursor + 4);
    if (id === "fmt ") {
      channels = data.readUInt16LE(cursor + 10);
      sampleRate = data.readUInt32LE(cursor + 12);
      bitsPerSample = data.readUInt16LE(cursor + 22);
    }
    if (id === "data") dataBytes = Math.min(declaredSize, data.length - cursor - 8);
    if (channels && sampleRate && bitsPerSample && dataBytes) return dataBytes / (channels * bitsPerSample / 8 * sampleRate);
    cursor += 8 + declaredSize + (declaredSize % 2);
  }
  throw new Error("WAV data chunk not found");
}

const hajikiDuration = decodedPcmDuration(path.join(root, "player", "audio", "shamisen-hajiki.wav"));

class AudioParamMock {
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
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
  async decodeAudioData(data) {
    return { duration: data.sourceKind === "hajiki" ? hajikiDuration : 85.714286, sampleRate: 44100 };
  }
  async resume() {}
}

function loadEngine() {
  const window = { AudioContext: AudioContextMock };
  window.top = window;
  const context = {
    window,
    location: { origin: "https://example.test" },
    fetch: async (url) => ({
      ok: true,
      arrayBuffer: async () => {
        const data = new ArrayBuffer(8);
        data.sourceKind = String(url).includes("hajiki") ? "hajiki" : "normal";
        return data;
      }
    }),
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
  window.ShianTuningMaster = {
    entries: Array.from({ length: 12 }, (_, index) => ({
      count: index + 1,
      mode: "hon",
      frequencies: [100 * Math.pow(2, index / 12)]
    }))
  };
  return window;
}

(async () => {
  const window = loadEngine();
  const engine = window.ShianAudioEngine;
  const highTarget = window.ShianTuningMaster.entries[10].frequencies[0] * 2;
  assert(Math.abs(hajikiDuration - 64.258844) < 0.001, "the bundled hajiki WAV must be tested using its actual decodable PCM length");

  engine.clearTrace();
  await engine.playFrequency(highTarget, {
    sourceKind: "normal",
    when: 0,
    duration: 0.25,
    exclusive: false,
    trace: { id: "normal-high" }
  });
  const normal = engine.getTrace()[0];
  assert.equal(normal.sourceNoteNumber, 23, "the complete normal WAV must keep the exact high source segment");

  engine.clearTrace();
  await engine.playFrequency(highTarget, {
    sourceKind: "hajiki",
    when: 0,
    duration: 0.25,
    exclusive: false,
    trace: { id: "hajiki-high" }
  });
  const hajiki = engine.getTrace()[0];
  assert.equal(hajiki.sourceNoteNumber, 19, "the shorter hajiki WAV must choose the nearest segment that actually exists in its decoded buffer");
  assert(hajiki.segmentStart < hajiki.audioBufferDuration, "the selected hajiki source offset must stay inside the decoded buffer");
  assert(hajiki.playbackRateStart > 1, "the available hajiki source must be pitch-shifted to the requested high note");

  console.log("technique segment fallback tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
