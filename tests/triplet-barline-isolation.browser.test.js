"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".ttf": "font/ttf", ".json": "application/json" };
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
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    const executablePath = process.env.SHIAN_CHROMIUM_EXECUTABLE || undefined;
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath, args: ["--no-sandbox"] } : {}) });
  } catch (error) {
    if (String(error?.message || error).includes("Executable doesn't exist")) {
      console.log("triplet/barline isolation browser test skipped: Playwright browser is not installed");
      await new Promise(resolve => server.close(resolve));
      return;
    }
    throw error;
  }

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const base = `http://127.0.0.1:${server.address().port}`;
    const score = {
      notes: [
        { m: 0, s: 3, p: 6, d: 2, v: "3", x: 0 },
        { m: 1, s: 3, p: 0, d: 2, v: "1", x: 0 },
        { m: 1, s: 3, p: 2, d: 1, v: "0", x: 0 }
      ],
      tuplets: [], vocalNotes: [], vocalSlurs: [], scoreParts: [], barlineKinds: {}, measureSpecials: {},
      title: "三連符小節線分離テスト", tuning: "二上り", meter: "2/4", rows: 1, measuresPerRow: 4,
      rowMeasureCounts: [4], measureOffsets: [], lyrics: [], layers: [], scoreEditLayer: "notes"
    };
    await page.addInitScript(value => localStorage.setItem("shian-bunkafu-editor-v2", JSON.stringify(value)), score);
    await page.goto(`${base}/index.html`);
    await page.click('[data-score-layer="technique"]');
    await page.click("#tripletTool");

    const tripletModeStyles = await page.evaluate(() => ({
      active: document.body.classList.contains("triplet-selecting"),
      layer: document.body.dataset.scoreLayer,
      score: getComputedStyle(document.querySelector("#scoreArea")).pointerEvents,
      note: getComputedStyle(document.querySelector('[data-note="1,3,0"]')).pointerEvents,
      barline: getComputedStyle(document.querySelector('[data-barline-key="0:1"]')).pointerEvents
    }));
    assert.equal(tripletModeStyles.active, true);
    assert.equal(tripletModeStyles.layer, "technique");
    assert.equal(tripletModeStyles.score, "none", "the score surface itself must stay inert");
    assert.equal(tripletModeStyles.note, "auto", "note endpoints must stay clickable");
    assert.equal(tripletModeStyles.barline, "none", "the barline hit area must not react");

    const tripletBarline = page.locator('[data-barline-key="0:1"]');
    const tripletBarlineBox = await tripletBarline.boundingBox();
    await page.mouse.move(tripletBarlineBox.x + tripletBarlineBox.width / 2, tripletBarlineBox.y + tripletBarlineBox.height / 2);
    assert.notEqual(
      await tripletBarline.evaluate(element => getComputedStyle(element, "::after").borderLeftWidth),
      "4px",
      "hovering the wide barline area during triplet entry must not show the yellow reaction"
    );

    await page.click('[data-note="1,3,0"] b');
    await page.click('[data-note="1,3,2"] b');
    assert.equal(await page.locator(".tuplet-item").count(), 1, "two selected notes must still create one triplet");
    assert.equal(await page.locator(".barline-handle.selected").count(), 0, "triplet entry must not select a barline");

    await page.click('[data-score-layer="staff"]');
    assert.equal(
      await page.locator('[data-barline-key="0:1"]').evaluate(element => getComputedStyle(element).pointerEvents),
      "auto",
      "barlines must remain interactive in their normal staff layer"
    );
    await page.locator('[data-barline-key="0:1"]').click();
    assert.equal(await page.locator('[data-barline-key="0:1"].selected').count(), 1, "normal barline selection must still work");
    assert.equal(
      await page.locator('[data-barline-key="0:1"]').evaluate(element => getComputedStyle(element, "::after").borderLeftWidth),
      "4px",
      "the selected barline must keep its normal staff-layer highlight"
    );

    console.log("triplet/barline isolation browser test passed");
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
