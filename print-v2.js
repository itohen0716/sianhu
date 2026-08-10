(function(global){
  "use strict";
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const key=(m,s,p)=>`${m},${s},${p}`;
  const line=(x,width=1.5)=>`<line x1="${x}" y1="0" x2="${x}" y2="68" stroke="currentColor" stroke-width="${width}"/>`;
  const dots=x=>`<circle cx="${x}" cy="23" r="2.2" fill="currentColor"/><circle cx="${x}" cy="45" r="2.2" fill="currentColor"/>`;
  function barSvg(kind){if(kind==="single")return"";if(kind==="double")return`<svg viewBox="0 0 18 68">${line(7)}${line(11)}</svg>`;if(kind==="repeat-start")return`<svg viewBox="0 0 18 68">${line(5)}${line(9)}${dots(15)}</svg>`;if(kind==="repeat-end")return`<svg viewBox="0 0 18 68">${dots(3)}${line(9)}${line(13)}</svg>`;return`<svg viewBox="0 0 18 68">${line(6)}${line(12,4)}</svg>`}
  function sameSvg(kind){const second=kind==="same2"?'<line x1="13" y1="62" x2="27" y2="6" stroke="currentColor" stroke-width="2"/>':"";return`<svg viewBox="0 0 34 68"><circle cx="5" cy="18" r="2.5" fill="currentColor"/><circle cx="29" cy="50" r="2.5" fill="currentColor"/><line x1="7" y1="62" x2="21" y2="6" stroke="currentColor" stroke-width="2"/>${second}</svg>`}
  function captureAnnotations(state){
    const svg=document.querySelector("#annotations"),staffs=[...document.querySelectorAll("#scoreArea .staff")];
    if(!svg||!staffs.length)return new Map();
    const svgRect=svg.getBoundingClientRect(),view=svg.viewBox.baseVal;
    if(!svgRect.width||!svgRect.height||!view.width||!view.height)return new Map();
    /* 書き込みは糸名欄を除いた譜面本体を基準にする。印刷側も同じ基準なので、
       画面幅が変わっても矢印・枠・コメントが対象の音から離れない。 */
    const wraps=staffs.map((staff,row)=>({row,rect:(staff.querySelector(".score-scroll")||staff.querySelector(".score-wrap")).getBoundingClientRect()})),result=new Map();
    const toClient=point=>({x:svgRect.left+point.x*svgRect.width/view.width,y:svgRect.top+point.y*svgRect.height/view.height});
    const sourcePoints=item=>item.type==="pen"?(item.points||[]):item.type==="text"||item.type==="symbol"?[{x:item.x,y:item.y}]:[{x:item.x1,y:item.y1},{x:item.x2,y:item.y2}];
    (state.layers||[]).filter(layer=>layer.id!=="technique-layer"&&layer.printEnabled!==false).forEach(layer=>(layer.items||[]).forEach(item=>{
      const raw=sourcePoints(item).filter(point=>Number.isFinite(point?.x)&&Number.isFinite(point?.y));if(!raw.length)return;
      const client=raw.map(toClient),centerY=client.reduce((sum,p)=>sum+p.y,0)/client.length;
      const target=wraps.reduce((best,current)=>Math.abs(current.rect.top+current.rect.height/2-centerY)<Math.abs(best.rect.top+best.rect.height/2-centerY)?current:best,wraps[0]);
      const points=client.map(point=>({x:(point.x-target.rect.left)*1000/target.rect.width,y:point.y-target.rect.top}));
      const normalized={...item,pointsNormalized:points};if(!result.has(target.row))result.set(target.row,[]);result.get(target.row).push(normalized);
    }));
    return result;
  }
  function annotationHtml(item){
    const pts=item.pointsNormalized||[],color=esc(item.color||"#222"),dash=item.lineStyle==="dashed"?' stroke-dasharray="8 7"':"",common=`stroke="${color}" stroke-width="2.5"${dash} fill="none" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
    if(item.type==="pen")return`<polyline ${common} points="${pts.map(p=>`${p.x},${p.y}`).join(" ")}"/>`;
    if(item.type==="rect"&&pts.length>1)return`<rect ${common} x="${Math.min(pts[0].x,pts[1].x)}" y="${Math.min(pts[0].y,pts[1].y)}" width="${Math.abs(pts[1].x-pts[0].x)}" height="${Math.abs(pts[1].y-pts[0].y)}" rx="5"/>`;
    if(item.type==="arrow"&&pts.length>1){const [a,b]=pts,angle=Math.atan2(b.y-a.y,b.x-a.x),size=16,p1={x:b.x-size*Math.cos(angle-.55),y:b.y-size*Math.sin(angle-.55)},p2={x:b.x-size*Math.cos(angle+.55),y:b.y-size*Math.sin(angle+.55)};return`<line ${common} x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><polyline ${common} points="${p1.x},${p1.y} ${b.x},${b.y} ${p2.x},${p2.y}"/>`}
    if(item.type==="text"&&pts[0]){const p=pts[0],size=Number(item.size)||20,bg=item.background==="none"?"none":item.background==="translucent"?"rgba(255,255,255,.72)":"#fff",width=Math.max(55,String(item.text||"").length*size*.95),height=size*1.55;return`<rect x="${p.x-7}" y="${p.y-height+5}" width="${width+14}" height="${height}" rx="7" fill="${bg}"/><text x="${p.x}" y="${p.y}" fill="${color}" font-size="${size}" font-weight="600">${esc(item.text)}</text>`}
    return"";
  }
  function render(state,options={}){
    const root=document.querySelector(options.rootSelector||"#printRootV2");if(!root)throw new Error("印刷面を生成できません。");
    const counts=Array.isArray(state.rowMeasureCounts)?state.rowMeasureCounts:Array(Number(state.rows)||1).fill(Number(state.measuresPerRow)||4),starts=counts.map((_,row)=>counts.slice(0,row).reduce((a,b)=>a+b,0));
    const capacity=options.capacity(),measureWidth=options.measureWidth,columnX=options.columnX,barKey=options.barlineKey,meterLabel=options.meterLabel;
    const techniqueLayer=(state.layers||[]).find(layer=>layer.id==="technique-layer"),techMap=new Map();
    if(techniqueLayer?.visible!==false)(techniqueLayer?.items||[]).filter(item=>item.type==="symbol"&&item.anchor).forEach(item=>{const k=key(item.anchor.m,item.anchor.s,item.anchor.p);if(!techMap.has(k))techMap.set(k,[]);techMap.get(k).push(item)});
    const annotations=captureAnnotations(state),rows=counts.map((count,row)=>({row,annotations:annotations.get(row)||[],measures:Array.from({length:count},(_,local)=>{const m=starts[row]+local,width=measureWidth(m);return{m,local,width,startKind:state.barlineKinds?.[barKey(row,local)]||"single",endKind:local===count-1?(state.barlineKinds?.[barKey(row,count)]||"single"):"single",notes:(state.notes||[]).filter(note=>note.m===m).map(note=>{const x=note.rest?(Number(note.x)||0):columnX(note.m,note.p);return{...note,left:clamp((Number(note.p)+.5)/capacity+x/width,.005,.995),value:note.rest?"●":String(note.v||""),techniques:note.rest?[]:(techMap.get(key(note.m,note.s,note.p))||[])} }),parts:(state.scoreParts||[]).filter(part=>part.m===m).map(part=>({...part,left:clamp((Number(part.p)+.5)/capacity+(Number(part.x)||0)/width,.005,.995)}))}})}));
    const pageCounts=options.pageRows(),pages=[];let cursor=0;pageCounts.forEach((count,index)=>{pages.push({index,rows:rows.slice(cursor,cursor+count)});cursor+=count});
    /* 段間隔は1ページ目の指定段数から一度だけ決め、全ページで共有する。
       最終ページの段数が少なくても再均等配置せず、余白はページ下部へ残す。 */
    const firstPageRowCount=Math.max(1,pages[0]?.rows.length||pageCounts[0]||1);
    const sharedStaffHeight=(283*96/25.4-34)/firstPageRowCount;
    const techniqueHtml=(item,index)=>{const side=item.side==="below"?"below":"above",x=Number(item.offsetXPx)||0,y=(Number(item.offsetYPx)||0)+index*16,style=`--tech-color:${esc(item.color||"#222")};margin-left:${x}px;${side==="above"?`margin-bottom:${-y}px`:`margin-top:${y}px`}`;if(["Ⅰ","Ⅱ","Ⅲ"].includes(item.text))return`<span class="pv2-tech finger ${side}" style="${style}">${esc(item.text)}</span>`;if(item.text==="スリ")return`<span class="pv2-tech slur ${side}" style="${style};--slur-width:${clamp(Number(item.slurWidth)||34,22,90)}px">スリ</span>`;return`<span class="pv2-tech symbol ${side}" style="${style}">${esc(item.text)}</span>`};
    const noteHtml=note=>`<span class="pv2-note d${[1,2,4].includes(note.d)?note.d:4}${note.rest?" rest":""}${!note.rest&&note.v==="○"?" open":""}" style="--left:${(note.left*100).toFixed(5)}%;--note-color:${esc(note.rest?"#222":(note.color||(note.v==="○"?state.openColor:state.numberColor)))}"><span class="pv2-glyph">${esc(note.value)}</span>${note.techniques.length?`<span class="pv2-techniques">${note.techniques.map(techniqueHtml).join("")}</span>`:""}</span>`;
    const measureHtml=measure=>`<div class="pv2-measure${measure.startKind!=="single"?" custom-start":""}${measure.endKind!=="single"?" custom-end":""}" style="--grow:${measure.width}">${measure.startKind!=="single"?`<span class="pv2-bar start">${barSvg(measure.startKind)}</span>`:""}${measure.endKind!=="single"?`<span class="pv2-bar end">${barSvg(measure.endKind)}</span>`:""}${measure.parts.map(part=>`<span class="pv2-part" style="left:${(part.left*100).toFixed(5)}%">${sameSvg(part.kind)}</span>`).join("")}${[3,2,1].map(string=>`<div class="pv2-string">${measure.notes.filter(note=>Number(note.s)===string).map(noteHtml).join("")}</div>`).join("")}</div>`;
    /* 曲名・調子・拍子は固定し、譜面と全レイヤーだけを一体で下げる。
       同じラッパーを全ページで使うため、最終ページでも開始位置と段間隔が変わらない。 */
    root.innerHTML=pages.map(page=>`<section class="pv2-page">${page.index===0?`<div class="pv2-meta"><div class="pv2-meta-left"><span>〈</span><span>${esc(state.tuning||"")}</span><span>〉</span><span>${esc(meterLabel())}</span></div><div class="pv2-title">${esc(state.title||"曲名入力")}</div><div></div></div>`:""}<div class="pv2-staffs">${page.rows.map(row=>`<section class="pv2-staff" style="height:${sharedStaffHeight.toFixed(2)}px"><div class="pv2-wrap"><div class="pv2-labels">${row.row===0?"<span>三の糸</span><span>二の糸</span><span>一の糸</span>":"<span></span><span></span><span></span>"}</div><div class="pv2-score">${row.measures.map(measureHtml).join("")}${row.annotations.length?`<svg class="pv2-overlay" viewBox="0 0 1000 120" preserveAspectRatio="none">${row.annotations.map(annotationHtml).join("")}</svg>`:""}</div></div></section>`).join("")}</div></section>`).join("");
    root.dataset.modelVersion="2";root.dataset.noteCount=String((state.notes||[]).length);root.dataset.annotationCount=String([...annotations.values()].flat().length);
  }
  global.ShianPrintV2={render};
})(window);
