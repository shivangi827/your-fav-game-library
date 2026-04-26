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
let idx = 0;
let score = 0;
let correct = 0;
let total = 0;
let timeLeft = 0;
let timer: number | null = null;
let answered = false;

const $ = (id: string) => document.getElementById(id)!;
const lobby = $('lobby');
const arena = $('arena');
const gameOver = $('game-over');
const startBtn = $('start-btn') as HTMLButtonElement;
const timerDisplay = $('timer-display');
const scoreDisplay = $('score-display');
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
  [lobby, arena, gameOver].forEach(s => s.classList.add('hidden'));
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
document.querySelectorAll<HTMLButtonElement>('#diff-tabs .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#diff-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedDifficulty = btn.dataset.diff as Difficulty;
    updateStartBtn();
  });
});

// Category buttons
document.querySelectorAll<HTMLButtonElement>('#cat-tabs .cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#cat-tabs .cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedCategory = btn.dataset.cat as Category;
    updateStartBtn();
  });
});

// Timer buttons
document.querySelectorAll<HTMLButtonElement>('#time-tabs .time-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#time-tabs .time-btn').forEach(b => b.classList.remove('active'));
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

  idx = 0;
  score = 0;
  correct = 0;
  total = 0;
  timeLeft = selectedTime;
  answered = false;

  scoreDisplay.textContent = '0';
  timerDisplay.textContent = formatTime(timeLeft);

  showScreen(arena);
  loadQuestion();

  timer = window.setInterval(() => {
    timeLeft--;
    timerDisplay.textContent = formatTime(timeLeft);
    if (timeLeft <= 0) endGame();
  }, 1000);
});

function loadQuestion() {
  if (idx >= pool.length) {
    pool = shuffle([...pool]);
    idx = 0;
  }

  const q = pool[idx];
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
    `<button class="opt-btn" data-idx="${i}"><span class="opt-label">${labels[i]}</span> ${escapeHtml(opt)}</button>`
  ).join('');

  optionsGrid.querySelectorAll<HTMLButtonElement>('.opt-btn').forEach(btn => {
    btn.addEventListener('click', () => selectAnswer(Number(btn.dataset.idx)));
  });
}

function selectAnswer(ansIdx: number) {
  if (answered || timer === null) return;
  answered = true;
  total++;

  const q = pool[idx];
  const isCorrect = ansIdx === q.answer;

  if (isCorrect) {
    score += POINTS[q.difficulty] || 100;
    correct++;
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

  setTimeout(() => {
    if (timer === null) return;
    idx++;
    loadQuestion();
  }, isCorrect ? 1200 : 2000);
}

function endGame() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }

  overScore.textContent = String(score);
  overCorrect.textContent = `${correct}/${total}`;
  overAccuracy.textContent = total > 0 ? `${Math.round((correct / total) * 100)}%` : '0%';

  showScreen(gameOver);
}

// Play again
btnPlayAgain.addEventListener('click', () => showScreen(lobby));

// Keyboard shortcuts 1-4
document.addEventListener('keydown', (e) => {
  if (arena.classList.contains('hidden') || answered) return;
  const key = parseInt(e.key);
  if (key >= 1 && key <= 4) {
    e.preventDefault();
    selectAnswer(key - 1);
  }
});

// Load questions
fetch('data/questions.json')
  .then(r => r.json())
  .then((data: Question[]) => { allQuestions = data; })
  .catch(err => console.error('Failed to load questions:', err));
