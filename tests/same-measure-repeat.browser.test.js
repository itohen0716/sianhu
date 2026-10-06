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
      console.log("same measure repeat browser test skipped: Playwright browser is not installed");
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
        { m: 1, s: 3, p: 0, d: 4, v: "7", x: 0 }
      ],
      tuplets: [], vocalNotes: [], vocalSlurs: [], scoreParts: [], barlineKinds: {}, measureSpecials: {},
      title: "同じ2ブラウザ試験", tuning: "二上り", meter: "2/4", rows: 1, measuresPerRow: 3,
      rowMeasureCounts: [3], measureOffsets: [], lyrics: [], layers: [], scoreEditLayer: "notes"
    };
    await page.addInitScript((value) => localStorage.setItem("shian-bunkafu-editor-v2", JSON.stringify(value)), score);
    await page.goto(`${base}/index.html`);
    await page.waitForSelector('[data-measure-select="2"]');

    await page.locator('[data-measure-select="2"]').click();
    await page.locator('[data-score-part="same2"]').click();
    assert.equal(await page.locator('.measure[data-measure="2"] .score-part[aria-label="同じ2"]').count(), 1, "同じ2を既存の小節中央表示へ入力できる");

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("shian-bunkafu-editor-v2")));
    assert.deepEqual(saved.scoreParts.map(({ kind, m, repeatCount, sourceMeasureOffset, playbackMeasureSpan }) => ({ kind, m, repeatCount, sourceMeasureOffset, playbackMeasureSpan })), [
      { kind: "same2", m: 2, repeatCount: 1, sourceMeasureOffset: -2, playbackMeasureSpan: 2 }
    ], "保存値は直前2小節を1回参照する意味へ正規化される");

    await page.reload();
    await page.waitForSelector('.measure[data-measure="2"] .score-part[aria-label="同じ2"]');
    assert.equal(await page.locator('.measure[data-measure="2"] .score-part[aria-label="同じ2"]').count(), 1, "保存・再読込後も同じ2表示を維持する");

    await page.click("#playScore");
    await page.waitForFunction(() => document.querySelector("#scorePlayerFrame")?.contentWindow?.ShianPlayerDiagnostics);
    const playbackResult = await page.evaluate(() => {
      const payload = JSON.parse(sessionStorage.getItem("shian-live-player-score"));
      const result = document.querySelector("#scorePlayerFrame").contentWindow.ShianPlayerDiagnostics.buildTimeMapForPayload(payload);
      return {
        metadata: payload.score.scoreParts[0],
        sources: result.score.playbackSegments.map((segment) => segment.sourceM),
        displays: result.score.playbackSegments.map((segment) => segment.displayM),
        values: result.events.filter((event) => event.voice === "shamisen").map((event) => event.notes[0].v),
        endUnit: result.score.playbackEndUnit
      };
    });
    assert.deepEqual(playbackResult.sources, [0, 1, 0, 1]);
    assert.deepEqual(playbackResult.displays, [0, 1, 2, 2]);
    assert.deepEqual(playbackResult.values, ["1", "7", "1", "7"], "実ブラウザの再生経路でも A→B→A→B になる");
    assert.equal(playbackResult.endUnit, 32);
    assert.equal(playbackResult.metadata.repeatCount, 1);
    assert.equal(playbackResult.metadata.sourceMeasureOffset, -2);

    await page.goto(`${base}/annotations.html`);
    await page.waitForSelector('.measure[data-measure="2"] .score-part[aria-label="同じ2"]');
    assert.equal(await page.locator('.measure[data-measure="2"] .score-part[aria-label="同じ2"]').count(), 1, "書き込みページも同じ保存データを同じ位置へ表示する");

    console.log("same measure repeat browser test passed");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
