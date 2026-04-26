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

type Difficulty = 'easy' | 'medium' | 'hard';
type Category = 'bigO' | 'bugspot' | 'pattern';
type TimeMode = 120 | 180 | 300;

const POINTS: Record<string, number> = { easy: 100, medium: 200, hard: 300 };

let allQuestions: Question[] = [];
let selectedDifficulty: Difficulty | null = null;
let selectedCategory: Category | null = null;
let selectedTime: TimeMode | null = null;

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
const promptText = $('prompt-text');
const codeBlock = $('code-block');
const optionsGrid = $('options-grid');
const explanationEl = $('explanation');
const overScore = $('over-score');
const overCorrect = $('over-correct');
const overAccuracy = $('over-accuracy');
const btnPlayAgain = $('btn-play-again');

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
  startBtn.disabled = !(selectedDifficulty && selectedCategory && selectedTime);
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Difficulty buttons
document.querySelectorAll<HTMLButtonElement>('#diff-tabs .setup-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#diff-tabs .setup-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedDifficulty = btn.dataset.diff as Difficulty;
    updateStartBtn();
  });
});

// Category buttons
document.querySelectorAll<HTMLButtonElement>('#cat-tabs .setup-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#cat-tabs .setup-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedCategory = btn.dataset.cat as Category;
    updateStartBtn();
  });
});

// Timer buttons
document.querySelectorAll<HTMLButtonElement>('#time-tabs .btn-time').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#time-tabs .btn-time').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedTime = Number(btn.dataset.time) as TimeMode;
    updateStartBtn();
  });
});

// Start game
startBtn.addEventListener('click', () => {
  if (!selectedDifficulty || !selectedCategory || !selectedTime) return;

  pool = shuffle(
    allQuestions.filter(q => q.difficulty === selectedDifficulty && q.type === selectedCategory)
  );

  if (pool.length === 0) {
    alert('No questions found for that combination. Try a different selection.');
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

function pickNext(): Question {
  // Try unseen questions first
  let unseen = pool.filter((_, i) => !seen.has(i));

  // If all seen, pull in same-difficulty questions from other categories as bonus pool
  if (unseen.length === 0) {
    const bonus = allQuestions.filter(
      q => q.difficulty === selectedDifficulty && q.type !== selectedCategory && !pool.includes(q)
    );
    if (bonus.length > 0) {
      const start = pool.length;
      pool.push(...shuffle(bonus));
      unseen = pool.filter((_, i) => !seen.has(i));
    }
  }

  // If still nothing unseen (exhausted everything), reset seen but avoid the last prompt
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

  const labels = ['A', 'B', 'C', 'D'];
  optionsGrid.innerHTML = q.options.map((opt, i) =>
    `<button class="opt-btn" data-idx="${i}"><span class="opt-label">${labels[i]}</span>${escapeHtml(opt)}</button>`
  ).join('');

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
    score += Math.round((POINTS[q.difficulty] || 100) * mult);
    correct++;
    streak++;
    if (streak > bestStreak) bestStreak = streak;
  } else {
    streak = 0;
  }

  const btns = optionsGrid.querySelectorAll<HTMLButtonElement>('.opt-btn');
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.answer) btn.classList.add('correct');
    if (i === ansIdx && !isCorrect) btn.classList.add('wrong');
  });

  explanationEl.textContent = q.explanation;
  explanationEl.classList.remove('hidden');
  explanationEl.className = `explanation ${isCorrect ? 'explanation-correct' : 'explanation-wrong'}`;

  scoreDisplay.textContent = String(score);
  correctDisplay.textContent = String(correct);
  streakDisplay.textContent = String(streak);

  setTimeout(() => {
    if (timer === null) return;
    loadQuestion();
  }, isCorrect ? 1500 : 2200);
}

function endGame() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }

  overScore.textContent = String(score);
  overCorrect.textContent = `${correct}/${total}`;
  overAccuracy.textContent = total > 0 ? `${Math.round((correct / total) * 100)}%` : '0%';

  showScreen(screenOver);
}

// Play again
btnPlayAgain.addEventListener('click', () => showScreen(screenHome));

// Keyboard shortcuts 1-4
document.addEventListener('keydown', (e) => {
  if (screenGame.classList.contains('hidden') || answered) return;
  const key = parseInt(e.key);
  if (key >= 1 && key <= 4) {
    e.preventDefault();
    selectAnswer(key - 1);
  }
});

// Theme toggle
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

// Load questions
fetch('data/questions.json')
  .then(r => r.json())
  .then((data: Question[]) => { allQuestions = data; })
  .catch(err => console.error('Failed to load questions:', err));
