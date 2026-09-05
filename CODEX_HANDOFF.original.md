# Codex Handoff: Chess Coach App

**Purpose.** Turn the working single-file prototype (`chess-app.jsx`, ~1,870 lines) into a maintainable, tested, installable web app. The prototype is the source of truth for behaviour; the job is engineering, not redesign.

**How to use this file.** Attach `chess-app.jsx` to the repo root as `reference/chess-app.jsx`, paste the "Codex prompt" section into Codex, and let it work through the task list in order. Each task ends with a verifiable checkpoint; do not let Codex skip checkpoints.

---

## 1. What the prototype already does (do not regress)

- **Rules engine**: full legality (castling through-check rules, en passant, promotion, check, checkmate, stalemate, fifty-move, threefold repetition, insufficient material). Verified: perft(3) from start = 8,902; Kiwipete perft(2) = 2,039; position 3 perft(3) = 2,812.
- **Search**: negamax, alpha-beta, iterative deepening with a time budget, quiescence (captures and promotions, depth 4), transposition table keyed on position, piece-square tables with a separate endgame king table. Three levels: Casual (depth 1 + noise), Club (depth 2, 600 ms), Strong (depth 4 target, 2,000 ms budget).
- **Opening book**: 185 lines, 27 families, each node carrying `name, eco, origin, plan`. Engine plays from the book. Book lookup returns the deepest named card, whether the game is still in book, and the candidate replies.
- **Motif recognition**: 27 detectors (tactical, positional, endgame, rules) producing a card with `name, kind, origin, plan` plus a move-specific detail string. Structural motifs fire only when they newly appear (delta against the previous position).
- **Coach panel**: eval bar, opening card, motif feed (last two plies), "better was" note, move annotations (`!`, `?!`, `?`, `??`, `book`), hint (voids rating), full-game review.
- **FIDE-style rating**: floor 1,400; K = 40 until 30 games, 20 under 2,400, 10 permanently after reaching 2,400; expected-score formula with the 400-point cap; engine nominal ratings 900 / 1,350 / 1,800. Takebacks and hints void the game; resignation and abandonment count as losses. Rating persisted via `window.storage` (artifact API) — **replace with `localStorage` / IndexedDB**.
- **UI**: two themes (wooden classic, dark modern), clocks (5+0, 10+0, 15|10), captured pieces with material count, board flip, FEN export, sound, promotion picker, setup / result / review / confirm modals. Piece glyphs use Unicode with `U+FE0E` to force text rendering (keep this, or move to SVG pieces).

---

## 2. Target architecture

```
chess-coach/
├─ package.json            Vite + React 18 + TypeScript, Vitest, ESLint, Prettier
├─ index.html              PWA manifest link, theme-colour meta
├─ public/manifest.webmanifest, icons/
├─ src/
│  ├─ engine/
│  │  ├─ board.ts          types, START, applyMove, genPseudo, legalMoves, isAttacked, posKey, toFEN, fromFEN, sanFor
│  │  ├─ eval.ts           VAL, PST tables, evaluate
│  │  ├─ search.ts         negamax, quiesce, TT, search(), analyse(), chooseAiMove()
│  │  └─ engine.worker.ts  Web Worker wrapper: {type:'search'|'analyse'|'ai', ...} → result
│  ├─ book/
│  │  ├─ lines.ts          BOOK_LINES data (copy verbatim from prototype)
│  │  └─ book.ts           buildBook, bookLookup
│  ├─ coach/
│  │  ├─ motifs.ts         MOTIFS cards + detectMotifs + structure()
│  │  └─ annotate.ts       annotateAll, thresholds
│  ├─ rating/
│  │  ├─ fide.ts           kFactor, expectedScore, ratingUpdate
│  │  └─ store.ts          load/save (localStorage; fall back to memory)
│  ├─ game/
│  │  ├─ state.ts          freshGame, reduceMove, undo, timeouts (pure functions)
│  │  └─ useGame.ts        React hook wiring state, worker, clocks, coach effects
│  ├─ ui/
│  │  ├─ Board.tsx, PlayerBar.tsx, MoveList.tsx, Controls.tsx
│  │  ├─ CoachPanel.tsx, RatingPanel.tsx, Modals.tsx, Card.tsx
│  │  └─ theme.css         the two themes as CSS custom properties (copy from prototype)
│  └─ main.tsx, App.tsx
└─ tests/
   ├─ perft.test.ts        the three perft positions above, exact counts
   ├─ san.test.ts          disambiguation (Nbd7, Ngf3, Ndb5), checks (+/#), castling, promotion
   ├─ book.test.ts         every BOOK_LINES entry is playable and matches sanFor output
   ├─ motifs.test.ts       one fixture per detector (positions listed in §5)
   ├─ rating.test.ts       K-factor ladder, 400-point cap, floor, abandonment
   └─ search.test.ts       mate-in-1 found, time budget respected (±150 ms)
```

**Key engineering moves**
1. Engine and analysis run in a **Web Worker**. The prototype blocks the main thread for up to 2 s; that is the single biggest UX defect to fix.
2. All game logic is **pure TypeScript** with no React imports, so tests need no DOM.
3. Persistence via `localStorage` with a versioned key (`chess-fide-rating-v1`) and a JSON schema check on load.
4. PWA: service worker, offline-first, installable on Android and iOS.

---

## 3. Codex prompt (paste this)

```
You are converting a working single-file React prototype (reference/chess-app.jsx) into a production TypeScript web app. Read CODEX_HANDOFF.md fully first. The prototype is the behavioural spec: reproduce its logic exactly unless the handoff says otherwise.

Work through the tasks in §4 of the handoff in order. After each task, run the checkpoint command and paste the output. Do not proceed if a checkpoint fails. Do not redesign the UI, rename motifs, alter book content, or change rating maths. Use British English in all user-facing strings. Ask me only if the handoff and the prototype genuinely conflict.
```

---

## 4. Task list with checkpoints

**T1. Scaffold.** Vite + React + TS, Vitest, ESLint, Prettier. Copy `reference/chess-app.jsx` in. Checkpoint: `npm run build` passes on an empty App.

**T2. Extract the engine.** Move board/eval/search into `src/engine/` as typed modules. Add `fromFEN`. Checkpoint: `npm test -- perft` shows 20 / 400 / 8,902; 48 / 2,039; 14 / 191 / 2,812.

**T3. SAN and book.** Extract `sanFor`, book data and lookup. Checkpoint: `book.test.ts` plays all 185 lines with zero errors.

**T4. Motifs and annotation.** Extract detectors and `annotateAll`. Checkpoint: `motifs.test.ts` passes the fixtures in §5.

**T5. Rating.** Extract FIDE maths and storage. Checkpoint: `rating.test.ts` passes; reload the page and the rating survives.

**T6. Worker.** Wrap `search`, `analyse`, `chooseAiMove` in a Web Worker with a request-id protocol; cancel stale requests. Checkpoint: the UI stays responsive (a CSS animation keeps running) while Strong thinks.

**T7. Game state and hook.** Pure reducer in `game/state.ts`; `useGame` wires worker, clocks, coach effects, rating effect. Keep the prototype's eval bookkeeping: `evals[ply]` is the evaluation of the position after `ply` moves; move `k` is annotated from `evals[k]` and `evals[k+1]`; the AI's search score is reused as the eval of the position it faced. Checkpoint: play a full game vs Club; annotations appear; review lists turning points.

**T8. UI.** Port components and both themes. Keep the `U+FE0E` glyph trick or switch to inline SVG pieces (preferred, licence-free set such as Cburnett/Wikimedia CC-BY-SA or Lichess's own). Checkpoint: visual parity with the prototype on a 390 px viewport and on desktop.

**T9. PWA and polish.** Manifest, service worker (Workbox or vite-plugin-pwa), icons, `prefers-reduced-motion`, keyboard focus states, ARIA labels on squares (`"e4, white pawn"`). Checkpoint: Lighthouse PWA and accessibility ≥ 90.

**T10. Hardening.** Persist the in-progress game (so a refresh doesn't lose it); rate-limit hints; guard against the worker dying (restart and retry once). Checkpoint: kill the worker in devtools mid-search; the game recovers.

---

## 5. Motif test fixtures (FEN → move → expected key)

| FEN | Move | Expect |
|---|---|---|
| `r3k3/8/N7/8/8/8/8/4K3 w - - 0 1` | Nc7+ | fork |
| `rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 4` | Bg5 | pin |
| `4k3/8/8/8/8/8/4N3/4RK2 w - - 0 1` | Nc3+ | discovered |
| `4k2q/8/8/8/8/8/8/R3K3 w - - 0 1` | Ra8+ | skewer |
| `r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4` | Bxf7+ | sacrifice |
| `rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2` | f4 | gambit, pawnbreak |
| `r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5` | O-O | castle |
| `rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3` | exd6 | enpassant |
| `6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1` | Ra8# | backrank (pass `over.reason = "Checkmate"`) |
| `8/8/8/4k3/8/8/4K3/8 w - - 0 1` | Ke3 | opposition, activeking |
| `r1bqkb1r/pp4pp/2n1pn2/2pp1p2/3P4/2P1PN2/PP3PPP/RNBQKB1R w KQkq - 0 6` | Ne5 | outpost |
| `r1bqkbnr/pppp1ppp/8/4p3/3nP3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 4` | Nxe5 | *no fork* (targets defended) |

Negative cases matter as much as positive ones: the detectors are tuned to stay quiet.

---

## 6. Non-goals

- No online play, accounts, or server. Everything runs client-side.
- No Stockfish/WASM in v1. The custom engine is the point; a Stockfish "analysis" toggle can be a later flag.
- No new openings or motifs during the port. Content changes are a separate ticket.

## 7. Definition of done

`npm test` green, `npm run build` clean, Lighthouse PWA ≥ 90, a Strong game playable on a mid-range Android phone without UI jank, rating and in-progress game survive a reload, and the coach panel reproduces the prototype's cards word for word.
