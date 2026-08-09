(function(){
"use strict";

/* ===================== STATE ===================== */
let CHAPTERS = [];
let MANIFEST = [];
let manifestByKey = {}; // "slug/attempt/num" -> record

let session = null; // current exam session object
let calcInited = false;

const LS = {
  name: 'jee_name',
  overrides: 'jee_overrides',
  progress: 'jee_progress',
  sound: 'jee_sound_enabled',
  theme: 'jee_theme'
};

/* ===================== UTIL ===================== */
function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }
function qKey(slug, attempt, num){ return slug+'/'+attempt+'/'+num; }

function getOverrides(){
  try{ return JSON.parse(localStorage.getItem(LS.overrides) || '{}'); }catch(e){ return {}; }
}
function setOverride(key, dataUrl){
  const o = getOverrides(); o[key] = dataUrl;
  try{ localStorage.setItem(LS.overrides, JSON.stringify(o)); }
  catch(e){ alert('Could not save — your browser storage is full. Try removing older overrides first.'); }
}
function clearOverride(key){
  const o = getOverrides(); delete o[key];
  localStorage.setItem(LS.overrides, JSON.stringify(o));
}
function imageSrcFor(q){
  const key = qKey(q.chapter_slug, q.attempt, q.num);
  const o = getOverrides();
  return o[key] || q.image;
}

function getProgress(){
  try{ return JSON.parse(localStorage.getItem(LS.progress) || '{}'); }catch(e){ return {}; }
}
function saveProgress(slug, entry){
  const p = getProgress();
  if(!p[slug]) p[slug] = {best:0, attempts:0};
  p[slug].best = Math.max(p[slug].best, entry.pct);
  p[slug].attempts += 1;
  p[slug].last = entry;
  localStorage.setItem(LS.progress, JSON.stringify(p));
}

function soundEnabled(){
  const v = localStorage.getItem(LS.sound);
  return v === null ? true : v === '1';
}
function setSoundEnabled(v){
  localStorage.setItem(LS.sound, v ? '1' : '0');
  if (!v) stopFeedbackSounds();
  updateSoundIcon();
  const cb = $('#settings-sound-toggle');
  if (cb) cb.checked = v;
}
function updateSoundIcon(){
  const b = $('#btn-sound-toggle');
  if (b){ b.textContent = soundEnabled() ? '🔊' : '🔇'; b.title = soundEnabled() ? 'Sound on (click to mute)' : 'Sound off (click to unmute)'; }
}

function showScreen(id){
  $all('.screen').forEach(s=>s.classList.remove('active'));
  $('#'+id).classList.add('active');
}

function enterExamFullscreen(){
  if (!document.fullscreenElement && document.documentElement.requestFullscreen){
    document.documentElement.requestFullscreen().catch(()=>{});
  }
}

function applyTheme(theme){
  const resolved = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
  document.documentElement.dataset.theme = resolved;
}
function initThemeChooser(){
  const saved = localStorage.getItem(LS.theme);
  if (saved) applyTheme(saved);
  else $('#modal-theme').classList.add('active');
  $all('[data-theme]').forEach(button=>button.addEventListener('click', ()=>{
    const theme = button.dataset.theme;
    localStorage.setItem(LS.theme, theme);
    applyTheme(theme);
    $('#modal-theme').classList.remove('active');
  }));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ()=>{
    if (localStorage.getItem(LS.theme) === 'system') applyTheme('system');
  });
}

/* ===================== LOAD DATA ===================== */
async function loadData(){
  try{
    const [ch, mf] = await Promise.all([
      fetch('data/chapters.json').then(r=>r.json()),
      fetch('data/manifest.json').then(r=>r.json())
    ]);
    CHAPTERS = ch;
    MANIFEST = mf;
    manifestByKey = {};
    MANIFEST.forEach(q=>{ manifestByKey[qKey(q.chapter_slug,q.attempt,q.num)] = q; });
    return true;
  }catch(e){
    document.body.innerHTML = '<div style="max-width:600px;margin:80px auto;font-family:sans-serif;padding:24px;' +
      'background:#fff3cd;border-radius:12px;color:#5c4500;line-height:1.6">' +
      '<h2>Almost there — one setup step</h2>' +
      '<p>Your browser is blocking local file access (this is normal browser security, not a bug).</p>' +
      '<p><b>Fix:</b> open a terminal in this folder and run:</p>' +
      '<pre style="background:#fff;padding:12px;border-radius:8px;overflow:auto">python3 -m http.server 8000</pre>' +
      '<p>Then open <b>http://localhost:8000</b> in your browser instead of double-clicking index.html.</p>' +
      '</div>';
    return false;
  }
}

/* ===================== WELCOME ===================== */
function initWelcome(){
  const saved = localStorage.getItem(LS.name);
  if (saved){ $('#name-input').value = saved; }
  $('#btn-start').addEventListener('click', ()=>{
    const name = $('#name-input').value.trim() || 'Aspirant';
    localStorage.setItem(LS.name, name);
    goToDashboard();
  });
  $('#name-input').addEventListener('keydown', e=>{ if(e.key==='Enter') $('#btn-start').click(); });
}

/* ===================== DASHBOARD ===================== */
function goToDashboard(){
  const name = localStorage.getItem(LS.name) || 'Aspirant';
  $('#dash-greeting').textContent = 'Hi, ' + name;
  renderDashStats();
  renderChapterGrid();
  showScreen('screen-dashboard');
}

function renderDashStats(){
  const progress = getProgress();
  const chaptersDone = Object.keys(progress).length;
  const totalQ = MANIFEST.length;
  const avgBest = chaptersDone ? Math.round(
    Object.values(progress).reduce((s,p)=>s+p.best,0) / chaptersDone
  ) : 0;
  $('#dash-stats').innerHTML = `
    <div class="dash-stat-card"><div class="dash-stat-num">${totalQ}</div><div class="dash-stat-label">Total Questions</div></div>
    <div class="dash-stat-card"><div class="dash-stat-num">24</div><div class="dash-stat-label">Chapters</div></div>
    <div class="dash-stat-card"><div class="dash-stat-num">${chaptersDone}</div><div class="dash-stat-label">Chapters Practiced</div></div>
    <div class="dash-stat-card"><div class="dash-stat-num">${avgBest}%</div><div class="dash-stat-label">Avg Best Score</div></div>
  `;
}

function renderChapterGrid(){
  const progress = getProgress();
  const grid = $('#chapter-grid');
  grid.innerHTML = '';
  CHAPTERS.forEach(c=>{
    const p = progress[c.slug];
    const best = p ? p.best : 0;
    const card = document.createElement('button');
    card.className = 'chapter-card';
    card.innerHTML = `
      <div class="chapter-idx">CHAPTER ${c.idx}</div>
      <div class="chapter-title">${c.name}</div>
      <div class="chapter-foot">
        <span><span class="chapter-count">${c.total}</span> questions</span>
        <span>${p ? best+'% best' : 'Not started'}</span>
      </div>
      <div class="chapter-progress-bar"><div class="chapter-progress-fill" style="width:${best}%"></div></div>
    `;
    card.addEventListener('click', ()=> openModeModal(c));
    grid.appendChild(card);
  });
}

/* ===================== MODE MODAL ===================== */
let pendingChapter = null;
let pendingAttempt = 'both';

function openModeModal(chapter){
  pendingChapter = chapter;
  pendingAttempt = 'both';
  $('#mode-chapter-title').textContent = chapter.name;
  $all('#attempt-pills .pill').forEach(p=>p.classList.toggle('active', p.dataset.attempt==='both'));
  $('#modal-mode').classList.add('active');
}

function initModeModal(){
  $all('#attempt-pills .pill').forEach(p=>{
    p.addEventListener('click', ()=>{
      $all('#attempt-pills .pill').forEach(x=>x.classList.remove('active'));
      p.classList.add('active');
      pendingAttempt = p.dataset.attempt;
    });
  });
  $('#pick-test').addEventListener('click', ()=>{
    enterExamFullscreen();
    $('#modal-mode').classList.remove('active');
    startExam(pendingChapter, pendingAttempt, 'test');
  });
  $('#pick-quiz').addEventListener('click', ()=>{
    enterExamFullscreen();
    $('#modal-mode').classList.remove('active');
    startExam(pendingChapter, pendingAttempt, 'quiz');
  });
  $all('[data-close]').forEach(b=>{
    b.addEventListener('click', ()=> $('#'+b.dataset.close).classList.remove('active'));
  });
}

/* ===================== EXAM SESSION ===================== */
function startExam(chapter, attemptFilter, mode){
  let qs = MANIFEST.filter(q=> q.chapter_slug === chapter.slug &&
    (attemptFilter === 'both' || q.attempt === attemptFilter));
  qs = qs.slice().sort((a,b)=> a.attempt===b.attempt ? a.num-b.num : (a.attempt==='jan'?-1:1));

  session = {
    chapter, attemptFilter, mode,
    questions: qs,
    answers: qs.map(()=> ({selected:null, numeric:null, status:'notvisited', locked:false, result:null})),
    idx: 0,
    zoom: 100,
    streak: 0,
    secondsLeft: qs.length * 90,
    timerHandle: null,
    submitted: false
  };

  $('#exam-chapter-name').textContent = chapter.name +
    (attemptFilter==='both' ? ' · Jan + April' : attemptFilter==='jan' ? ' · Jan Attempt' : ' · April Attempt');
  $('#exam-mode-badge').textContent = mode.toUpperCase() + ' MODE';
  const videoUrl = attemptFilter === 'april' ? chapter.youtubeApril : chapter.youtubeJan;
  $('#btn-quiz-video').hidden = mode !== 'quiz' || !videoUrl;
  $('#btn-quiz-video').dataset.url = videoUrl || '';

  const name = localStorage.getItem(LS.name) || 'Aspirant';
  $('#candidate-name').textContent = name;
  $('#candidate-avatar').textContent = name.trim()[0].toUpperCase();

  buildPalette();
  renderQuestion(0);
  startTimer();
  updateSoundIcon();
  showScreen('screen-exam');
}

function startTimer(){
  clearInterval(session.timerHandle);
  updateTimerDisplay();
  session.timerHandle = setInterval(()=>{
    session.secondsLeft--;
    updateTimerDisplay();
    if (session.secondsLeft <= 0){
      clearInterval(session.timerHandle);
      finishExam();
    }
  }, 1000);
}
function updateTimerDisplay(){
  const s = Math.max(0, session.secondsLeft);
  const h = String(Math.floor(s/3600)).padStart(2,'0');
  const m = String(Math.floor((s%3600)/60)).padStart(2,'0');
  const sec = String(s%60).padStart(2,'0');
  $('#exam-timer').textContent = `${h}:${m}:${sec}`;
}

function buildPalette(){
  const wrap = $('#question-palette');
  wrap.innerHTML = '';
  session.questions.forEach((q,i)=>{
    const b = document.createElement('button');
    b.className = 'palette-btn';
    b.textContent = i+1;
    b.addEventListener('click', ()=> renderQuestion(i));
    wrap.appendChild(b);
  });
  refreshPalette();
}
function refreshPalette(){
  const btns = $all('.palette-btn');
  session.answers.forEach((a,i)=>{
    const b = btns[i];
    b.className = 'palette-btn ' + a.status + (i===session.idx ? ' current' : '');
  });
  renderStatusCounts();
}

function renderStatusCounts(){
  const counts = {notvisited:0, notanswered:0, answered:0, review:0, 'answered-review':0};
  session.answers.forEach(a=> counts[a.status]++);
  const answeredTotal = counts.answered + counts['answered-review'];
  const reviewTotal = counts.review + counts['answered-review'];
  $('#status-counts').innerHTML = `
    <div class="status-chip sc-answered"><span>Answered</span><span class="n">${answeredTotal}</span></div>
    <div class="status-chip sc-notanswered"><span>Not Answered</span><span class="n">${counts.notanswered}</span></div>
    <div class="status-chip sc-review"><span>Marked</span><span class="n">${reviewTotal}</span></div>
    <div class="status-chip sc-notvisited"><span>Not Visited</span><span class="n">${counts.notvisited}</span></div>
  `;
}

function currentQ(){ return session.questions[session.idx]; }
function currentA(){ return session.answers[session.idx]; }

function renderQuestion(i){
  stopFeedbackSounds();
  // save nothing here (explicit Save & Next handles persistence); just mark visited
  session.idx = i;
  const q = currentQ();
  const a = currentA();
  if (a.status === 'notvisited') a.status = 'notanswered';

  $('#q-index').textContent = `Question ${i+1} of ${session.questions.length}`;
  $('#q-type-badge').textContent = q.type === 'numerical' ? 'Numerical' : q.type==='dropped' ? 'Dropped by NTA' : 'Objective';
  $('#q-dropped-badge').style.display = q.dropped ? 'inline-block' : 'none';

  $('#question-image').src = imageSrcFor(q);
  session.zoom = 100;
  $('#question-image').style.transform = 'scale(1)';
  $('#zoom-level').textContent = '100%';

  const showNumeric = q.type === 'numerical';
  $('#mcq-row').style.display = 'flex';
  $('#numeric-row').style.display = 'flex';
  $('#numeric-hint').style.display = showNumeric ? 'none' : 'block';

  $all('.opt-btn').forEach(b=>{
    b.className = 'opt-btn';
    if (a.selected === Number(b.dataset.opt)) b.classList.add('selected');
  });
  $('#numeric-input').value = a.numeric !== null ? a.numeric : '';

  $('#feedback-banner').className = 'feedback-banner';
  $('#feedback-banner').textContent = '';
  if (session.mode === 'quiz' && a.result){
    showFeedback(a.result, q);
    lockOptions(a);
    $('#btn-save-next').textContent = i < session.questions.length-1 ? 'Next ▸' : 'Finish';
  } else {
    setOptionsDisabled(false);
    $('#btn-save-next').textContent = 'Save & Next';
  }

  $('#btn-prev').disabled = i===0;
  refreshPalette();
}

function setOptionsDisabled(disabled){
  $all('.opt-btn').forEach(b=> b.disabled = disabled);
  $('#numeric-input').disabled = disabled;
}
function lockOptions(a){
  setOptionsDisabled(true);
  const q = currentQ();
  if (q.answer && q.answer>=1 && q.answer<=4){
    $all('.opt-btn').forEach(b=>{
      const n = Number(b.dataset.opt);
      if (n === q.answer) b.classList.add('correct-answer');
      else if (n === a.selected) b.classList.add('wrong-answer');
    });
  }
}

function showFeedback(result, q){
  const el = $('#feedback-banner');
  if (result === 'correct'){
    el.className = 'feedback-banner correct';
    el.textContent = '✓ Correct!';
  } else if (result === 'dropped'){
    el.className = 'feedback-banner dropped';
    el.textContent = 'This question was dropped by NTA' + (q.note ? ' — ' + q.note : '') + '. No penalty either way.';
  } else {
    el.className = 'feedback-banner wrong';
    let correctText = (q.type === 'numerical' && q.answer > 4) ? q.answer : ('Option ' + q.answer);
    el.textContent = '✗ Not quite. Correct answer: ' + correctText;
  }
}

/* ---- answer selection ---- */
function selectOption(n){
  const a = currentA();
  if (a.locked) return;
  a.selected = n;
  a.numeric = null;
  $('#numeric-input').value = '';
  $all('.opt-btn').forEach(b=> b.classList.toggle('selected', Number(b.dataset.opt)===n));
}

function evaluate(q, a){
  if (q.dropped) return 'dropped';
  if (q.answer === null || q.answer === undefined) return 'dropped';
  const hasNumeric = a.numeric !== null && a.numeric !== '' && !isNaN(Number(a.numeric));
  if (hasNumeric){
    const user = Number(a.numeric), correct = Number(q.answer);
    const tol = Math.max(0.01, Math.abs(correct)*0.01);
    return Math.abs(user-correct) <= tol ? 'correct' : 'wrong';
  } else if (a.selected !== null){
    return a.selected === q.answer ? 'correct' : 'wrong';
  }
  return null;
}

const audioStartOffsets = new Map();
let audioAnalysisContext = null;

function stopFeedbackSounds(){
  $all('audio[id^="audio-"]').forEach(el=>{
    el.pause();
    el.currentTime = 0;
  });
}

async function firstAudibleSecond(el){
  if (audioStartOffsets.has(el.src)) return audioStartOffsets.get(el.src);
  try{
    audioAnalysisContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const buffer = await fetch(el.src).then(r=>r.arrayBuffer()).then(b=>audioAnalysisContext.decodeAudioData(b));
    const samples = buffer.getChannelData(0), step = Math.max(1, Math.floor(buffer.sampleRate * 0.02));
    let start = 0;
    for (let i=0; i<samples.length; i+=step){
      let peak = 0;
      for (let j=i; j<Math.min(i+step, samples.length); j++) peak = Math.max(peak, Math.abs(samples[j]));
      if (peak > 0.018){ start = Math.max(0, i / buffer.sampleRate - 0.02); break; }
    }
    audioStartOffsets.set(el.src, start);
    return start;
  }catch(e){ return 0; }
}

async function playFeedbackSound(result){
  if (!soundEnabled()) return;
  let pool;
  if (result === 'correct') pool = [1,5,6];
  else if (result === 'wrong') pool = [2,3];
  else return;
  const n = pool[Math.floor(Math.random()*pool.length)];
  const el = $('#audio-'+n);
  if (el){
    stopFeedbackSounds();
    el.currentTime = await firstAudibleSecond(el);
    if (soundEnabled()) el.play().catch(()=>{});
  }
}

function hasAnyAnswer(a){
  return a.selected !== null || (a.numeric !== null && a.numeric !== '');
}

function showStreakPopup(n){
  const el = $('#streak-popup');
  el.querySelector('.streak-popup-text').textContent = n + ' in a row!';
  el.querySelector('.streak-sub').textContent = n >= 9 ? "You're on fire" : n >= 6 ? 'Excellent streak' : 'Keep it going';
  el.classList.add('show');
  clearTimeout(showStreakPopup._t);
  showStreakPopup._t = setTimeout(()=> el.classList.remove('show'), 2000);
}

function commitAnswer(){
  const q = currentQ();
  const a = currentA();
  const hasAnswer = hasAnyAnswer(a);

  if (session.mode === 'quiz' && hasAnswer && !a.locked){
    const result = evaluate(q, a);
    a.result = result;
    a.locked = true;
    showFeedback(result, q);
    lockOptions(a);
    playFeedbackSound(result);
    if (result === 'correct'){
      session.streak = (session.streak || 0) + 1;
      if (session.streak > 0 && session.streak % 3 === 0) showStreakPopup(session.streak);
    } else if (result === 'wrong'){
      session.streak = 0;
    }
  }

  if (hasAnswer){
    a.status = (a.status === 'review' || a.status === 'answered-review') ? 'answered-review' : 'answered';
  } else if (a.status !== 'review' && a.status !== 'answered-review'){
    a.status = 'notanswered';
  }
  refreshPalette();
}

/* ===================== NAV BUTTONS ===================== */
function initExamControls(){
  $('#btn-quiz-video').addEventListener('click', ()=>{
    const url = $('#btn-quiz-video').dataset.url;
    if (url) window.open(url, '_blank', 'noopener');
  });
  $all('.opt-btn').forEach(b=>{
    b.addEventListener('click', ()=> selectOption(Number(b.dataset.opt)));
  });
  $('#numeric-input').addEventListener('input', e=>{
    currentA().numeric = e.target.value;
    if (e.target.value !== ''){
      currentA().selected = null;
      $all('.opt-btn').forEach(b=> b.classList.remove('selected'));
    }
  });

  $('#btn-clear').addEventListener('click', ()=>{
    const a = currentA();
    if (a.locked) return;
    a.selected = null; a.numeric = null;
    renderQuestion(session.idx);
  });

  $('#btn-save-next').addEventListener('click', ()=>{
    const a = currentA();
    if (session.mode === 'quiz' && !a.locked){
      commitAnswer();               // evaluate, show feedback, lock, play sound
      if (hasAnyAnswer(a)){
        $('#btn-save-next').textContent = session.idx < session.questions.length-1 ? 'Next ▸' : 'Finish';
        return; // stay put so the feedback is actually seen
      }
    }
    commitAnswer();
    goNext();
    $('#btn-save-next').textContent = 'Save & Next';
  });
  $('#btn-mark-review').addEventListener('click', ()=>{
    const a = currentA();
    const hasAnswer = hasAnyAnswer(a);
    commitAnswer();
    a.status = hasAnswer ? 'answered-review' : 'review';
    refreshPalette();
    goNext();
  });
  $('#btn-prev').addEventListener('click', ()=>{
    commitAnswer();
    if (session.idx > 0) renderQuestion(session.idx-1);
  });
  $('#btn-submit-test').addEventListener('click', ()=>{
    commitAnswer();
    if (confirm('Submit and finish this session? You can review all answers afterwards.')){
      finishExam();
    }
  });

  $('#zoom-in').addEventListener('click', ()=> setZoom(session.zoom+15));
  $('#zoom-out').addEventListener('click', ()=> setZoom(session.zoom-15));

  $('#btn-exam-settings').addEventListener('click', ()=> $('#modal-settings').classList.add('active'));
  $('#btn-settings').addEventListener('click', ()=> $('#modal-settings').classList.add('active'));
  $('#btn-sound-toggle').addEventListener('click', ()=>{
    const now = !soundEnabled();
    setSoundEnabled(now);
    toast(now ? 'Sound on' : 'Sound off');
  });

  $('#btn-results-dashboard').addEventListener('click', goToDashboard);
}

function goNext(){
  if (session.idx < session.questions.length-1){
    renderQuestion(session.idx+1);
  } else {
    if (confirm("That's the last question. Submit now?")) finishExam();
  }
}

function setZoom(v){
  session.zoom = Math.max(50, Math.min(220, v));
  $('#question-image').style.transform = `scale(${session.zoom/100})`;
  $('#zoom-level').textContent = session.zoom+'%';
}

/* ===================== FINISH / RESULTS ===================== */
function finishExam(){
  clearInterval(session.timerHandle);
  if (session.submitted) { renderResults(); showScreen('screen-results'); return; }
  session.submitted = true;

  // finalize evaluation for every question (test mode never evaluated live)
  session.answers.forEach((a,i)=>{
    const q = session.questions[i];
    if (a.result === null || a.result === undefined){
      a.result = evaluate(q, a);
    }
  });

  const total = session.questions.length;
  const correct = session.answers.filter(a=>a.result==='correct').length;
  const wrong = session.answers.filter(a=>a.result==='wrong').length;
  const dropped = session.answers.filter(a=>a.result==='dropped').length;
  const unattempted = total - correct - wrong - dropped;
  const scored = total - dropped;
  const pct = scored>0 ? Math.round((correct/scored)*100) : 100;

  saveProgress(session.chapter.slug, {pct, correct, wrong, unattempted, dropped, total, mode:session.mode, ts:Date.now()});

  session.lastResult = {total, correct, wrong, unattempted, dropped, pct};
  renderResults();
  showScreen('screen-results');
}

function renderResults(){
  const r = session.lastResult;
  $('#results-title').textContent = session.chapter.name + ' — ' + session.mode.toUpperCase() + ' MODE RESULT';
  $('#results-stats').innerHTML = `
    <div class="rs-card"><div class="rs-num navy">${r.pct}%</div><div class="rs-label">Score</div></div>
    <div class="rs-card"><div class="rs-num green">${r.correct}</div><div class="rs-label">Correct</div></div>
    <div class="rs-card"><div class="rs-num red">${r.wrong}</div><div class="rs-label">Wrong</div></div>
    <div class="rs-card"><div class="rs-num grey">${r.unattempted}</div><div class="rs-label">Unattempted</div></div>
    <div class="rs-card"><div class="rs-num" style="color:#c9971d">${r.dropped}</div><div class="rs-label">Dropped by NTA</div></div>
  `;
  const rev = $('#results-review');
  rev.innerHTML = '';
  session.questions.forEach((q,i)=>{
    const a = session.answers[i];
    const badgeClass = a.result==='correct'?'ok':a.result==='wrong'?'no':a.result==='dropped'?'drop':'skip';
    const badgeText = a.result==='correct'?'✓':a.result==='wrong'?'✗':a.result==='dropped'?'—':'?';
    const given = (a.numeric !== null && a.numeric !== '') ? a.numeric
                : a.selected ? ('Option ' + a.selected)
                : 'No answer';
    const correctTxt = (q.type === 'numerical' && q.answer > 4) ? q.answer : (q.answer ? ('Option ' + q.answer) : 'N/A');
    const div = document.createElement('div');
    div.className = 'rr-item';
    div.innerHTML = `
      <div class="rr-badge ${badgeClass}">${badgeText}</div>
      <img class="rr-thumb" src="${imageSrcFor(q)}">
      <div class="rr-body">
        <div class="rr-title">${q.attempt.toUpperCase()} · Q${q.num}</div>
        <div class="rr-sub">Your answer: ${given} &nbsp;|&nbsp; Correct: ${correctTxt}${a.result==='dropped' ? ' (dropped by NTA)' : ''}</div>
      </div>
    `;
    rev.appendChild(div);
  });
}

/* ===================== ASK AI ===================== */
async function captureScreenShot(){
  // Real full-screen/tab capture using the browser's native picker --
  // this is the only web-standard way to grab actual on-screen pixels
  // (there's no API that lets a page silently screenshot itself or
  // the OS screen without the user explicitly choosing what to share).
  if (!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) return null;
  const stream = await navigator.mediaDevices.getDisplayMedia({video:{cursor:'never'}, audio:false});
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  await video.play();
  await new Promise(r=> requestAnimationFrame(()=> requestAnimationFrame(r))); // let a real frame land
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  stream.getTracks().forEach(t=> t.stop());
  return await new Promise(res=> canvas.toBlob(res, 'image/png'));
}

async function captureQuestionImageOnly(){
  const img = $('#question-image');
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return await new Promise(res=> canvas.toBlob(res, 'image/png'));
}

function initAskAI(){
  $('#btn-ask-ai').addEventListener('click', async ()=>{
    // Open the tab first, synchronously, while the click's user-gesture is
    // still "fresh" -- otherwise the async screenshot step below can make
    // browsers treat window.open() as an unrequested popup and block it.
    window.open('https://chatgpt.com/', '_blank');

    let blob = null, usedFullScreen = false;
    try{
      blob = await captureScreenShot();
      usedFullScreen = !!blob;
    }catch(e){
      // user cancelled the "what do you want to share" picker, or it's
      // unsupported/blocked -- fall through to the simpler fallback below
    }
    if (!blob){
      try{ blob = await captureQuestionImageOnly(); }catch(e2){ blob = null; }
    }

    if (blob){
      let copied = false;
      if (navigator.clipboard && window.ClipboardItem){
        try{
          await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
          copied = true;
        }catch(e3){ copied = false; }
      }
      if (copied){
        toast(usedFullScreen
          ? 'Screenshot copied! Switch to the ChatGPT tab and paste it with Ctrl+V (Cmd+V on Mac).'
          : "Couldn't capture the full screen, so the question image was copied instead — paste it into ChatGPT.");
      } else {
        // clipboard access is blocked/unsupported in this browser -- always
        // fall back to a real downloaded file so the user still ends up
        // with something they can actually attach in ChatGPT.
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'question-screenshot.png'; a.click();
        setTimeout(()=> URL.revokeObjectURL(url), 10000);
        toast('Your browser blocked clipboard copy, so the screenshot downloaded instead — drag it into the ChatGPT tab, or use the paperclip/attach button there.');
      }
    } else {
      toast('Screenshot capture was cancelled or unsupported here — take a manual screenshot and paste it into ChatGPT.');
    }
  });
}
let toastTimer=null;
function toast(msg){
  const t = $('#ai-toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.remove('show'), 5000);
}

/* ===================== SETTINGS ===================== */
function initSettings(){
  function refreshThemeSettings(){
    const selected = localStorage.getItem(LS.theme) || 'system';
    $all('[data-settings-theme]').forEach(b=>b.classList.toggle('active', b.dataset.settingsTheme === selected));
  }
  refreshThemeSettings();
  $all('[data-settings-theme]').forEach(button=>button.addEventListener('click', ()=>{
    const theme = button.dataset.settingsTheme;
    localStorage.setItem(LS.theme, theme);
    applyTheme(theme);
    refreshThemeSettings();
    toast('Theme updated.');
  }));
  $('#settings-name').value = localStorage.getItem(LS.name) || '';
  $('#settings-save-name').addEventListener('click', ()=>{
    const v = $('#settings-name').value.trim() || 'Aspirant';
    localStorage.setItem(LS.name, v);
    if ($('#candidate-name')) $('#candidate-name').textContent = v;
    toast('Name updated.');
  });

  $('#settings-sound-toggle').checked = soundEnabled();
  $('#settings-sound-toggle').addEventListener('change', e=>{
    setSoundEnabled(e.target.checked);
  });

  $('#settings-clear-progress').addEventListener('click', ()=>{
    if (confirm('This clears all saved scores and progress. Continue?')){
      localStorage.removeItem(LS.progress);
      toast('Progress cleared.');
      renderDashStats(); renderChapterGrid();
    }
  });

  // fix-a-question tool
  const chSel = $('#fix-chapter');
  CHAPTERS.forEach(c=>{
    const o = document.createElement('option'); o.value=c.slug; o.textContent=c.name; chSel.appendChild(o);
  });
  function refreshQNums(){
    const slug = chSel.value, attempt = $('#fix-attempt').value;
    const qs = MANIFEST.filter(q=>q.chapter_slug===slug && q.attempt===attempt).sort((a,b)=>a.num-b.num);
    const qSel = $('#fix-qnum');
    qSel.innerHTML = '';
    qs.forEach(q=>{
      const o = document.createElement('option'); o.value=q.num; o.textContent='Q'+q.num; qSel.appendChild(o);
    });
  }
  chSel.addEventListener('change', refreshQNums);
  $('#fix-attempt').addEventListener('change', refreshQNums);
  if (CHAPTERS.length) refreshQNums();

  let fixCtx=null, fixQ=null, dragStart=null, dragRect=null, fixImgObj=null;

  $('#fix-load').addEventListener('click', ()=>{
    const slug = chSel.value, attempt = $('#fix-attempt').value, num = Number($('#fix-qnum').value);
    fixQ = manifestByKey[qKey(slug,attempt,num)];
    if (!fixQ) return;
    $('#fix-editor').style.display = 'block';
    const canvas = $('#fix-canvas');
    fixCtx = canvas.getContext('2d');
    fixImgObj = new Image();
    fixImgObj.onload = ()=>{
      canvas.width = fixImgObj.naturalWidth;
      canvas.height = fixImgObj.naturalHeight;
      canvas.style.width = Math.min(560, fixImgObj.naturalWidth) + 'px';
      fixCtx.drawImage(fixImgObj,0,0);
      dragRect = null;
    };
    fixImgObj.src = imageSrcFor(fixQ);
  });

  const canvas = $('#fix-canvas');
  canvas.addEventListener('mousedown', e=>{
    const r = canvas.getBoundingClientRect();
    const scale = canvas.width / r.width;
    dragStart = {x:(e.clientX-r.left)*scale, y:(e.clientY-r.top)*scale};
  });
  canvas.addEventListener('mousemove', e=>{
    if (!dragStart) return;
    const r = canvas.getBoundingClientRect();
    const scale = canvas.width / r.width;
    const cur = {x:(e.clientX-r.left)*scale, y:(e.clientY-r.top)*scale};
    dragRect = {
      x: Math.min(dragStart.x, cur.x), y: Math.min(dragStart.y, cur.y),
      w: Math.abs(cur.x-dragStart.x), h: Math.abs(cur.y-dragStart.y)
    };
    fixCtx.drawImage(fixImgObj,0,0);
    fixCtx.strokeStyle = '#1565c0'; fixCtx.lineWidth = 3;
    fixCtx.strokeRect(dragRect.x, dragRect.y, dragRect.w, dragRect.h);
  });
  canvas.addEventListener('mouseup', ()=> dragStart=null);

  $('#fix-use-selection').addEventListener('click', ()=>{
    if (!dragRect || dragRect.w<10 || dragRect.h<10){ toast('Drag a selection box on the image first.'); return; }
    const out = document.createElement('canvas');
    out.width = dragRect.w; out.height = dragRect.h;
    out.getContext('2d').drawImage(fixImgObj, dragRect.x, dragRect.y, dragRect.w, dragRect.h, 0,0, dragRect.w, dragRect.h);
    const dataUrl = out.toDataURL('image/png');
    setOverride(qKey(fixQ.chapter_slug, fixQ.attempt, fixQ.num), dataUrl);
    toast('Crop saved for Q'+fixQ.num+'.');
    if (session && currentQ() === fixQ) renderQuestion(session.idx);
  });

  $('#fix-upload').addEventListener('change', e=>{
    const file = e.target.files[0];
    if (!file || !fixQ) return;
    const reader = new FileReader();
    reader.onload = ev=>{
      setOverride(qKey(fixQ.chapter_slug, fixQ.attempt, fixQ.num), ev.target.result);
      toast('Replacement image saved for Q'+fixQ.num+'.');
      fixImgObj.src = ev.target.result;
      if (session && currentQ() === fixQ) renderQuestion(session.idx);
    };
    reader.readAsDataURL(file);
  });

  $('#fix-reset').addEventListener('click', ()=>{
    if (!fixQ) return;
    clearOverride(qKey(fixQ.chapter_slug, fixQ.attempt, fixQ.num));
    fixImgObj.src = fixQ.image;
    toast('Reset to the original image.');
    if (session && currentQ() === fixQ) renderQuestion(session.idx);
  });
}

/* ===================== INIT ===================== */
document.addEventListener('DOMContentLoaded', async ()=>{
  const ok = await loadData();
  if (!ok) return;
  initWelcome();
  initThemeChooser();
  initModeModal();
  initExamControls();
  initAskAI();
  initSettings();

  const saved = localStorage.getItem(LS.name);
  if (saved){
    // skip straight to dashboard on repeat visits
    goToDashboard();
  }
});

})();
