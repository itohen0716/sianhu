(() => {
  "use strict";

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function displayOffsetBounds(measurePixels, capacity) {
    const width = Number(measurePixels);
    const columns = Number(capacity);
    if (!Number.isFinite(width) || width <= 0 || !Number.isInteger(columns) || columns < 1) {
      return { min: 0, max: 0 };
    }
    const cellWidth = width / columns;
    const safetyMargin = Math.min(2, cellWidth * 0.12);
    /* p は論理セルのまま、x は表示微調整だけを担う。
       左側は前セル寄りまで整えられる余地を持たせる一方、実際の小節端と
       隣接音との衝突は呼出側の noteMoveBounds で引き続き制限する。 */
    const rightLimit = Math.max(0, cellWidth / 2 - safetyMargin);
    const leftLimit = Math.max(rightLimit, cellWidth - safetyMargin);
    return { min: -leftLimit, max: rightLimit };
  }

  function constrainDisplayOffset(offset, measurePixels, capacity) {
    const value = Number(offset);
    const bounds = displayOffsetBounds(measurePixels, capacity);
    return clamp(Number.isFinite(value) ? value : 0, bounds.min, bounds.max);
  }

  function measureDisplayOffsetBounds(measurePixels, capacity, position, glyphPixels = 12, marginPixels = 5) {
    const width = Number(measurePixels);
    const columns = Number(capacity);
    const column = Number(position);
    const glyphWidth = Math.max(0, Number(glyphPixels) || 0);
    const margin = Math.max(0, Number(marginPixels) || 0);
    if (!Number.isFinite(width) || width <= 0 || !Number.isInteger(columns) || columns < 1 || !Number.isInteger(column) || column < 0 || column >= columns) {
      return { min: 0, max: 0 };
    }
    const baseCenter = (column + 0.5) * width / columns;
    const halfGlyph = glyphWidth / 2;
    return {
      min: margin + halfGlyph - baseCenter,
      max: width - margin - halfGlyph - baseCenter
    };
  }

  function rescaleDisplayOffset(offset, oldMeasuresPerRow, newMeasuresPerRow) {
    const value = Number(offset);
    const oldCount = Number(oldMeasuresPerRow);
    const newCount = Number(newMeasuresPerRow);
    if (!Number.isFinite(value) || !value) return 0;
    if (!Number.isInteger(oldCount) || oldCount < 1 || !Number.isInteger(newCount) || newCount < 1) return value;
    return value * oldCount / newCount;
  }

  window.ShianNotePosition = Object.freeze({
    displayOffsetBounds,
    constrainDisplayOffset,
    measureDisplayOffsetBounds,
    rescaleDisplayOffset
  });
})();
