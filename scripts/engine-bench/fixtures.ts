/** Authored for E0 before candidate tuning. These are rule-checkable properties,
 * not historical examples or an independently adjudicated tactical test suite. */
export const CURATED = [
  {
    id: "quiet-central-development",
    category: "quiet",
    fen: "r3k2r/ppp2ppp/2n1bn2/3pp3/3PP3/2N1BN2/PPP2PPP/R3K2R w KQkq - 0 9",
    property: "not in check; at least ten legal moves",
  },
  {
    id: "forced-rook-check-defense",
    category: "defensive",
    fen: "7k/8/6K1/8/8/8/7R/8 b - - 0 1",
    property: "in check; Kg8 is the sole legal reply",
  },
  {
    id: "queen-mate-conversion",
    category: "winning-conversion",
    fen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",
    property: "at least one legal move immediately checkmates",
  },
  {
    id: "pawn-ending",
    category: "endgame",
    fen: "8/8/4k3/8/3P4/4K3/8/8 w - - 0 1",
    property: "three pieces; no check; multiple legal choices",
  },
  {
    id: "poisoned-pawn",
    category: "uncompensated-trap",
    fen: "4k3/8/2p5/3p4/4Q3/8/8/4K3 w - - 0 1",
    property: "Qxd5 permits cxd5; queen lost for a pawn with no remaining white mating material",
  },
] as const;
