(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.ShianNoteDensity=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const LEVELS=Object.freeze([
    Object.freeze({name:"low",label:"低密度",size:18,maxLoad:.28}),
    Object.freeze({name:"standard",label:"標準",size:17,maxLoad:.52}),
    Object.freeze({name:"medium-high",label:"やや高密度",size:16,maxLoad:.76}),
    Object.freeze({name:"high",label:"高密度",size:15,maxLoad:Infinity})
  ]);
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const noteText=note=>note?.v==="0"||note?.v==="○"?"0":String(note?.v??"");
  function groupColumns(notes,size,measureText){
    const groups=new Map();
    (notes||[]).filter(note=>!note?.rest&&Number.isFinite(Number(note?.p))).forEach(note=>{
      const p=Number(note.p),text=noteText(note),glyphWidth=Math.max(12,Number(measureText(text,size))||0),x=Number(note.x)||0;
      const current=groups.get(p)||{p,minX:Infinity,maxX:-Infinity,width:0};
      current.minX=Math.min(current.minX,x-glyphWidth/2);
      current.maxX=Math.max(current.maxX,x+glyphWidth/2);
      current.width=Math.max(current.width,glyphWidth);
      groups.set(p,current);
    });
    return [...groups.values()].sort((a,b)=>a.p-b.p);
  }
  function collides(columns,measureWidth,capacity,gap=1){
    if(!columns.length)return false;
    const width=Math.max(1,Number(measureWidth)||1),slots=Math.max(1,Number(capacity)||1);
    const extents=columns.map(column=>{const base=(column.p+.5)*width/slots;return{left:base+column.minX,right:base+column.maxX}});
    if(extents.some(item=>item.left<-6||item.right>width+6))return true;
    return extents.some((item,index)=>index>0&&item.left-extents[index-1].right<gap);
  }
  function select(options={}){
    const notes=Array.isArray(options.notes)?options.notes:[],measureWidth=Math.max(1,Number(options.measureWidth)||1),capacity=Math.max(1,Number(options.capacity)||1),measureText=typeof options.measureText==="function"?options.measureText:((text,size)=>String(text).length*size*.62+2);
    const reference=groupColumns(notes,LEVELS[0].size,measureText),columnLoad=reference.length/capacity,glyphLoad=(reference.reduce((sum,column)=>sum+(column.maxX-column.minX),0)+Math.max(0,reference.length-1)*2)/measureWidth,load=Math.max(columnLoad,glyphLoad*.8);
    let index=LEVELS.findIndex(level=>load<=level.maxLoad);if(index<0)index=LEVELS.length-1;
    while(index<LEVELS.length-1&&collides(groupColumns(notes,LEVELS[index].size,measureText),measureWidth,capacity,1))index++;
    const level=LEVELS[index];
    return{...level,index,load:clamp(load,0,99),columnLoad,glyphLoad,columns:reference.length};
  }
  return{LEVELS,select,groupColumns};
});
