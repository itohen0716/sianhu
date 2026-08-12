(()=>{"use strict";
const STORAGE_KEY="shian-live-player-score";
const BASE_FREQUENCIES={
  1:{"本調子":[220,293.7,440],"二上り":[220,329.6,440],"三下り":[220,293.7,392]},
  2:{"本調子":[233.1,311.1,466.2],"二上り":[233.1,349.2,466.2],"三下り":[233.1,311.1,415.3]},
  3:{"本調子":[246.9,329.6,493.9],"二上り":[246.9,370,493.9],"三下り":[246.9,329.6,440]},
  4:{"本調子":[261.6,349.2,523.3],"二上り":[261.6,392,523.3],"三下り":[261.6,349.2,466.2]},
  5:{"本調子":[277.2,370,554.4],"二上り":[277.2,415.3,554.4],"三下り":[277.2,370,493.9]},
  6:{"本調子":[293.7,392,587.3],"二上り":[293.7,440,587.3],"三下り":[293.7,392,523.3]},
  7:{"本調子":[311.1,415.3,622.3],"二上り":[311.1,466.2,622.3],"三下り":[311.1,415.3,554.4]},
  8:{"本調子":[329.6,440,659.3],"二上り":[329.6,493.9,659.3],"三下り":[329.6,440,587.3]}
};
const POSITION_SEMITONES=[0,1,2,3,5,6,7,8,9,10,12,13,14,15,17,18,19,20,21,22,24];
const $=selector=>document.querySelector(selector),clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
let score=null,count=6,tempo=96,muted=false,playing=false,pausedUnit=0,startContextTime=0,audioContext=null,masterGain=null,scheduled=[],finishTimer=0;

function setStatus(message,error=false){const element=$("#status");element.textContent=message;element.classList.toggle("error",error)}
function parseMeter(value){const match=String(value||"2/4").match(/(\d+)\s*\/\s*(\d+)/);if(!match)return{capacity:8};const numerator=Number(match[1]),denominator=Number(match[2]);const capacity=16*numerator/denominator;return{capacity:Number.isFinite(capacity)&&capacity>0?capacity:8}}
function validatePayload(payload){
  if(!payload||payload.format!=="shian-live-score"||!payload.score||!Array.isArray(payload.score.notes))throw new Error("演奏データの形式が正しくありません。");
  const notes=payload.score.notes.flatMap(note=>{const m=Number(note.m),s=Number(note.s),p=Number(note.p),d=Number(note.d);if(!Number.isInteger(m)||m<0||![1,2,3].includes(s)||!Number.isInteger(p)||p<0||![1,2,4].includes(d))return[];return[{m,s,p,d,v:String(note.v||""),rest:Boolean(note.rest)}]});
  return{title:String(payload.score.title||""),tuning:["本調子","二上り","三下り"].includes(payload.score.tuning)?payload.score.tuning:"二上り",meter:String(payload.score.meter||"2/4"),notes};
}
function receivePayload(payload){try{stop(true);score=validatePayload(payload);pausedUnit=0;setStatus(score.notes.length?`${score.tuning}・入力済み ${score.notes.length}音` :"演奏できる音がありません。",!score.notes.length)}catch(error){score=null;setStatus(error instanceof Error?error.message:"演奏データを読み込めませんでした。",true)}}
function loadInitial(){try{const raw=sessionStorage.getItem(STORAGE_KEY);if(raw)receivePayload(JSON.parse(raw))}catch(error){setStatus("演奏データを読み込めませんでした。",true);console.error(error)}}
function noteSemitone(value){if(value==="○"||value==="0")return 0;const number=Number(value);return Number.isInteger(number)&&number>=1&&number<=20?POSITION_SEMITONES[number]:null}
function frequencyFor(note){const semitone=noteSemitone(note.v),base=BASE_FREQUENCIES[count]?.[score?.tuning]?.[note.s-1];return semitone===null||!base?null:base*Math.pow(2,semitone/12)}
function buildEvents(){
  if(!score)return[];const capacity=parseMeter(score.meter).capacity,groups=new Map();
  score.notes.forEach(note=>{const unit=note.m*capacity+note.p,key=String(unit);if(!groups.has(key))groups.set(key,{unit,duration:note.d,notes:[]});const event=groups.get(key);event.duration=Math.max(event.duration,note.d);event.notes.push(note)});
  return[...groups.values()].sort((a,b)=>a.unit-b.unit);
}
async function ensureAudio(){const AudioContextClass=window.AudioContext||window.webkitAudioContext;if(!AudioContextClass)throw new Error("このブラウザは音声再生に対応していません。");if(!audioContext){audioContext=new AudioContextClass();masterGain=audioContext.createGain();masterGain.gain.value=muted?0:.78;masterGain.connect(audioContext.destination)}if(audioContext.state==="suspended")await audioContext.resume()}
function pluck(frequency,when,durationSeconds,stringNumber){
  if(!audioContext||!masterGain||!Number.isFinite(frequency))return;const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),filter=audioContext.createBiquadFilter();
  oscillator.type=stringNumber===1?"sawtooth":"triangle";oscillator.frequency.setValueAtTime(frequency,when);filter.type="lowpass";filter.frequency.setValueAtTime(Math.min(5200,frequency*7),when);filter.Q.value=.8;
  const peak=stringNumber===1?.18:.13,end=when+Math.max(.09,durationSeconds*.92);gain.gain.setValueAtTime(.0001,when);gain.gain.exponentialRampToValueAtTime(peak,when+.008);gain.gain.exponentialRampToValueAtTime(.0001,end);
  oscillator.connect(filter);filter.connect(gain);gain.connect(masterGain);oscillator.start(when);oscillator.stop(end+.02);scheduled.push(oscillator);
}
async function play(){
  if(!score||!score.notes.length){setStatus("演奏できる音がありません。",true);return}
  try{await ensureAudio()}catch(error){setStatus(error instanceof Error?error.message:"音声を開始できません。",true);return}
  stopScheduled();const events=buildEvents().filter(event=>event.unit>=pausedUnit);if(!events.length){pausedUnit=0;return play()}
  const secondsPerUnit=60/tempo/4,lead=.06;startContextTime=audioContext.currentTime+lead-pausedUnit*secondsPerUnit;playing=true;updateTransport();
  events.forEach(event=>{const when=startContextTime+event.unit*secondsPerUnit,duration=event.duration*secondsPerUnit;event.notes.filter(note=>!note.rest).forEach(note=>{const frequency=frequencyFor(note);if(frequency)pluck(frequency,when,duration,note.s)})});
  const last=events[events.length-1],endUnit=last.unit+last.duration;finishTimer=window.setTimeout(()=>{playing=false;pausedUnit=0;stopScheduled();updateTransport();setStatus("演奏が終わりました。")},Math.max(0,(startContextTime+endUnit*secondsPerUnit-audioContext.currentTime)*1000+80));setStatus(`${score.tuning}・${count}本・${tempo} BPM`);
}
function stopScheduled(){scheduled.forEach(node=>{try{node.stop()}catch{}});scheduled=[];if(finishTimer)window.clearTimeout(finishTimer);finishTimer=0}
function pause(){if(!playing||!audioContext)return;const secondsPerUnit=60/tempo/4;pausedUnit=Math.max(0,(audioContext.currentTime-startContextTime)/secondsPerUnit);playing=false;stopScheduled();updateTransport();setStatus("一時停止中")}
function stop(reset=false){if(playing&&audioContext&&!reset){const secondsPerUnit=60/tempo/4;pausedUnit=Math.max(0,(audioContext.currentTime-startContextTime)/secondsPerUnit)}playing=false;stopScheduled();if(reset)pausedUnit=0;updateTransport()}
function updateTransport(){$("#playPause").textContent=playing?"Ⅱ":"▶";$("#playPause").setAttribute("aria-label",playing?"一時停止":"再生");$("#mute").classList.toggle("muted",muted);$("#mute").textContent=muted?"♩":"♪"}
function setTempo(next){const resume=playing;if(resume)pause();tempo=clamp(Math.round(next),40,180);$("#tempo").value=String(tempo);$("#tempoValue").textContent=`${tempo} BPM`;if(resume)play()}
function renderCounts(){const labels=["一","二","三","四","五","六","七","八"];$(".counts").innerHTML=labels.map((label,index)=>`<button type="button" data-count="${index+1}" class="${index+1===count?"on":""}" aria-pressed="${index+1===count}">${label}</button>`).join("")}

window.addEventListener("message",event=>{if(event.origin!==location.origin)return;const validSource=event.source===window.opener||event.source===window.parent;if(!validSource)return;if(event.data?.type==="SHIAN_SCORE_UPDATE")receivePayload(event.data.payload);else if(event.data?.type==="SHIAN_PLAYER_STOP")stop(true)});
$(".counts").addEventListener("click",event=>{const button=event.target.closest("[data-count]");if(!button)return;count=Number(button.dataset.count);stop(true);renderCounts();if(score)setStatus(`${score.tuning}・${count}本`)});
$("#tempo").addEventListener("input",event=>setTempo(Number(event.target.value)));
$("#tempoDown").addEventListener("click",()=>setTempo(tempo-5));$("#tempoUp").addEventListener("click",()=>setTempo(tempo+5));
$("#rewind").addEventListener("click",()=>{stop(true);setStatus(score?"先頭へ戻りました。":"演奏データを待っています。");});
$("#playPause").addEventListener("click",()=>playing?pause():play());
$("#mute").addEventListener("click",()=>{muted=!muted;if(masterGain&&audioContext)masterGain.gain.setTargetAtTime(muted?0:.78,audioContext.currentTime,.015);updateTransport()});
window.addEventListener("pagehide",()=>stop(true));document.addEventListener("visibilitychange",()=>{if(document.hidden&&playing)pause()});
renderCounts();setTempo(tempo);updateTransport();loadInitial();
})();
