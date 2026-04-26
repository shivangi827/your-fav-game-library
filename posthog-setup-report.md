<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog into your-fav-game-library. The `posthog-node` SDK was installed and a shared client module created at `src/posthog.ts`. Event tracking was added across all five server-side files covering multiplayer game sessions, leaderboard score submissions, feedback, and error handling.

## Events instrumented

| Event | Description | File |
|---|---|---|
| `room created` | A player created a new multiplayer game room | `src/games/imposter/server.ts`, `src/games/vibe-check/server.ts` |
| `game started` | A multiplayer game session was started by the host | `src/games/imposter/server.ts`, `src/games/vibe-check/server.ts`, `src/games/never-have-i-ever/server.ts`, `src/games/zombie-survival/server.ts` |
| `game completed` | A multiplayer game session reached its final results state | `src/games/imposter/server.ts`, `src/games/vibe-check/server.ts`, `src/games/never-have-i-ever/server.ts`, `src/games/zombie-survival/server.ts` |
| `score submitted` | A player submitted their Gramble (word scramble) score to the leaderboard | `src/server.ts` |
| `score submitted` | A player submitted their CodeCrack score to the leaderboard | `src/server.ts` |
| `feedback submitted` | A user submitted feedback about a game page | `src/server.ts` |

### Additional changes

- **`src/posthog.ts`** — PostHog singleton client (reads `POSTHOG_API_KEY` and `POSTHOG_HOST` from environment).
- **`src/server.ts`** — Express error middleware added to call `posthog.captureException()` for unhandled server errors.
- **`.env`** — `POSTHOG_API_KEY` and `POSTHOG_HOST` written.

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard**: [Analytics basics](https://us.posthog.com/project/398472/dashboard/1512457)
- **Insight**: [Games started per day](https://us.posthog.com/project/398472/insights/N9Mgs5mI)
- **Insight**: [Game completion rate (started → completed)](https://us.posthog.com/project/398472/insights/8F13Rg53)
- **Insight**: [Games started by game type](https://us.posthog.com/project/398472/insights/Wp09zQLn)
- **Insight**: [Scores submitted per day (Gramble & CodeCrack)](https://us.posthog.com/project/398472/insights/foPyjA1U)
- **Insight**: [Feedback ratings distribution](https://us.posthog.com/project/398472/insights/gwXtpMvy)

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
