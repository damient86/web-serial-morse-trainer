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

    //auto refresh for kicking off rx monitoring when on key tab

    if (!document.getElementById('card-transmit')?.hidden) {
  startMonitor();
}

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
  monitorRunning = false;
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
function normalizeForGrade(s){
  // Case-insensitive only; do NOT alter spaces/tabs/newlines
  // Strip CR so Windows newlines (\r\n) don’t misalign vs preview text
  return (s || '').toUpperCase().replace(/\r/g, '');
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
  const answerEl = document.getElementById('preview');
  const inputEl  = document.getElementById('operatorInput');
  if (!answerEl || !inputEl) return;

  const A = normalizeForGrade(answerEl.textContent || '');
  const B = normalizeForGrade(inputEl.value || '');

  let correct = 0;
  for (let i = 0; i < A.length; i++) {
    if (B[i] === A[i]) correct++;            // exact match at this position
  }
  const total = Math.max(1, A.length);
  const score = Math.round((correct / total) * 100);

  document.getElementById('gradeResult').textContent =
    `Score: ${score}% (${correct}/${A.length})`;
}
document.getElementById('btnGrade').addEventListener('click', gradeNow);

// Initial preview
regenerate();

// Play a single character using existing timing & keying (no logic changes)
async function playChar(ch){
  if(!port){ alert('Connect serial first.'); return; }
  const wpm = parseInt($('#wpm').value,10) || 20;
  const eff = parseInt($('#effWpm').value,10) || wpm;
  const t = timings(wpm, eff);
  const pat = encodeChar(String(ch).toUpperCase());
  if (!pat) return; // unknown char
  for (let i = 0; i < pat.length; i++) await sendSymbol(pat[i], t);
  await sleep(t.charGap - t.intra); // standard char gap
}

// Build buttons for every character in the current lesson/test set
function renderCharPad(){
  const pad = document.getElementById('charPad');
  if (!pad) return;
  pad.innerHTML = '';
  const lesson = parseInt($('#lesson').value, 10);
  const chars = kochChars(lesson);      // uses your existing lesson order
  for (const ch of chars) {
    if (ch === ' ') continue;           // skip space
    const btn = document.createElement('button');
    btn.className = 'btn secondary';
    btn.style.margin = '4px';
    btn.textContent = ch;
    btn.addEventListener('click', () => playChar(ch));
    pad.appendChild(btn);
  }
}

// Hook into existing UI without changing it
document.addEventListener('DOMContentLoaded', renderCharPad);
$('#lesson').addEventListener('input', renderCharPad);
$('#btnGenerate').addEventListener('click', renderCharPad);

// EVERYTHING BELOW THIS POINT IS TO DO WITH THE TRANSMIT TRAINER
// --- Key Monitor (DSR) & optional loopback (RTS) ---
let monitorRunning = false, lastDSR = null;

// Build a reverse Morse map once (prefer your existing MORSE if available)
function getMorseReverse(){
  if (window.__MORSE_REV__) return window.__MORSE_REV__;
  const src = (typeof MORSE !== 'undefined') ? MORSE : {
    'A':'.-','B':'-...','C':'-.-.','D':'-..','E':'.','F':'..-.','G':'--.',
    'H':'....','I':'..','J':'.---','K':'-.-','L':'.-..','M':'--','N':'-.',
    'O':'---','P':'.--.','Q':'--.-','R':'.-.','S':'...','T':'-','U':'..-',
    'V':'...-','W':'.--','X':'-..-','Y':'-.--','Z':'--..',
    '1':'.----','2':'..---','3':'...--','4':'....-','5':'.....',
    '6':'-....','7':'--...','8':'---..','9':'----.','0':'-----',
    '.':'.-.-.-', ',':'--..--', '?':'..--..', '/':'-..-.', '=':'-...-'
  };
  const rev = {};
  for (const [ch, code] of Object.entries(src)) rev[code] = ch;
  window.__MORSE_REV__ = rev;
  return rev;
}

// Decoder state
let rxPattern = '';            // accumulating .- for current character
let rxLastEdgeTs = null;       // ms timestamp of last edge (UP↔DOWN)
let rxLastGapWordAdded = false;

// Append a decoded character (or '?') to the textarea
function commitCharFromPattern(){
  const rxEl = document.getElementById('rxText');
  if (!rxEl || !rxPattern) return;
  const MORSE_REV = getMorseReverse();
  const ch = MORSE_REV[rxPattern] || '?';
  rxEl.value += ch;
  rxPattern = '';
  rxLastGapWordAdded = false;  // allow a space after committing a char
}

// Ensure exactly one word-space when gap is long enough
function ensureWordSpace(){
  const rxEl = document.getElementById('rxText');
  if (!rxEl || rxLastGapWordAdded) return;
  const v = rxEl.value;
  if (!v || v.endsWith(' ')) { rxLastGapWordAdded = true; return; }
  rxEl.value += ' ';
  rxLastGapWordAdded = true;
}

async function startMonitor(){
  if (!port || monitorRunning) return;
  const ledEl = document.getElementById('led');
  const keyStateEl = document.getElementById('keyState');
  if (!ledEl || !keyStateEl) return; // transmit card not visible in DOM

  monitorRunning = true;
  log('Key monitor started','•');
  while (monitorRunning && port){
  try{
    // Timing based on current UI settings (falls back safely)
    const wpm = parseInt(document.getElementById('wpm')?.value, 10) || 20;
    const eff = parseInt(document.getElementById('effWpm')?.value, 10) || wpm;
    const t = typeof timings === 'function'
      ? timings(wpm, eff)
      : { dit: 1200/Math.max(1,wpm), dah: 3*(1200/Math.max(1,wpm)), intra: (1200/Math.max(1,wpm)), charGap: 3*(1200/Math.max(1,wpm)), wordGap: 7*(1200/Math.max(1,wpm)) };

    const now = performance.now();
    if (rxLastEdgeTs == null) rxLastEdgeTs = now;

    const sig = await port.getSignals();
    const dsr = !!(sig.dataSetReady || sig.dsr); // Chrome reports dataSetReady

    // ----- edge detection (DOWN->UP gives a symbol duration) -----
    const prev = lastDSR;
    if (prev !== null && prev !== dsr){
      const dur = now - rxLastEdgeTs;

      if (prev === true){        // key was DOWN, we just released -> measure tone length
        // dot vs dash threshold ~ 2 dits (midpoint between 1 and 3)
        const sym = (dur < (2 * t.dit)) ? '.' : '-';
        rxPattern += sym;
      } else {
        // prev was UP, we just pressed; we handle gaps continuously below
      }
      rxLastEdgeTs = now;
    }

    // ----- continuous gap handling (commit char / word) -----
    if (!dsr){ // key UP (silence)
      const gap = now - rxLastEdgeTs;
      const charThresh = (t.charGap + t.intra) / 2;      // between element gap and char gap
      const wordThresh = (t.wordGap + t.charGap) / 2;    // between char gap and word gap

      if (rxPattern && gap >= charThresh){
        commitCharFromPattern();                         // finish the character
      }
      if (gap >= wordThresh){
        ensureWordSpace();                               // add one space max
      }
    } else {
      // key DOWN: we're inside a tone; no spacing decisions here
      rxLastGapWordAdded = false;                        // allow a space after this tone ends
    }

    // ----- existing UI updates / loopback (unchanged) -----
    if (lastDSR !== dsr){
      lastDSR = dsr;
      if (dsr){ ledEl.classList.add('on'); keyStateEl.textContent = 'Key: DOWN'; }
      else    { ledEl.classList.remove('on'); keyStateEl.textContent = 'Key: UP'; }
      if (document.getElementById('loopToSounder')?.checked){
        if (dsr) await rtsDown(); else await rtsUp();
      }
    }
  } catch(e){ /* ignore transient errors */ }

  // Sampling rate (edge timing): 10ms is nicer for 20WPM dits (~60ms)
  await sleep(10);
}

  log('Key monitor stopped','•');
}

// --- Tabs: switch between Trainer and Transmit (left column) ---
function showTrainer(){
  const a = document.getElementById('card-trainer');
  const b = document.getElementById('card-transmit');
  if (a) a.hidden = false;
  if (b) b.hidden = true;
  monitorRunning = false; // stop DSR polling when leaving Transmit
  // update tab aria-selected
  document.getElementById('tabTrainer')?.setAttribute('aria-selected','true');
  document.getElementById('tabTransmit')?.setAttribute('aria-selected','false');
  document.getElementById('tabTrainer2')?.setAttribute('aria-selected','true');
  document.getElementById('tabTransmit2')?.setAttribute('aria-selected','false');
}

function showTransmit(){
  const a = document.getElementById('card-trainer');
  const b = document.getElementById('card-transmit');
  if (a) a.hidden = true;
  if (b) b.hidden = false;
  startMonitor(); // begin DSR polling when entering Transmit
  // update tab aria-selected
  document.getElementById('tabTrainer')?.setAttribute('aria-selected','false');
  document.getElementById('tabTransmit')?.setAttribute('aria-selected','true');
  document.getElementById('tabTrainer2')?.setAttribute('aria-selected','false');
  document.getElementById('tabTransmit2')?.setAttribute('aria-selected','true');
}
// wire both tab bars
document.getElementById('tabTrainer') ?.addEventListener('click', showTrainer);
document.getElementById('tabTransmit')?.addEventListener('click', showTransmit);
document.getElementById('tabTrainer2')?.addEventListener('click', showTrainer);
document.getElementById('tabTransmit2')?.addEventListener('click', showTransmit);

document.getElementById('rxClear')?.addEventListener('click', ()=>{
  const rxEl = document.getElementById('rxText');
  if (rxEl) rxEl.value = '';
  rxPattern = '';
  rxLastGapWordAdded = false;
});


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