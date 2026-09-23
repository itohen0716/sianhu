(() => {
  "use strict";

  const root = (() => {
    try { return window.top && window.top.location.origin === location.origin ? window.top : window; }
    catch (_) { return window; }
  })();
  if (root !== window && root.ShianAudioEngine) {
    window.ShianAudioEngine = root.ShianAudioEngine;
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const active = new Set();
  let context;
  let teacherBuffer;
  let loadPromise;

  function getContext() {
    if (!AudioContextClass) throw new Error("このブラウザーはWeb Audio APIに対応していません。");
    if (!context || context.state === "closed") context = new AudioContextClass({ latencyHint: "interactive" });
    return context;
  }

  async function resume() {
    const ctx = getContext();
    if (ctx.state === "suspended") await ctx.resume();
    return ctx;
  }

  function load() {
    if (teacherBuffer) return Promise.resolve(teacherBuffer);
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      const ctx = await resume();
      let response;
      try {
        response = await fetch("./audio/teacher-1to12-octave.wav", { cache: "force-cache" });
      } catch (_) {
        throw new Error("三味線音源を読み込めませんでした。通信状態を確認してください。");
      }
      if (!response.ok) throw new Error(`三味線音源を読み込めませんでした（${response.status}）。`);
      const audioData = await response.arrayBuffer();
      if (!audioData.byteLength) throw new Error("三味線音源のデータが空です。");
      try {
        teacherBuffer = await ctx.decodeAudioData(audioData);
      } catch (_) {
        throw new Error("三味線音源を再生用に変換できませんでした。");
      }
      return teacherBuffer;
    })().catch((error) => {
      loadPromise = null;
      throw error;
    });
    return loadPromise;
  }

  function stopVoice(voice, fadeSeconds = 0.02) {
    if (!voice || voice.stopped) return;
    voice.stopped = true;
    active.delete(voice);
    const now = voice.context.currentTime;
    try {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0.0001, now, Math.max(0.001, fadeSeconds / 3));
      voice.source.stop(now + fadeSeconds);
    } catch (_) {}
  }

  function stopAll(fadeSeconds = 0.02) {
    [...active].forEach((voice) => stopVoice(voice, fadeSeconds));
  }

  async function playSegment(segmentOrNumber, options = {}) {
    const segment = typeof segmentOrNumber === "number"
      ? window.ShianSoundSegments?.[segmentOrNumber]
      : segmentOrNumber;
    if (!segment || !Number.isFinite(segment.start) || !Number.isFinite(segment.end)) {
      throw new Error("音源区間が見つかりません。");
    }

    const ctx = await resume();
    const audioBuffer = await load();
    if (options.exclusive !== false) stopAll(0.01);

    const offset = Math.max(0, segment.start);
    const rate = Math.max(0.25, Math.min(4, Number(options.playbackRate) || 1));
    const endRate = Math.max(0.25, Math.min(4, Number(options.playbackRateEnd) || rate));
    const baseSourceDuration = Math.max(0.05, Math.min(segment.end, audioBuffer.duration) - offset);
    const availableSourceDuration = Math.max(baseSourceDuration, Math.min(Number(segment.tailEnd) || segment.end, audioBuffer.duration) - offset);
    const requestedDuration = Math.max(0, Number(options.duration) || 0);
    const requestedGlideDuration = endRate !== rate
      ? Math.min(requestedDuration || Infinity, Math.max(0.01, Number(options.glideDuration) || requestedDuration || 0.01))
      : 0;
    const averageRate = requestedDuration && requestedGlideDuration
      ? (((rate + endRate) / 2) * requestedGlideDuration + endRate * (requestedDuration - requestedGlideDuration)) / requestedDuration
      : rate;
    const minimumOutputDuration = Math.max(0, Number(options.minimumDuration) || 0);
    const sourceDuration = requestedDuration
      ? Math.min(availableSourceDuration, Math.max(0.05, requestedDuration * averageRate))
      : Math.min(availableSourceDuration, Math.max(baseSourceDuration, minimumOutputDuration * rate));
    const outputDuration = requestedDuration
      ? Math.min(requestedDuration, sourceDuration / averageRate)
      : sourceDuration / rate;
    const startDelay = Math.max(0, Number(options.delay) || 0);
    const startAt = ctx.currentTime + startDelay;
    const fade = Math.min(0.018, outputDuration / 5);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const voice = { source, gain, context: ctx, stopped: false };

    source.buffer = audioBuffer;
    source.playbackRate.setValueAtTime(rate, startAt);
    if (endRate !== rate) {
      const glideDuration = Math.min(outputDuration, requestedGlideDuration || outputDuration);
      source.playbackRate.linearRampToValueAtTime(endRate, startAt + glideDuration);
      source.playbackRate.setValueAtTime(endRate, startAt + outputDuration);
    }
    const destination = options.destination && typeof options.destination.connect === "function"
      ? options.destination
      : ctx.destination;
    source.connect(gain).connect(destination);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(Number(options.volume) || 0.9, startAt + fade);
    gain.gain.setValueAtTime(Number(options.volume) || 0.9, startAt + Math.max(fade, outputDuration - fade));
    gain.gain.linearRampToValueAtTime(0.0001, startAt + outputDuration);
    source.addEventListener("ended", () => {
      active.delete(voice);
      try { source.disconnect(); gain.disconnect(); } catch (_) {}
    }, { once: true });
    active.add(voice);
    source.start(startAt, offset, sourceDuration);
    if (requestedDuration) {
      try { source.stop(startAt + outputDuration + 0.01); } catch (_) {}
    }

    return Object.freeze({
      duration: outputDuration,
      stop: () => stopVoice(voice),
      ended: new Promise((resolve) => source.addEventListener("ended", resolve, { once: true }))
    });
  }

  async function play(noteNumber, options) {
    const voice = await playSegment(noteNumber, options);
    return voice.duration;
  }

  async function playFrequency(frequency, options = {}) {
    const target = Number(frequency);
    const master = window.ShianTuningMaster;
    if (!Number.isFinite(target) || !master) throw new Error("調弦データから音を取得できません。");
    const sources = master.entries
      .filter((entry) => entry.mode === "hon")
      .flatMap((entry) => [
        { noteNumber: entry.count, frequency: entry.frequencies[0] },
        { noteNumber: entry.count + 12, frequency: entry.frequencies[0] * 2 }
      ]);
    if (!sources.length) throw new Error("先生音源に対応する調弦データがありません。");
    const source = sources.reduce((best, candidate) =>
      Math.abs(Math.log2(target / candidate.frequency)) < Math.abs(Math.log2(target / best.frequency))
        ? candidate
        : best
    );
    return playSegment(source.noteNumber, {
      ...options,
      playbackRate: (Number(options.playbackRate) || 1) * target / source.frequency
    });
  }

  async function playFrequencyGlide(startFrequency, endFrequency, options = {}) {
    const start = Number(startFrequency), end = Number(endFrequency), master = window.ShianTuningMaster;
    if (!Number.isFinite(start) || !Number.isFinite(end) || !master) throw new Error("スリの音高を取得できませんでした。");
    const sources = master.entries
      .filter((entry) => entry.mode === "hon")
      .flatMap((entry) => [
        { noteNumber: entry.count, frequency: entry.frequencies[0] },
        { noteNumber: entry.count + 12, frequency: entry.frequencies[0] * 2 }
      ]);
    if (!sources.length) throw new Error("先生音源に対応する調弦データがありません。");
    const source = sources.reduce((best, candidate) =>
      Math.abs(Math.log2(start / candidate.frequency)) < Math.abs(Math.log2(start / best.frequency)) ? candidate : best
    );
    return playSegment(source.noteNumber, {
      ...options,
      playbackRate: start / source.frequency,
      playbackRateEnd: end / source.frequency
    });
  }

  const api = Object.freeze({ getContext, resume, load, play, playSegment, playFrequency, playFrequencyGlide, stop: stopAll, stopAll });
  root.ShianAudioEngine = api;
  window.ShianAudioEngine = api;
})();
