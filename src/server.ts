import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';

import { setupImposter } from './games/imposter/server';
import { setupVibeCheck } from './games/vibe-check/server';
import { setupNeverHaveIEver } from './games/never-have-i-ever/server';
import { setupZombieSurvival } from './games/zombie-survival/server';

import { getScores, addScore, isConfigured, ScoreEntry } from './games/word-scramble/sheets';
import { getCodeCrackScores, addCodeCrackScore, CodeCrackScoreEntry } from './games/codecrack/sheets';

import { addFeedback, FeedbackEntry } from './feedback-sheets';
import { sendFeedbackEmail } from './feedback-email';
import posthog from './posthog';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 4 * 1024,
  pingTimeout: 20_000,
  pingInterval: 25_000,
});

app.use(express.static(path.join(__dirname, '..', 'public')));

/* ---------------- PAGES ---------------- */

app.get('/imposter', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'imposter', 'index.html'));
});

app.get('/vibe-check', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'vibe-check', 'index.html'));
});

app.get('/never-have-i-ever', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'never-have-i-ever', 'index.html'));
});

app.get('/zombie-survival', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'zombie-survival', 'index.html'));
});

app.get('/word-scramble', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'word-scramble', 'index.html'));
});

app.get('/codecrack', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'codecrack', 'index.html'));
});

app.get('/bounty-of-the-lost', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'bounty-of-the-lost', 'index.html'));
});

/* ---------------- SCORES + APIs (UNCHANGED) ---------------- */

app.get('/api/gramble/configured', async (_req, res) => {
  const ok = await isConfigured();
  res.json({ configured: ok });
});

app.get('/api/gramble/scores/:gameMode/:timeMode', async (req, res) => {
  const gameMode = req.params.gameMode;
  const timeMode = Number(req.params.timeMode);

  if (!['regular', 'french', 'dev'].includes(gameMode)) {
    res.status(400).json({ error: 'Invalid game mode' });
    return;
  }

  if (![60, 90, 120].includes(timeMode)) {
    res.status(400).json({ error: 'Invalid time mode' });
    return;
  }

  const scores = await getScores(gameMode, timeMode);
  res.json(scores);
});

app.post('/api/gramble/scores', express.json(), async (req, res) => {
  const { gameMode, timeMode, name, score, words, streak, date } = req.body as ScoreEntry;

  if (!['regular', 'french', 'dev'].includes(gameMode)) {
    res.status(400).json({ error: 'Invalid game mode' });
    return;
  }

  if (![60, 90, 120].includes(timeMode) || !name || typeof score !== 'number') {
    res.status(400).json({ error: 'Invalid data' });
    return;
  }

  const sanitizedName = String(name).slice(0, 20).trim();

  const ok = await addScore({
    gameMode,
    timeMode,
    name: sanitizedName,
    score: Math.max(0, Math.round(score)),
    words: Math.max(0, Math.round(words)),
    streak: Math.max(0, Math.round(streak)),
    date: String(date).slice(0, 20),
  });

  posthog.capture({
    distinctId: sanitizedName,
    event: 'score submitted',
    properties: {
      game: 'gramble',
      game_mode: gameMode,
      time_mode: timeMode,
      score,
      words,
      streak,
    },
  });

  res.json({ ok });
});

/* ---------------- FEEDBACK ---------------- */

app.post('/api/feedback', express.json(), async (req, res) => {
  const { rating, message, page } = req.body as Partial<FeedbackEntry>;

  if (!rating || rating < 1 || rating > 5) {
    res.status(400).json({ error: 'Rating must be 1-5' });
    return;
  }

  const entry: FeedbackEntry = {
    rating: Math.round(rating),
    message: String(message || '').slice(0, 1000).trim(),
    page: String(page || '').slice(0, 100),
    date: new Date().toISOString(),
  };

  const [ok] = await Promise.all([
    addFeedback(entry),
    sendFeedbackEmail(entry),
  ]);

  posthog.capture({
    distinctId: 'anonymous_feedback',
    event: 'feedback submitted',
    properties: {
      rating: entry.rating,
      page: entry.page,
    },
  });

  res.json({ ok });
});

/* ---------------- SOCKET GAMES ---------------- */

setupImposter(io);
setupVibeCheck(io.of('/vibe-check'));
setupNeverHaveIEver(io.of('/never-have-i-ever'));
setupZombieSurvival(io.of('/zombie-survival'));

/* ---------------- ERROR HANDLER ---------------- */

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  posthog.captureException(err instanceof Error ? err : new Error(String(err)));
  res.status(500).json({ error: 'Internal server error' });
});

/* ---------------- START ---------------- */

const PORT = Number(process.env.PORT) || 3000;

server.listen(PORT, () => {
  console.log(`Your fav Game Library running on http://localhost:${PORT}`);
});