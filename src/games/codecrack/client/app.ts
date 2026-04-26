interface Question {
  type: string;
  topic: string;
  difficulty: string;
  prompt: string;
  code?: string;
  options: string[];
  answer: number;
  explanation: string;
}

interface LeaderboardEntry {
  name: string;
  score: number;
  correct: number;
  total: number;
  streak: number;
}

type Category = 'bigO' | 'bugspot' | 'pattern';
type TimeMode = 60 | 120 | 180;

const POINTS: Record<string, number> = { easy: 100, medium: 200, hard: 300 };
const DIFF_LABEL: Record<string, string> = { easy: '1× pts', medium: '2× pts', hard: '3× pts' };
const DIFF_CLASS: Record<string, string> = { easy: 'badge-easy', medium: 'badge-medium', hard: 'badge-hard' };

let allQuestions: Question[] = [];
let selectedCategory: Category | null = null;
let selectedTime: TimeMode | null = null;
let activeLbTab: TimeMode = 60;

let pool: Question[] = [];
let seen: Set<number> = new Set();
let lastPrompt = '';
let currentQ: Question | null = null;
let score = 0;
let correct = 0;
let streak = 0;
let bestStreak = 0;
let total = 0;
let timeLeft = 0;
let timer: number | null = null;
let answered = false;

const $ = (id: string) => document.getElementById(id)!;
const screenHome = $('screen-home');
const screenGame = $('screen-game');
const screenOver = $('screen-over');
const startBtn = $('start-btn') as HTMLButtonElement;
const timerDisplay = $('timer-display');
const scoreDisplay = $('score-display');
const correctDisplay = $('correct-display');
const streakDisplay = $('streak-display');
const countdownFill = $('countdown-fill');
const diffBadge = $('diff-badge');
const promptText = $('prompt-text');
const codeBlock = $('code-block');
const optionsGrid = $('options-grid');
const explanationEl = $('explanation');
const btnSkip = $('btn-skip') as HTMLButtonElement;
const overScore = $('over-score');
const overCorrect = $('over-correct');
const overAccuracy = $('over-accuracy');
const btnPlayAgain = $('btn-play-again');
const homeLbList = $('home-lb-list');
const homeLbEmpty = $('home-lb-empty');
const overLbList = $('over-lb-list');
const overLbEmpty = $('over-lb-empty');
const modalName = $('modal-name');
const inputName = $('input-name') as HTMLInputElement;
const btnNameConfirm = $('btn-name-confirm') as HTMLButtonElement;
const btnNameSkip = $('btn-name-skip') as HTMLButtonElement;

// ── Utilities ──────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function showScreen(screen: HTMLElement) {
  [screenHome, screenGame, screenOver].forEach(s => s.classList.add('hidden'));
  screen.classList.remove('hidden');
}

function updateStartBtn() {
  startBtn.disabled = !(selectedCategory && selectedTime);
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Leaderboard ────────────────────────────────────

async function fetchLeaderboard(category: string, timeMode: number): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(`/api/codecrack/scores/${category}/${timeMode}`);
    if (!res.ok) return [];
    return await res.json() as LeaderboardEntry[];
  } catch {
    return [];
  }
}

function renderHomeLb(entries: LeaderboardEntry[]) {
  if (entries.length === 0) {
    homeLbList.innerHTML = '';
    homeLbEmpty.textContent = 'No scores yet. Play a round!';
    homeLbEmpty.classList.remove('hidden');
    return;
  }
  homeLbEmpty.classList.add('hidden');
  homeLbList.innerHTML = entries
    .map((e, i) => `<li class="lb-item"><span class="lb-rank">${i + 1}</span><span class="lb-name">${escapeHtml(e.name)}</span><span class="lb-score">${e.score}</span></li>`)
    .join('');
}

function renderOverLb(entries: LeaderboardEntry[], highlightName: string) {
  if (entries.length === 0) {
    overLbList.innerHTML = '';
    overLbEmpty.classList.remove('hidden');
    return;
  }
  overLbEmpty.classList.add('hidden');
  overLbList.innerHTML = entries
    .map((e, i) => `<li class="lb-item${e.name === highlightName ? ' lb-highlight' : ''}"><span class="lb-rank">${i + 1}</span><span class="lb-name">${escapeHtml(e.name)}</span><span class="lb-score">${e.score}</span></li>`)
    .join('');
}

async function refreshHomeLb() {
  if (!selectedCategory) {
    homeLbList.innerHTML = '';
    homeLbEmpty.textContent = 'Pick a category to see scores.';
    homeLbEmpty.classList.remove('hidden');
    return;
  }
  const entries = await fetchLeaderboard(selectedCategory, activeLbTab);
  renderHomeLb(entries);
}

// ── Setup buttons ──────────────────────────────────

document.querySelectorAll<HTMLButtonElement>('#cat-tabs .setup-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#cat-tabs .setup-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedCategory = btn.dataset.cat as Category;
    updateStartBtn();
    refreshHomeLb();
  });
});

document.querySelectorAll<HTMLButtonElement>('#time-tabs .btn-time').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#time-tabs .btn-time').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedTime = Number(btn.dataset.time) as TimeMode;
    // Snap the leaderboard tab to match the selected time
    activeLbTab = selectedTime;
    document.querySelectorAll<HTMLButtonElement>('.lb-tab').forEach(t => {
      t.classList.toggle('active', Number(t.dataset.time) === activeLbTab);
    });
    refreshHomeLb();
    updateStartBtn();
  });
});

document.querySelectorAll<HTMLButtonElement>('.lb-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.lb-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeLbTab = Number(btn.dataset.time) as TimeMode;
    refreshHomeLb();
  });
});

// ── Start game ─────────────────────────────────────

startBtn.addEventListener('click', () => {
  if (!selectedCategory || !selectedTime) return;

  pool = shuffle(allQuestions.filter(q => q.type === selectedCategory));

  if (pool.length === 0) {
    alert('No questions found for that category. Try a different selection.');
    return;
  }

  currentQ = null;
  seen = new Set();
  lastPrompt = '';
  score = 0;
  correct = 0;
  streak = 0;
  bestStreak = 0;
  total = 0;
  timeLeft = selectedTime;
  answered = false;

  scoreDisplay.textContent = '0';
  correctDisplay.textContent = '0';
  streakDisplay.textContent = '0';
  timerDisplay.textContent = formatTime(timeLeft);

  countdownFill.style.transition = 'none';
  countdownFill.style.width = '100%';
  void countdownFill.offsetWidth;
  countdownFill.style.transition = 'width 1s linear';

  showScreen(screenGame);
  loadQuestion();

  const totalTime = selectedTime;
  timer = window.setInterval(() => {
    timeLeft--;
    timerDisplay.textContent = formatTime(timeLeft);
    countdownFill.style.width = `${(timeLeft / totalTime) * 100}%`;
    countdownFill.classList.toggle('timer-danger', timeLeft <= 10);
    if (timeLeft <= 0) endGame();
  }, 1000);
});

// ── Question cycling ───────────────────────────────

function pickNext(): Question {
  let unseen = pool.filter((_, i) => !seen.has(i));

  if (unseen.length === 0) {
    const bonus = allQuestions.filter(q => q.type !== selectedCategory && !pool.includes(q));
    if (bonus.length > 0) {
      pool.push(...shuffle(bonus));
      unseen = pool.filter((_, i) => !seen.has(i));
    }
  }

  if (unseen.length === 0) {
    seen.clear();
    unseen = pool.filter(q => q.prompt !== lastPrompt);
    if (unseen.length === 0) unseen = [...pool];
  }

  const pick = unseen[Math.floor(Math.random() * unseen.length)];
  const idx = pool.indexOf(pick);
  if (idx >= 0) seen.add(idx);
  lastPrompt = pick.prompt;
  return pick;
}

function loadQuestion() {
  const q = pickNext();
  currentQ = q;
  answered = false;

  diffBadge.textContent = DIFF_LABEL[q.difficulty] ?? '';
  diffBadge.className = `diff-badge ${DIFF_CLASS[q.difficulty] ?? ''}`;

  promptText.textContent = q.prompt;

  if (q.code) {
    codeBlock.textContent = q.code;
    codeBlock.classList.remove('hidden');
  } else {
    codeBlock.textContent = '';
    codeBlock.classList.add('hidden');
  }

  explanationEl.textContent = '';
  explanationEl.classList.add('hidden');
  btnSkip.classList.remove('hidden');

  const labels = ['A', 'B', 'C', 'D'];
  optionsGrid.innerHTML = q.options
    .map((opt, i) => `<button class="opt-btn" data-idx="${i}"><span class="opt-label">${labels[i]}</span>${escapeHtml(opt)}</button>`)
    .join('');

  optionsGrid.querySelectorAll<HTMLButtonElement>('.opt-btn').forEach(btn => {
    btn.addEventListener('click', () => selectAnswer(Number(btn.dataset.idx)));
  });
}

function selectAnswer(ansIdx: number) {
  if (answered || timer === null || !currentQ) return;
  answered = true;
  total++;

  const q = currentQ;
  const isCorrect = ansIdx === q.answer;

  if (isCorrect) {
    const mult = 1 + Math.floor(streak / 3) * 0.25;
    score += Math.round((POINTS[q.difficulty] ?? 100) * mult);
    correct++;
    streak++;
    if (streak > bestStreak) bestStreak = streak;
  } else {
    streak = 0;
  }

  optionsGrid.querySelectorAll<HTMLButtonElement>('.opt-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.answer) btn.classList.add('correct');
    if (i === ansIdx && !isCorrect) btn.classList.add('wrong');
  });

  explanationEl.textContent = q.explanation;
  explanationEl.classList.remove('hidden');
  explanationEl.className = `explanation ${isCorrect ? 'explanation-correct' : 'explanation-wrong'}`;
  btnSkip.classList.add('hidden');

  scoreDisplay.textContent = String(score);
  correctDisplay.textContent = String(correct);
  streakDisplay.textContent = String(streak);

  setTimeout(() => {
    if (timer === null) return;
    loadQuestion();
  }, isCorrect ? 1500 : 2200);
}

// ── Skip ───────────────────────────────────────────

btnSkip.addEventListener('click', () => {
  if (answered || timer === null || !currentQ) return;
  answered = true;
  total++;
  streak = 0;
  scoreDisplay.textContent = String(score);
  streakDisplay.textContent = String(streak);
  btnSkip.classList.add('hidden');
  setTimeout(() => {
    if (timer === null) return;
    loadQuestion();
  }, 300);
});

// ── End game ───────────────────────────────────────

function endGame() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }

  overScore.textContent = String(score);
  overCorrect.textContent = `${correct}/${total}`;
  overAccuracy.textContent = total > 0 ? `${Math.round((correct / total) * 100)}%` : '0%';

  showNameModal();
}

// ── Name modal ─────────────────────────────────────

function showNameModal() {
  inputName.value = '';
  modalName.classList.remove('hidden');
  setTimeout(() => inputName.focus(), 50);
}

function hideNameModal() {
  modalName.classList.add('hidden');
}

async function submitAndShowOver(name: string) {
  hideNameModal();

  if (name && selectedCategory && selectedTime) {
    try {
      await fetch('/api/codecrack/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          difficulty: selectedCategory,
          timeMode: selectedTime,
          name,
          score,
          correct,
          total,
          streak: bestStreak,
          date: new Date().toISOString().slice(0, 10),
        }),
      });
    } catch {
      // continue even if submission fails
    }
  }

  const entries = selectedCategory && selectedTime
    ? await fetchLeaderboard(selectedCategory, selectedTime)
    : [];

  if (entries.length > 0) {
    renderOverLb(entries, name);
  } else {
    overLbList.innerHTML = '';
    overLbEmpty.classList.remove('hidden');
  }

  showScreen(screenOver);
}

btnNameConfirm.addEventListener('click', () => {
  const name = inputName.value.trim().slice(0, 20);
  if (!name) {
    inputName.classList.add('input-error');
    setTimeout(() => inputName.classList.remove('input-error'), 800);
    return;
  }
  submitAndShowOver(name);
});

btnNameSkip.addEventListener('click', () => {
  submitAndShowOver('');
});

inputName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const name = inputName.value.trim().slice(0, 20);
    if (name) submitAndShowOver(name);
  }
});

// ── Play again ─────────────────────────────────────

btnPlayAgain.addEventListener('click', () => {
  showScreen(screenHome);
  refreshHomeLb();
});

// ── Keyboard shortcuts 1–4 ─────────────────────────

document.addEventListener('keydown', (e) => {
  if (screenGame.classList.contains('hidden') || answered) return;
  const key = parseInt(e.key);
  if (key >= 1 && key <= 4) {
    e.preventDefault();
    selectAnswer(key - 1);
  }
});

// ── Theme toggle ───────────────────────────────────

const THEME_KEY = 'codecrack.theme';
const themeToggle = $('theme-toggle');
const themeIcon = $('theme-icon');

function applyTheme(light: boolean) {
  document.body.classList.toggle('theme-light', light);
  themeIcon.innerHTML = light ? '&#x1F319;' : '&#x2600;&#xFE0F;';
  localStorage.setItem(THEME_KEY, light ? 'light' : 'dark');
}

const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme === 'light') applyTheme(true);

themeToggle.addEventListener('click', () => {
  applyTheme(!document.body.classList.contains('theme-light'));
});

// ── Load questions ─────────────────────────────────

fetch('data/questions.json')
  .then(r => r.json())
  .then((data: Question[]) => {
    allQuestions = data;
    refreshHomeLb();
  })
  .catch(err => console.error('Failed to load questions:', err));
