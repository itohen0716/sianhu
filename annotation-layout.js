(function(global){
  "use strict";
  const VERSION=1,UNIT="staff-line",LANES=["afterScore","afterLyrics","afterVocal"];
  const round=value=>Math.round(Math.max(0,Number(value)||0)*1000000)/1000000;
  const key=(row,lane)=>`${Math.max(0,Math.trunc(Number(row)||0))}:${LANES.includes(lane)?lane:"afterScore"}`;
  function normalize(raw){
    const boundaries={};
    Object.entries(raw?.boundaries||{}).forEach(([name,value])=>{
      if(!/^\d+:(afterScore|afterLyrics|afterVocal)$/.test(name))return;
      const gap=round(typeof value==="number"?value:value?.gap);
      if(gap>0)boundaries[name]={gap:Math.max(gap,Number(boundaries[name]?.gap)||0)};
    });
    return{version:VERSION,unit:UNIT,boundaries};
  }
  function fromPixelGaps(entries){
    const boundaries={};
    (entries||[]).forEach(entry=>{
      const line=Math.max(1,Number(entry.lineSpacing)||18),gap=round((Number(entry.gapPx)||0)/line),name=key(entry.row,entry.lane);
      if(gap>0)boundaries[name]={gap:Math.max(gap,Number(boundaries[name]?.gap)||0)};
    });
    return{version:VERSION,unit:UNIT,boundaries};
  }
  function rawGap(layout,row,lane){return Number(normalize(layout).boundaries[key(row,lane)]?.gap)||0}
  function rowGaps(layout,row,{lyricsVisible=true,vocalVisible=true}={}){
    const source={afterScore:rawGap(layout,row,"afterScore"),afterLyrics:rawGap(layout,row,"afterLyrics"),afterVocal:rawGap(layout,row,"afterVocal")};
    const result={afterScore:source.afterScore,afterLyrics:0,afterVocal:0};
    if(lyricsVisible)result.afterLyrics=source.afterLyrics;else result.afterScore=Math.max(result.afterScore,source.afterLyrics);
    if(vocalVisible)result.afterVocal=source.afterVocal;else if(lyricsVisible)result.afterLyrics=Math.max(result.afterLyrics,source.afterVocal);else result.afterScore=Math.max(result.afterScore,source.afterVocal);
    return result;
  }
  function pixelGaps(layout,row,visibility,lineSpacing){
    const unit=Math.max(1,Number(lineSpacing)||18),gaps=rowGaps(layout,row,visibility);
    return Object.fromEntries(LANES.map(lane=>[lane,round(gaps[lane]*unit)]));
  }
  function equal(a,b){return JSON.stringify(normalize(a))===JSON.stringify(normalize(b))}
  global.ShianAnnotationLayout={VERSION,UNIT,LANES,key,normalize,fromPixelGaps,rowGaps,pixelGaps,equal};
})(window);
