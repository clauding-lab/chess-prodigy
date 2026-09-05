# Chess Prodigy Implementation Plan

> Execution update, 5 September 2026 (BDT): the local production candidate is implemented. See ../../verification/release-report.md for current measured checks and physical-device limitations. The text below records the accepted requirements and historical plan.

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. If the owner explicitly chooses delegation, use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking. This document plans the production port; current prototype corrections are already verified separately.

**Goal:** Build Chess Prodigy as a maintainable, tested, accessible, installable browser chess coach.

**Architecture:** Extract the corrected single-file prototype into pure typed modules. Keep React responsible for presentation and coordination, a Web Worker responsible for calculation, and one validated local save responsible for game/rating consistency.

**Tech Stack:** React 18, Vite, strict TypeScript, Vitest, React Testing Library, Playwright, ESLint, Prettier, vite-plugin-pwa. The existing lockfile pins the preview dependencies; verify compatibility before adding tooling.

**Spec:** docs/superpowers/specs/2026-09-05-chess-prodigy-design.md

## Global constraints

- Product name: Chess Prodigy. British English. BDT (UTC+6) in reports and user-facing dates.
- Preserve both themes, all 185 opening entries and all 27 motif cards/prose.
- Keep the custom engine, three difficulty settings, rating floor/K ladder and documented draw policy.
- No backend, accounts, paid services, new chess content or Stockfish.
- Corrected reference/chess-app.jsx overrides reference/chess-app.original.jsx.
- Every task includes a failing behavioral test, minimal implementation and a green checkpoint.
- Do not continue after a failed checkpoint. Do not weaken the expected behavior to copy a prototype defect.
- No Lighthouse PWA score. Accessibility >=90 plus manual keyboard checks, installation/offline/update tests.
- No automatic publish, push or merge. Review the governance drafts before the first commit.
- Retain original files and existing verification evidence. Do not remove regression tests during extraction.

## Current state — not future work

The local Vite preview renders reference/chess-app.jsx. The seven reviewed code bugs have regression coverage; the handoff's eighth issue is corrected. Tests use a test-only loader to access the monolith; replace that seam with ordinary imports as modules are extracted. React 18.3.1 and Vite 7.3.6 are currently installed. This is not a completed PWA or persistent game implementation.

## File map

~~~
src/
  engine/types.ts, board.ts, eval.ts, search.ts, engine.worker.ts
  book/lines.ts, book.ts
  coach/motifs.ts, annotate.ts
  rating/fide.ts
  game/types.ts, state.ts, useGame.ts
  worker/protocol.ts, client.ts
  storage/schema.ts, store.ts
  ui/Board.tsx, PlayerBar.tsx, MoveList.tsx, Controls.tsx
  ui/CoachPanel.tsx, RatingPanel.tsx, Modals.tsx, Card.tsx, theme.css
  App.tsx, main.tsx
public/icons/icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png
tests/engine/, tests/coach/, tests/game/, tests/storage/, tests/worker/, tests/browser/
~~~

## Task 1 — Extract a typed, tested rules and search engine

**Files:** create src/engine/types.ts, board.ts, eval.ts, search.ts; tests/engine/board.test.ts, search.test.ts; tsconfig.json, eslint.config.js, .prettierrc.json. Modify package.json. Keep the preview entry active.

**Interfaces:** board exposes START, applyMove, legalMoves, genPseudo, legalFilter, inCheck, isAttacked, kingSq, posKey, toFEN, fromFEN, sanFor, sameMove, insufficientMaterial and coordinate helpers. eval exposes VAL, PST, nonPawnMaterial, evaluate. search exposes search, analyse, chooseAiMove and MATE.

- [ ] Add TypeScript/ESLint/Prettier compatible with the lockfile and scripts typecheck, lint and format:check. Use strict checking, noEmit, ES2022, DOM and ESNext modules; isolated worker globals are declared in the worker file.
- [ ] Define the shared types before extraction:
~~~ts
export type Color = "w" | "b";
export type PieceKind = "p" | "n" | "b" | "r" | "q" | "k";
export type Piece = `${Color}${PieceKind}`;
export type Level = "casual" | "club" | "strong";
export interface Position {
  board: (Piece | null)[];
  turn: Color;
  castling: Record<"K" | "Q" | "k" | "q", boolean>;
  ep: number | null;
  halfmove: number;
  fullmove: number;
}
export interface Move {
  from: number; to: number;
  promo?: "q" | "r" | "b" | "n";
  capture?: Piece; ep?: boolean; double?: boolean; castle?: "K" | "Q";
}
export interface SearchResult { move: Move | null; score: number; depth: number; }
export interface AiResult { move: Move | null; score: number | null; book: boolean; }
~~~
- [ ] Port the existing behavioral engine tests to normal imports. Add invalid-FEN rejection and roundtrip tests before implementing fromFEN:
~~~ts
expect(toFEN(fromFEN(toFEN(START())))).toBe(toFEN(START()));
expect(() => fromFEN("8/8/8/8/8/8/8/8 w - - 0 1")).toThrow();
expect(() => fromFEN("not a position")).toThrow();
~~~
- [ ] Run npm test -- tests/engine and confirm failure from missing typed modules.
- [ ] Copy engine boundaries from the corrected reference: coordinate helpers through sameMove into board; VAL through evaluate into eval; MATE through chooseAiMove into search. Add explicit types rather than any or @ts-nocheck. Import helpers across the three modules; no React imports.
- [ ] Implement fromFEN by requiring six fields, eight ranks of exactly eight squares, known piece letters, one king per colour, a valid side, unique recognised castling letters, a valid en-passant rank and finite nonnegative counters (fullmove >=1). Reject adjacent kings, pawns on terminal ranks, inconsistent castling pieces and impossible en-passant structure. Do not reject a raw en-passant square merely because no legal capture exists; repetition normalization is separate.
- [ ] Preserve checked quiescence, quiet evasions, terminal scores and deadline checks. Scope/reset search state on every request with try/finally so an error cannot poison the next request. Give the worker a monotonic timer (performance.now) for search budgets; game clocks retain persistent epoch timestamps.
- [ ] Add SAN fixtures Nbd7/Ngf3/Ndb5, castling through check, pinned en passant, all promotion types, mate/stalemate and the reviewed repetition cycle.
- [ ] Checkpoint: npm test -- tests/engine; npm run typecheck; npm run lint; npm run build. Required move counts: start 20/400/8902; Kiwipete 48/2039; position 3 14/191/2812. Search finds mate in one and respects 100 ms +150 ms tolerance on this machine.
- [ ] Review the diff; prepare a Conventional Commit only under the governance-approved commit policy.

## Task 2 — Extract opening content, motifs and coach annotations

**Files:** src/book/lines.ts, book.ts; src/coach/motifs.ts, annotate.ts; tests/coach/book.test.ts, motifs.test.ts, annotate.test.ts, fixtures.ts.
**Consumes:** Task 1 board/eval types and functions.
**Produces:** BOOK_LINES; bookLookup(sans); MOTIFS; detectMotifs(before, move, after, over); annotateAll(game).

- [ ] Define readonly OpeningLine tuples and MotifKey as the exact existing 27 keys; define Motif { key, detail, side }, PositionEval { score, best } and typed move-history entries matching the corrected reference.
- [ ] Port all 185 line-playability checks and the 12 handoff fixtures unchanged. Add a content comparison that reads immutable original content via the existing test loader.
- [ ] Run the tests and observe missing-module failures.
- [ ] Copy BOOK_LINES into lines.ts unchanged; copy buildBook/bookLookup into book.ts. Copy MOTIFS and detector/structure helpers into motifs.ts with imports from engine. Extract annotateAll without changing its evaluation index contract.
- [ ] Make a fixture matrix for every MOTIF_ORDER key. Existing rows cover fork, pin, discovered, skewer, sacrifice, gambit, pawnbreak, castle, enpassant, backrank, opposition, activeking and outpost. Add legal FEN+move positive and negative fixtures for the remaining keys: doublecheck, underpromotion, promotion, castleQ, fianchetto, duo, seventh, openfile, passed, bishops, iqp, doubled, minority, check.
- [ ] Write each missing fixture before changing detector behavior. Fixtures must prove legal moves with sanFor. Exercise structural deltas by comparing before/after; an already-present motif must remain quiet. Do not change detector meaning to satisfy an incorrectly chosen fixture.
- [ ] Test annotation indexing with literal scores:
~~~ts
// One White move: position 0 = +100, position 1 = -200.
// Its 300-point drop is a blunder. A Black move must invert both scores.
const annotated = annotateAll({
  ...gameFixture,
  evals: {0: {score:100,best:null}, 1:{score:-200,best:null}}
});
expect(annotated.hist[0].ann).toBe("??");
~~~
gameFixture is a real one-move game built with Task 1 legalMoves/applyMove; no invented move objects. Also test missing evaluations remain unannotated, book moves are marked book, and terminal mate scores are not interpreted as a zero evaluation.
- [ ] Checkpoint: npm test -- tests/coach; npm run typecheck; npm run lint; npm run build. All 27 detectors have named positive/negative coverage; 185 lines and all prose unchanged.

## Task 3 — Make game transitions, clocks and rating settlement pure

**Files:** src/game/types.ts, state.ts; src/rating/fide.ts; tests/game/state.test.ts, rating.test.ts.
**Consumes:** Position, Move, Level, motif/book functions.
**Produces:** freshGame(setup, now, id), reduceGame(game, action), settleClock(game, now); kFactor, expectedScore, ratingUpdate.

- [ ] Define Game with id, revision, st, hist, keys, clocks, clockAt, setup, started, rated, hintUsed, over, evals and ratingApplied. Give Setup playerColor, level and time. Move/history entries retain pre-move clock snapshots so takebacks have a deliberate tested clock policy.
- [ ] Define a tagged action contract:
~~~ts
type Action =
 | {type:"move"; move:Move; book:boolean; now:number}
 | {type:"tick"; now:number}
 | {type:"undo"; now:number}
 | {type:"resign"; now:number}
 | {type:"hint"}
 | {type:"evaluation"; gameId:string; revision:number; ply:number; value:PositionEval};
~~~
Game/Action types live in game/types.ts. PositionEval comes from coach/annotate.ts. Fresh-game IDs and timestamps are supplied by useGame, never generated inside pure reducers.
- [ ] Port the approved clock/promotion/repetition/rating tests to these functions; add delayed move submission before any timer callback:
~~~ts
const g = {...freshGame(setup,0,"g1"), started:true,
  clocks:{w:1000,b:1000}, clockAt:0};
const m = legalMoves(g.st).find(m=>m.from===52 && m.to===36)!;
const next = reduceGame(g,{type:"move",move:m,book:false,now:1500});
expect(next.over?.reason).toBe("Time out");
expect(next.hist).toHaveLength(0);
~~~
- [ ] Run the state tests red; extract transitions from the corrected reference. Settle time before move/resignation; reject illegal/stale moves; increment revision on every position replacement. Keep no-clock and first-move behavior explicit.
- [ ] Test result settlement with a unique game receipt: invoke settlement twice, rating.games increases once. Undo reverses only that game's receipt and sets rated=false. Hints and takebacks never produce a new rated result.
- [ ] Test rating: K=40 until 30 games, then 20, permanent 10 after reaching 2400; capped expected score; 1400 floor; actual zero/partial delta; resignation and abandonment; BDT date near midnight. Preserve calculated ratings from the reference.
- [ ] Checkpoint: npm test -- tests/game; npm run typecheck; npm run lint. No React, timers, localStorage or audio calls inside pure modules.

## Task 4 — Run calculation in a cancellable worker

**Files:** src/worker/protocol.ts, client.ts; src/engine/engine.worker.ts; tests/worker/client.test.ts; tests/browser/worker.spec.ts.
**Consumes:** engine/search and board types.
**Produces:** EngineClient.request(request), cancel(), dispose(), typed success/error replies.

- [ ] Declare an exact wire contract:
~~~ts
type Request = {
 requestId:number; gameId:string; revision:number; position:Position;
} & (
 {type:"search"|"analyse"; depth:number; ms:number}
 | {type:"ai"; level:Level; bookSans:string[]}
);
type Reply = {requestId:number; gameId:string; revision:number} & (
 {ok:true; result:SearchResult | AiResult}
 | {ok:false; message:string}
);
~~~
- [ ] Write tests that an older game/revision cannot update a new position, cancellation rejects pending work with AbortError, and disposal releases the worker and watchdog.
- [ ] Run those tests red. Implement the worker using the typed search functions:
~~~ts
self.onmessage = (event: MessageEvent<Request>) => {
 const r=event.data;
 try {
  const result=r.type==="ai"
    ? chooseAiMove(r.position,r.level,r.bookSans)
    : search(r.position,r.depth,r.ms);
  self.postMessage({requestId:r.requestId,gameId:r.gameId,revision:r.revision,ok:true,result});
 } catch(error) {
  self.postMessage({requestId:r.requestId,gameId:r.gameId,revision:r.revision,
    ok:false,message:error instanceof Error?error.message:"Engine calculation failed"});
 }
};
~~~
- [ ] Implement the client using new Worker(new URL("../engine/engine.worker.ts",import.meta.url),{type:"module"}). Store pending request+resolver+watchdog; validate all reply identity fields. Terminate/recreate to cancel active synchronous work. Reject promises and clear busy flags on every exit.
- [ ] Retry one still-current request after unexpected worker error/watchdog; second failure stays visible with Retry. Intentional cancellation never consumes the failure retry allowance.
- [ ] Browser test: begin non-book Strong search, flip board and open/close a card while thinking. A 50 ms heartbeat should have no gap >250 ms on the named desktop test environment; record physical-device performance separately.
- [ ] Checkpoint: npm test -- tests/worker; npm run test:browser -- worker; npm run typecheck; npm run build. Terminate the worker mid-search and observe exactly one recovery attempt; restart/undo never applies old results.

## Task 5 — Connect React and port the accessible interface

**Files:** src/game/useGame.ts; src/ui components from file map; src/App.tsx, main.tsx; tests/game/useGame.test.tsx; tests/browser/accessibility.spec.ts; modify index.html.
**Consumes:** Task 2 coaching, Task 3 state, Task 4 worker client.
**Produces:** a playable production UI with controls, state and coaching wired to background work.

- [ ] Port existing real React interaction regressions to the new hook/UI. Add out-of-order AI/hint/review results using a controllable worker boundary while keeping real reducers. Verify replacement with equal history length cannot accept old work.
- [ ] Run tests red. Implement useGame with one EngineClient lifetime, reducer dispatch, visibility/focus clock settling, priority queue and cleanup. Copy eval bookkeeping precisely; analyse book positions when AI returns score=null.
- [ ] Extract the two themes and components. Replace inline root style injection with theme.css, retaining dimensions/colours and correcting only accessibility defects supported by tests.
- [ ] Implement orientation once and consume it everywhere:
~~~ts
const topColor:Color=flipped?"w":"b";
const bottomColor:Color=flipped?"b":"w";
const displayedSquare=(displayIndex:number)=>flipped?63-displayIndex:displayIndex;
~~~
- [ ] Board uses buttons with accessible labels and a single tab stop. Arrow keys move focus in display coordinates; Enter/Space select or commit a legal move; Escape cancels selection. Maintain a visible focus ring and a status live region.
- [ ] Dialogs use role=dialog, aria-modal=true and labelled headings; trap/restore focus and prevent background interaction. Promotion choices have piece names. Confirmation, review and setup close cleanly; result remains until an explicit action.
- [ ] Preserve sound on forward move/new result only, not on sound preference changes, undo or game reset. Cover the first move in a new game and React StrictMode.
- [ ] Browser checks: play by keyboard, select underpromotion, cancel confirmation, close review and restart during queued analysis; run all existing desktop/mobile journeys.
- [ ] Checkpoint: npm test; npm run test:browser; npm run typecheck; npm run lint; npm run build. Capture both themes at 390x844 and 1280x1000 with animations disabled after a real legal move. Remove the preview entry from index.html only after parity passes; retain reference and verification files.

## Task 6 — Persist rating, live game and preferences safely

**Files:** src/storage/schema.ts, store.ts; tests/storage/store.test.ts; tests/browser/persistence.spec.ts; modify useGame.ts.
**Consumes:** typed Game and rating/preference objects.
**Produces:** loadSavedState(storage), saveState(storage,envelope) and explicit saved/unsaved/corrupt results.

- [ ] Write tests for absent storage, malformed JSON, invalid board/history/rating, quota failure, valid reload, stale legacy data, duplicate game settlement and timeout while closed.
- [ ] Use one authoritative envelope:
~~~ts
interface SavedState {
 version:1;
 rating:Rating;
 game:Game;
 preferences:{theme:"wood"|"dark";sound:boolean;coach:boolean;flipped:boolean};
}
const SAVE_KEY="chess-prodigy-state-v1";
~~~
Rating type lives in rating/fide.ts. Validate unknown input before casting. Replay legal history and compare reconstructed board, castling, counters and repetition counts to the stored state. Validate current rating/receipt consistency.
- [ ] Run storage tests red. Implement load/save with try/catch and explicit status. Import validated chess-fide-rating-v1 only when no new-format envelope exists. Do not silently overwrite an invalid newer save.
- [ ] Write game result and rating receipt together. Save at state transitions and hide/pagehide; clock display ticks must not cause disk writes every 200 ms.
- [ ] On restoration settle elapsed time before any worker job. Preserve unrated status and hints across refresh. Persist a promotion-pending board without applying a guessed piece.
- [ ] Checkpoint: npm test -- tests/storage; npm run test:browser -- persistence; npm run typecheck. Browser reload preserves game, rating, history, theme and flags; repeat reload after a result does not add another rated game. Simulated storage failures leave a playable game with a visible unsaved indicator.

## Task 7 — Install and play offline, with safe updates

**Files:** vite.config.ts, public icons, src/ui/UpdatePrompt.tsx; tests/browser/offline.spec.ts; docs/verification/device-checklist.md.
**Consumes:** completed production entry, worker, validated save store.
**Produces:** an installable offline app and evidence, without publishing automatically.

- [ ] Add vite-plugin-pwa compatible with the installed Vite version. Write manifest contract tests and a browser test that reopens the production build with network access disabled; this fails before service-worker integration.
- [ ] Configure explicit updates:
~~~ts
VitePWA({
 registerType:"prompt",
 manifest:{
  id:"/",name:"Chess Prodigy",short_name:"Chess Prodigy",
  start_url:"/",scope:"/",display:"standalone",
  theme_color:"#2f6b3a",background_color:"#f4ead6",
  icons:[
   {src:"/icons/icon-192.png",sizes:"192x192",type:"image/png"},
   {src:"/icons/icon-512.png",sizes:"512x512",type:"image/png"},
   {src:"/icons/maskable-512.png",sizes:"512x512",type:"image/png",purpose:"maskable"}
  ]
 },
 workbox:{globPatterns:["**/*.{js,css,html,png,svg,woff2}"]}
});
~~~
- [ ] Generate original icons with a chess motif and safe maskable margins; add the Apple touch icon link. Keep icons local and inspect each size visually. Do not assume Wikimedia assets have no licence obligations.
- [ ] Implement UpdatePrompt: defer during active play by default, save before accepting, and apply an update only on explicit user action. Verify storage migration precedes subsequent play.
- [ ] Serve the built output (not the dev server), establish service-worker control, close/reopen offline, play an out-of-book move and review a game. Repeat after updating from a previous cached build.
- [ ] Run Lighthouse accessibility against both themes with >=90 required, then keyboard-test a full game path. Do not request a PWA score.
- [ ] Physical checks on an available mid-range Android phone and an iPhone/iPad: record model, OS/browser version and BDT time; install, offline launch, Strong responsiveness, background clock, reload and safe update. If devices are unavailable, keep these boxes pending and identify the release limitation.
- [ ] Checkpoint: npm run build; offline/update browser suite; measured accessibility results; completed physical-device checklist. Publishing remains a separate owner decision.

## Task 8 — Release candidate review and durable handoff

**Files:** README.md, AGENTS.md, VISION.md, .github/workflows/ci.yml, docs/verification/release-report.md.
**Consumes:** all prior green checkpoints.
**Produces:** a reviewable release candidate; no automatic deployment.

- [ ] Add CI with npm ci, typecheck, lint, format:check, npm test, npm run build and browser tests against the built app. Pin Node to a supported LTS version and install the browser used by the CI projects; do not assume desktop Chrome exists in Linux runners.
- [ ] Use independent code review for changed engine/state/worker code and resolve high/medium correctness findings with reproductions.
- [ ] Run clean-install verification and all gates exactly once after final changes:
~~~sh
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run test:browser
~~~
- [ ] Record command results, screenshot paths, tested physical devices, accessibility results, offline/update evidence, known constraints and source revision in the release report. Do not substitute an animation screenshot for worker responsiveness measurements.
- [ ] Update README with local run/install/save-recovery instructions. Replace governance draft language only after owner review; record actual commands and the adopted merge/release policy.
- [ ] Present the finished candidate and any genuinely outstanding device checks for review. Deployment/account/domain decisions occur here, after a concrete build exists.

## Plan self-review

Coverage: all eight approved corrections remain in tasks 1/3/5 and the installation gate in task 7; opening/motif parity task 2; worker cancellation/recovery task 4; state/rating atomic save task 6; accessibility and responsive UI task 5; offline/install/update task 7; CI/docs task 8.

Interfaces are defined before consumption. Future production modules do not import the test-only prototype loader. Physical-device evidence is explicitly required and cannot be inferred from desktop mobile emulation.
