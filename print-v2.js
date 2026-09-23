(function(global){
  "use strict";
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const key=(m,s,p)=>`${m},${s},${p}`;
  const isOpenValue=value=>value==="0"||value==="○";
  const line=(x,width=1.5)=>`<line x1="${x}" y1="0" x2="${x}" y2="68" stroke="currentColor" stroke-width="${width}"/>`;
  const dots=x=>`<circle cx="${x}" cy="23" r="2.2" fill="currentColor"/><circle cx="${x}" cy="45" r="2.2" fill="currentColor"/>`;
  function barSvg(kind,edge="middle"){
    if(kind==="single")return"";
    if(edge===true)edge="end";
    if(edge==="start"){if(kind==="double")return`<svg viewBox="0 0 18 68">${line(0)}${line(6)}</svg>`;if(kind==="repeat-start")return`<svg viewBox="0 0 18 68">${line(0)}${line(6)}${dots(13)}</svg>`;if(kind==="repeat-end")return`<svg viewBox="0 0 18 68">${dots(3)}${line(9)}${line(15)}</svg>`;if(kind==="final")return`<svg viewBox="0 0 18 68">${line(0,4)}${line(8)}</svg>`}
    if(edge==="end"){if(kind==="double")return`<svg viewBox="0 0 18 68">${line(12)}${line(18)}</svg>`;if(kind==="repeat-end")return`<svg viewBox="0 0 18 68">${dots(5)}${line(12)}${line(18)}</svg>`;if(kind==="final")return`<svg viewBox="0 0 18 68">${line(10)}${line(18,4)}</svg>`}
    if(kind==="double")return`<svg viewBox="0 0 18 68">${line(7)}${line(11)}</svg>`;if(kind==="repeat-start")return`<svg viewBox="0 0 18 68">${line(5)}${line(9)}${dots(15)}</svg>`;if(kind==="repeat-end")return`<svg viewBox="0 0 18 68">${dots(3)}${line(9)}${line(13)}</svg>`;return`<svg viewBox="0 0 18 68">${line(6)}${line(12,4)}</svg>`
  }
  function sameSvg(kind){const second=kind==="same2"?'<line x1="13" y1="62" x2="27" y2="6" stroke="currentColor" stroke-width="2"/>':"";return`<svg viewBox="0 0 34 68"><circle cx="5" cy="18" r="2.5" fill="currentColor"/><circle cx="29" cy="50" r="2.5" fill="currentColor"/><line x1="7" y1="62" x2="21" y2="6" stroke="currentColor" stroke-width="2"/>${second}</svg>`}
  function captureAnnotations(state){
    const svg=document.querySelector("#annotations"),staffs=[...document.querySelectorAll("#scoreArea .staff")];
    if(!svg||!staffs.length)return{items:[]};
    const svgRect=svg.getBoundingClientRect(),view=svg.viewBox.baseVal;
    if(!svgRect.width||!svgRect.height||!view.width||!view.height)return{items:[]};
    const items=[];
    const toClient=point=>({x:svgRect.left+point.x*svgRect.width/view.width,y:svgRect.top+point.y*svgRect.height/view.height});
    const sourcePoints=item=>item.type==="pen"?(item.points||[]):item.type==="text"||item.type==="symbol"?[{x:item.x,y:item.y}]:[{x:item.x1,y:item.y1},{x:item.x2,y:item.y2}];
    (state.layers||[]).filter(layer=>layer.id!=="technique-layer"&&layer.printEnabled!==false).forEach(layer=>(layer.items||[]).forEach(item=>{
      const target=item.layoutTarget||"staff",visibilityTarget=item.type==="text"?(item.layoutVisibilityTarget||target):target;if(visibilityTarget==="lyrics"&&state.lyricsVisible===false||visibilityTarget==="vocal"&&state.vocalVisible===false)return;
      if(item.layoutAnchorVersion===3&&Array.isArray(item.layoutAnchors)&&item.layoutAnchors.length){items.push({...item,layoutAnchors:item.layoutAnchors.map(anchor=>target==="staff"&&!Number.isFinite(Number(anchor.staffY))?{...anchor,staffY:Number(anchor.y||0)-2}:{...anchor}),annotationRow:Number(item.layoutRow)||0});return}
      /* 旧形式が残っていても、印刷直前の実表示から一度だけ現在形式相当へ正規化する。 */
      const row=staffs[Number(item.layoutRow)]||staffs[0],anchorElement=target==="page"?document.querySelector(".paper"):target==="lyrics"?row?.querySelector(".lyrics-input"):target==="vocal"?row?.querySelector(".vocal-score"):row?.querySelector(".score");if(!anchorElement)return;
      const rect=anchorElement.getBoundingClientRect(),raw=sourcePoints(item).filter(point=>Number.isFinite(point?.x)&&Number.isFinite(point?.y));if(!rect.width||!rect.height||!raw.length)return;
      const measures=[...row.querySelectorAll(".score>.measure[data-measure]")].map(element=>({m:Number(element.dataset.measure),rect:element.getBoundingClientRect()})),strings=[...(measures.length?row.querySelector('.score>.measure[data-measure]')?.querySelectorAll('.string')||[]:[])].map(element=>element.getBoundingClientRect()),lineTop=strings[0]?strings[0].top+strings[0].height/2:rect.top,lineBottom=strings.length?strings.at(-1).top+strings.at(-1).height/2:lineTop+36,lineSpacing=strings.length>1?(lineBottom-lineTop)/(strings.length-1):18,layoutAnchors=raw.map(toClient).map(point=>{if(target==="page")return{pageX:(point.x-rect.left)/rect.width,pageY:(point.y-rect.top)/rect.height};const measure=measures.find(entry=>point.x>=entry.rect.left&&point.x<=entry.rect.right)||measures[0];if(!measure)return null;if(target==="staff"){const y=(point.y-lineTop)/(lineSpacing||18);return{m:measure.m,x:(point.x-measure.rect.left)/Math.max(1,measure.rect.width),rowX:(point.x-rect.left)/rect.width,y,staffY:(point.y-lineBottom)/(lineSpacing||18)}}return{m:measure.m,x:(point.x-measure.rect.left)/Math.max(1,measure.rect.width),rowX:(point.x-rect.left)/rect.width,y:(point.y-rect.top)/rect.height}});if(layoutAnchors.some(anchor=>!anchor))return;items.push({...item,layoutAnchors,annotationRow:target==="page"?0:Number(item.layoutRow)||0});
    }));
    return{items};
  }
  function annotationHtml(item){
    const pts=item.pointsNormalized||[],color=esc(item.color||"#222"),dash=item.lineStyle==="dashed"?' stroke-dasharray="8 7"':"",detailScale=Number(item.printDetailScale)||1,common=`stroke="${color}" stroke-width="2.5"${dash} fill="none" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
    if(item.type==="pen")return`<polyline ${common} points="${pts.map(p=>`${p.x},${p.y}`).join(" ")}"/>`;
    if(item.type==="line"&&pts.length>1)return`<line ${common} x1="${pts[0].x}" y1="${pts[0].y}" x2="${pts[1].x}" y2="${pts[1].y}"/>`;
    if(item.type==="rect"&&pts.length>1)return`<rect ${common} x="${Math.min(pts[0].x,pts[1].x)}" y="${Math.min(pts[0].y,pts[1].y)}" width="${Math.abs(pts[1].x-pts[0].x)}" height="${Math.abs(pts[1].y-pts[0].y)}" rx="5"/>`;
    if(item.type==="arrow"&&pts.length>1){const [a,b]=pts,angle=Math.atan2(b.y-a.y,b.x-a.x),size=16*detailScale,p1={x:b.x-size*Math.cos(angle-.55),y:b.y-size*Math.sin(angle-.55)},p2={x:b.x-size*Math.cos(angle+.55),y:b.y-size*Math.sin(angle+.55)};return`<line ${common} x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><polyline ${common} points="${p1.x},${p1.y} ${b.x},${b.y} ${p2.x},${p2.y}"/>`}
    if(item.type==="text"&&pts[0]){const p=pts[0],size=(Number(item.size)||20)*detailScale,lines=String(item.text||"").replace(/\r\n?/g,"\n").split("\n"),lineHeight=size*1.35,longest=Math.max(1,...lines.map(line=>Array.from(line).length)),bg=item.background==="none"?"none":item.background==="translucent"?"rgba(255,255,255,.72)":"#fff",width=Math.max(size*2.5,longest*size*.95),height=size*1.55+(lines.length-1)*lineHeight,top=p.y,baseline=top+size*1.05+5,tspans=lines.map((line,index)=>`<tspan x="${p.x}" dy="${index?lineHeight:0}">${line?esc(line):"&#160;"}</tspan>`).join("");return`<rect x="${p.x-7}" y="${top}" width="${width+14}" height="${height}" rx="7" fill="${bg}"/><text x="${p.x}" y="${baseline}" fill="${color}" font-size="${size}" font-weight="600">${tspans}</text>`}
    return"";
  }
  function markerHtml(item){
    const pts=item.pointsNormalized||[];if(item.type!=="marker"||pts.length<2)return"";
    const x=Math.min(pts[0].x,pts[1].x),y=Math.min(pts[0].y,pts[1].y),width=Math.abs(pts[1].x-pts[0].x),height=Math.abs(pts[1].y-pts[0].y),color=esc(item.color||"#f4df59"),opacity=clamp(Number(item.opacity)||.4,.1,.55);
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="${color}" fill-opacity="${opacity}"/>`;
  }
  function captureScoreGeometry(){
    const noteLeft=new Map(),columnSamples=new Map(),columnLeft=new Map(),partLeft=new Map(),lyricsWidth=new Map(),lyricsGlyphs=new Map();
    document.querySelectorAll("#scoreArea .measure").forEach(measure=>{
      const rect=measure.getBoundingClientRect();if(rect.width<=0)return;
      measure.querySelectorAll("[data-note]").forEach(note=>{const glyph=note.querySelector("b")||note,noteRect=glyph.getBoundingClientRect(),id=note.dataset.note;if(!id)return;const left=clamp((noteRect.left+noteRect.width/2-rect.left)/rect.width,.005,.995);noteLeft.set(id,left);const [m,,p]=id.split(","),columnKey=`${m},${p}`;if(!columnSamples.has(columnKey))columnSamples.set(columnKey,[]);columnSamples.get(columnKey).push(left)});
      measure.querySelectorAll("[data-score-part-id]").forEach(part=>{const id=part.dataset.scorePartId;if(id)partLeft.set(id,.5)});
    });
    document.querySelectorAll("#scoreArea [data-lyrics-row]").forEach(input=>{const row=Number(input.dataset.lyricsRow),width=Number(input.offsetWidth),display=input.closest(".lyrics-field")?.querySelector("[data-lyrics-display-row]");if(Number.isInteger(row)&&width>0){lyricsWidth.set(row,width);lyricsGlyphs.set(row,[...(display?.querySelectorAll("[data-lyric-x]")||[])].map(glyph=>({text:glyph.textContent||"",x:clamp(Number(glyph.dataset.lyricX)||0,0,1),m:Number(glyph.dataset.lyricMeasure),measureX:clamp(Number(glyph.dataset.lyricMeasureX)||0,0,1)})))}});
    columnSamples.forEach((values,id)=>columnLeft.set(id,values.reduce((sum,value)=>sum+value,0)/values.length));return{noteLeft,columnLeft,partLeft,lyricsWidth,lyricsGlyphs};
  }
  /* 印刷面の段間隔は、保存済みの境界集計だけに依存させない。
     印刷対象コメントが保持する境界・次要素基準の相対位置・実寸からも
     必要量を復元し、両者の大きい方を使う。画面座標や元データは変更しない。 */
  function buildPrintAnnotationLayout(state,annotationCapture){
    const layoutApi=global.ShianAnnotationLayout,source=layoutApi?layoutApi.normalize(state.annotationLayout):{version:2,boundaries:{}};
    const boundaries={};
    let derivedCount=0;
    (annotationCapture?.items||[]).filter(item=>item.type==="text").forEach(item=>{
      const placement=item.layoutPlacement;if(!placement)return;
      const lane=String(placement.lane||"");if(!["beforeScore","afterScore","afterLyrics","afterVocal"].includes(lane))return;
      const row=Number(placement.row);if(!Number.isInteger(row)||row<0)return;
      const boundaryKey=String(placement.boundaryKey||`${row}:${lane}`),savedGap=Math.max(0,Number(source?.boundaries?.[boundaryKey]?.gap)||0),current=Math.max(savedGap,Number(boundaries[boundaryKey]?.gap)||0);
      boundaries[boundaryKey]={gap:current};
      const offsetFromNextTop=Number(placement.offsetFromNextTop),heightLines=Number(placement.heightLines),clearanceBottom=Number(placement.clearanceBottom);
      if(!Number.isFinite(offsetFromNextTop)||!Number.isFinite(heightLines))return;
      const requiredGap=Math.max(0,offsetFromNextTop+Math.max(0,heightLines)+(Number.isFinite(clearanceBottom)?Math.max(0,clearanceBottom):0));
      if(requiredGap>current+1e-6){boundaries[boundaryKey]={gap:requiredGap};derivedCount++}
    });
    return{layout:{version:Number(layoutApi?.VERSION)||Number(source?.version)||2,boundaries},derivedCount};
  }
  function effectivePrintLane(lane,showLyrics,showVocal){
    if(lane==="afterVocal"&&!showVocal)return showLyrics?"afterLyrics":"afterScore";
    if(lane==="afterLyrics"&&!showLyrics)return"afterScore";
    return lane;
  }
  function logicalCommentSpacing(placement,layout){
    if(!placement)return null;
    const boundaryKey=String(placement.boundaryKey||`${Number(placement.row)||0}:${placement.lane||"afterScore"}`),offsetTop=Number(placement.offsetTop),offsetFromNextTop=Number(placement.offsetFromNextTop),heightLines=Math.max(0,Number(placement.heightLines)),clearanceBottom=Math.max(0,Number(placement.clearanceBottom)||0);
    if(!Number.isFinite(offsetTop)||!Number.isFinite(offsetFromNextTop)||!Number.isFinite(heightLines))return null;
    /* offsetFromNextTop は追加余白を入れる前の次要素上端が基準。
       画面で確定した下側余白は、保存済み境界追加量を足した次要素上端から
       コメント下端を引いて復元する。 */
    const screenGapLines=Math.max(0,Number(layout?.boundaries?.[boundaryKey]?.gap)||0),topGapLines=Math.max(0,offsetTop),bottomGapLines=Math.max(clearanceBottom,screenGapLines-offsetFromNextTop-heightLines);
    return{boundaryKey,topGapLines,heightLines,bottomGapLines,requiredLines:topGapLines+heightLines+bottomGapLines,screenGapLines,offsetTop,offsetFromNextTop,clearanceBottom};
  }
  function naturalPrintBoundaryHeight(rows,rowIndex,lane,{showLyrics=true,showVocal=true,baseStaffHeight=0}={}){
    const row=rows[rowIndex];if(!row)return 0;
    const scoreHeight=54+(row.measures.some(measure=>measure.hanma)?28:0);
    if(lane==="afterScore"){
      if(showLyrics)return Math.max(0,scoreHeight+10-45);
      if(showVocal)return Math.max(0,scoreHeight+1-45);
      return rows[rowIndex+1]?Math.max(0,baseStaffHeight+9-45):0;
    }
    if(lane==="afterLyrics")return showVocal?1:rows[rowIndex+1]?Math.max(0,baseStaffHeight-(scoreHeight+35)+9):0;
    if(lane==="afterVocal"){
      if(!rows[rowIndex+1])return 0;
      const intrinsicBottom=showVocal?scoreHeight+(showLyrics?35:0)+1+41:showLyrics?scoreHeight+10+25:45;
      return Math.max(0,baseStaffHeight+9-intrinsicBottom);
    }
    return 0;
  }
  /* コメントが単に収まる最小量ではなく、画面で確定した
     前要素→上余白→コメント→下余白→次要素を譜線間隔単位で印刷へ投影する。 */
  function expandPrintAnnotationLayout(layout,annotationCapture,rows,{showLyrics=true,showVocal=true,lineSpacing=18,baseStaffHeight=0}={}){
    const layoutApi=global.ShianAnnotationLayout,source=layoutApi?layoutApi.normalize(layout):{version:2,boundaries:{...(layout?.boundaries||{})}},result={version:Number(layoutApi?.VERSION)||Number(source.version)||2,unit:"staff-line",boundaries:{}},setGap=(row,lane,gapPx)=>{
      const boundaryKey=`${row}:${lane}`,gap=Math.max(0,gapPx)/Math.max(1,lineSpacing),current=Number(result.boundaries[boundaryKey]?.gap)||0;if(gap>current)result.boundaries[boundaryKey]={gap};
    };
    /* 第1段上側は既存の正常な投影を維持する。 */
    const beforeScoreGap=Number(source.boundaries?.["0:beforeScore"]?.gap)||0;if(beforeScoreGap>0)result.boundaries["0:beforeScore"]={gap:beforeScoreGap};
    (annotationCapture?.items||[]).filter(item=>item.type==="text").forEach(item=>{
      const placement=item.layoutPlacement,rowIndex=Number(placement?.row);if(!placement||!Number.isInteger(rowIndex)||rowIndex<0||rowIndex>=rows.length)return;
      const originalLane=String(placement.lane||""),lane=effectivePrintLane(originalLane,showLyrics,showVocal);if(originalLane!==lane||lane==="beforeScore")return;
      const spacing=logicalCommentSpacing(placement,source);if(!spacing)return;
      const requiredBoundaryHeight=spacing.requiredLines*Math.max(1,lineSpacing),naturalBoundaryHeight=naturalPrintBoundaryHeight(rows,rowIndex,lane,{showLyrics,showVocal,baseStaffHeight});
      setGap(rowIndex,lane,Math.max(0,requiredBoundaryHeight-naturalBoundaryHeight));
    });
    return result;
  }
  function render(state,options={}){
    const root=document.querySelector(options.rootSelector||"#printRootV2");if(!root)throw new Error("印刷面を生成できません。");
    const showLyrics=state.lyricsVisible!==false,showVocal=state.vocalVisible!==false,showSong=showLyrics||showVocal;
    const counts=Array.isArray(state.rowMeasureCounts)?state.rowMeasureCounts:Array(Number(state.rows)||1).fill(Number(state.measuresPerRow)||4),starts=counts.map((_,row)=>counts.slice(0,row).reduce((a,b)=>a+b,0));
    const capacity=options.capacity(),measureWidth=options.measureWidth,columnX=options.columnX,barKey=options.barlineKey,meterLabel=options.meterLabel;
    const techniqueLayer=(state.layers||[]).find(layer=>layer.id==="technique-layer"),techMap=new Map(),linkedTechniqueSlurs=[],noteKeys=new Set((state.notes||[]).filter(note=>!note.rest).map(note=>key(note.m,note.s,note.p))),seenTechniqueIds=new Set(),seenTechniqueSignatures=new Set();
    /* 通常表示と同じく、奏法は保存された対象音とオフセットだけを使う。
       旧印刷処理の配列順による追加移動は行わず、同一ID／同一内容の重複も印刷時に再生成しない。 */
    if(techniqueLayer?.visible!==false&&techniqueLayer?.printEnabled!==false)(techniqueLayer?.items||[]).filter(item=>item.type==="symbol"&&item.anchor).forEach(item=>{
      const anchorKey=key(Number(item.anchor.m),Number(item.anchor.s),Number(item.anchor.p));if(!noteKeys.has(anchorKey))return;
      const id=String(item.id||""),signature=[anchorKey,String(item.text||""),item.side==="below"?"below":"above",Number(item.offsetXPx)||0,Number(item.offsetYPx)||0,item.endAnchor?key(Number(item.endAnchor.m),Number(item.endAnchor.s),Number(item.endAnchor.p)):""].join("|");
      if(id&&seenTechniqueIds.has(id)||seenTechniqueSignatures.has(signature))return;if(id)seenTechniqueIds.add(id);seenTechniqueSignatures.add(signature);
      if(item.text==="スリ"&&item.endAnchor){if(noteKeys.has(key(Number(item.endAnchor.m),Number(item.endAnchor.s),Number(item.endAnchor.p))))linkedTechniqueSlurs.push(item);return}
      if(!techMap.has(anchorKey))techMap.set(anchorKey,[]);techMap.get(anchorKey).push(item)
    });
    const annotationCapture=captureAnnotations(state),geometry=captureScoreGeometry(),rows=counts.map((count,row)=>({row,measures:Array.from({length:count},(_,local)=>{const m=starts[row]+local,width=measureWidth(m),special=state.measureSpecials?.[String(m)],hanma=special?.type==="hanma"&&Number(special.lengthRatio)===0.5,displayCapacity=hanma?Math.max(1,Math.round(capacity*.5)):capacity;return{m,local,width,hanma,startKind:state.barlineKinds?.[barKey(row,local)]||"single",endKind:local===count-1?(state.barlineKinds?.[barKey(row,count)]||"single"):"single",notes:(state.notes||[]).filter(note=>note.m===m&&Number(note.p)<displayCapacity).map(note=>{const x=note.rest?(Number(note.x)||0):columnX(note.m,note.p),id=key(note.m,note.s,note.p),measured=geometry.noteLeft.get(id);return{...note,left:Number.isFinite(measured)?measured:clamp((Number(note.p)+.5)/displayCapacity+x/width,.005,.995),value:note.rest?"●":(isOpenValue(note.v)?"0":String(note.v||"")),techniques:note.rest?[]:(techMap.get(id)||[])} }),vocalNotes:(state.vocalNotes||[]).filter(note=>Number(note.m)===m&&Number(note.p)<displayCapacity).map(note=>{const anchor=note.anchor&&Number(note.anchor.m)===m&&Number.isInteger(Number(note.anchor.p))?note.anchor:null,position=anchor?Number(anchor.p):Number(note.p),offset=anchor?Math.max(0,Number(note.anchorOffset)||0):0,measured=anchor?geometry.columnLeft.get(`${m},${position}`):null,base=Number.isFinite(measured)?measured:(position+.5)/displayCapacity+(anchor?columnX(m,position)/width:0);return{...note,left:clamp(base+offset/displayCapacity+(Number(note.x)||0)/width,.005,.995)}}),parts:(state.scoreParts||[]).filter(part=>part.m===m).map(part=>({...part,left:.5}))}})}));
    const printScoreWidth=196*96/25.4-55,printLyricsWidth=printScoreWidth;rows.forEach(item=>{const sourceWidth=geometry.lyricsWidth.get(item.row)||1000;item.lyrics=showLyrics?String(state.lyrics?.[item.row]||""):"";item.lyricsGlyphAnchors=showLyrics?(geometry.lyricsGlyphs.get(item.row)||[]):[];item.lyricsGlyphs=[];item.lyricsSourceWidth=sourceWidth;item.lyricsScale=printLyricsWidth/sourceWidth});
    const vocalPositionById=new Map(),shamisenPositionByAnchor=new Map();rows.forEach(row=>{row.totalWidth=row.measures.reduce((sum,measure)=>sum+measure.width,0);row.vocalSlurs=[];row.tuplets=[];row.techniqueSlurs=[];let used=0;const measureStarts=new Map();row.measures.forEach(measure=>{measureStarts.set(measure.m,used);measure.vocalNotes.forEach(note=>vocalPositionById.set(String(note.id),{row:row.row,x:(used+note.left*measure.width)/row.totalWidth*1000}));measure.notes.filter(note=>!note.rest).forEach(note=>{shamisenPositionByAnchor.set(`${measure.m},${Number(note.s)},${Number(note.p)}`,{row:row.row,x:(used+note.left*measure.width)/row.totalWidth*1000,y:23+(3-Number(note.s))*18})});used+=measure.width});row.lyricsGlyphs=(row.lyricsGlyphAnchors||[]).map(glyph=>{const measure=row.measures.find(item=>item.m===glyph.m),start=measureStarts.get(glyph.m);return measure&&Number.isFinite(start)?{text:glyph.text,x:clamp((start+glyph.measureX*measure.width)/row.totalWidth,0,1)}:{text:glyph.text,x:glyph.x}})});
    (state.tuplets||[]).forEach(tuplet=>{let start=shamisenPositionByAnchor.get(`${Number(tuplet.start?.m)},${Number(tuplet.start?.s)},${Number(tuplet.start?.p)}`),end=shamisenPositionByAnchor.get(`${Number(tuplet.end?.m)},${Number(tuplet.end?.s)},${Number(tuplet.end?.p)}`);if(!start||!end||start.row!==end.row)return;if(start.x>end.x)[start,end]=[end,start];if(end.x-start.x>=8){const controlY=Math.max(5,Math.min(start.y,end.y)-17),curveMidY=(start.y+2*controlY+end.y)/4;rows[start.row]?.tuplets.push({start:start.x,end:end.x,startY:start.y,endY:end.y,controlY,labelY:Math.max(8,curveMidY-4)})}});
    linkedTechniqueSlurs.forEach(item=>{let start=shamisenPositionByAnchor.get(key(Number(item.anchor?.m),Number(item.anchor?.s),Number(item.anchor?.p))),end=shamisenPositionByAnchor.get(key(Number(item.endAnchor?.m),Number(item.endAnchor?.s),Number(item.endAnchor?.p)));if(!start||!end||start.row!==end.row)return;if(start.x>end.x)[start,end]=[end,start];const offsetX=(Number(item.offsetXPx)||0)*1000/printScoreWidth,offsetY=Number(item.offsetYPx)||0,below=item.side==="below",edgeShift=below?4:-4,x1=start.x+offsetX,x2=end.x+offsetX,y1=start.y+offsetY+edgeShift,y2=end.y+offsetY+edgeShift,centerX=(x1+x2)/2,centerY=(y1+y2)/2,controlY=centerY+(below?8:-8),textY=centerY+(below?13:-13);if(x2-x1>=8)rows[start.row]?.techniqueSlurs.push({x1,x2,y1,y2,centerX,controlY,textY,color:item.color||"#222"})});
    (state.vocalSlurs||[]).forEach(slur=>{let start=vocalPositionById.get(String(slur.startId)),end=vocalPositionById.get(String(slur.endId));if(!start||!end)return;if(start.row>end.row||(start.row===end.row&&start.x>end.x))[start,end]=[end,start];for(let rowIndex=start.row;rowIndex<=end.row;rowIndex++){const row=rows[rowIndex];if(!row)continue;const x1=rowIndex===start.row?start.x:2,x2=rowIndex===end.row?end.x:998;if(x2-x1>=8)row.vocalSlurs.push({start:x1,end:x2})}});
    const pageCounts=options.pageRows(),pages=[];let cursor=0;pageCounts.forEach((count,index)=>{pages.push({index,rows:rows.slice(cursor,cursor+count)});cursor+=count});
    /* 段間隔は1ページ目の指定段数から一度だけ決め、全ページで共有する。
       最終ページの段数が少なくても再均等配置せず、余白はページ下部へ残す。 */
    const firstPageRowCount=Math.max(1,pages[0]?.rows.length||pageCounts[0]||1),availableHeight=283*96/25.4-46,fixedReferenceRows=showSong?7:10,printStaffLineSpacing=18,referenceRows=firstPageRowCount<=5?fixedReferenceRows:firstPageRowCount;
    const printAnnotationLayout=buildPrintAnnotationLayout(state,annotationCapture);let resolvedPrintLayout=printAnnotationLayout.layout,sharedStaffHeight=availableHeight/referenceRows;
    /* 段高を縮めると afterVocal 境界の空きも変わるため、印刷段高と不足量を収束させる。
       前回値へ加算せず、同じ論理配置から毎回再構築する。 */
    for(let pass=0;pass<12;pass++){
      /* 各回とも画面で確定した同一論理値から再計算し、前回の印刷不足量を累積しない。 */
      resolvedPrintLayout=expandPrintAnnotationLayout(printAnnotationLayout.layout,annotationCapture,rows,{showLyrics,showVocal,lineSpacing:printStaffLineSpacing,baseStaffHeight:sharedStaffHeight});
      rows.forEach(row=>{row.printGaps=global.ShianAnnotationLayout?global.ShianAnnotationLayout.pixelGaps(resolvedPrintLayout,row.row,{lyricsVisible:showLyrics,vocalVisible:showVocal},printStaffLineSpacing):{beforeScore:0,afterScore:0,afterLyrics:0,afterVocal:0};row.printGapTotal=Object.values(row.printGaps).reduce((sum,value)=>sum+(Number(value)||0),0)});
      const maxPageGap=Math.max(0,...pages.map(page=>page.rows.reduce((sum,row)=>sum+row.printGapTotal,0))),nextHeight=Math.max(72,(availableHeight-maxPageGap)/referenceRows);if(Math.abs(nextHeight-sharedStaffHeight)<.001){sharedStaffHeight=nextHeight;break}sharedStaffHeight=nextHeight;
    }
    /* A4の基本段高から追加余白を先に差し引く。追加量を段高へ足し続けず、
       各印刷生成時に論理境界情報から一度だけ再構築する。 */
    let printTop=0;
    rows.forEach(row=>{row.printTop=printTop;row.printHeight=sharedStaffHeight+row.printGapTotal;printTop+=row.printHeight});
    /* 印刷オーバーレイは譜線位置ではなく staffs 上端から開始する。
       1段目より上へ置いたコメントや枠もSVGの正の座標内へ収め、
       Chromiumの印刷時に負座標部分が切り落とされるのを防ぐ。 */
    const overlayTopOffset=12*96/25.4+(showSong?20:24);
    const printMeasureMap=new Map(),printStaffBottomLine=45;rows.forEach(row=>{let used=0;row.measures.forEach(measure=>{printMeasureMap.set(measure.m,{row,measure,used});used+=measure.width})});
    const asPrintTopAnchoredComment=item=>{if(item.type!=="text"||item.layoutTextAnchorVersion===2)return item;const offset=((Number(item.size)||20)*1.05+5)*(Number(item.printDetailScale)||1);return{...item,layoutTextAnchorVersion:2,layoutTextAnchorBasis:"comment-top",pointsNormalized:item.pointsNormalized.map(point=>({...point,y:point.y-offset}))}};
    const printItemTop=(item,points)=>{const ys=points.map(point=>Number(point.y)||0);if(!ys.length)return 0;if(item.type==="text")return ys[0];if(item.type==="symbol")return ys[0]-12;if(item.type==="pen")return Math.min(...ys)-4;return Math.min(...ys)-(item.type==="arrow"?20:4)};
    const printPlacementTop=placement=>{if(!placement)return null;const row=rows[clamp(Number(placement.row)||0,0,Math.max(0,rows.length-1))];if(!row)return null;let lane=placement.lane;if(lane==="afterVocal"&&!showVocal)lane=showLyrics?"afterLyrics":"afterScore";if(lane==="afterLyrics"&&!showLyrics)lane="afterScore";const before=Number(row.printGaps.beforeScore)||0,scoreHeight=54+(row.measures.some(measure=>measure.hanma)?28:0),scoreTop=before+9,lyricsTop=before+scoreHeight+10+row.printGaps.afterScore,vocalTop=before+scoreHeight+(showLyrics?35:0)+1+row.printGaps.afterScore+(showLyrics?row.printGaps.afterLyrics:0);if(lane==="beforeScore")return overlayTopOffset+row.printTop+scoreTop+(Number(placement.offsetFromNextTop)||0)*printStaffLineSpacing;const previousBottom=lane==="afterVocal"?vocalTop+41:lane==="afterLyrics"?lyricsTop+25:before+printStaffBottomLine;return overlayTopOffset+row.printTop+previousBottom+(Number(placement.offsetTop)||0)*printStaffLineSpacing};
    const mappedAnnotations=annotationCapture.items.map(item=>{
      const target=item.layoutTarget||"staff";if(!Array.isArray(item.layoutAnchors)||!item.layoutAnchors.length)return null;
      if(target==="page"){const pointsNormalized=item.layoutAnchors.map(anchor=>({x:Number(anchor.pageX)*1000,y:overlayTopOffset+Number(anchor.pageY)*printTop}));return asPrintTopAnchoredComment({...item,pointsNormalized,annotationRow:0,printDetailScale:1})}
      const firstLocated=printMeasureMap.get(Number(item.layoutAnchors[0]?.m)),fallbackRow=rows[clamp(Number(item.annotationRow)||0,0,Math.max(0,rows.length-1))],annotationRow=item.type==="text"&&Number.isInteger(Number(item.layoutPlacement?.row))?Number(item.layoutPlacement.row):(firstLocated?.row?.row??fallbackRow?.row??0);
      const pointsNormalized=item.layoutAnchors.map(anchor=>{const located=printMeasureMap.get(Number(anchor.m)),row=located?.row||fallbackRow;if(!row)return null;const before=Number(row.printGaps.beforeScore)||0,scoreHeight=54+(row.measures.some(measure=>measure.hanma)?28:0),targetTop=target==="lyrics"?before+scoreHeight+10+row.printGaps.afterScore:target==="vocal"?before+scoreHeight+(showLyrics?35:0)+1+row.printGaps.afterScore+(showLyrics?row.printGaps.afterLyrics:0):0,targetHeight=target==="lyrics"?25:target==="vocal"?41:18,x=located?(located.used+Number(anchor.x||0)*located.measure.width)/row.totalWidth*1000:Number(anchor.rowX||0)*1000,staffY=Number.isFinite(Number(anchor.staffY))?Number(anchor.staffY):Number(anchor.y||0)-2,y=overlayTopOffset+row.printTop+(target==="staff"?before+printStaffBottomLine+staffY*printStaffLineSpacing:targetTop+Number(anchor.y||0)*targetHeight);return{x,y}});if(pointsNormalized.some(point=>!point))return null;
      const mapped=asPrintTopAnchoredComment({...item,pointsNormalized,annotationRow,printDetailScale:1}),desiredTop=item.type==="text"?printPlacementTop(item.layoutPlacement):null;if(Number.isFinite(desiredTop)){const dy=desiredTop-printItemTop(mapped,mapped.pointsNormalized);mapped.pointsNormalized.forEach(point=>point.y+=dy)}
      mapped.printBoundary=item.layoutPlacement?.boundaryKey||"";return mapped;
    }).filter(Boolean);
    const techniqueHtml=item=>{const side=item.side==="below"?"below":"above",x=Number(item.offsetXPx)||0,y=Number(item.offsetYPx)||0,id=esc(String(item.id||"")),anchor=esc(key(Number(item.anchor?.m),Number(item.anchor?.s),Number(item.anchor?.p))),style=`--tech-color:${esc(item.color||"#222")};margin-left:${x}px;${side==="above"?`margin-bottom:${-y}px`:`margin-top:${y}px`}`,trace=` data-technique-id="${id}" data-technique-anchor="${anchor}"`;if(["Ⅰ","Ⅱ","Ⅲ"].includes(item.text))return`<span class="pv2-tech finger ${side}"${trace} style="${style}">${esc(item.text)}</span>`;if(item.text==="スリ")return`<span class="pv2-tech slur ${side}"${trace} style="${style};--slur-width:${clamp(Number(item.slurWidth)||34,22,90)}px">スリ</span>`;return`<span class="pv2-tech symbol ${side}"${trace} style="${style}">${esc(item.text)}</span>`};
    const noteHtml=note=>`<span class="pv2-note d${[1,2,4].includes(note.d)?note.d:4}${note.rest?" rest":""}${!note.rest&&isOpenValue(note.v)?" open":""}" style="--left:${(note.left*100).toFixed(5)}%;--note-color:${esc(note.rest?"#222":(note.color||(isOpenValue(note.v)?state.openColor:state.numberColor)))}"><span class="pv2-glyph">${esc(note.value)}</span>${note.techniques.length?`<span class="pv2-techniques">${note.techniques.map(techniqueHtml).join("")}</span>`:""}</span>`;
    const vocalMark=stringNumber=>Number(stringNumber)===1?"•":Number(stringNumber)===2?"••":"";
    const vocalNoteHtml=note=>{
      const value=String(note.v??""),kind=["pitch","rest","interjection"].includes(note.kind)?note.kind:(value==="・"?"rest":value==="×"?"interjection":"pitch");
      const color=kind==="pitch"&&/^#[0-9a-f]{6}$/i.test(String(note.color||""))?String(note.color):"#222222";
      return `<span class="pv2-vocal-note d${[1,2,4].includes(Number(note.d))?Number(note.d):4} kind-${kind}${note.dotted?" dotted":""}" style="left:${(note.left*100).toFixed(5)}%;--vocal-print-color:${esc(color)};color:${esc(color)}!important"><span class="pv2-vocal-value">${esc(value)}${note.dotted?'<span class="pv2-vocal-dot">・</span>':""}</span><span class="pv2-vocal-mark">${kind==="pitch"?vocalMark(note.s):""}</span></span>`;
    };
    /* 通常小節線も実要素として必ず描画し、印刷時の疑似要素処理に依存しない。 */
    const measureHtml=measure=>`<div class="pv2-measure${measure.hanma?" hanma":""}" style="--grow:${measure.width}"><span class="pv2-boundary start${measure.startKind!=="single"?" custom":""}">${measure.startKind==="single"?"":barSvg(measure.startKind,measure.local===0?"start":"middle")}</span>${measure.endKind!=="single"?`<span class="pv2-boundary end custom">${barSvg(measure.endKind,"end")}</span>`:""}${measure.parts.map(part=>`<span class="pv2-part" style="left:${(part.left*100).toFixed(5)}%">${sameSvg(part.kind)}</span>`).join("")}${[3,2,1].map(string=>`<div class="pv2-string">${measure.notes.filter(note=>Number(note.s)===string).map(noteHtml).join("")}</div>`).join("")}${measure.hanma?'<span class="pv2-hanma-label">〔半間〕</span>':""}</div>`;
    const vocalMeasureHtml=measure=>`<span class="pv2-vocal-measure" style="--grow:${measure.width}">${measure.vocalNotes.map(vocalNoteHtml).join("")}</span>`;
    /* 曲名・調子・拍子は固定し、譜面と全レイヤーだけを一体で下げる。
       同じラッパーを全ページで使うため、最終ページでも開始位置と段間隔が変わらない。 */
    root.innerHTML=pages.map(page=>{
      const firstRow=page.rows[0]?.row||0,lastRow=firstRow+page.rows.length,pageStart=page.rows[0]?.printTop||0,items=mappedAnnotations.filter(item=>item.annotationRow>=firstRow&&item.annotationRow<lastRow).map(item=>({...item,pointsNormalized:item.pointsNormalized.map(point=>({...point,y:point.y-pageStart}))})),pageMarkers=items.filter(item=>item.type==="marker"),pageAnnotations=items.filter(item=>item.type!=="marker"),overlayHeight=overlayTopOffset+page.rows.reduce((sum,row)=>sum+row.printHeight,0);
      return`<section class="pv2-page" data-print-page="${page.index}">${page.index===0?`<div class="pv2-meta"><div class="pv2-meta-left" aria-label="調子と拍子"><span>〈${esc(state.tuning||"")}〉</span><span>${esc(meterLabel())}</span></div><div class="pv2-title">${esc(state.title||"曲名入力")}</div></div>`:""}<div class="pv2-staffs${showSong?" lyrics-mode":""}">${pageMarkers.length?`<svg class="pv2-page-underlay" style="height:${overlayHeight.toFixed(2)}px" viewBox="0 0 1000 ${overlayHeight.toFixed(2)}" preserveAspectRatio="none">${pageMarkers.map(markerHtml).join("")}</svg>`:""}${page.rows.map(row=>`<section class="pv2-staff${row.row===0?" first-score-row":""}${row.measures.some(measure=>measure.hanma)?" has-hanma":""}" data-print-row="${row.row}" data-print-top="${row.printTop.toFixed(3)}" data-print-height="${row.printHeight.toFixed(3)}" style="height:${sharedStaffHeight.toFixed(2)}px"><div class="pv2-wrap"><div class="pv2-labels">${row.row===0?"<span>三の糸</span><span>二の糸</span><span>一の糸</span>":"<span></span><span></span><span></span>"}</div><div class="pv2-score">${row.techniqueSlurs.length?`<svg class="pv2-technique-slurs" viewBox="0 0 1000 80" preserveAspectRatio="none">${row.techniqueSlurs.map(slur=>`<g style="color:${esc(slur.color)}"><path d="M ${slur.x1.toFixed(2)} ${slur.y1.toFixed(2)} Q ${slur.centerX.toFixed(2)} ${slur.controlY.toFixed(2)} ${slur.x2.toFixed(2)} ${slur.y2.toFixed(2)}"/><text x="${slur.centerX.toFixed(2)}" y="${slur.textY.toFixed(2)}">スリ</text></g>`).join("")}</svg>`:""}${row.tuplets.length?`<svg class="pv2-tuplets" viewBox="0 0 1000 80" preserveAspectRatio="none">${row.tuplets.map(tuplet=>`<path d="M ${tuplet.start.toFixed(2)} ${tuplet.startY.toFixed(2)} Q ${((tuplet.start+tuplet.end)/2).toFixed(2)} ${tuplet.controlY.toFixed(2)} ${tuplet.end.toFixed(2)} ${tuplet.endY.toFixed(2)}"/><text x="${((tuplet.start+tuplet.end)/2).toFixed(2)}" y="${tuplet.labelY.toFixed(2)}">3</text>`).join("")}</svg>`:""}${row.measures.map(measureHtml).join("")}</div></div>${showLyrics?`<div class="pv2-lyrics">${row.lyricsGlyphs.length?`<span class="pv2-lyrics-track positioned">${row.lyricsGlyphs.map(glyph=>`<span class="pv2-lyrics-glyph" style="left:${(glyph.x*100).toFixed(5)}%">${esc(glyph.text)}</span>`).join("")}</span>`:`<span class="pv2-lyrics-track" style="width:${row.lyricsSourceWidth.toFixed(2)}px;transform:scaleX(${row.lyricsScale.toFixed(6)})">${esc(row.lyrics)}</span>`}</div>`:""}${showVocal?`<div class="pv2-vocal"><span class="pv2-vocal-label" aria-hidden="true"></span><span class="pv2-vocal-score">${row.vocalSlurs.length?`<svg class="pv2-vocal-slurs" viewBox="0 0 1000 16" preserveAspectRatio="none">${row.vocalSlurs.map(slur=>`<path d="M ${slur.start.toFixed(2)} 13 Q ${((slur.start+slur.end)/2).toFixed(2)} 1 ${slur.end.toFixed(2)} 13"/>`).join("")}</svg>`:""}${row.measures.map(vocalMeasureHtml).join("")}</span></div>`:""}</section>`).join("")}${pageAnnotations.length?`<svg class="pv2-page-overlay" style="height:${overlayHeight.toFixed(2)}px" viewBox="0 0 1000 ${overlayHeight.toFixed(2)}" preserveAspectRatio="none">${pageAnnotations.map(item=>`<g data-print-annotation-id="${esc(item.id||"")}" data-print-row="${item.annotationRow}" data-print-boundary="${esc(item.printBoundary||"")}">${annotationHtml(item)}</g>`).join("")}</svg>`:""}</div></section>`
    }).join("");
    let printedRow=0;
    root.querySelectorAll(".pv2-staff").forEach(staff=>{
      const row=rows[printedRow++];if(!row)return;staff.style.height=`${row.printHeight.toFixed(2)}px`;
      const insertGap=(after,lane,before=false)=>{const height=Number(row.printGaps[lane])||0;if(!after||height<=0)return;const gap=document.createElement("div");gap.className="pv2-annotation-gap";gap.dataset.annotationBoundary=lane;gap.dataset.printRow=String(row.row);gap.dataset.expectedHeight=height.toFixed(3);gap.style.height=`${height.toFixed(2)}px`;before?after.insertAdjacentElement("beforebegin",gap):after.insertAdjacentElement("afterend",gap)};
      if(row.row===0)insertGap(staff.querySelector(".pv2-wrap"),"beforeScore",true);
      insertGap(staff.querySelector(".pv2-wrap"),"afterScore");
      if(showLyrics)insertGap(staff.querySelector(".pv2-lyrics"),"afterLyrics");
      if(showVocal)insertGap(staff.querySelector(".pv2-vocal"),"afterVocal");
    });
    const printBoundaryEdges=(placement)=>{const rowIndex=Number(placement?.row),row=rows[rowIndex];if(!row)return null;const lane=effectivePrintLane(String(placement.lane||""),showLyrics,showVocal),before=Number(row.printGaps.beforeScore)||0,afterScore=Number(row.printGaps.afterScore)||0,afterLyrics=Number(row.printGaps.afterLyrics)||0,scoreHeight=54+(row.measures.some(measure=>measure.hanma)?28:0),lyricsTop=before+scoreHeight+10+afterScore,vocalTop=before+scoreHeight+(showLyrics?35:0)+1+afterScore+(showLyrics?afterLyrics:0);let previousBottom,nextTop;if(lane==="afterScore"){previousBottom=row.printTop+before+45;nextTop=row.printTop+(showLyrics?lyricsTop:showVocal?vocalTop:row.printHeight+(Number(rows[rowIndex+1]?.printGaps?.beforeScore)||0)+9)}else if(lane==="afterLyrics"){previousBottom=row.printTop+lyricsTop+25;nextTop=row.printTop+(showVocal?vocalTop:row.printHeight+(Number(rows[rowIndex+1]?.printGaps?.beforeScore)||0)+9)}else if(lane==="afterVocal"&&rows[rowIndex+1]){previousBottom=row.printTop+(showVocal?vocalTop+41:showLyrics?lyricsTop+25:before+45);nextTop=rows[rowIndex+1].printTop+(Number(rows[rowIndex+1].printGaps.beforeScore)||0)+9}else return null;return{lane,previousBottom:overlayTopOffset+previousBottom,nextTop:overlayTopOffset+nextTop,actualBoundaryHeight:nextTop-previousBottom}};
    root.dataset.modelVersion="20";root.dataset.annotationLayoutVersion=String(global.ShianAnnotationLayout?.VERSION||0);root.dataset.annotationLayoutSource="screen-logical-spacing+print-geometry";root.dataset.annotationDerivedGapCount=String(printAnnotationLayout.derivedCount);root.dataset.annotationAnchorBasis="previous-bottom/top/height/next-top";root.dataset.printBoundaryGaps=JSON.stringify(rows.map(row=>({row:row.row,top:+row.printTop.toFixed(3),height:+row.printHeight.toFixed(3),gaps:Object.fromEntries(Object.entries(row.printGaps).map(([lane,value])=>[lane,+Number(value).toFixed(3)]))})));root.dataset.printCommentTrace=JSON.stringify(mappedAnnotations.filter(item=>item.type==="text").map(item=>{const placement=item.layoutPlacement,spacing=logicalCommentSpacing(placement,printAnnotationLayout.layout),edges=printBoundaryEdges(placement),printTop=printItemTop(item,item.pointsNormalized),printHeight=(spacing?.heightLines||0)*printStaffLineSpacing;return{id:String(item.id||""),row:item.annotationRow,boundary:item.printBoundary,previous:placement?.previous||"",next:placement?.next||"",placement,logicalSpacing:spacing?{top:spacing.topGapLines,height:spacing.heightLines,bottom:spacing.bottomGapLines,required:spacing.requiredLines}:null,printSpacing:spacing?{top:+(spacing.topGapLines*printStaffLineSpacing).toFixed(3),height:+printHeight.toFixed(3),bottom:+(spacing.bottomGapLines*printStaffLineSpacing).toFixed(3),required:+(spacing.requiredLines*printStaffLineSpacing).toFixed(3)}:null,printEdges:edges?{previousBottom:+edges.previousBottom.toFixed(3),commentTop:+printTop.toFixed(3),commentBottom:+(printTop+printHeight).toFixed(3),nextTop:+edges.nextTop.toFixed(3),actualBoundaryHeight:+edges.actualBoundaryHeight.toFixed(3)}:null}}));root.dataset.noteCount=String((state.notes||[]).length);root.dataset.annotationCount=String(mappedAnnotations.length);root.dataset.techniqueCount=String([...techMap.values()].reduce((sum,items)=>sum+items.length,0)+linkedTechniqueSlurs.length);
  }
  function audit(rootSelector="#printRootV2"){
    const root=document.querySelector(rootSelector);if(!root)return null;
    const relativeRect=(element,origin)=>{const rect=element?.getBoundingClientRect?.();return rect&&origin?{top:+(rect.top-origin.top).toFixed(3),bottom:+(rect.bottom-origin.top).toFixed(3),height:+rect.height.toFixed(3)}:null},pages=[...root.querySelectorAll(".pv2-page")].map(page=>{const origin=page.getBoundingClientRect();return{page:Number(page.dataset.printPage)||0,rows:[...page.querySelectorAll(".pv2-staff")].map(staff=>({row:Number(staff.dataset.printRow),expectedTop:Number(staff.dataset.printTop),expectedHeight:Number(staff.dataset.printHeight),actual:relativeRect(staff,origin),score:relativeRect(staff.querySelector(".pv2-score"),origin),lyrics:relativeRect(staff.querySelector(".pv2-lyrics"),origin),vocal:relativeRect(staff.querySelector(".pv2-vocal"),origin),gaps:[...staff.querySelectorAll(".pv2-annotation-gap")].map(gap=>({lane:gap.dataset.annotationBoundary,expected:Number(gap.dataset.expectedHeight),actual:relativeRect(gap,origin)}))})),comments:[...page.querySelectorAll("[data-print-annotation-id]")].map(item=>({id:item.dataset.printAnnotationId,row:Number(item.dataset.printRow),boundary:item.dataset.printBoundary,actual:relativeRect(item,origin)}))}});
    const parse=value=>{try{return JSON.parse(value||"null")}catch{return null}},result={media:global.matchMedia?.("print")?.matches===true,modelVersion:root.dataset.modelVersion,logicalGaps:parse(root.dataset.printBoundaryGaps),logicalComments:parse(root.dataset.printCommentTrace),pages};root.dataset.printAudit=JSON.stringify(result);console.info("[ShianPrintV2 final print DOM]",result);return result;
  }
  global.ShianPrintV2={render,audit,buildPrintAnnotationLayout,expandPrintAnnotationLayout,logicalCommentSpacing,naturalPrintBoundaryHeight};
})(window);
