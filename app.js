// ===================== Training data =====================
// ask me about Koch training
const KOCH_SEQUENCE = [
  'K','M','U','R','E','S','N','A','P','T',
  'L','W','I','.', 'J','Z','=', 'F','O','Y',
  ',', 'V','G','5','/','Q','9','2','H','3',
  '8','B','?','4','7','C','1','D','6','0','X'
];
function kochChars(lesson){
  const count = Math.min(KOCH_SEQUENCE.length, Math.max(1, lesson+1)); // LCWO style
  return KOCH_SEQUENCE.slice(0, count);
}
function randomGroups(lesson, groups, groupLen){
  const chars = kochChars(lesson);
  const out = [];
  for(let g=0; g<groups; g++){
    let grp = '';
    for(let i=0;i<groupLen;i++) grp += chars[Math.floor(Math.random()*chars.length)];
    out.push(grp);
  }
  return out.join(' ');
}

// ===================== Web Serial Stuff =====================
let port, reader, writer;
const $ = s => document.querySelector(s);
const logEl = $('#log');
const statusEl = $('#status');
function log(msg, dir="→"){ const ts=new Date().toLocaleTimeString(); logEl.textContent += `[${ts}] ${dir} ${msg}\n`; logEl.scrollTop = logEl.scrollHeight; }

async function connect(){
  try{
    if(!('serial' in navigator)){ alert('Web Serial not supported in this browser.'); return; }
    port = await navigator.serial.requestPort();
    const baud = parseInt($('#baud').value,10) || 9600;
    await port.open({ baudRate: baud });
    // Hold DTR high for bias; set RTS to idle (respect invert)
    try { await port.setSignals({ dataTerminalReady: true, requestToSend: invertOut() }); } catch(e) { console.warn('setSignals not supported?', e); }

    // Console pipelines
    const enc = new TextEncoderStream();
    enc.readable.pipeTo(port.writable);
    writer = enc.writable.getWriter();

    const dec = new TextDecoderStream();
    port.readable.pipeTo(dec.writable).catch(()=>{});
    reader = dec.readable.getReader();

    statusEl.textContent = 'Connected';
    log(`Port opened @ ${baud}`,'✔');
    readLoop();

    navigator.serial.addEventListener('disconnect', e=>{
      if(port && e.port === port){ log('Serial device disconnected','⚠'); disconnect(); }
    });
  }catch(e){ log('Connect error: '+e.message,'✖'); }
}
async function readLoop(){
  try{
    while(true){
      const {value, done} = await reader.read();
      if(done) break; if(value) log(value, '←');
    }
  }catch(e){ log('Read loop error: '+e.message,'✖'); }
}
async function sendLine(s){ if(!writer) return; await writer.write(s+"\r\n"); log(s,'→'); }
async function disconnect(){
  try{ if(reader){ await reader.cancel(); reader.releaseLock(); } }catch{}
  try{ if(writer){ await writer.close(); writer.releaseLock(); } }catch{}
  try{ if(port){ await port.close(); } }catch{}
  statusEl.textContent = 'Idle';
}

// ===================== Morse keying on RTS =====================
// Invert handling (active-low drivers or cooked wiring) - it happens!
function invertOut(){ return $('#invert').checked; }
async function rtsDown(){ try{ await port.setSignals({ requestToSend: !invertOut() }); }catch(e){ console.warn(e); } }
async function rtsUp(){   try{ await port.setSignals({ requestToSend:  invertOut() }); }catch(e){ console.warn(e); } }

const sleep = ms => new Promise(r=>setTimeout(r,ms));
function ditMs(wpm){ return 1200 / Math.max(1,wpm); } // standard
function timings(wpm, eff){
  const dit = ditMs(wpm);
  const dah = 3*dit;
  const intra = dit; // between elements
  const scale = Math.max(1, wpm/Math.max(1,eff||wpm));
  const charGap = 3*dit*scale;
  const wordGap = 7*dit*scale;
  return {dit,dah,intra,charGap,wordGap};
}
// magic antique runes
const MORSE = {
  'A':'.-','B':'-...','C':'-.-.','D':'-..','E':'.','F':'..-.','G':'--.',
  'H':'....','I':'..','J':'.---','K':'-.-','L':'.-..','M':'--','N':'-.',
  'O':'---','P':'.--.','Q':'--.-','R':'.-.','S':'...','T':'-','U':'..-',
  'V':'...-','W':'.--','X':'-..-','Y':'-.--','Z':'--..',
  '1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.','0':'-----',
  '.':'.-.-.-', ',':'--..--', '?':'..--..', '/':'-..-.', '=':'-...-'
};
function encodeChar(ch){ if(ch===' ') return ' '; const p=MORSE[ch]; return p||''; }

let stopFlag = false;
async function sendSymbol(sym, t){
  await rtsDown();
  await sleep(sym==='.' ? t.dit : t.dah);
  await rtsUp();
  await sleep(t.intra);
}
async function sendMorseText(text, wpm, eff){
  const t = timings(wpm, eff);
  stopFlag = false; $('#btnStop').disabled = false;
  const words = text.toUpperCase().split(/\s+/);
  for(let wi=0; wi<words.length; wi++){
    const word = words[wi];
    for(let ci=0; ci<word.length; ci++){
      if(stopFlag) break;
      const pat = encodeChar(word[ci]);
      for(let si=0; si<pat.length; si++){
        if(stopFlag) break;
        await sendSymbol(pat[si], t);
      }
      await sleep(t.charGap - t.intra);
    }
    await sleep(t.wordGap - t.charGap);
  }
  $('#btnStop').disabled = true;
}

// ===================== UI wiring =====================
$('#btnConnect').addEventListener('click', connect);
$('#btnDisconnect').addEventListener('click', disconnect);
$('#btnSend').addEventListener('click', ()=> sendLine($('#tx').value));
$('#tx').addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); sendLine($('#tx').value); }});

// Test pulses
//$('#btnDit').addEventListener('click', async ()=>{ await rtsDown(); await sleep(ditMs(parseInt($('#wpm').value,10)||20)); await rtsUp(); });
//$('#btnDah').addEventListener('click', async ()=>{ const d=ditMs(parseInt($('#wpm').value,10)||20); await rtsDown(); await sleep(3*d); await rtsUp(); });
// dead stuff - rewritten to add console out functionality below - can probably be removed...

$('#btnDit').addEventListener('click', async ()=>{
  log('Test dit','•');
  await rtsDown();
  await sleep(ditMs(parseInt($('#wpm').value,10)||20));
  await rtsUp();
});

$('#btnDah').addEventListener('click', async ()=>{
  log('Test dah','•');
  const d=ditMs(parseInt($('#wpm').value,10)||20);
  await rtsDown();
  await sleep(3*d);
  await rtsUp();
});

// Trainer controls
function regenerate(){
  const lesson=parseInt($('#lesson').value,10);
  const groups=parseInt($('#groups').value,10);
  const gl=parseInt($('#groupLen').value,10);
  $('#preview').textContent = randomGroups(lesson, groups, gl);
}
$('#btnGenerate').addEventListener('click', regenerate);
$('#lesson').addEventListener('input', regenerate);
$('#groups').addEventListener('input', regenerate);
$('#groupLen').addEventListener('input', regenerate);

$('#btnStart').addEventListener('click', async ()=>{
  if(!port){ alert('Connect serial first.'); return; }
  const wpm = parseInt($('#wpm').value,10)||20;
  const eff = parseInt($('#effWpm').value,10)||12;
  const text = ($('#preview').textContent.trim() || randomGroups(parseInt($('#lesson').value,10), parseInt($('#groups').value,10), parseInt($('#groupLen').value,10)));

  // 5-second countdown printed to the on-page Console
  for (let t = 5; t >= 1; t--) {
    log(`Test begins in ${t}`, '•');
    await sleep(1000);
  }

  log('Test started','•');
  await sendMorseText(text, wpm, eff);
  log('Test finished','•');
});

$('#btnStop').addEventListener('click', ()=>{ stopFlag = true; rtsUp(); log('Test aborted','•'); });

// Prepopulate lesson dropdown 1..(KOCH_SEQUENCE.length-1)
(function(){
  const sel = $('#lesson');
  if(sel){
    sel.innerHTML = '';
    const max = Math.max(1, KOCH_SEQUENCE.length - 1);
    for(let i=1;i<=max;i++){
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = String(i);
      sel.appendChild(opt);
    }
    sel.value = '1';
  }
})();

// Grading (compare operator input to hidden preview)
// Gives a percentage - specifically ignores case
// MASSIVELY BROKEN I AM AWARE OF THIS
function normalizeForGrade(s){
  s = (s||'').toUpperCase();
  let out = '';
  for(let i=0;i<s.length;i++){
    const c = s[i];
    const code = c.charCodeAt(0);
    const isDigit = code >= 48 && code <= 57;
    const isUpper = code >= 65 && code <= 90;
    if(isDigit || isUpper) out += c;
  }
  return out;
}
function levenshtein(a,b){
  const m=a.length, n=b.length;
  const dp = new Array(n+1);
  for(let j=0;j<=n;j++) dp[j]=j;
  for(let i=1;i<=m;i++){
    let prev = dp[0];
    dp[0]=i;
    for(let j=1;j<=n;j++){
      const tmp = dp[j];
      const cost = a[i-1]===b[j-1]?0:1;
      const del = dp[j] + 1;
      const ins = dp[j-1] + 1;
      const sub = prev + cost;
      dp[j] = Math.min(del, ins, sub);
      prev = tmp;
    }
  }
  return dp[n];
}
function gradeNow(){
  const answer = document.getElementById('preview').textContent || '';
  const input = document.getElementById('operatorInput').value || '';
  const A = normalizeForGrade(answer);
  const B = normalizeForGrade(input);
  const maxLen = Math.max(A.length, B.length) || 1;
  const dist = levenshtein(A,B);
  const score = Math.max(0, Math.round(100 * (1 - dist / maxLen)));
  document.getElementById('gradeResult').textContent = 'Score: ' + score + '%';
}
document.getElementById('btnGrade').addEventListener('click', gradeNow);

// Initial preview
regenerate();

// Dark mode stuff
(function(){
  const root = document.documentElement;
  const btn = document.getElementById('themeToggle');
  if (!btn) return;

// Load saved choice (default to dark), removed read OS pref...
const saved = localStorage.getItem('theme') || 'dark';
root.setAttribute('data-theme', saved);

  function refreshLabel() {
    const isDark = root.getAttribute('data-theme') === 'dark';
    btn.textContent = isDark ? 'Light mode' : 'Dark mode';
    btn.setAttribute('aria-pressed', String(isDark));
  }
  refreshLabel();

  btn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    refreshLabel();
  });
})();