# Plans-v1 production decision diagnostic — 12 September 2026 BDT

These are engineering observations, not measured strength or a perceived-style certification.
Classic comparisons use the same position/level and seed9; timings are machine dependent.
Full terms, fingerprints, both-colour multi-turn traces and fallback totals are in behaviour.json.

```json
{
  "casual": {
    "positions": 22,
    "reasons": {
      "mate": 2,
      "neutral": 10,
      "plan": 10
    },
    "searchTimeouts": 0,
    "deadlineFallbacks": 0,
    "changedFromClassic": 14,
    "maximumNeutralLoss": 0,
    "maximumElapsedMs": 27.514374999999973
  },
  "club": {
    "positions": 22,
    "reasons": {
      "mate": 2,
      "neutral": 10,
      "plan": 10
    },
    "searchTimeouts": 0,
    "deadlineFallbacks": 0,
    "changedFromClassic": 4,
    "maximumNeutralLoss": 90,
    "maximumElapsedMs": 115.391459
  },
  "strong": {
    "positions": 22,
    "reasons": {
      "mate": 2,
      "neutral": 10,
      "plan": 10
    },
    "searchTimeouts": 10,
    "deadlineFallbacks": 0,
    "changedFromClassic": 8,
    "maximumNeutralLoss": 70,
    "maximumElapsedMs": 1971.3444170000002
  }
}
```

| Position | Side | Level | Plans move | Classic move | Mode | Depth | Bonus cp | Neutral loss cp | Reason | ms |
|---|---|---|---|---|---|---|---|---|---|---|
| unique-mate | w | casual | Qd8# | Qd8# | active-pieces | 1 | 0 | 0 | mate | 2.0 |
| unique-mate | b | casual | Qd1# | Qd1# | active-pieces | 1 | 0 | 0 | mate | 2.7 |
| free-queen | w | casual | Rxa2 | Rxa2 | active-pieces | 1 | 0 | 0 | neutral | 2.4 |
| free-queen | b | casual | Rxa7 | Rxa7 | active-pieces | 1 | 0 | 0 | neutral | 1.2 |
| poisoned-pawn | w | casual | Kf2 | Qh5+ | active-pieces | 1 | 0 | 0 | neutral | 2.0 |
| poisoned-pawn | b | casual | Kf7 | Qh4+ | active-pieces | 1 | 0 | 0 | neutral | 0.7 |
| recapture | w | casual | Rxd2 | Rxd2 | active-pieces | 1 | 0 | 0 | neutral | 0.6 |
| recapture | b | casual | Rxd7 | Rxd7 | active-pieces | 1 | 0 | 0 | neutral | 0.6 |
| development | w | casual | Nf3 | d4 | develop | 1 | 110 | 0 | plan | 12.1 |
| development | b | casual | Nf6 | Nf6 | develop | 1 | 110 | 0 | plan | 3.6 |
| guarded-centre | w | casual | Bxe6 | Bxa7 | open-centre | 1 | 55 | 0 | plan | 27.5 |
| guarded-centre | b | casual | Bxe3 | Bxa2 | open-centre | 1 | 55 | 0 | plan | 13.2 |
| central-break | w | casual | d4 | d4 | open-centre | 1 | 140 | 0 | plan | 7.1 |
| central-break | b | casual | d5 | a5 | open-centre | 1 | 140 | 0 | plan | 8.6 |
| coordination | w | casual | Bxe6 | Bxa7 | king-attack | 1 | 88 | 0 | plan | 11.3 |
| coordination | b | casual | Bxe3 | Bxa2 | king-attack | 1 | 88 | 0 | plan | 10.9 |
| balanced-coordination | w | casual | Bxe6 | Bxa7 | king-attack | 1 | 88 | 0 | plan | 11.4 |
| balanced-coordination | b | casual | Bxe3 | Bxa2 | king-attack | 1 | 88 | 0 | plan | 10.7 |
| pinned | w | casual | Kd2 | Kf2 | active-pieces | 1 | 0 | 0 | neutral | 0.5 |
| pinned | b | casual | Kd7 | Kf7 | active-pieces | 1 | 0 | 0 | neutral | 0.5 |
| ending | w | casual | Kb2 | Rf1 | active-pieces | 1 | 0 | 0 | neutral | 0.1 |
| ending | b | casual | Kb7 | Rh8 | active-pieces | 1 | 0 | 0 | neutral | 0.1 |
| unique-mate | w | club | Qd8# | Qd8# | active-pieces | 1 | 0 | 0 | mate | 0.2 |
| unique-mate | b | club | Qd1# | Qd1# | active-pieces | 1 | 0 | 0 | mate | 0.2 |
| free-queen | w | club | Rxa2 | Rxa2 | active-pieces | 2 | 0 | 0 | neutral | 2.3 |
| free-queen | b | club | Rxa7 | Rxa7 | active-pieces | 2 | 0 | 0 | neutral | 2.3 |
| poisoned-pawn | w | club | Kf2 | Kf2 | active-pieces | 2 | 0 | 0 | neutral | 4.8 |
| poisoned-pawn | b | club | Kf7 | Kf7 | active-pieces | 2 | 0 | 0 | neutral | 4.4 |
| recapture | w | club | Rxd2 | Rxd2 | active-pieces | 2 | 0 | 0 | neutral | 3.1 |
| recapture | b | club | Rxd7 | Rxd7 | active-pieces | 2 | 0 | 0 | neutral | 3.2 |
| development | w | club | Nf3 | Nc3 | develop | 2 | 110 | 0 | plan | 24.6 |
| development | b | club | Nf6 | Nc6 | develop | 2 | 110 | 0 | plan | 35.6 |
| guarded-centre | w | club | Bxe6 | Bxe6 | open-centre | 2 | 55 | 0 | plan | 115.4 |
| guarded-centre | b | club | Bxe3 | Bxe3 | open-centre | 2 | 55 | 0 | plan | 98.0 |
| central-break | w | club | d4 | Bd5 | open-centre | 2 | 140 | 90 | plan | 97.2 |
| central-break | b | club | d5 | Nd4 | open-centre | 2 | 140 | 90 | plan | 87.9 |
| coordination | w | club | Bxe6 | Bxe6 | king-attack | 2 | 88 | 0 | plan | 99.3 |
| coordination | b | club | Bxe3 | Bxe3 | king-attack | 2 | 88 | 0 | plan | 90.9 |
| balanced-coordination | w | club | Bxe6 | Bxe6 | king-attack | 2 | 88 | 0 | plan | 96.4 |
| balanced-coordination | b | club | Bxe3 | Bxe3 | king-attack | 2 | 88 | 0 | plan | 88.1 |
| pinned | w | club | Rf1 | Rf1 | active-pieces | 2 | 0 | 0 | neutral | 4.0 |
| pinned | b | club | Rf8 | Rf8 | active-pieces | 2 | 0 | 0 | neutral | 3.8 |
| ending | w | club | Kb2 | Kb2 | active-pieces | 2 | 0 | 0 | neutral | 0.9 |
| ending | b | club | Kb7 | Kb7 | active-pieces | 2 | 0 | 0 | neutral | 0.8 |
| unique-mate | w | strong | Qd8# | Qd8# | active-pieces | 1 | 0 | 0 | mate | 0.2 |
| unique-mate | b | strong | Qd1# | Qd1# | active-pieces | 1 | 0 | 0 | mate | 0.2 |
| free-queen | w | strong | Rxa2 | Rxa2 | active-pieces | 4 | 0 | 0 | neutral | 77.9 |
| free-queen | b | strong | Rxa7 | Rxa7 | active-pieces | 4 | 0 | 0 | neutral | 130.6 |
| poisoned-pawn | w | strong | Qh5+ | Qh5+ | active-pieces | 4 | 0 | 0 | neutral | 352.3 |
| poisoned-pawn | b | strong | Qh4+ | Qh4+ | active-pieces | 4 | 0 | 0 | neutral | 232.7 |
| recapture | w | strong | Rxd2 | Rxd2 | active-pieces | 4 | 0 | 0 | neutral | 114.8 |
| recapture | b | strong | Rxd7 | Rxd7 | active-pieces | 4 | 0 | 0 | neutral | 125.3 |
| development | w | strong | Nf3 | Nc3 | develop | 3 | 110 | 0 | plan | 1970.9 |
| development | b | strong | Nf6 | Nc6 | develop | 3 | 110 | 0 | plan | 1971.0 |
| guarded-centre | w | strong | Bxe6 | Bxe6 | open-centre | 3 | 55 | 0 | plan | 1971.3 |
| guarded-centre | b | strong | Bxe3 | Bxe3 | open-centre | 3 | 55 | 0 | plan | 1971.1 |
| central-break | w | strong | d4 | Ng5 | open-centre | 3 | 140 | 70 | plan | 1971.3 |
| central-break | b | strong | d5 | Ng4 | open-centre | 3 | 140 | 70 | plan | 1971.2 |
| coordination | w | strong | Bxe6 | Nd5 | king-attack | 3 | 88 | 0 | plan | 1971.1 |
| coordination | b | strong | Bxe3 | Nd4 | king-attack | 3 | 88 | 0 | plan | 1971.2 |
| balanced-coordination | w | strong | Bxe6 | Nd5 | king-attack | 3 | 88 | 0 | plan | 1971.2 |
| balanced-coordination | b | strong | Bxe3 | Nd4 | king-attack | 3 | 88 | 0 | plan | 1971.3 |
| pinned | w | strong | Rf1 | Rf1 | active-pieces | 4 | 0 | 0 | neutral | 257.1 |
| pinned | b | strong | Rf8 | Rf8 | active-pieces | 4 | 0 | 0 | neutral | 150.3 |
| ending | w | strong | Rb7 | Rb7 | active-pieces | 4 | 0 | 0 | neutral | 36.8 |
| ending | b | strong | Rb2 | Rb2 | active-pieces | 4 | 0 | 0 | neutral | 27.8 |
