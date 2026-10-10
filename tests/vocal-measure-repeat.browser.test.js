"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".ttf": "font/ttf", ".json": "application/json", ".wav": "audio/wav" };
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(root, relative);
  if (!file.startsWith(`${root}${path.sep}`) && file !== path.join(root, "index.html")) {
    response.writeHead(403).end();
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    response.end(data);
  });
});

(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    const executablePath = process.env.SHIAN_CHROMIUM_EXECUTABLE || undefined;
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath, args: ["--no-sandbox"] } : {}) });
  } catch (error) {
    if (String(error?.message || error).includes("Executable doesn't exist")) {
      console.log("vocal measure repeat browser test skipped: Playwright browser is not installed");
      await new Promise((resolve) => server.close(resolve));
      return;
    }
    throw error;
  }

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const base = `http://127.0.0.1:${server.address().port}`;
    const score = {
      notes: [
        { m: 0, s: 3, p: 0, d: 4, v: "1", x: 0 },
        { m: 1, s: 3, p: 0, d: 4, v: "5", x: 0 }
      ],
      tuplets: [],
      vocalNotes: [
        { id: "v0", m: 0, s: 3, p: 0, d: 4, v: "2", kind: "pitch", dotted: false, x: 0 },
        { id: "v1", m: 1, s: 3, p: 0, d: 4, v: "4", kind: "pitch", dotted: false, x: 0 },
        { id: "v2-rest", m: 2, s: 3, p: 0, d: 1, v: "・", kind: "rest", dotted: false, x: 0 },
        { id: "v2-start", m: 2, s: 3, p: 1, d: 2, v: "9", kind: "pitch", dotted: true, x: 0 },
        { id: "v2-end", m: 2, s: 3, p: 4, d: 2, v: "10", kind: "pitch", dotted: false, x: 0 }
      ],
      vocalSlurs: [{ id: "vocal-slur", startId: "v2-start", endId: "v2-end" }],
      scoreParts: [{ id: "same2", type: "measureRepeat", kind: "same2", m: 2, p: 4, x: 0 }],
      barlineKinds: { "0:0": "repeat-start", "0:3": "repeat-end" },
      measureSpecials: {},
      title: "唄譜小節反復ブラウザ試験",
      tuning: "二上り",
      meter: "2/4",
      rows: 1,
      measuresPerRow: 3,
      rowMeasureCounts: [3],
      measureOffsets: [],
      lyrics: [],
      layers: [],
      scoreEditLayer: "notes"
    };
    await page.addInitScript((value) => localStorage.setItem("shian-bunkafu-editor-v2", JSON.stringify(value)), score);
    await page.goto(`${base}/index.html`);
    await page.waitForSelector('.measure[data-measure="2"] .score-part[aria-label="同じ2"]');
    await page.click("#playScore");
    await page.waitForFunction(() => document.querySelector("#scorePlayerFrame")?.contentWindow?.ShianPlayerDiagnostics);

    const playback = await page.evaluate(() => {
      const payload = JSON.parse(sessionStorage.getItem("shian-live-player-score"));
      const result = document.querySelector("#scorePlayerFrame").contentWindow.ShianPlayerDiagnostics.buildTimeMapForPayload(payload);
      return {
        shamisen: result.events.filter((event) => event.voice === "shamisen").map((event) => event.notes[0].v),
        vocal: result.events.filter((event) => event.voice === "vocal").map((event) => event.notes[0].v),
        displayTwoSources: result.score.vocalNotes.filter((note) => note.displayM === 2).map((note) => note.sourceM),
        displayTwoCopies: result.score.vocalNotes.filter((note) => note.displayM === 2).map((note) => ({ v: note.v, dotted: note.dotted, rest: note.rest })),
        vocalSlurCount: result.score.vocalSlurs.length,
        endUnit: result.score.playbackEndUnit
      };
    });

    assert.deepEqual(playback.shamisen, ["1", "5", "1", "5", "1", "5", "1", "5"], "A/B反復を含む同じ2の三味線を維持する");
    assert.deepEqual(playback.vocal, ["2", "4", "・", "9", "10", "2", "4", "・", "9", "10"], "実ブラウザ送信経路でも同じ2の固有唄を各A/B周回で一度だけ再生する");
    assert.deepEqual(playback.displayTwoSources, [2, 2, 2, 2, 2, 2], "同じ2小節の唄は表示小節を参照する");
    assert.deepEqual(playback.displayTwoCopies.slice(0, 3), [
      { v: "・", dotted: false, rest: true },
      { v: "9", dotted: true, rest: false },
      { v: "10", dotted: false, rest: false }
    ], "休符と付点をブラウザ送信後も保持する");
    assert.equal(playback.vocalSlurCount, 2, "A/Bの2周分へ唄スラーを対応付ける");
    assert.equal(playback.endUnit, 64, "三味線と唄で共通の曲終了時刻を維持する");

    console.log("vocal measure repeat browser test passed");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
