(function(global){
  "use strict";

  const TECHNIQUE_LAYER_ID="technique-layer";

  function hasSavedComment(layer){
    return Array.isArray(layer?.items)&&layer.items.some(item=>item?.type==="text"&&String(item.text??"").trim().length>0);
  }

  /*
   * 旧保存データでは、個人レイヤーが「画面では非表示・印刷は有効」の
   * 組み合わせのまま残ることがある。印刷に残っている実コメントを削除・
   * 複製せず、読込時に同じレイヤーを画面表示へ戻す。
   * 奏法レイヤー、印刷対象外レイヤー、コメントを持たない描画レイヤーは
   * 対象にしない。
   */
  function restoreSavedCommentLayers(layers){
    const restored=[];
    (Array.isArray(layers)?layers:[]).forEach(layer=>{
      if(!layer||layer.id===TECHNIQUE_LAYER_ID||layer.visible!==false||layer.printEnabled===false||!hasSavedComment(layer))return;
      layer.visible=true;
      restored.push(String(layer.id||""));
    });
    return restored;
  }

  global.ShianAnnotationVisibility={hasSavedComment,restoreSavedCommentLayers};
})(typeof window!=="undefined"?window:globalThis);
