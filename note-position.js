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
    const limit = Math.max(0, cellWidth / 2 - safetyMargin);
    return { min: -limit, max: limit };
  }

  function constrainDisplayOffset(offset, measurePixels, capacity) {
    const value = Number(offset);
    const bounds = displayOffsetBounds(measurePixels, capacity);
    return clamp(Number.isFinite(value) ? value : 0, bounds.min, bounds.max);
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
    rescaleDisplayOffset
  });
})();
