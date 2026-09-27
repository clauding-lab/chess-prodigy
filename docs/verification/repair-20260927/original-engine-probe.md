# Why the computer opponents feel the same

**TLDR:** You are right, but the opening books are not the main reason. Each opponent follows its master's real games for only about 2 to 3 of its own moves before your moves take it off the recorded path. After that, all of them run the same engine, and the "personality" changes only about one move in four, often to the same move for several opponents. In the most common lines (1.e4, and 1.e4 e5) the real masters also played the same moves, so even the first few moves look alike.

**Quick mental model:** six actors reading the same script. Each wears a different costume and ad-libs a few lines, and several of them ad-lib the same line.

---

## What was run

- **Five probes, all checked.** Five separate investigations ("lenses") ran: books, move agreement, full games, engine mechanism, and project history. **5 of 5 finished, and 5 of 5 were independently re-checked** by a verifier using fresh code. Every verifier returned "corrected": the measured numbers reproduced, but some wording and interpretation was fixed. The corrected figures are used throughout, and no lens is missing.
- **Real engine code.** Every move came from the live production code and was cross-checked against the app's dispatcher (thousands of checks, 0 mismatches). A fixed clock let every search finish, so there were **0 "incomplete" and 0 "deadline" decisions** in every lens.
- **Sample sizes:**
  - books lens: 7,200 opening games
  - agreement lens: 344 fixed middlegame positions x 8 opponents x 3 seeds
  - games lens: 600 full Club games
  - mechanism lens: 245 + 208 positions
  - history lens: the project's own saved evidence
- **Read-only.** Nothing tracked was changed; git is clean at 4e3a112. Everything lives in `.review-scratch/engine-probe/`.
- **Big caveat.** The stand-in "human" was the Classic engine, not a person.

---

## Where the sameness comes from (biggest first)

**1. After the book, one shared engine makes most of the moves (high).**
- **Pairs agree two times in three.** On 344 middlegame positions at Club, any two opponents play the same move **0.66** of the time on average (range 0.56-0.86).
- **Often all of them agree.** All 8 play the identical move in **35%** of positions, and all 5 named opponents in **44%**.
- **Ruler for scale:** Classic at Club and Classic at Strong agree on only 64%. So one personality differs from another about as much as one engine differs from itself when you change the level.
- **In full games:** 68-82% of the named opponents' non-book moves are exactly Classic's move, rising to 78-97% after move 30.

**2. The personality is a small nudge, and the personalities overlap (high).**
- **How often it changes a move.** The style bonus changes the move in only **17-30%** of decisions (Morphy v4 17%, Chigorin 24%, Tal 26%, Fischer 29%, Spassky 30%).
- **What it can choose from.** It may only pick among moves already within 50, 100 or 150 cp (half a pawn to a pawn and a half) of the engine's best. Usually only about 4 to 8 moves qualify.
- **Shared ingredients.** All five reward development and castling, and four reward king-zone attackers and central breaks. So when two of them leave the plain move, they often pick the *same* alternative: Morphy v4 and Tal 69%, Morphy v4 and Spassky 60%, Spassky and Tal 57%.
- **Bigger windows don't help much.** Fischer's small window (50 cp) changes about as many moves as Tal's large one (150 cp). The limit is the shared ingredients, not the window size.
- **Tal can't really sacrifice.** Of 1,888 piece offers checked, only 32 fit his window. He played one sacrifice in 245 positions.

**3. The books are left very early (high, for the openings).**
- **About 2 to 3 own moves.** On average each opponent plays only 1.8-3.2 of its own book moves per game.
- **The books never run out by themselves.** They hold every move of every recorded game. There were 0 dead-ends in 6,000 games. Every exit happened because the other side played a move none of the master's opponents ever played.
- **So the shared engine plays "the opening".** What a player thinks of as the opening, roughly moves 3 to 15, comes mostly from the shared engine.
- **Morphy as Black leaves at once.** He is out of book on his very first move in 96 of 200 games; his recorded games only cover 1.e4, 1.d4, 1.a3 and 1.f4.

**4. In the popular lines, the real masters really did play the same moves (medium).**
- **1.e4 dominates.** Morphy opens 1.e4 in 100% of his recorded games, Chigorin 95% and Fischer 91%. Spassky and Tal do so about 61% of the time.
- **Against 1.e4, Morphy and Chigorin are twins.** Both answer ...e5 over 90% of the time. They match each other through 4 plies exactly as often as each matches himself (0.250 vs 0.251/0.264).
- **After 1.e4 e5, four masters converge.** Morphy, Spassky, Tal and Fischer mostly go into the same 2.Nf3 lines. Only Chigorin stands apart, with 2.f4 in 35% of games.
- **Two Morphy versions share one book.** Morphy v3 and v4 use exactly the same book.

**5. Nothing varies after the book (medium).**
- **Same position, same move.** Each opponent plays the same move in the same position every time. The Club "noise" setting is never actually used.
- **Games repeat.** Only 39-85 of every 100 games were unique. Tal and Morphy v4 played the identical 28-ply game for three different seeds.

**6. Frequency-weighted book picking (low).** Choosing evenly instead would add very little variety. In 26-80% of book positions the master only ever played one move.

**7. Time limits at Strong and on slow devices (low).** On the real clock, Strong usually stops at depth 3 instead of 4. An open review item (F01) says that on slow devices every opponent would fall back to the same capture move.

**8. Nobody ever tested "can you tell them apart?" (why it was missed).** The same complaint came up on 12 Sep for Morphy v3. The three fixes tried then were scored on copying Morphy's real moves, not on being different. Opponents were compared only on a handful of hand-picked positions, and a blind side-by-side test was planned but never built.

---

## What is genuinely different

- **First moves differ.** As White: Morphy always 1.e4; Spassky mixes in 1.d4; Tal mixes in 1.Nf3 and 1.c4. Against 1.e4, Fischer and Tal answer ...c5.
- **When the human varies their moves, the openings rarely match.** Two different opponents share the first 6 plies at most 0.036 of the time.
- **Tal gives the most checks:** 0.125 per move, against 0.070-0.084 for the others. The gap holds up clearly against only some of them.
- **Attack and castling habits.** The named opponents put more pieces near the enemy king than Classic does. Fischer castles latest.
- **A simple computer test can sometimes name the opponent** from a game's statistics: right 28-38% of the time, against 17% by guessing. Several pairs cannot be told apart at all.

---

## Options (cheapest first)

| # | Option | Changes play? | Effort | New 400-game measurements | Expected effect |
|---|---|---|---|---|---|
| 1 | Show the thinking: plan name, "from Morphy's games" label | No | Small | 0 | Perception only |
| 2 | Signature-line book weighting | Yes | Small | 5 | Small; first 2-3 moves only |
| 3 | A distinct personality layer | Yes | Medium | 5 | Targets the biggest causes; size unknown until tested |
| 4 | Longer designed repertoires | Yes | Medium-large | 5 | Longer openings, only if you stay on known theory |
| 5 | Style inside a per-opponent search | Yes | Large | 5 | Only route to real Tal sacrifices; tried before without much gain |
| 6 | Stronger shared core | Yes | Very large | 6 or more; every rating becomes invalid | No distinctness gain expected |

**Notes on the options:**
- **Option 2** reopens the 12 Sep choice to keep exact historical frequencies. It costs the same measurement bill as option 3, so do it only bundled with option 3.
- **Option 3 must change the rules, not just the weights.** The 19 Sep "exaggerated styles" pass already turned the weights up and the styles still overlap.
- **Option 4** risks thin coverage, the same problem that sank the "historical analogues" experiment on 12 Sep.
- **Option 5 has been partly tried.** Morphy v2 and v3 already put style inside the search and still agreed with Classic 0.86 and 0.72. v3 is the one the owner said "feels like Classic".

---

## Recommendation

**Run an offline test for option 3, with option 2 folded in. Judge it on how different the opponents are, not on how historical they are. Stop if it fails. Do this before any new version or any 400-game measurement.**

- **Why:** the biggest cause is after the book, and every change to play costs a new version plus 400 games for each opponent. The test tools already exist: the 344 positions and the game loop in `.review-scratch/engine-probe/`.
- **Pass mark 1 (computer):** pairwise agreement on the 344 positions drops from 0.66 to a target the owner sets. Tactical safety still passes, and a changed move costs no more than an agreed amount (today 18-28 cp).
- **Pass mark 2 (owner):** a short blind "who is this?" test beats a baseline taken on today's opponents.
- **Sign-off needed:** this would change how the opponents play and their ratings, so it needs the owner's sign-off first.

Option 1 can go ahead alongside, since it changes no moves. On its own it will not make the opponents play differently.

---

## Would a stronger engine help?

**Not on its own.** A stronger core is shared, so everyone gets the same better answers. Going deeper did not clearly change how often they agree. It only matters as a precondition for Tal making real sacrifices.

**The cost is the highest of any option:**
- Every opponent's moves change, including Classic, the measuring stick every rating was taken against. So every measured rating becomes invalid.
- Each changed opponent then needs a new version and a fresh 400-game measurement: at least 6 measurements.
- The old engine must be kept frozen for old games, rematches and rating receipts.

---

## Corrections applied from the verifiers

- **The engine is shared, but not identical.** After the book, the named opponents share one search but differ in their style bonus. Morphy v2 and v3 put their style inside the search.
- **Fewer 1.e4 players than first stated.** 3 of 5 masters almost always open 1.e4, not 4 of 5.
- **Style moves cost more than first reported.** A move changed by style costs 18-28 cp on average, not 9-13.
- **Agreement depends on the positions tested.** "All five agree" is 51% on positions from Morphy's games but 36% on the opponents' own games. It does not rise at Strong.
- **Strong under a real clock is different.** A constant clock matches Casual and Club, not Strong. On the real clock, Strong mostly stops at depth 3.
- **The historical-frequency rule came from the agent, not the owner.** The ledger entries to keep exact historical frequencies and to stop after three experiments were written by the controlling agent. The owner approved exact frequencies only indirectly, through the specs.

---

## Open questions

- **How it feels:** perceived style needs human play; no blind test exists yet.
- **Your real openings:** which openings, colour and level you actually play.
- **Untested levels:** Casual and Strong full games.
- **Untested devices:** real phone and Mac timing.
- **The trade-off in option 3:** how much distinctness it can buy before strength and safety suffer.
- **Old versions:** whether you sometimes play old versions through rematches (Morphy v1/v2 is nearly a twin of Classic).

---

## Files

- Books: `.review-scratch/engine-probe/books/out/summary.txt`
- Agreement: `.review-scratch/engine-probe/agreement/result-club.json`
- Games: `.review-scratch/engine-probe/games/report.txt`
- Mechanism: `.review-scratch/engine-probe/mechanism/club.summary.txt`
- History: `.review-scratch/engine-probe/history/`
- Verifier re-runs: `.review-scratch/engine-probe/verify-*/`
