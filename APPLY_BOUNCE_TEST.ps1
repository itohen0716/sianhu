param(
  [string]$Root = "."
)

$ErrorActionPreference = "Stop"
$LF = [char]10

function Get-GitBlobSha1([string]$Path) {
  $bytes = [IO.File]::ReadAllBytes($Path)
  $header = [Text.Encoding]::ASCII.GetBytes("blob $($bytes.Length)" + [char]0)
  $all = New-Object byte[] ($header.Length + $bytes.Length)
  [Buffer]::BlockCopy($header, 0, $all, 0, $header.Length)
  [Buffer]::BlockCopy($bytes, 0, $all, $header.Length, $bytes.Length)
  $sha = [Security.Cryptography.SHA1]::Create().ComputeHash($all)
  return -join ($sha | ForEach-Object { $_.ToString("x2") })
}

function Replace-Once([string]$Text, [string]$Old, [string]$New, [string]$Label) {
  $first = $Text.IndexOf($Old, [StringComparison]::Ordinal)
  if ($first -lt 0) { throw "置換対象が見つかりません: $Label" }
  $second = $Text.IndexOf($Old, $first + $Old.Length, [StringComparison]::Ordinal)
  if ($second -ge 0) { throw "置換対象が複数あります: $Label" }
  return $Text.Substring(0, $first) + $New + $Text.Substring($first + $Old.Length)
}

$indexPath = Join-Path $Root "index.html"
$annotationsPath = Join-Path $Root "annotations.html"
$playerPath = Join-Path $Root "player\player.js"

foreach ($p in @($indexPath, $annotationsPath, $playerPath)) {
  if (-not (Test-Path -LiteralPath $p)) {
    throw "必要なファイルがありません: $p"
  }
}

# 2026-10-06 GitHub main (commit 99a66a2854f9fb51d44ee481a59886e1cc812816)
# と完全一致する場合だけ実行する。古いZIPには適用しない。
$expected = @{
  $indexPath       = "edebc587e08f794db920c70a9ed11047fea0ea14"
  $annotationsPath = "3466ba36aca09f33c3294443ab47c42520879ac3"
  $playerPath      = "1d7cda5669770c3ae6bcbd11993366f086b0d7c5"
}

foreach ($p in @($indexPath, $annotationsPath, $playerPath)) {
  $actual = Get-GitBlobSha1 $p
  if ($actual -ne $expected[$p]) {
    throw "現在のGitHub基準版と一致しないため中止しました。`n$p`n期待: $($expected[$p])`n実際: $actual"
  }
}

$utf8 = New-Object Text.UTF8Encoding($false)
$index = [IO.File]::ReadAllText($indexPath, $utf8)
$annotations = [IO.File]::ReadAllText($annotationsPath, $utf8)
$player = [IO.File]::ReadAllText($playerPath, $utf8)

# ------------------------------------------------------------
# index.html
# 「演奏のノリ：通常／弾む」を追加し、JSON保存・読込・プレーヤー受け渡しに含める
# ------------------------------------------------------------
$index = Replace-Once $index `
  '.score-meta{display:flex;align-items:flex-end;gap:6px}' `
  '.score-meta{display:flex;align-items:flex-end;gap:6px;flex-wrap:wrap}' `
  'score-meta style'

$index = Replace-Once $index `
  '.score-meta #meter{font-size:15px}' `
  '.score-meta #meter{font-size:15px}.rhythm-feel-control{display:flex;align-items:center;gap:4px;white-space:nowrap;font:13px serif}.rhythm-feel-control select{border:1px solid #d4c7b8;border-radius:6px;background:#fffdf8;padding:3px 5px;font:13px serif}' `
  'rhythm feel style'

$oldMeta = @'
<div class="meta"><div class="score-meta"><span>〈</span><select id="tuning" aria-label="調弦"><option>本調子</option><option selected>二上り</option><option>三下り</option></select><span>〉</span><input id="meter" value="四分ノ二拍子" aria-label="拍子" title="2/4の形式で入力"></div><input id="title" value="曲名入力" aria-label="曲名"><span id="summary"></span></div>
'@.Trim()

$newMeta = @'
<div class="meta"><div class="score-meta"><span>〈</span><select id="tuning" aria-label="調弦"><option>本調子</option><option selected>二上り</option><option>三下り</option></select><span>〉</span><input id="meter" value="四分ノ二拍子" aria-label="拍子" title="2/4の形式で入力"><label class="rhythm-feel-control">演奏のノリ <select id="rhythmFeel" aria-label="演奏のノリ"><option value="normal">通常</option><option value="bounce">弾む</option></select></label></div><input id="title" value="曲名入力" aria-label="曲名"><span id="summary"></span></div>
'@.Trim()

$index = Replace-Once $index $oldMeta $newMeta 'rhythm feel UI'
$index = Replace-Once $index `
  'meter:"2/4",rows:' `
  'meter:"2/4",rhythmFeel:{type:"normal"},rows:' `
  'defaults rhythm feel'

$helper = 'function normalizeRhythmFeel(value){const raw=typeof value==="string"?value:value?.type;return{type:raw==="bounce"?"bounce":"normal"}}'
$index = Replace-Once $index `
  'function migrateState(){' `
  ($helper + $LF + 'function migrateState(){') `
  'normalize helper'

$oldMigrate = '  const rawMeter=state.meter,parsed=parseMeter(rawMeter)||parseMeter(defaults.meter),legacy=String(rawMeter||"").includes("拍子"),oldRows=state.rows;'
$newMigrate = $oldMigrate + $LF + '  state.rhythmFeel=normalizeRhythmFeel(state.rhythmFeel);'
$index = Replace-Once $index $oldMigrate $newMigrate 'migrate rhythm feel'

$index = Replace-Once $index `
  'meter:state.meter,rows:' `
  'meter:state.meter,rhythmFeel:normalizeRhythmFeel(state.rhythmFeel),rows:' `
  'serializable rhythm feel'

$index = Replace-Once $index `
  'meter:String(state.meter||"2/4"),measureCount:' `
  'meter:String(state.meter||"2/4"),rhythmFeel:normalizeRhythmFeel(state.rhythmFeel),measureCount:' `
  'player payload rhythm feel'

$index = Replace-Once $index `
  'q("#meter").readOnly=IS_ANNOTATION_PAGE;q("#summary").textContent="";' `
  'q("#meter").readOnly=IS_ANNOTATION_PAGE;q("#rhythmFeel").value=normalizeRhythmFeel(state.rhythmFeel).type;q("#summary").textContent="";' `
  'render rhythm feel'

$oldTuningListener = 'q("#tuning").addEventListener("change",e=>{snap();state.tuning=e.target.value;render()});'
$newTuningListener = $oldTuningListener + $LF + 'q("#rhythmFeel").addEventListener("change",e=>{snap();state.rhythmFeel=normalizeRhythmFeel(e.target.value);render()});'
$index = Replace-Once $index $oldTuningListener $newTuningListener 'rhythm feel listener'

# ------------------------------------------------------------
# annotations.html
# 書き込みページを経由しても rhythmFeel を消さない
# ------------------------------------------------------------
$annotations = Replace-Once $annotations `
  'meter:"2/4",rows:' `
  'meter:"2/4",rhythmFeel:{type:"normal"},rows:' `
  'annotations defaults'

$annotations = Replace-Once $annotations `
  'function migrateState(){' `
  ($helper + $LF + 'function migrateState(){') `
  'annotations normalize helper'

$annotations = Replace-Once $annotations `
  'function migrateState(){const rawMeter=' `
  'function migrateState(){state.rhythmFeel=normalizeRhythmFeel(state.rhythmFeel);const rawMeter=' `
  'annotations migrate'

$annotations = Replace-Once $annotations `
  'meter:state.meter,rows:' `
  'meter:state.meter,rhythmFeel:normalizeRhythmFeel(state.rhythmFeel),rows:' `
  'annotations serializable'

$annotations = Replace-Once $annotations `
  'meter:String(state.meter||"2/4"),measureCount:' `
  'meter:String(state.meter||"2/4"),rhythmFeel:normalizeRhythmFeel(state.rhythmFeel),measureCount:' `
  'annotations player payload'

# ------------------------------------------------------------
# player/player.js
# 既存の時間軸完成後に「弾む」のときだけ通常8分音符ペアを補正
# 三連符そのもの、半間、繰り返し、スリ、スクイ、ハジキの処理は変更しない
# ------------------------------------------------------------
$player = Replace-Once $player `
  'const SUKUI_GAIN_DB=-4,HAJIKI_GAIN_DB=-2;' `
  ('const SUKUI_GAIN_DB=-4,HAJIKI_GAIN_DB=-2;' + $LF + 'const BOUNCE_OFFBEAT_FRACTION=.60;') `
  'bounce constant'

$player = Replace-Once $player `
  'function normalizeNote(note,isVocal=false){' `
  ($helper + $LF + 'function normalizeNote(note,isVocal=false){') `
  'player normalize helper'

$player = Replace-Once $player `
  'meter=String(source.meter||"2/4"),capacity=' `
  'meter=String(source.meter||"2/4"),rhythmFeel=normalizeRhythmFeel(source.rhythmFeel),capacity=' `
  'validate rhythm feel'

$player = Replace-Once $player `
  'return{title:String(source.title||""),tuning:["本調子","二上り","三下り"].includes(source.tuning)?source.tuning:"二上り",meter,notes:' `
  'return{title:String(source.title||""),tuning:["本調子","二上り","三下り"].includes(source.tuning)?source.tuning:"二上り",meter,rhythmFeel,notes:' `
  'validated score rhythm feel'

$applyRhythmFeel = @'
function applyRhythmFeel(events){if(score?.rhythmFeel?.type!=="bounce")return events;const result=events.map(event=>({...event})),shamisen=result.filter(event=>event.voice==="shamisen"),eps=1e-6;for(let index=0;index<shamisen.length-1;index++){const first=shamisen[index],second=shamisen[index+1],firstSegment=first.notes?.[0]?.segmentIndex,secondSegment=second.notes?.[0]?.segmentIndex;if(!Number.isInteger(firstSegment)||firstSegment!==secondSegment||first.isTuplet||second.isTuplet)continue;if(!first.notes?.length||!second.notes?.length||!first.notes.every(note=>Number(note.d)===2)||!second.notes.every(note=>Number(note.d)===2))continue;const segment=score.playbackSegments?.[firstSegment];if(!segment)continue;const localFirst=first.rawUnit-segment.start,localSecond=second.rawUnit-segment.start,phase=((localFirst%4)+4)%4;if(Math.abs(phase)>eps||Math.abs(localSecond-localFirst-2)>eps)continue;const beatRawStart=first.rawUnit,beatRawEnd=beatRawStart+4;if((score.tuplets||[]).some(tuplet=>tuplet.start<beatRawEnd-eps&&tuplet.writtenEnd>beatRawStart+eps))continue;const naturalBeatEnd=second.unit+second.duration;if(Math.abs(naturalBeatEnd-(first.unit+4))>eps)continue;const offbeat=first.unit+4*BOUNCE_OFFBEAT_FRACTION;first.duration=offbeat-first.unit;second.unit=offbeat;second.duration=naturalBeatEnd-offbeat}return result.sort(compareEvents)}
'@.Trim()

$player = Replace-Once $player `
  'function buildEvents(timeMap=buildTimeMap()){' `
  ($applyRhythmFeel + $LF + 'function buildEvents(timeMap=buildTimeMap()){') `
  'insert bounce transform'

$newBuildEvents = @'
function buildEvents(timeMap=buildTimeMap()){if(!score)return[];const groups=new Map(),tuplets=score.tuplets||[];[...score.notes,...score.vocalNotes].forEach(note=>{const rawUnit=Number(note.timelineUnit),segmentEnd=Number(note.segmentEndUnit),key=`${note.voice}:${rawUnit}`,writtenDuration=note.d*(note.voice==="vocal"&&note.dotted?1.5:1),duration=Number.isFinite(segmentEnd)?Math.max(0,Math.min(writtenDuration,segmentEnd-rawUnit)):writtenDuration;if(!Number.isFinite(rawUnit)||duration<=0)return;if(!groups.has(key))groups.set(key,{rawUnit,duration,voice:note.voice,notes:[]});const event=groups.get(key);event.duration=Math.max(event.duration,duration);event.notes.push(note)});const events=[...groups.values()].map(event=>({...event,notes:[...event.notes].sort(compareEventNotes),isTuplet:tuplets.some(tuplet=>event.rawUnit>=tuplet.start&&event.rawUnit<tuplet.writtenEnd),unit:timeMap(event.rawUnit),duration:timeMap(event.rawUnit+event.duration)-timeMap(event.rawUnit)})).sort(compareEvents);return applyRhythmFeel(events)}
'@.Trim()

$matches = [regex]::Matches($player, '(?m)^function buildEvents\(timeMap=buildTimeMap\(\)\)\{.*$')
if ($matches.Count -ne 1) {
  throw "buildEvents の置換対象が一意ではありません。"
}
$player = [regex]::Replace(
  $player,
  '(?m)^function buildEvents\(timeMap=buildTimeMap\(\)\)\{.*$',
  [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $newBuildEvents },
  1
)

# 書き込み前の最終チェック
$markers = @(
  @($index, 'id="rhythmFeel"'),
  @($index, 'rhythmFeel:normalizeRhythmFeel(state.rhythmFeel)'),
  @($annotations, 'rhythmFeel:{type:"normal"}'),
  @($player, 'BOUNCE_OFFBEAT_FRACTION=.60'),
  @($player, 'function applyRhythmFeel(events)'),
  @($player, 'return applyRhythmFeel(events)')
)
foreach ($pair in $markers) {
  if (-not $pair[0].Contains($pair[1])) {
    throw "実装後チェックに失敗しました: $($pair[1])"
  }
}

# ここで初めて3ファイルを書き換える
[IO.File]::WriteAllText($indexPath, $index, $utf8)
[IO.File]::WriteAllText($annotationsPath, $annotations, $utf8)
[IO.File]::WriteAllText($playerPath, $player, $utf8)

Write-Host ""
Write-Host "[OK] 「演奏のノリ：通常／弾む」のテスト実装を適用しました。" -ForegroundColor Green
Write-Host "変更した本番ファイルは3つだけです。"
Write-Host "  index.html"
Write-Host "  annotations.html"
Write-Host "  player/player.js"
Write-Host ""
Write-Host "APPLY_BOUNCE_TEST.ps1 自体はGitHubへアップロードしないでください。"
