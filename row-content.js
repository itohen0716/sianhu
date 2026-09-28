(function(global){
  "use strict";

  const EMPTY_TEXT=/^[\s\u200B-\u200D\u2060\uFEFF]*$/u;

  function meaningfulText(value){
    return !EMPTY_TEXT.test(String(value??""));
  }

  function rowMeasureCounts(state){
    const rows=Math.max(1,Math.trunc(Number(state?.rows)||1));
    const fallback=Math.max(1,Math.trunc(Number(state?.measuresPerRow)||4));
    const source=Array.isArray(state?.rowMeasureCounts)?state.rowMeasureCounts:[];
    return Array.from({length:rows},(_,row)=>Math.max(1,Math.trunc(Number(source[row])||fallback)));
  }

  function rowRange(state,row){
    const counts=rowMeasureCounts(state),index=Math.max(0,Math.min(counts.length-1,Math.trunc(Number(row)||0)));
    const start=counts.slice(0,index).reduce((sum,count)=>sum+count,0);
    return{start,end:start+counts[index]};
  }

  function hasLyrics(state,row){
    return meaningfulText(state?.lyrics?.[row]);
  }

  function hasVocal(state,row){
    const range=rowRange(state,row);
    return(Array.isArray(state?.vocalNotes)?state.vocalNotes:[]).some(note=>{
      const measure=Number(note?.m);
      return Number.isInteger(measure)&&measure>=range.start&&measure<range.end;
    });
  }

  function visibility(state,row){
    return{
      lyrics:state?.lyricsVisible!==false&&hasLyrics(state,row),
      vocal:state?.vocalVisible!==false&&hasVocal(state,row)
    };
  }

  function rows(state){
    return rowMeasureCounts(state).map((_,row)=>({row,...visibility(state,row),hasLyrics:hasLyrics(state,row),hasVocal:hasVocal(state,row)}));
  }

  global.ShianRowContent={meaningfulText,rowMeasureCounts,rowRange,hasLyrics,hasVocal,visibility,rows};
})(window);
