(() => {
  "use strict";

  const HOLD_UNITS = 4;
  const validPosition = value => Number.isInteger(Number(value)) && Number(value) >= 0;
  const anchorKey = value => `${Number(value?.m)},${Number(value?.s)},${Number(value?.p)}`;

  function normalize({ holds, notes, totalMeasures, capacity, capacityFor }) {
    const safeNotes = Array.isArray(notes) ? notes : [];
    const safeTotal = Math.max(0, Number(totalMeasures) || 0);
    const safeCapacity = Math.max(1, Number(capacity) || 1);
    const capacityAt = typeof capacityFor === "function" ? capacityFor : () => safeCapacity;
    const notesByKey = new Map(safeNotes.map(note => [anchorKey(note), note]));
    const seenSources = new Set();

    return (Array.isArray(holds) ? holds : []).flatMap(hold => {
      const source = hold?.source;
      const sourceKey = anchorKey(source);
      const note = notesByKey.get(sourceKey);
      if (hold?.type !== "hold" || !note || note.rest || Number(note.d) !== HOLD_UNITS || seenSources.has(sourceKey)) return [];
      if (![source?.m, source?.s, source?.p].every(validPosition) || ![1, 2, 3].includes(Number(source.s))) return [];

      let m = Number(source.m), p = Number(source.p) + HOLD_UNITS;
      while (m < safeTotal && p >= capacityAt(m)) { p -= capacityAt(m); m += 1; }
      if (m < 0 || m >= safeTotal || p + HOLD_UNITS > capacityAt(m)) return [];
      const overlaps = (startA, lengthA, startB, lengthB) => startA < startB + lengthB && startB < startA + lengthA;
      if (safeNotes.some(item => Number(item.m) === m && (item.rest || Number(item.s) === Number(source.s)) && overlaps(p, HOLD_UNITS, Number(item.p) || 0, Number(item.d) || HOLD_UNITS))) return [];
      if ((Array.isArray(holds) ? holds : []).some(item => item !== hold && item?.type === "hold" && Number(item.m) === m && Number(item.s) === Number(source.s) && overlaps(p, HOLD_UNITS, Number(item.p), Number(item.d) || HOLD_UNITS))) return [];
      seenSources.add(sourceKey);
      return [{ type: "hold", m, s: Number(source.s), p, d: HOLD_UNITS, source: { m: Number(source.m), s: Number(source.s), p: Number(source.p) } }];
    });
  }

  function create({ source, notes, holds, totalMeasures, capacity, capacityFor, isOccupied }) {
    const note = (Array.isArray(notes) ? notes : []).find(item => anchorKey(item) === anchorKey(source));
    if (!note || note.rest || Number(note.d) !== HOLD_UNITS) return { ok: false, reason: "source" };
    const normalized = normalize({ holds, notes, totalMeasures, capacity, capacityFor });
    if (normalized.some(item => anchorKey(item.source) === anchorKey(source))) return { ok: false, reason: "duplicate" };

    const safeCapacity = Math.max(1, Number(capacity) || 1);
    const getCapacity = typeof capacityFor === "function" ? capacityFor : () => safeCapacity;
    let m = Number(source.m), p = Number(source.p) + HOLD_UNITS;
    while (m < Number(totalMeasures) && p >= getCapacity(m)) { p -= getCapacity(m); m += 1; }
    if (m >= Number(totalMeasures) || p + HOLD_UNITS > getCapacity(m)) return { ok: false, reason: "end" };
    const hold = { type: "hold", m, s: Number(source.s), p, d: HOLD_UNITS, source: { m: Number(source.m), s: Number(source.s), p: Number(source.p) } };
    if (typeof isOccupied === "function" && isOccupied(hold)) return { ok: false, reason: "occupied" };
    return { ok: true, hold };
  }

  function sourceKeyFor(hold) { return anchorKey(hold?.source); }

  globalThis.ShianNoteHold = Object.freeze({ HOLD_UNITS, normalize, create, sourceKeyFor });
})();
