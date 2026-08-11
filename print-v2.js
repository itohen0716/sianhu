(function (global) {
  "use strict";

  const XHTML_NS = "http://www.w3.org/1999/xhtml";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character]));
  }

  function screenCssText() {
    const serializeRules = (rules) => Array.from(rules || []).map((rule) => {
      if (rule instanceof CSSMediaRule) {
        if (/\bprint\b/i.test(rule.conditionText)) return "";
        return `@media ${rule.conditionText}{${serializeRules(rule.cssRules)}}`;
      }
      if (typeof CSSSupportsRule !== "undefined" && rule instanceof CSSSupportsRule) {
        return `@supports ${rule.conditionText}{${serializeRules(rule.cssRules)}}`;
      }
      return rule.cssText || "";
    }).join("\n");

    return Array.from(document.styleSheets).map((sheet) => {
      try {
        return serializeRules(sheet.cssRules);
      } catch (error) {
        console.warn("印刷用に画面スタイルを取得できませんでした。", error);
        return "";
      }
    }).join("\n");
  }

  function prepareClone(source) {
    const clone = source.cloneNode(true);
    clone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
    clone.querySelectorAll(".selected,.range-selected,.moving,.on,.cursor").forEach((element) => {
      element.classList.remove("selected", "range-selected", "moving", "on", "cursor");
    });
    clone.querySelectorAll("button,input,select,textarea").forEach((element) => {
      element.setAttribute("tabindex", "-1");
      element.style.pointerEvents = "none";
    });
    source.querySelectorAll("input,textarea,select").forEach((original, index) => {
      const copied = clone.querySelectorAll("input,textarea,select")[index];
      if (!copied) return;
      if (copied instanceof HTMLInputElement) copied.setAttribute("value", original.value);
      if (copied instanceof HTMLTextAreaElement) copied.textContent = original.value;
      if (copied instanceof HTMLSelectElement) {
        Array.from(copied.options).forEach((option, optionIndex) => {
          option.toggleAttribute("selected", optionIndex === original.selectedIndex);
        });
      }
    });
    return clone;
  }

  function metadataHtml(state, meterLabel) {
    return `<div class="pv3-meta"><div class="pv3-meta-left"><span>〈</span><span>${escapeHtml(state.tuning || "")}</span><span>〉</span><span>${escapeHtml(meterLabel())}</span></div><div class="pv3-title">${escapeHtml(state.title || "曲名入力")}</div><div></div></div>`;
  }

  function buildSnapshotPage({
    pageIndex,
    sourceWidth,
    sourceHeight,
    cropTop,
    viewportHeight,
    styleText,
    scoreClone,
    annotationClone,
    annotationLeft,
    annotationTop,
    annotationWidth,
    annotationHeight,
    state,
    meterLabel
  }) {
    const scoreMarkup = scoreClone.outerHTML;
    const annotationMarkup = annotationClone.outerHTML;
    return `<section class="pv3-page" data-print-page="${pageIndex + 1}">${pageIndex === 0 ? metadataHtml(state, meterLabel) : ""}<div class="pv3-score-gap"><svg class="pv3-snapshot" viewBox="0 0 ${sourceWidth} ${viewportHeight}" xmlns="http://www.w3.org/2000/svg"><foreignObject x="0" y="0" width="${sourceWidth}" height="${viewportHeight}"><div xmlns="${XHTML_NS}" class="pv3-foreign-viewport" style="width:${sourceWidth}px;height:${viewportHeight}px"><style>${styleText}</style><div class="pv3-source" style="position:relative;width:${sourceWidth}px;height:${sourceHeight}px;transform:translateY(${-cropTop}px);transform-origin:top left;background:#fffef9;overflow:visible"><div class="pv3-score-source" style="position:relative;width:${sourceWidth}px">${scoreMarkup}</div><div class="pv3-annotation-source" style="position:absolute;left:${annotationLeft}px;top:${annotationTop}px;width:${annotationWidth}px;height:${annotationHeight}px">${annotationMarkup}</div></div></div></foreignObject></svg></div></section>`;
  }

  function render(state, options = {}) {
    const root = document.querySelector(options.rootSelector || "#printRootV2");
    const paper = document.querySelector("main.app .paper");
    const scoreArea = paper?.querySelector("#scoreArea");
    const annotations = paper?.querySelector("#annotations");
    const staffs = scoreArea ? Array.from(scoreArea.querySelectorAll(".staff")) : [];
    if (!root || !paper || !scoreArea || !annotations || !staffs.length) {
      throw new Error("印刷する譜面を取得できません。画面を再読み込みしてからお試しください。");
    }

    const pageRows = options.pageRows();
    if (!Array.isArray(pageRows) || pageRows.reduce((sum, count) => sum + count, 0) !== staffs.length) {
      throw new Error("印刷する段数とページ分割が一致していません。");
    }

    const paperRect = paper.getBoundingClientRect();
    const scoreRect = scoreArea.getBoundingClientRect();
    const annotationRect = annotations.getBoundingClientRect();
    const staffRects = staffs.map((staff) => staff.getBoundingClientRect());
    const sourceWidth = Math.max(1, Math.round(scoreRect.width));
    const sourceHeight = Math.max(1, Math.ceil(Math.max(scoreRect.height, annotationRect.bottom - scoreRect.top)));
    const rowTops = staffRects.map((rect) => rect.top - scoreRect.top);
    const firstPageCount = Math.max(1, pageRows[0]);
    const techniqueClearance = 24;
    const firstStart = Math.max(0, rowTops[0] - techniqueClearance);
    const firstEnd = firstPageCount < rowTops.length
      ? rowTops[firstPageCount]
      : staffRects[firstPageCount - 1].bottom - scoreRect.top + 28;
    const viewportHeight = Math.max(1, Math.ceil(firstEnd - firstStart));
    const styleText = `${screenCssText()}\n.pv3-score-source #scoreArea{width:${sourceWidth}px!important}.pv3-score-source .score-scroll{overflow:visible!important}.pv3-foreign-viewport,.pv3-foreign-viewport *{print-color-adjust:exact;-webkit-print-color-adjust:exact}`;
    const scoreClone = prepareClone(scoreArea);
    scoreClone.style.width = `${sourceWidth}px`;
    const annotationClone = prepareClone(annotations);
    annotationClone.setAttribute("preserveAspectRatio", annotations.getAttribute("preserveAspectRatio") || "xMinYMin meet");
    annotationClone.style.cssText = `position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none`;

    const pages = [];
    let cursor = 0;
    pageRows.forEach((count, pageIndex) => {
      const cropTop = Math.max(0, (rowTops[cursor] ?? firstStart) - techniqueClearance);
      pages.push(buildSnapshotPage({
        pageIndex,
        sourceWidth,
        sourceHeight,
        cropTop,
        viewportHeight,
        styleText,
        scoreClone,
        annotationClone,
        annotationLeft: paperRect.left - scoreRect.left,
        annotationTop: paperRect.top - scoreRect.top,
        annotationWidth: paperRect.width,
        annotationHeight: paperRect.height,
        state,
        meterLabel: options.meterLabel
      }));
      cursor += count;
    });

    root.innerHTML = pages.join("");
    root.dataset.modelVersion = "3-snapshot";
    root.dataset.pageRows = pageRows.join(",");
    root.dataset.sourceWidth = String(sourceWidth);
    root.dataset.viewportHeight = String(viewportHeight);
  }

  global.ShianPrintV2 = { render };
})(window);
