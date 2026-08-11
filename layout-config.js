/**
 * 写譜ページと印刷プレビュー間でレイアウト値を統一するための設定
 * このファイルの値が唯一の真実になり、他のファイルから参照される
 */

const LayoutConfig = {
  // 譜線・音符の基本寸法
  rowHeight: 18,      // 1行の高さ（px）
  noteHeight: 14,     // 音符グリフの高さ（px）
  noteSize: 14,       // 音符フォントサイズ（px）
  
  // 段間のスペース
  staffGap: 28,       // 段と段の間隔（px）
  printStaffGap: 28,  // 印刷時の段間隔
  
  // メタデータ・ヘッダー
  metaHeight: 34,     // 曲名・調弦行の高さ（px）
  
  // スコアエリアのパディング
  scorePaddingTop: 24,    // スコア上部のパディング（px）
  scorePaddingBottom: 34, // スコア下部のパディング（px）
  
  // 印刷ページの設定
  printPageWidth: 196,   // A4横幅（mm）
  printPageHeight: 283,  // A4縦幅（mm）
  printMargin: 7,        // ページ余白（mm）
  
  // 印刷ページレイアウト
  printScoreGapTop: 12,  // 最初のページのスコア上部スペース（mm）
  printMetaHeightMm: 34, // メタデータ高さ（px → 印刷時も使用）
  printTechniqueClearance: 20, // 奏法記号クリアランス（px）
  
  // ページ分割
  maxRowsPerPage: 10, // 1ページあたりの最大段数
  
  /**
   * 段の上側マージン計算（印刷時の奏法記号ための余白確保）
   */
  getPrintStaffMarginTop(isPrintPageStart = false) {
    const printTechniqueClearance = this.printTechniqueClearance;
    const printStaffGap = this.printStaffGap;
    // 段の上側を段内領域として確保して、奏法が段境界で欠けないようにする
    return Math.max(0, printStaffGap - printTechniqueClearance);
  },
  
  /**
   * 段のパディング上計算（奏法クリアランス）
   */
  getPrintStaffPaddingTop(isPrintPageStart = false) {
    return this.printTechniqueClearance;
  },
  
  /**
   * 印刷時の最初のページ内スコア位置の計算
   */
  getPrintFirstPageScoreGapPx() {
    // 12mm を px に変換（96dpi 想定：1mm ≈ 3.78px、ただし印刷は別の換算が必要）
    // 実際の印刷出力では @page の margin で制御される
    return this.printScoreGapTop; // mm値を保持
  },
  
  /**
   * 印刷時の奏法アイテムのY補正
   * （入力画面での手動移動量を無視して、対応する数字へ強制配置）
   */
  getTechniquePrintOffset() {
    return { x: 0, y: 0 };
  }
};

// グローバルに公開（index.htmlとprint-v2.jsから使用可能）
if (typeof window !== 'undefined') {
  window.LayoutConfig = LayoutConfig;
}

// Node.js環境での export も想定（テストやビルド時）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LayoutConfig;
}
