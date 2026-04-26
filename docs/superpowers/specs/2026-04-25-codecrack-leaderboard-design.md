# CodeCrack — Timer Modes & Leaderboard Design

**Date:** 2026-04-25

## Overview

Add 1min/2min/3min timer options, remove difficulty selection, show difficulty badge + multiplier on each question, add a skip button, and introduce a leaderboard scoped by category + time mode.

---

## 1. Home Screen

- **Remove** the difficulty row (Easy / Medium / Hard buttons) entirely.
- **Timer options** change from 120/180/300s to **60/120/180s** (1:00 / 2:00 / 3:00), keeping the same Sprint/Flow/Marathon labels (or equivalent).
- Category row (Bug Spot / Big O / Pattern) stays unchanged.
- **Leaderboard panel** added below the setup controls:
  - Time-mode tabs: `1 min` | `2 min` | `3 min`
  - Top-10 list for the currently selected **category** + active tab's time mode
  - If no category is selected, show: *"Pick a category to see scores."*
  - Scores display: rank, name, score

---

## 2. Game Screen

- **Difficulty badge** shown per question (top-right of question card), styled as a pill:
  - Easy → `1× pts` (green/subtle)
  - Medium → `2× pts` (amber)
  - Hard → `3× pts` (red/accent)
- Scoring logic is unchanged — the badge just makes the existing `100/200/300` points visible.
- **Skip button** below the answer options:
  - Resets streak (treated as wrong answer)
  - No points awarded
  - No explanation shown
  - Advances immediately to next question

---

## 3. Game Over Screen

- **Name modal** appears first (before game-over stats are revealed):
  - Simple text input, max 20 characters
  - "Submit Score" button → POSTs to `/api/codecrack/scores`
  - Closing/dismissing without a name skips saving (score is lost)
- Game-over stats remain: Score / Correct / Accuracy
- **Leaderboard panel** below stats:
  - Shows top 10 for the category + time mode just played
  - Player's new entry highlighted if it made the top 10
- "Play Again" returns to home screen

---

## 4. Server & DB

### DB (no migration needed)

The existing `codecrack_scores` table has a `difficulty TEXT NOT NULL` column. This column is **repurposed to store category** (`bigO`, `bugspot`, `pattern`). The schema is otherwise unchanged:

```sql
CREATE TABLE IF NOT EXISTS codecrack_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  difficulty TEXT NOT NULL,   -- repurposed: stores category (bigO/bugspot/pattern)
  time_mode INTEGER NOT NULL,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  total INTEGER NOT NULL,
  streak INTEGER NOT NULL,
  date TEXT NOT NULL
)
```

### API Routes (existing, updated validation only)

`GET /api/codecrack/scores/:difficulty/:timeMode`
- `:difficulty` now validates against `['bigO', 'bugspot', 'pattern']`
- `:timeMode` now validates against `[60, 120, 180]`

`POST /api/codecrack/scores`
- Same field validations updated to match above

### Client

- `TimeMode` type changes from `120 | 180 | 300` to `60 | 120 | 180`
- `selectedDifficulty` state removed; `selectedCategory` becomes the sole filter for question pool and leaderboard
- Question pool filter: `allQuestions.filter(q => q.type === selectedCategory)` (no difficulty filter)
- On game end: show name modal → on submit, POST score → fetch updated leaderboard → show game-over screen
- On home screen: fetch leaderboard when category or active time tab changes

---

## 5. Data Flow

```
Home screen load
  → user picks category + time
  → fetch GET /api/codecrack/scores/:category/:timeMode
  → render leaderboard tabs

Game ends
  → show name modal
  → POST /api/codecrack/scores (category, timeMode, name, score, correct, total, streak, date)
  → fetch GET /api/codecrack/scores/:category/:timeMode
  → show game-over screen with leaderboard, highlight new entry if top 10

Play Again
  → return to home screen
```

---

## 6. Files to Change

| File | Change |
|------|--------|
| `public/codecrack/index.html` | Remove difficulty row; update timer buttons; add leaderboard panel; add name modal |
| `src/games/codecrack/client/app.ts` | Remove difficulty state; update TimeMode type; add skip logic; add difficulty badge rendering; add name modal + score submit + leaderboard fetch |
| `src/server.ts` | Update validation: difficulty → category values; timeMode → [60,120,180] |
| `src/db.ts` | Update timeMode validation comment (no schema change) |

---

## Out of Scope

- No changes to question data or `questions.ts`
- No changes to other games
- No new DB tables
