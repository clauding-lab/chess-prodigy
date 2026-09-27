# Interrupted computer clocks — R08 execution contract

27 September 2026 BDT. Implements approved D1 within the repair generation (state-v8/account-v8/history-v7, compact wire3, minimum account policy6). This is not an engine strength or search-budget change.

## State and eligibility

Add optional persistent interruption provenance to a game, tied to its current half-move count and computer turn, with a bounded timestamp and cause (closed/resumed, suspended, worker failure). Old snapshots lacking this field retain their historical meaning. Existing completed games and rating receipts are never reclassified.

When opening an unfinished timed computer turn, record interruption **before** elapsed-clock settlement. The computer did not execute while the app was closed. Keep the real elapsed clock: no clock refund. If that turn expires with interruption provenance, retain the timeout result but make it unrated with an explicit engine-interrupted reason. If a legal computer move arrives before expiration, clear the turn's interruption; later normal play keeps its existing eligibility. Retrying computation alone does not erase interrupted time.

A human-turn timeout still follows existing rating rules. A computer timeout during uninterrupted execution also keeps existing rules. A previously terminal receipt is never removed by reload, a late worker error, or a stale event. Hints/takebacks/beta/temporary eligibility remain unrated and do not gain a new receipt.

Validate provenance against legal saved history and current turn; malformed metadata remains recoverable raw data. Compact encoding retains provenance. A repair-only reason or provenance requires policy6 even if a manually supplied legacy-shaped wire carries it.

## Worker and lifecycle connection

Record failure at the first worker failure/retry, not only after the second attempt, without changing search settings or seeded playing policy. Only computer-opponent work affects this provenance; hint/review failure does not pretend the opponent stopped.

Visibility suspension and a detected long event-loop pause while a computer turn is pending must be classified before a resumed tick can settle a rated timeout. A conservative one-second tick gap is a suspension signal, not a search deadline; ordinary 200ms display ticks do not trigger it. Preserve an earlier interruption until an actual legal move ends that turn.

Setup owns its pause even when another view opens. No unstarted hidden computer game may make its first move or start a clock merely because multiplayer navigation hides setup. Home navigation for an existing timed game keeps the original request and reply deadline.

## Cosmetic delay

Keep the usual one-second reply presentation delay when time allows. Cap it to leave at least 250ms of the computer's remaining clock; if less than 250ms remains, apply an already-ready legal reply immediately. Clock settlement still precedes move acceptance. Do not increase search budgets, fabricate a move, or accept a move after flag fall.

## Evidence required

Pure state/codec tests and actual hook lifecycle checks cover computer versus human turns, closed load, suspension, first worker failure, successful retry, ready-but-held reply, 0/1/250/1000ms boundaries, two reloads, stale errors and settled results before Home resume. Exact old receipts remain pinned. Browser checks establish UI behaviour; they do not stand in for physical-device evidence.
