import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* ================= CHESS ENGINE ================= */

const idx = (r, c) => r * 8 + c;
const rowOf = (i) => Math.floor(i / 8);
const colOf = (i) => i % 8;
const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const FILES = "abcdefgh";
const sqName = (i) => FILES[colOf(i)] + (8 - rowOf(i));
const sqIndex = (name) => idx(8 - parseInt(name[1]), FILES.indexOf(name[0]));

const START = () => {
  const b = new Array(64).fill(null);
  const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
  for (let c = 0; c < 8; c++) {
    b[idx(0, c)] = "b" + back[c];
    b[idx(1, c)] = "bp";
    b[idx(6, c)] = "wp";
    b[idx(7, c)] = "w" + back[c];
  }
  return { board: b, turn: "w", castling: { K: true, Q: true, k: true, q: true }, ep: null, halfmove: 0, fullmove: 1 };
};

const KN = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KG = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const DIAG = [[-1,-1],[-1,1],[1,-1],[1,1]];
const ORTH = [[-1,0],[1,0],[0,-1],[0,1]];

function isAttacked(board, r, c, by) {
  const pr = by === "w" ? r + 1 : r - 1;
  for (const dc of [-1, 1]) if (inB(pr, c + dc) && board[idx(pr, c + dc)] === by + "p") return true;
  for (const [dr, dc] of KN) if (inB(r + dr, c + dc) && board[idx(r + dr, c + dc)] === by + "n") return true;
  for (const [dr, dc] of KG) if (inB(r + dr, c + dc) && board[idx(r + dr, c + dc)] === by + "k") return true;
  for (const [dr, dc] of ORTH) {
    let rr = r + dr, cc = c + dc;
    while (inB(rr, cc)) {
      const p = board[idx(rr, cc)];
      if (p) { if (p[0] === by && (p[1] === "r" || p[1] === "q")) return true; break; }
      rr += dr; cc += dc;
    }
  }
  for (const [dr, dc] of DIAG) {
    let rr = r + dr, cc = c + dc;
    while (inB(rr, cc)) {
      const p = board[idx(rr, cc)];
      if (p) { if (p[0] === by && (p[1] === "b" || p[1] === "q")) return true; break; }
      rr += dr; cc += dc;
    }
  }
  return false;
}

function kingSq(board, color) {
  for (let i = 0; i < 64; i++) if (board[i] === color + "k") return i;
  return -1;
}
function inCheck(state, color) {
  const k = kingSq(state.board, color);
  if (k < 0) return false;
  return isAttacked(state.board, rowOf(k), colOf(k), color === "w" ? "b" : "w");
}

function genPseudo(state) {
  const { board, turn, castling, ep } = state;
  const moves = [];
  const enemy = turn === "w" ? "b" : "w";
  const push = (m) => moves.push(m);
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || p[0] !== turn) continue;
    const r = rowOf(i), c = colOf(i), t = p[1];
    if (t === "p") {
      const dir = turn === "w" ? -1 : 1, startR = turn === "w" ? 6 : 1, promoR = turn === "w" ? 0 : 7;
      const one = idx(r + dir, c);
      if (inB(r + dir, c) && !board[one]) {
        if (r + dir === promoR) for (const pr of ["q", "r", "b", "n"]) push({ from: i, to: one, promo: pr });
        else {
          push({ from: i, to: one });
          const two = idx(r + 2 * dir, c);
          if (r === startR && !board[two]) push({ from: i, to: two, double: true });
        }
      }
      for (const dc of [-1, 1]) {
        if (!inB(r + dir, c + dc)) continue;
        const ti = idx(r + dir, c + dc), tp = board[ti];
        if (tp && tp[0] === enemy) {
          if (r + dir === promoR) for (const pr of ["q", "r", "b", "n"]) push({ from: i, to: ti, promo: pr, capture: tp });
          else push({ from: i, to: ti, capture: tp });
        } else if (ti === ep) push({ from: i, to: ti, ep: true, capture: enemy + "p" });
      }
    } else if (t === "n" || t === "k") {
      for (const [dr, dc] of t === "n" ? KN : KG) {
        if (!inB(r + dr, c + dc)) continue;
        const ti = idx(r + dr, c + dc), tp = board[ti];
        if (!tp) push({ from: i, to: ti });
        else if (tp[0] === enemy) push({ from: i, to: ti, capture: tp });
      }
      if (t === "k") {
        const home = turn === "w" ? 7 : 0;
        const rights = turn === "w" ? ["K", "Q"] : ["k", "q"];
        if (r === home && c === 4 && !isAttacked(board, home, 4, enemy)) {
          if (castling[rights[0]] && !board[idx(home, 5)] && !board[idx(home, 6)] && board[idx(home, 7)] === turn + "r" &&
              !isAttacked(board, home, 5, enemy) && !isAttacked(board, home, 6, enemy)) push({ from: i, to: idx(home, 6), castle: "K" });
          if (castling[rights[1]] && !board[idx(home, 3)] && !board[idx(home, 2)] && !board[idx(home, 1)] && board[idx(home, 0)] === turn + "r" &&
              !isAttacked(board, home, 3, enemy) && !isAttacked(board, home, 2, enemy)) push({ from: i, to: idx(home, 2), castle: "Q" });
        }
      }
    } else {
      const dirs = t === "b" ? DIAG : t === "r" ? ORTH : [...DIAG, ...ORTH];
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (inB(rr, cc)) {
          const ti = idx(rr, cc), tp = board[ti];
          if (!tp) push({ from: i, to: ti });
          else { if (tp[0] === enemy) push({ from: i, to: ti, capture: tp }); break; }
          rr += dr; cc += dc;
        }
      }
    }
  }
  return moves;
}

function applyMove(state, m) {
  const board = state.board.slice();
  const turn = state.turn, enemy = turn === "w" ? "b" : "w";
  const piece = board[m.from];
  const fr = rowOf(m.from), fc = colOf(m.from), tr = rowOf(m.to), tc = colOf(m.to);
  board[m.to] = m.promo ? turn + m.promo : piece;
  board[m.from] = null;
  if (m.ep) board[idx(fr, tc)] = null;
  if (m.castle === "K") { board[idx(fr, 5)] = board[idx(fr, 7)]; board[idx(fr, 7)] = null; }
  else if (m.castle === "Q") { board[idx(fr, 3)] = board[idx(fr, 0)]; board[idx(fr, 0)] = null; }
  const castling = { ...state.castling };
  if (piece === "wk") { castling.K = false; castling.Q = false; }
  if (piece === "bk") { castling.k = false; castling.q = false; }
  if (m.from === 63 || m.to === 63) castling.K = false;
  if (m.from === 56 || m.to === 56) castling.Q = false;
  if (m.from === 7 || m.to === 7) castling.k = false;
  if (m.from === 0 || m.to === 0) castling.q = false;
  return {
    board, turn: enemy, castling,
    ep: m.double ? idx((fr + tr) / 2, fc) : null,
    halfmove: piece[1] === "p" || m.capture ? 0 : state.halfmove + 1,
    fullmove: turn === "b" ? state.fullmove + 1 : state.fullmove,
  };
}

function legalFilter(state, moves) {
  const out = [], me = state.turn, enemy = me === "w" ? "b" : "w";
  const k0 = kingSq(state.board, me);
  for (const m of moves) {
    const ns = applyMove(state, m);
    const k = state.board[m.from][1] === "k" ? m.to : k0;
    if (!isAttacked(ns.board, rowOf(k), colOf(k), enemy)) out.push(m);
  }
  return out;
}
function legalMoves(state) { return legalFilter(state, genPseudo(state)); }

function posKey(state) {
  const c = state.castling;
  return state.board.map((p) => p || ".").join("") + state.turn +
    (c.K ? "K" : "") + (c.Q ? "Q" : "") + (c.k ? "k" : "") + (c.q ? "q" : "") +
    (state.ep !== null ? sqName(state.ep) : "-");
}

function toFEN(state) {
  let fen = "";
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = state.board[idx(r, c)];
      if (!p) empty++;
      else { if (empty) { fen += empty; empty = 0; } fen += p[0] === "w" ? p[1].toUpperCase() : p[1]; }
    }
    if (empty) fen += empty;
    if (r < 7) fen += "/";
  }
  const cs = (state.castling.K ? "K" : "") + (state.castling.Q ? "Q" : "") + (state.castling.k ? "k" : "") + (state.castling.q ? "q" : "");
  return `${fen} ${state.turn} ${cs || "-"} ${state.ep !== null ? sqName(state.ep) : "-"} ${state.halfmove} ${state.fullmove}`;
}

function insufficientMaterial(board) {
  const minors = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || p[1] === "k") continue;
    if (p[1] === "b" || p[1] === "n") minors.push({ p, i });
    else return false;
  }
  if (minors.length <= 1) return true;
  if (minors.length === 2 && minors.every((m) => m.p[1] === "b")) {
    const shade = (m) => (rowOf(m.i) + colOf(m.i)) % 2;
    if (minors[0].p[0] !== minors[1].p[0] && shade(minors[0]) === shade(minors[1])) return true;
  }
  return false;
}

function sanFor(state, m, nextState) {
  const decorate = (base) => {
    const chk = inCheck(nextState, nextState.turn);
    if (!chk) return base;
    return legalMoves(nextState).length === 0 ? base + "#" : base + "+";
  };
  if (m.castle === "K") return decorate("O-O");
  if (m.castle === "Q") return decorate("O-O-O");
  const piece = state.board[m.from], t = piece[1];
  const letter = { p: "", n: "N", b: "B", r: "R", q: "Q", k: "K" }[t];
  let dis = "";
  if (t !== "p" && t !== "k") {
    const rivals = legalMoves(state).filter((x) => x.to === m.to && x.from !== m.from && state.board[x.from] === piece);
    if (rivals.length) {
      const sameFile = rivals.some((x) => colOf(x.from) === colOf(m.from));
      const sameRank = rivals.some((x) => rowOf(x.from) === rowOf(m.from));
      if (!sameFile) dis = FILES[colOf(m.from)];
      else if (!sameRank) dis = String(8 - rowOf(m.from));
      else dis = sqName(m.from);
    }
  }
  let s = letter + dis;
  if (m.capture) s += (t === "p" ? FILES[colOf(m.from)] : "") + "x";
  s += sqName(m.to);
  if (m.promo) s += "=" + m.promo.toUpperCase();
  return decorate(s);
}

function sameMove(a, b) {
  return !!a && !!b && a.from === b.from && a.to === b.to && (a.promo || null) === (b.promo || null);
}

/* ================= EVALUATION & SEARCH ================= */

const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const PST = {
  p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5,
      0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
      -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10,
      -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
      -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5,
      0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
      20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
  ke: [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30,
       -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30,
       -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50],
};

function nonPawnMaterial(board) {
  let w = 0, b = 0;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || p[1] === "p" || p[1] === "k") continue;
    if (p[0] === "w") w += VAL[p[1]]; else b += VAL[p[1]];
  }
  return { w, b };
}

function evaluate(state) {
  const b = state.board;
  let score = 0, npm = 0, wk = -1, bk = -1;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p) continue;
    const t = p[1];
    if (t === "k") { if (p[0] === "w") wk = i; else bk = i; continue; }
    if (t !== "p") npm += VAL[t];
    if (p[0] === "w") score += VAL[t] + PST[t][i];
    else score -= VAL[t] + PST[t][(7 - (i >> 3)) * 8 + (i & 7)];
  }
  const kt = npm <= 2600 ? PST.ke : PST.k;
  if (wk >= 0) score += kt[wk];
  if (bk >= 0) score -= kt[(7 - (bk >> 3)) * 8 + (bk & 7)];
  return score;
}

const MATE = 100000;
const ABORT = { abort: true };
let deadline = Infinity, nodes = 0;
let TT = new Map();

function orderMoves(moves, ttBest) {
  const sc = (m) => {
    let s = 0;
    if (ttBest && sameMove(m, ttBest)) s += 100000;
    if (m.capture) s += 10 * VAL[m.capture[1]] + 50;
    if (m.promo) s += VAL[m.promo] || 0;
    return s;
  };
  return moves.sort((a, b) => sc(b) - sc(a));
}

function quiesce(state, alpha, beta, depth) {
  nodes++;
  const stand = evaluate(state) * (state.turn === "w" ? 1 : -1);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (depth <= 0) return alpha;
  const caps = orderMoves(legalFilter(state, genPseudo(state).filter((m) => m.capture || m.promo)));
  for (const m of caps) {
    const sc = -quiesce(applyMove(state, m), -beta, -alpha, depth - 1);
    if (sc >= beta) return beta;
    if (sc > alpha) alpha = sc;
  }
  return alpha;
}

function negamax(state, depth, alpha, beta, ply) {
  if ((++nodes & 255) === 0 && Date.now() > deadline) throw ABORT;
  const useTT = depth >= 2;
  const key = useTT ? posKey(state) : null;
  const tt = useTT ? TT.get(key) : null;
  if (tt && tt.depth >= depth) {
    if (tt.flag === 0) return tt.score;
    if (tt.flag === 1 && tt.score >= beta) return tt.score;
    if (tt.flag === 2 && tt.score <= alpha) return tt.score;
  }
  const moves = legalMoves(state);
  if (moves.length === 0) return inCheck(state, state.turn) ? -MATE + ply : 0;
  if (state.halfmove >= 100) return 0;
  if (depth <= 0) return quiesce(state, alpha, beta, 4);
  orderMoves(moves, tt && tt.best);
  const alpha0 = alpha;
  let best = -Infinity, bestMove = null;
  for (const m of moves) {
    const sc = -negamax(applyMove(state, m), depth - 1, -beta, -alpha, ply + 1);
    if (sc > best) { best = sc; bestMove = m; }
    if (sc > alpha) alpha = sc;
    if (alpha >= beta) break;
  }
  if (useTT) TT.set(key, { depth, score: best, best: bestMove, flag: best <= alpha0 ? 2 : best >= beta ? 1 : 0 });
  return best;
}

// Iterative deepening with a time budget. Returns the best move from the
// deepest completed iteration and its score from White's perspective.
function search(state, maxDepth, ms) {
  TT = new Map();
  deadline = Date.now() + ms;
  nodes = 0;
  const moves = orderMoves(legalMoves(state));
  if (moves.length === 0) return { move: null, score: 0, depth: 0 };
  let best = moves[0], bestScore = 0, done = 0;
  const t0 = Date.now();
  for (let d = 1; d <= maxDepth; d++) {
    if (d > 1 && Date.now() - t0 > ms * 0.45) break;
    let iterBest = null, iterScore = -Infinity;
    let alpha = -Infinity;
    try {
      const ordered = orderMoves(moves.slice(), best);
      for (const m of ordered) {
        const sc = -negamax(applyMove(state, m), d - 1, -Infinity, -alpha, 1);
        if (sc > iterScore) { iterScore = sc; iterBest = m; }
        if (sc > alpha) alpha = sc;
      }
    } catch (e) {
      if (e !== ABORT) throw e;
      break;
    }
    best = iterBest; bestScore = iterScore; done = d;
    if (Math.abs(bestScore) > MATE - 100) break;
  }
  const white = bestScore * (state.turn === "w" ? 1 : -1);
  return { move: best, score: white, depth: done };
}

function analyse(state, ms = 300, maxDepth = 3) {
  return search(state, maxDepth, ms);
}

const LEVEL_CFG = {
  casual: { depth: 1, ms: 200, noise: 120, book: 0.5 },
  club: { depth: 2, ms: 600, noise: 15, book: 1 },
  strong: { depth: 4, ms: 2000, noise: 0, book: 1 },
};

function chooseAiMove(state, level, bookSans) {
  const cfg = LEVEL_CFG[level];
  const legal = legalMoves(state);
  // Opening book
  if (bookSans && bookSans.length && Math.random() < cfg.book) {
    const san = bookSans[Math.floor(Math.random() * bookSans.length)];
    for (const m of legal) if (sanFor(state, m, applyMove(state, m)) === san) return { move: m, score: null, book: true };
  }
  if (level === "casual") {
    let best = null, bs = -Infinity;
    for (const m of orderMoves(legal)) {
      const ns = applyMove(state, m);
      let sc = -quiesce(ns, -Infinity, Infinity, 2) + (Math.random() * 2 - 1) * cfg.noise;
      if (legalMoves(ns).length === 0 && inCheck(ns, ns.turn)) sc = MATE;
      if (sc > bs) { bs = sc; best = m; }
    }
    return { move: best, score: null, book: false };
  }
  const r = search(state, cfg.depth, cfg.ms);
  return { move: r.move, score: r.score, book: false };
}

/* ================= OPENING BOOK ================= */
// Each line: [moves, name, ECO, origin, plan]. Lines extend one another; the
// tree is built at load. Cards on sub-variations inherit the family's story.

const BOOK_LINES = [
  // ---- Open games: 1.e4 e5
  ["e4 e5", "Open Game", "C20", "The oldest recorded battleground: both sides stake a claim in the centre at once. Lucena's 1497 treatise and Greco's 17th-century games are almost all open games.",
   "Fast development, early castling, and the fight for d4 and d5. Tactics come quickly because both king's bishops see the f-pawns."],
  ["e4 e5 Nf3 Nc6 Bb5", "Ruy Lopez (Spanish)", "C60", "Analysed in the Göttingen manuscript (c.1490) and named for Ruy López de Segura, the Spanish priest whose 1561 book gave it a systematic treatment. The main line of top-level chess for over a century.",
   "White pressures e5 indirectly by threatening the c6 knight, then builds slowly with c3, d4 and the Nb1-d2-f1-g3 regrouping. Black holds the centre and waits for a chance to counter with ...d5 or a queenside expansion."],
  ["e4 e5 Nf3 Nc6 Bb5 a6", "Morphy Defence", "C70", "Paul Morphy's 1850s idea: ask the bishop a question at once. Retreating to a4 keeps the tension; taking on c6 gives Black the bishop pair.",
   "...a6 and ...b5 gain queenside space and can later hunt the bishop with ...Na5. White accepts the tempo loss for a lasting bind on e5."],
  ["e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3", "Closed Ruy Lopez", "C84", "The classical position reached in thousands of master games since the 1890s. Chigorin, Capablanca and Karpov all built careers on it.",
   "White plays d4 and manoeuvres the knight to g3 or f1; Black chooses a plan for the c6 knight (Chigorin, Breyer, Zaitsev). A slow, strategic middlegame where one tempo decides."],
  ["e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Na5 Bc2 c5 d4 Qc7", "Chigorin Variation", "C96", "Mikhail Chigorin's late-19th-century plan, the mainstay of the Closed Spanish for decades.",
   "Black grabs queenside space with ...c5 and ...Qc7, keeping e5 solid. White decides whether to close the centre with d5 or keep tension with Nbd2."],
  ["e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8", "Breyer Variation", "C95", "Gyula Breyer proposed it around 1911; Spassky and later Karpov made it respectable in the 1960s and 70s.",
   "The knight retreats to reroute via d7, freeing the c-pawn and supporting e5. Ugly-looking, deeply logical."],
  ["e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Bb7", "Zaitsev Variation", "C92", "Igor Zaitsev, Karpov's second, developed it in the 1980s; it became the battleground of the Karpov–Kasparov matches.",
   "Black activates the bishop and plays ...Re8, ...Bf8 to pressure e4. Extremely concrete: both sides need precise preparation."],
  ["e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5", "Marshall Attack", "C89", "Frank Marshall unveiled it against Capablanca in New York, 1918, reportedly after years of secret preparation. Capablanca won anyway, but the gambit has been a headache for White ever since.",
   "Black sacrifices a pawn for a kingside attack with ...Bd6, ...Qh4 and ...Nf6-g4 ideas. White must know the antidotes or avoid it with an anti-Marshall like 8.a4 or 8.h3."],
  ["e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4", "Open Ruy Lopez", "C80", "Tarrasch's preference, later a weapon of Korchnoi and Yusupov: grab the pawn and fight.",
   "After d4 b5 Bb3 d5 dxe5 Be6 Black has active pieces and a central pawn; White has the e5 wedge and attacking chances. Tactical, unbalanced."],
  ["e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4 d4 b5 Bb3 d5 dxe5 Be6", "Open Ruy Lopez, main line", "C80", "Standard position of the Open Spanish since the Steinitz era.",
   "White targets the e4 knight and the d5 pawn; Black seeks ...Bc5 and ...O-O with active play."],
  ["e4 e5 Nf3 Nc6 Bb5 a6 Bxc6", "Exchange Variation", "C68", "Emanuel Lasker used it to win at St Petersburg 1914; Fischer revived it at the 1966 Havana Olympiad with three wins in a row.",
   "White gives up the bishop pair for a healthier pawn structure: after d4 and trades, White's 4-v-3 kingside majority is a real endgame asset. Black relies on the two bishops."],
  ["e4 e5 Nf3 Nc6 Bb5 Nf6", "Berlin Defence", "C65", "Analysed by the Berlin school in the 1840s, dismissed as drawish, then resurrected by Kramnik to neutralise Kasparov in their 2000 world championship match.",
   "Black develops before deciding on ...a6. The main line leads to a queenless middlegame (the Berlin Wall) where Black's bishop pair offsets a damaged pawn structure."],
  ["e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8", "Berlin Wall", "C67", "The endgame Kramnik used to blunt Kasparov's 1.e4 in 2000.",
   "White has the kingside majority and a lead in development; Black has the bishop pair and a solid, long-term structure. Endgame technique decides."],
  ["e4 e5 Nf3 Nc6 Bb5 f5", "Schliemann Defence", "C63", "Carl Jaenisch analysed it in the 1840s; Adolf Schliemann popularised it. A gambit in the sharpest tradition.",
   "Black attacks the e4 pawn immediately and aims for open lines. White's most testing reply is Nc3."],
  ["e4 e5 Nf3 Nc6 Bb5 d6", "Steinitz Defence", "C62", "Wilhelm Steinitz's solid choice: defend e5 with the pawn and accept a cramped but sound position.",
   "Black keeps a tight centre; White gains space with d4. The Modern Steinitz (with ...a6 first) is the improved version."],
  ["e4 e5 Nf3 Nc6 Bb5 a6 Ba4 d6", "Modern Steinitz Defence", "C71", "Steinitz's setup improved by inserting ...a6, favoured by Keres and Alekhine.",
   "Black is solid on e5 and may later play ...f5. White presses with c3 and d4."],
  ["e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O b5 Bb3 Bb7", "Arkhangelsk Variation", "C78", "Developed by players from Arkhangelsk in the 1970s and 80s.",
   "Black puts the bishop on the long diagonal to pressure e4 and often follows with ...Bc5. Sharp and active."],
  // ---- Italian complex
  ["e4 e5 Nf3 Nc6 Bc4", "Italian Game", "C50", "The workhorse of Renaissance chess: Polerio, Greco and the Italian masters analysed it in the 16th and 17th centuries, and it opens most of the earliest surviving games.",
   "The bishop eyes f7, the weakest point in Black's camp. White can go for quick tactics (Evans, Two Knights) or a slow build with c3 and d3."],
  ["e4 e5 Nf3 Nc6 Bc4 Bc5", "Giuoco Piano", "C53", "\"The quiet game\", though its main lines are anything but. Greco's manuscripts (c.1620) are full of it.",
   "Symmetrical bishops, symmetrical aims. White chooses between the central push c3 and d4 or the modern slow treatment with d3."],
  ["e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+", "Giuoco Piano, main line", "C54", "The classical pawn centre with a pin: Greco's line, still played.",
   "White has a big centre and open lines; Black hits it with ...Nxe4 or ...d5. Greco Attack (Nc3) versus Bd2 keeps this alive."],
  ["e4 e5 Nf3 Nc6 Bc4 Bc5 d3", "Giuoco Pianissimo", "C50", "The \"very quiet game\". Elite players rediscovered it in the 2010s (Carlsen, Caruana, Anand) as a way to get Spanish-style play without Spanish theory.",
   "White delays d4, plays c3, Nbd2, Re1 and often h3 and Bb3, keeping a small, durable edge. Manoeuvring chess."],
  ["e4 e5 Nf3 Nc6 Bc4 Bc5 b4", "Evans Gambit", "C51", "Captain William Davies Evans, a Welsh sea captain, introduced it around 1827. Morphy and Anderssen adored it; Kasparov beat Anand with it in 1995.",
   "White gives a pawn to gain tempi with c3 and d4, building a huge centre and open lines for an attack on f7. Black must return material or defend precisely."],
  ["e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4", "Evans Gambit Accepted", "C52", "The classical acceptance, Anderssen's battleground.",
   "White's pawns roll forward; Black's bishop on a5 pins the c3 pawn. Lasker's defence (...d6 and returning the pawn) is the sober answer."],
  ["e4 e5 Nf3 Nc6 Bc4 Nf6", "Two Knights Defence", "C55", "Polerio analysed it around 1600. Black counterattacks e4 instead of copying White.",
   "White's Ng5 attacks f7 immediately; the calmer d3 leads to Italian-style play. Black must know the tactics of 4.Ng5."],
  ["e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5", "Two Knights, main line", "C58", "The principled answer to 4.Ng5, worked out in the 19th century.",
   "Black sacrifices a pawn for a lead in development after Bb5+ c6 dxc6 bxc6. Active play compensates."],
  ["e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7", "Fried Liver Attack", "C57", "Polerio's \"Fegatello\" (c.1600): a knight sacrifice that drags the king into the open. A staple of club chess for four centuries.",
   "After ...Kxf7 Qf3+ Ke6 White attacks the exposed king with d4 and Nc3. Black is objectively fine but must defend accurately."],
  ["e4 e5 Nf3 Nc6 Bc4 Nf6 d4", "Two Knights, Scotch Gambit style", "C56", "Max Lange and 19th-century attacking players preferred opening the centre.",
   "White sacrifices a pawn for rapid development and open lines against the king."],
  ["e4 e5 Nf3 Nc6 Bc4 Be7", "Hungarian Defence", "C50", "Named after a Pest–Paris correspondence game of 1842.",
   "Black avoids all the Italian tactics with a modest bishop. Solid, slightly passive."],
  // ---- Scotch
  ["e4 e5 Nf3 Nc6 d4", "Scotch Game", "C44", "Named for the Edinburgh vs London correspondence match of 1824. Out of fashion for a century until Kasparov used it against Karpov in 1990.",
   "White opens the centre immediately. Black gets easy development; White gets space and a lead in the fight for d5."],
  ["e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5", "Scotch, Classical Variation", "C45", "The old main line: pressure the knight and provoke Be3.",
   "Black develops actively; White may play Nxc6 or Be3 followed by c3 and Nc2 to keep the centre."],
  ["e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6", "Scotch, Schmidt Variation", "C45", "Ernst Schmidt's counterattack on e4.",
   "Leads to the Mieses line after Nxc6 bxc6 e5, where Black's doubled pawns are offset by active pieces."],
  ["e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4", "Mieses Variation", "C45", "Jacques Mieses's line, revived by Kasparov and Timman in the 1990s.",
   "White pushes the knight back with c4; Black has ...Ba6 and pressure on the e-file. Unbalanced and rich."],
  ["e4 e5 Nf3 Nc6 d4 exd4 Bc4", "Scotch Gambit", "C44", "A 19th-century favourite; Morphy played it.",
   "White delays recapturing to develop with tempo. Transposes to Italian lines or leads to sharp play after ...Bc5 c3."],
  ["e4 e5 Nf3 Nc6 d4 exd4 c3", "Göring Gambit", "C44", "Carl Göring played it in the 1870s. A close relative of the Danish Gambit.",
   "White offers one or two pawns for open lines and rapid development. Declining with ...d5 is the modern recommendation."],
  // ---- Petrov, Philidor
  ["e4 e5 Nf3 Nf6", "Petrov Defence", "C42", "Alexander Petrov and Carl Jaenisch analysed it in the 1840s (the Russian Game). Its reputation as a drawing weapon was cemented by Kramnik and Caruana.",
   "Black counterattacks e4 rather than defending e5. Symmetrical structures, early simplifications, and a solid road to equality."],
  ["e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3", "Petrov, Classical main line", "C42", "The standard position since the 19th century.",
   "White challenges the e4 knight with c4 or Re1; Black develops with ...Nc6, ...Be7 and holds the centre."],
  ["e4 e5 Nf3 d6", "Philidor Defence", "C41", "François-André Danican Philidor, the 18th-century master who declared pawns the soul of chess, recommended it in 1749.",
   "Black supports e5 with a pawn, keeps a compact centre and often fianchettoes nothing: a modest, resilient setup. White has more space."],
  // ---- Sicilian
  ["e4 c5", "Sicilian Defence", "B20", "Polerio noted it in 1594; the name was fixed by Jacob Sarratt in 1813. Louis Paulsen made it respectable in the 1870s, and since the 1950s it has been Black's most popular reply to 1.e4.",
   "Black fights for d4 with a flank pawn, keeping the position asymmetrical. White usually opens the centre with d4 to gain development; Black plays for the long term on the queenside."],
  ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6", "Najdorf Variation", "B90", "Miguel Najdorf's flexible waiting move became the weapon of Fischer and Kasparov, who both used it as the backbone of their repertoires.",
   "...a6 stops Nb5 and prepares ...e5 or ...b5. White chooses an attacking setup (Bg5, Be3 with f3, Bc4) and Black counters on the queenside."],
  ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6 f4", "Najdorf, main line 6.Bg5", "B96", "The critical test of the Najdorf in the Fischer era, home of the Poisoned Pawn (...Qb6).",
   "White throws the f-pawn forward; Black chooses ...Be7, ...Qb6 or ...Nbd7. Extremely sharp."],
  ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3", "Najdorf, English Attack", "B90", "Named for the English grandmasters (Nunn, Short, Chandler) who developed it in the 1980s.",
   "White plays f3, Qd2, O-O-O and g4; Black castles short and races with ...b5. Opposite-side attacks."],
  ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2", "Najdorf, Classical 6.Be2", "B92", "Karpov's choice: a quiet move against a sharp defence.",
   "White castles and plays a4 or f4 later; Black replies ...e5. Positional battle around d5."],
  ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bc4", "Najdorf, Fischer–Sozin Attack", "B86", "Veniamin Sozin's idea, adopted by Fischer as his main weapon against the Najdorf.",
   "The bishop on b3 targets f7 and e6. Black plays ...e6, ...b5 and ...Bb7."],
  ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6", "Dragon Variation", "B70", "Fyodor Dus-Chotimirsky named it in 1901 after the constellation Draco, which he thought the pawn structure resembled.",
   "Black's bishop on g7 rakes the long diagonal towards b2. White's most dangerous plan is the Yugoslav Attack; Black counters on the c-file."],
  ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6 O-O-O", "Yugoslav Attack", "B76", "Developed by Yugoslav masters in the 1950s, building on Rauzer's earlier ideas. Fischer called the plan \"pry open the h-file, sac, sac, mate\".",
   "White castles long and storms with h4-h5; Black uses ...Rc8, ...Ne5-c4 and exchange sacrifices on c3. Both kings are targets."],
  ["e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6", "Accelerated Dragon", "B34", "Black fianchettoes without ...d6, hoping for ...d5 in one go.",
   "Avoids the Yugoslav Attack but allows the Maroczy Bind with c4. Flexible, positional Dragon."],
  ["e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 c4", "Maroczy Bind", "B36", "Géza Maróczy's clamp on d5, feared for a century.",
   "White's pawns on c4 and e4 deny Black the ...d5 break. Black plays for ...b5 or slow piece pressure."],
  ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6", "Scheveningen Variation", "B80", "Named after the 1923 tournament in the Dutch seaside town. Kasparov's most reliable Sicilian.",
   "Black's small centre (d6, e6) is elastic and solid. White's sharpest try is the Keres Attack (g4); Black counters with ...b5 and ...Bb7."],
  ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6 g4", "Keres Attack", "B81", "Paul Keres's pawn thrust, the reason many players reach the Scheveningen via the Najdorf move order.",
   "White gains space and drives the f6 knight away; Black must react precisely with ...h6 or ...e5."],
  ["e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5", "Sveshnikov Variation", "B33", "Evgeny Sveshnikov and Gennady Timoshchenko developed it in the 1970s against orthodox opinion. Carlsen used it in his 2018 title match.",
   "Black accepts a backward d6 pawn and a hole on d5 for active pieces and the ...f5 break. Dynamic, deeply analysed."],
  ["e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5", "Sveshnikov, main line", "B33", "The critical tabiya since the 1980s.",
   "White plays Bxf6 and Nd5; Black uses the bishop pair and ...f5. Sharp, concrete play."],
  ["e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 e5", "Kalashnikov Variation", "B32", "A 1980s cousin of the Sveshnikov, named after the rifle for its directness.",
   "Same hole on d5, but with the knight still on g8 Black keeps more options."],
  ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6", "Classical Sicilian", "B56", "The oldest Open Sicilian setup: develop and see.",
   "White's Richter–Rauzer (Bg5) is the main test; Black keeps a flexible structure."],
  ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6 Bg5", "Richter–Rauzer Attack", "B60", "Kurt Richter and Vsevolod Rauzer, 1930s: the pin that shapes the Classical Sicilian.",
   "White plans Qd2 and O-O-O; Black chooses ...e6 and ...Bd7 or ...Qb6."],
  ["e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6", "Taimanov Variation", "B44", "Mark Taimanov's flexible system, a favourite of positional players.",
   "Black keeps the d-pawn back and develops with ...Qc7 and ...a6. White chooses between Nb5, Nc3 and the Maroczy setup."],
  ["e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6", "Kan Variation", "B41", "Ilya Kan's system: maximum flexibility, minimum commitment.",
   "Black may play ...Qc7, ...Nf6, ...d6 or ...b5 depending on White's setup. White often plays Bd3 or c4."],
  ["e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6", "Four Knights Sicilian", "B45", "A route to the Sveshnikov or Scheveningen with fewer forcing lines.",
   "Black's ...Bb4 pin and ...e5 are the main ideas."],
  ["e4 c5 Nc3 Nc6 g3", "Closed Sicilian", "B25", "Spassky's weapon and Smyslov's, avoiding the theory of the Open Sicilian.",
   "White fianchettoes and plays f4, Nf3 and a slow kingside build. Black expands on the queenside with ...Rb8 and ...b5."],
  ["e4 c5 Nc3 Nc6 f4", "Grand Prix Attack", "B23", "Named after the British weekend Grand Prix circuit of the 1980s, where Hebden and Hodgson used it to great effect.",
   "White aims for Bb5 or Bc4, O-O and a direct kingside attack with f5. Black counters with ...g6 and ...d5 ideas."],
  ["e4 c5 c3", "Alapin Variation", "B22", "Semyon Alapin's 19th-century idea, revived in the 1980s by Sveshnikov of all people.",
   "White prepares d4 without allowing ...cxd4 Nxd4. Black's best replies are ...Nf6 (hitting e4) and ...d5."],
  ["e4 c5 c3 Nf6 e5 Nd5", "Alapin, 2...Nf6", "B22", "The most popular reply: provoke e5 and target the pawn.",
   "White gets space; Black gets a good knight on d5 and pressure on the e5 pawn."],
  ["e4 c5 c3 d5 exd5 Qxd5", "Alapin, 2...d5", "B22", "The direct challenge: an open centre with the queen out early.",
   "White gains tempi on the queen with Nf3 and d4; Black has easy development and an isolated d-pawn to attack."],
  ["e4 c5 d4 cxd4 c3", "Smith–Morra Gambit", "B21", "Pierre Morra analysed it in the 1950s; Ken Smith championed it in America.",
   "White gives a pawn for open c- and d-files and rapid development. Declining with ...Nf6 or ...d3 is safe."],
  ["e4 c5 Nf3 d6 Bb5+", "Moscow Variation", "B51", "A modern anti-Sicilian, favoured by positional players who want a quiet game.",
   "White trades bishops or gains a tempo on the c6 knight; Black chooses ...Bd7, ...Nd7 or ...Nc6."],
  ["e4 c5 Nf3 Nc6 Bb5", "Rossolimo Variation", "B30", "Nicolas Rossolimo's line, a favourite of Fischer and later Carlsen.",
   "White threatens Bxc6 to damage the pawns, then plays a Spanish-style game. Black replies ...g6, ...e6 or ...d6."],
  // ---- French
  ["e4 e6", "French Defence", "C00", "Named for a Paris vs London correspondence match of 1834. Nimzowitsch and Botvinnik gave it its strategic depth; Korchnoi its fighting reputation.",
   "Black builds a solid pawn chain with ...d5 and counterattacks the base of White's chain (d4) with ...c5. The bad light-squared bishop is the eternal French problem."],
  ["e4 e6 d4 d5 e5", "Advance Variation", "C02", "Nimzowitsch loved it; Sveshnikov and later Grischuk modernised it.",
   "White gains space and clamps down on the kingside; Black hammers d4 with ...c5, ...Nc6 and ...Qb6."],
  ["e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6", "Advance, main line", "C02", "The classical tabiya of the Advance French.",
   "Black piles on d4 and b2; White defends with Be2 or a3 and later plays Bd3 with a kingside attack."],
  ["e4 e6 d4 d5 exd5", "Exchange Variation", "C01", "The quiet option, chosen by those who want to avoid the pawn chain fight.",
   "A symmetrical structure; play is about piece activity and the e-file."],
  ["e4 e6 d4 d5 Nd2", "Tarrasch Variation", "C03", "Siegbert Tarrasch's idea to avoid the ...Bb4 pin. Karpov's main weapon against the French.",
   "The knight stays flexible and c3 is available. Black chooses between ...c5 (open) and ...Nf6 (closed)."],
  ["e4 e6 d4 d5 Nd2 c5", "Tarrasch, 3...c5", "C07", "The freeing break, often leading to an isolated queen's pawn for Black.",
   "Black gets active pieces for a structural weakness; White plays against the d5 pawn."],
  ["e4 e6 d4 d5 Nd2 Nf6", "Tarrasch, 3...Nf6", "C05", "The closed treatment: White plays e5 and a chain fight follows.",
   "Black attacks d4 with ...c5 and ...Nc6; White defends with c3 and Ne2, eyeing the kingside."],
  ["e4 e6 d4 d5 Nc3 Bb4", "Winawer Variation", "C15", "Szymon Winawer played it in the 1870s; Botvinnik made it a world championship weapon.",
   "Black pins and usually trades on c3, saddling White with doubled pawns. White gets the bishop pair and a kingside attack. Deeply unbalanced."],
  ["e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7", "Winawer, main line", "C18", "The classical battleground of the Winawer.",
   "White plays Qg4 against the kingside; Black plays ...Qc7 or ...Qa5 and attacks c3 and the queenside."],
  ["e4 e6 d4 d5 Nc3 Nf6", "Classical French", "C11", "The oldest French main line, played before Winawer's pin was fashionable.",
   "White's e5 (Steinitz) gains space; Bg5 allows the Burn or MacCutcheon. A chain fight with kingside pressure for White."],
  ["e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7", "Steinitz Variation", "C11", "Steinitz's plan of grabbing space at once.",
   "White plays f4, Nf3 and Be3; Black attacks d4 with ...c5 and ...Nc6, often sacrificing on d4."],
  ["e4 e6 d4 d5 Nc3 Nf6 Bg5 dxe4", "Burn Variation", "C11", "Amos Burn's simplifying answer to the pin.",
   "Black relieves the tension and develops the bad bishop later; White keeps a small space edge."],
  ["e4 e6 d4 d5 Nc3 Nf6 Bg5 Bb4", "MacCutcheon Variation", "C12", "John Lindsay McCutcheon beat Steinitz with it in 1885.",
   "Black counter-pins and lets White wreck the kingside pawns for activity. Sharp and double-edged."],
  ["e4 e6 d4 d5 Nc3 dxe4", "Rubinstein Variation", "C10", "Akiba Rubinstein's solid choice, adopted by Fischer.",
   "Black gives up the centre for easy development and a sound structure. White has space; the fight is over who uses it."],
  // ---- Caro-Kann
  ["e4 c6", "Caro–Kann Defence", "B10", "Horatio Caro and Marcus Kann published analysis in 1886. Capablanca, Botvinnik, Petrosian and Karpov all used it.",
   "Black prepares ...d5 without blocking the c8 bishop. Solid structure, few weaknesses; the cost is a slower development."],
  ["e4 c6 d4 d5 e5 Bf5", "Advance Variation", "B12", "Tal used it; Nigel Short's 4.Nf3 e6 5.Be2 treatment made it the main line in the 1990s.",
   "White grabs space; Black develops the bishop outside the chain and hits d4 with ...c5. A pawn-chain battle."],
  ["e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5", "Classical Variation", "B18", "The traditional main line, a Capablanca and Karpov favourite.",
   "Black develops the bishop before ...e6; White gains kingside space with Ng3 and h4-h5."],
  ["e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7", "Classical, main line", "B19", "The tabiya of countless world championship games.",
   "White plays h5 and Bd3 to trade bishops; Black castles long or short and relies on a rock-solid structure."],
  ["e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7", "Karpov Variation", "B17", "Karpov's favourite: prepare ...Ngf6 without allowing doubled pawns.",
   "Black keeps the structure intact; White has a lead in development and attacking tries with Bc4 or Ng5."],
  ["e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Nxf6+ gxf6", "Bronstein–Larsen Variation", "B16", "Bronstein and Larsen accepted doubled f-pawns for open lines and the bishop pair.",
   "Black plays ...Bf5, ...Qc7 and castles long; the half-open g-file is an attacking asset."],
  ["e4 c6 d4 d5 exd5 cxd5", "Exchange Variation", "B13", "A quiet line, sometimes leading to the Panov.",
   "Symmetrical pawns; White tries Bd3 and a minority attack or c4 for the Panov structure."],
  ["e4 c6 d4 d5 exd5 cxd5 c4", "Panov–Botvinnik Attack", "B14", "Vasily Panov's 1930 idea, refined by Botvinnik.",
   "White accepts an isolated d-pawn for active pieces and space. Black blockades on d5 and aims for the endgame."],
  ["e4 c6 Nc3 d5 Nf3", "Two Knights Variation", "B11", "Fischer's early preference.",
   "White develops quickly and delays d4; Black's ...Bg4 pin is the main reply."],
  ["e4 c6 d4 d5 f3", "Fantasy Variation", "B12", "An offbeat line that supports e4 with the f-pawn.",
   "White keeps a big centre; Black challenges it with ...e6 and ...c5 or ...dxe4 fxe4 e5."],
  // ---- Scandinavian, Pirc, Modern, Alekhine
  ["e4 d5", "Scandinavian Defence", "B01", "The oldest recorded chess game (Valencia, 1475) opened this way. Scandinavian masters analysed it in the 19th century; Anand used it against Kasparov in 1995.",
   "Black challenges e4 at once and recaptures with the queen. White gains tempi on the queen; Black gets a solid Caro-Kann-like structure."],
  ["e4 d5 exd5 Qxd5 Nc3 Qa5", "Scandinavian, 3...Qa5", "B01", "The classical retreat, keeping the queen active.",
   "Black plays ...c6, ...Bf5 and ...e6; White uses the tempi for d4, Nf3 and Bc4."],
  ["e4 d5 exd5 Qxd5 Nc3 Qd6", "Scandinavian, 3...Qd6", "B01", "A modern retreat popularised by Sergei Tiviakov.",
   "The queen supports ...c6 and ...e5 ideas from a safer square."],
  ["e4 d5 exd5 Nf6", "Scandinavian, Modern Variation", "B01", "Marshall's gambit-style treatment.",
   "Black recaptures with the knight, keeping the queen home. White may hold the pawn with c4 or return it with d4."],
  ["e4 d6 d4 Nf6 Nc3 g6", "Pirc Defence", "B07", "Vasja Pirc and Anatoly Ufimtsev developed it in the 1930s and 40s: a hypermodern approach against 1.e4.",
   "Black lets White build a centre and attacks it later with ...e5 or ...c5. White's most aggressive plan is the Austrian Attack (f4)."],
  ["e4 d6 d4 Nf6 Nc3 g6 f4 Bg7 Nf3", "Austrian Attack", "B09", "Named for Austrian players of the 1930s. The most direct test of the Pirc.",
   "White prepares e5 and a kingside attack; Black counters with ...c5 or ...O-O and ...Na6."],
  ["e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2", "Pirc, Classical System", "B08", "The calm treatment: develop and castle.",
   "White keeps the centre and plays h3, Be3; Black plays ...O-O, ...c6 and ...e5 or ...a6."],
  ["e4 d6 d4 Nf6 Nc3 g6 Be3", "150 Attack", "B07", "Named by British club players (rated about 150 ECF) who used it to storm the Pirc with Qd2 and Bh6.",
   "White plays f3, Qd2, Bh6 and h4-h5; Black must counter fast in the centre."],
  ["e4 g6 d4 Bg7", "Modern Defence", "B06", "Karl Robatsch and others made it a system in the 1960s: the Pirc without ...Nf6.",
   "Black delays committing the knight, keeping ...c5, ...d6 or ...c6 and ...d5 options. White has a free hand in the centre."],
  ["e4 Nf6", "Alekhine's Defence", "B02", "Alexander Alekhine introduced it at Budapest 1921, provoking White's pawns forward to attack them later.",
   "Black invites e5, d4, c4 and f4 and then undermines the overextended centre. White must choose between the modest Modern (Nf3) and the ambitious Four Pawns."],
  ["e4 Nf6 e5 Nd5 d4 d6 Nf3", "Alekhine, Modern Variation", "B04", "The solid choice: take space but don't overreach.",
   "White develops and plays Be2, O-O and c4 later; Black chooses ...Bg4 or ...g6."],
  ["e4 Nf6 e5 Nd5 d4 d6 c4 Nb6 f4", "Alekhine, Four Pawns Attack", "B03", "The maximalist approach: take everything.",
   "White's centre is enormous but fragile; Black plays ...dxe5 fxe5 Nc6 and hits d4 hard."],
  ["e4 Nf6 e5 Nd5 d4 d6 c4 Nb6 exd6", "Alekhine, Exchange Variation", "B03", "A quieter reduction of the tension.",
   "Black recaptures with the e-pawn (solid) or c-pawn (active); White has space, Black has no weaknesses."],
  // ---- King's Gambit, Vienna
  ["e4 e5 f4", "King's Gambit", "C30", "Polerio and Greco analysed it; it was the romantic era's favourite, immortalised by Anderssen's 1851 Immortal Game. Fischer's 1961 article \"A Bust to the King's Gambit\" damaged its reputation, but it never died.",
   "White gives a pawn to open the f-file and build a centre with d4. Black can take and hold the pawn, take and return it, or decline with ...Bc5 or the Falkbeer ...d5."],
  ["e4 e5 f4 exf4", "King's Gambit Accepted", "C33", "The principled reply: take the pawn and try to keep it.",
   "White chooses the King's Knight's Gambit (Nf3) or Bishop's Gambit (Bc4). Black's ...g5 holds the pawn at the cost of the kingside."],
  ["e4 e5 f4 exf4 Nf3", "King's Knight's Gambit", "C34", "The classical continuation, stopping ...Qh4+.",
   "Black's main tries are ...g5 (Kieseritzky lines), ...d5 (Modern) and ...Nf6."],
  ["e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5", "Kieseritzky Gambit", "C39", "Lionel Kieseritzky's line, the setting of the Immortal Game.",
   "White's knight on e5 and the h-file give attacking chances; Black holds the f4 pawn. Wild."],
  ["e4 e5 f4 exf4 Bc4", "Bishop's Gambit", "C33", "Bronstein and Fischer both played it: allow ...Qh4+ and lose castling rights for a tempo.",
   "White plays Kf1 and later Nf3, driving the queen away with gain of time."],
  ["e4 e5 f4 Bc5", "King's Gambit Declined", "C30", "The sensible refusal: the bishop stops White from castling.",
   "Black keeps the centre and aims to punish f4 later with ...d6 and ...Nf6."],
  ["e4 e5 f4 d5", "Falkbeer Countergambit", "C31", "Ernst Falkbeer's 1850s reply: counter a gambit with a gambit.",
   "Black offers a pawn to open the centre before White is ready. After exd5 e4 White's development is awkward."],
  ["e4 e5 Nc3", "Vienna Game", "C25", "Developed by the Viennese masters of the 1850s (Hamppe, Falkbeer) as a delayed King's Gambit.",
   "White prepares f4 with the knight already on c3, or plays Bc4 for Italian-style pressure. Black's ...Nf6 and ...d5 is the freeing plan."],
  ["e4 e5 Nc3 Nf6 f4", "Vienna Gambit", "C29", "The Vienna's teeth: f4 with c3 knight support.",
   "Black should reply ...d5 and after fxe5 Nxe4 has a fine game; ...exf4 is risky because of e5."],
  ["e4 e5 Nc3 Nf6 Bc4", "Vienna, 3.Bc4", "C28", "A positional Vienna leading to Italian-style play.",
   "Black's ...Nxe4 is a temporary sacrifice; ...Nc6 keeps it quiet."],
  // ---- Queen's Gambit family
  ["d4 d5 c4", "Queen's Gambit", "D06", "Recorded in the Göttingen manuscript (c.1490). It became the classical opening of the Steinitz–Lasker–Capablanca era and remains the backbone of 1.d4.",
   "Not a true gambit: White offers the c-pawn to deflect the d5 pawn and claim the centre. Black declines with ...e6 or ...c6, or accepts and returns it for freedom."],
  ["d4 d5 c4 e6", "Queen's Gambit Declined", "D30", "The solid classical answer, played in every world championship of the 1920s and 30s.",
   "Black keeps d5 at the cost of the c8 bishop, which must be freed later with ...c5, ...dxc4 or ...b6. White presses with Nc3, Bg5 and e3."],
  ["d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7", "QGD, Orthodox Defence", "D63", "The main line of the 1920s: Capablanca vs Alekhine 1927 was fought largely here.",
   "Black frees with ...c6, ...dxc4 and ...Nd5 (Capablanca's freeing manoeuvre); White keeps a small, lasting edge."],
  ["d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6", "Tartakower Defence", "D58", "Savielly Tartakower's plan (also credited to Makogonov and Bondarevsky), Karpov's and Kasparov's choice for its reliability.",
   "The bishop comes to b7, solving the classic QGD problem. Balanced and durable."],
  ["d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 Ne4", "Lasker Defence", "D56", "Emanuel Lasker's simplifying idea.",
   "Black trades two minor pieces to relieve the cramp, then frees with ...c5. Solid, slightly drawish."],
  ["d4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 e3 c6 Nf3 Qa5", "Cambridge Springs Defence", "D52", "Named for the 1904 tournament in Cambridge Springs, Pennsylvania, where it was played repeatedly.",
   "Black pins the c3 knight and eyes the g5 bishop with ...Ne4 and ...Bb4. White must handle the tactics on the a5–e1 diagonal."],
  ["d4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5", "QGD, Exchange Variation", "D35", "The Carlsbad structure, weaponised by Botvinnik and Kasparov.",
   "White plays the minority attack (b4-b5) to create a weak c6 pawn; Black seeks kingside play with ...Ne4 or ...f5."],
  ["d4 d5 c4 e6 Nc3 c5", "Tarrasch Defence", "D32", "Tarrasch believed free piece play was worth an isolated pawn. Kasparov used it in his 1984 title challenge.",
   "Black accepts an isolated d-pawn for open lines and activity; White plays g3 and Bg2 to pressure d5."],
  ["d4 d5 c4 e6 Nc3 Nf6 Nf3 Bb4", "Ragozin Defence", "D38", "Viacheslav Ragozin's mix of QGD and Nimzo-Indian ideas, a modern favourite.",
   "Black pins and prepares ...dxc4 and ...c5. Flexible and active."],
  ["d4 d5 c4 dxc4", "Queen's Gambit Accepted", "D20", "Steinitz and Alekhine played it; Alekhine's 1937 rematch win over Euwe leaned on it.",
   "Black takes the pawn not to keep it but to free ...c5 and ...e6 quickly. White regains the pawn with Bxc4 and plays for the centre."],
  ["d4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6", "QGA, Classical main line", "D27", "The standard tabiya of the QGA.",
   "Black plays ...b5 and ...Bb7; White chooses between Qe2 with e4 and a4 to stop the expansion."],
  ["d4 d5 c4 c6", "Slav Defence", "D10", "Analysed by Slavic masters (Alapin, Alekhine, Bogoljubov) in the 1920s. Its virtue: the c8 bishop stays free.",
   "Black supports d5 without blocking the bishop. The main line ...dxc4 with ...Bf5 gives easy development; White fights for e4."],
  ["d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5", "Slav, main line", "D17", "The classical Slav tabiya since Euwe–Alekhine.",
   "White regains the pawn and plays e4 or Ne5; Black keeps the bishop pair active and plays ...e6, ...Bb4."],
  ["d4 d5 c4 c6 cxd5 cxd5", "Exchange Slav", "D13", "The drawing option, though White can press with Bf4 and e3.",
   "Symmetry; the side that misplaces a piece first suffers."],
  ["d4 d5 c4 c6 Nc3 Nf6 Nf3 e6", "Semi-Slav Defence", "D43", "A hybrid of Slav and QGD, sharpened by Botvinnik and later Kramnik and Anand.",
   "Black keeps both ...dxc4 with ...b5 (Meran) and the Botvinnik gambit in reserve. White chooses e3 (Meran) or Bg5 (Botvinnik/Moscow)."],
  ["d4 d5 c4 c6 Nc3 Nf6 Nf3 e6 e3 Nbd7 Bd3 dxc4 Bxc4 b5", "Meran Variation", "D47", "From Grünfeld–Rubinstein, Meran 1924.",
   "Black expands with ...b5, ...a6 and ...c5; White plays e4 and a kingside attack. Both sides have their chances."],
  ["d4 d5 c4 c6 Nc3 Nf6 Nf3 e6 Bg5 dxc4 e4 b5", "Botvinnik Variation", "D44", "Botvinnik–Denker, USA–USSR radio match 1945, is the founding game. One of the sharpest lines in all of chess.",
   "White sacrifices a piece for a huge centre and attack; Black keeps material and counterattacks. Memorisation required."],
  ["d4 d5 c4 c6 Nc3 Nf6 Nf3 e6 Bg5 h6 Bxf6", "Moscow Variation", "D43", "A calmer alternative to the Botvinnik.",
   "White gives the bishop pair for a lead in development and e4; Black relies on the bishops long-term."],
  ["d4 d5 c4 Nc6", "Chigorin Defence", "D07", "Chigorin's romantic idea: knights over bishops, activity over structure.",
   "Black gives up the centre and often the bishop pair for piece play. Unfashionable but sound enough."],
  ["d4 d5 c4 e5", "Albin Countergambit", "D08", "Adolf Albin played it against Lasker in 1893. Morozevich revived it a century later.",
   "Black offers a pawn for the advanced d4 wedge and tactics such as the Lasker Trap. White returns to development calmly."],
  // ---- Indian Defences
  ["d4 Nf6", "Indian Defence", "A45", "Named for the Indian player Moheschunder Bannerjee, whose games against Cochrane in the 1850s featured fianchettoes. The hypermoderns of the 1920s built a theory on it.",
   "Black delays ...d5 and keeps flexibility. Which Indian defence follows depends on the second and third moves."],
  ["d4 Nf6 c4 g6 Nc3 Bg7 e4 d6", "King's Indian Defence", "E70", "Hypermodern in spirit (Réti, Nimzowitsch), it was made a fighting weapon by Bronstein and Boleslavsky in the 1940s, then Fischer and Kasparov.",
   "Black concedes the centre, then attacks it with ...e5 or ...c5 and launches a kingside pawn storm. White expands on the queenside. A race."],
  ["d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5", "KID, Classical Variation", "E91", "The main line since the 1950s.",
   "After d5 White plays c5 and b4 on the queenside; Black plays ...Ne7, ...f5 and ...g5 for mate. The Mar del Plata race."],
  ["d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7", "Mar del Plata Variation", "E97", "Najdorf–Gligorić, Mar del Plata 1953 set the pattern.",
   "Opposite-wing attacks in their purest form: White's b4-c5, Black's ...f5-f4 and ...g4."],
  ["d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 d5", "KID, Petrosian System", "E92", "Petrosian's idea of closing the centre early to cramp Black.",
   "White plays Bg5 to slow ...f5; Black manoeuvres with ...Na6, ...h6 and ...Nh7."],
  ["d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3", "Sämisch Variation", "E80", "Friedrich Sämisch's solid setup, supporting e4 and preparing a queenside castle and g4.",
   "White plays Be3, Qd2 and O-O-O; Black chooses ...c5, ...e5 or the ...Nc6 with ...a6, ...Rb8 plan."],
  ["d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f4", "Four Pawns Attack", "E76", "The maximalist answer: take all the centre and dare Black to break it.",
   "Black must react at once with ...c5; White's centre is strong but brittle."],
  ["d4 Nf6 c4 g6 g3 Bg7 Bg2 O-O Nf3 d6", "KID, Fianchetto Variation", "E62", "The positional treatment favoured by Korchnoi and Karpov.",
   "White's bishop on g2 blunts Black's kingside attack; Black plays ...Nbd7, ...e5 or the ...c5 Panno setup."],
  ["d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Be2 O-O Bg5", "Averbakh Variation", "E73", "Yuri Averbakh's bishop pin, preventing an early ...e5.",
   "White's Qd2 and O-O-O ideas; Black plays ...c5 or ...Na6 and ...e5 later."],
  ["d4 Nf6 c4 e6 Nc3 Bb4", "Nimzo-Indian Defence", "E20", "Aron Nimzowitsch's creation of the 1920s, explained in \"My System\": control the centre with pieces, not pawns.",
   "Black pins the knight and threatens to double White's pawns, fighting for e4. White's choices (e3, Qc2, a3, f3) each define a different middlegame."],
  ["d4 Nf6 c4 e6 Nc3 Bb4 e3", "Rubinstein Variation", "E40", "Rubinstein's flexible development, the most popular reply since the 1930s.",
   "White develops with Bd3, Nf3 and O-O; Black chooses ...O-O with ...d5 and ...c5, or the ...b6 fianchetto."],
  ["d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5", "Rubinstein, main line", "E53", "The classical tabiya with a full centre battle.",
   "After O-O Nc6 Black eyes ...dxc4 and ...Bxc3; White accepts doubled pawns for the bishop pair and a central mass."],
  ["d4 Nf6 c4 e6 Nc3 Bb4 Qc2", "Classical (Capablanca) Variation", "E32", "Capablanca's answer: recapture on c3 with the queen and keep the structure.",
   "White avoids doubled pawns at the cost of a tempo; Black plays ...O-O, ...c5 or ...d5 quickly."],
  ["d4 Nf6 c4 e6 Nc3 Bb4 a3 Bxc3+ bxc3", "Sämisch Variation", "E25", "Sämisch's forcing line: accept the doubled pawns for the bishop pair and a big centre.",
   "White plays f3 and e4; Black blockades with ...c5, ...Nc6 and ...Ba6 to attack the c4 weakness."],
  ["d4 Nf6 c4 e6 Nc3 Bb4 Bg5", "Leningrad Variation", "E30", "Spassky's pin, developed by Leningrad players.",
   "White keeps the pin; Black replies ...h6, ...c5 and ...d6 with ...e5."],
  ["d4 Nf6 c4 e6 Nc3 Bb4 Nf3", "Kasparov Variation", "E21", "Kasparov used it early in his career to reach fresh positions.",
   "White delays commitment; Black chooses ...c5, ...b6 or ...O-O."],
  ["d4 Nf6 c4 e6 Nf3 b6", "Queen's Indian Defence", "E12", "Nimzowitsch's sister opening to the Nimzo-Indian: control e4 from b7.",
   "Black fianchettoes and holds e4 with pieces. White's g3 (Rubinstein) or a3 (Petrosian, stopping ...Bb4) are the main tries."],
  ["d4 Nf6 c4 e6 Nf3 b6 g3 Bb7 Bg2 Be7 O-O O-O", "Queen's Indian, Classical", "E17", "The old main line, a Karpov speciality.",
   "Quiet, symmetrical fianchettoes; White plays Nc3 and Qc2 with e4, Black ...d5 or ...Ne4."],
  ["d4 Nf6 c4 e6 Nf3 b6 a3", "Petrosian Variation", "E12", "Petrosian's prophylaxis against ...Bb4; Kasparov's main weapon in the 1980s.",
   "White prepares Nc3 and d5 or e4; Black plays ...Bb7 and ...d5."],
  ["d4 Nf6 c4 e6 Nf3 b6 g3 Ba6", "Queen's Indian, 4...Ba6", "E15", "Nimzowitsch's provocative bishop, hitting c4.",
   "White must defend c4 awkwardly with b3 or Qc2; Black gains time for ...Bb4+ and ...c5."],
  ["d4 Nf6 c4 e6 Nf3 Bb4+", "Bogo-Indian Defence", "E11", "Efim Bogoljubov's check, a sound alternative to the Queen's Indian.",
   "After Bd2 Black chooses ...Qe7, ...a5 or ...Bxd2+. Solid and low-theory."],
  ["d4 Nf6 c4 g6 Nc3 d5", "Grünfeld Defence", "D80", "Ernst Grünfeld introduced it against Alekhine in Vienna 1922. Fischer used it to beat Botvinnik; Kasparov made it his main defence.",
   "Black lets White build a full pawn centre and attacks it from a distance with ...Bg7, ...c5 and ...Nc6. The centre is the target, not the prize."],
  ["d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7", "Exchange Variation", "D85", "The principled main line: build the centre and defend it.",
   "White chooses Nf3 with Rb1 (modern) or Bc4 with Ne2 (classical). Black hits d4 with ...c5, ...Nc6 and ...Qa5."],
  ["d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7 Bc4", "Exchange, Classical 7.Bc4", "D87", "The classical setup with Ne2 to keep the f3 square for the f-pawn.",
   "White plays Be3, O-O and pushes d5; Black plays ...c5, ...Nc6 and ...Bg4."],
  ["d4 Nf6 c4 g6 Nc3 d5 Nf3 Bg7 Qb3", "Russian Variation", "D96", "Botvinnik and Smyslov's early queen sortie, forcing ...dxc4.",
   "White regains the pawn with tempo and gets e4; Black counters with ...Bg4 or ...a6 and ...b5."],
  ["d4 Nf6 c4 g6 Nc3 d5 Bf4", "Grünfeld, 4.Bf4", "D82", "A solid development scheme popular in the 1930s.",
   "White holds the centre with e3; Black plays ...Bg7 and ...c5 to free the game."],
  ["d4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6", "Modern Benoni", "A60", "The Benoni (\"son of sorrow\" in Hebrew) appears in Aaron Reinganum's 1825 book. Tal turned the Modern Benoni into a fighting weapon in the 1950s.",
   "Black accepts a cramped d6 pawn for a queenside majority and dynamic piece play (...Bg7, ...Re8, ...b5). White has central space and the e5 break."],
  ["d4 Nf6 c4 c5 d5 b5", "Benko Gambit", "A57", "Pal Benko popularised it in the 1960s (also the Volga Gambit).",
   "Black gives a pawn for lasting pressure on the a- and b-files with ...Bg7 and ...Qa5. Compensation is positional, not tactical."],
  ["d4 f5", "Dutch Defence", "A80", "Elias Stein recommended it in 1789. Botvinnik and later Nakamura used it as a fighting weapon.",
   "Black stakes out e4 and aims at the kingside. The weakened e8–h5 diagonal is the price. Leningrad, Stonewall and Classical are the three main systems."],
  ["d4 f5 c4 Nf6 g3 g6", "Leningrad Dutch", "A87", "Developed in Leningrad in the 1950s: a Dutch with a King's Indian bishop.",
   "Black plays ...Bg7, ...O-O, ...d6 and ...e5 or ...c6 with ...Qe8. Sharp."],
  ["d4 f5 c4 Nf6 g3 e6 Bg2 d5", "Stonewall Dutch", "A90", "A pawn wall (d5, e6, f5) that Botvinnik used to win world championship games.",
   "Black secures e4 for a knight and attacks on the kingside; the hole on e5 and the bad c8 bishop are the drawbacks."],
  // ---- Queen's pawn systems
  ["d4 d5 Bf4", "London System", "D02", "Named for the London 1922 tournament, where Réti, Capablanca and Alekhine all used it. A 2010s explosion in popularity (Carlsen, Kamsky) made it the club player's favourite.",
   "White develops the bishop outside the pawn chain, then plays e3, c3, Nbd2 and Bd3: the same setup against almost everything. Solid, low-theory, with kingside chances."],
  ["d4 Nf6 Bf4", "London System vs ...Nf6", "A45", "The flexible London move order.",
   "White's setup is identical; Black's ...c5 and ...Qb6 pressure on b2 is the main challenge."],
  ["d4 d5 Bf4 Nf6 e3 c5 c3 Nc6 Nd2 e6 Ngf3", "London System, main line", "D02", "The standard London tabiya.",
   "White plays Bd3, O-O and often Ne5 with a kingside attack; Black plays ...Bd6 and ...Qb6 or ...O-O."],
  ["d4 d5 Nf3 Nf6 e3", "Colle System", "D04", "Edgard Colle's 1920s system: a quiet buildup ending with an e4 break.",
   "White plays Bd3, c3, Nbd2 and e4; the Colle–Zukertort version uses b3 and Bb2 instead of c3."],
  ["d4 Nf6 Nf3 e6 Bg5", "Torre Attack", "A46", "Carlos Torre beat Lasker with it in Moscow 1925 (the famous windmill game).",
   "White pins and plays e3, Nbd2 and c3; Black frees with ...c5 and ...h6."],
  ["d4 Nf6 Bg5", "Trompowsky Attack", "A45", "Octávio Trompowsky, Brazilian champion of the 1930s and 40s. Hodgson and Adams revived it in the 1990s.",
   "White threatens to double Black's pawns and avoids Indian defences entirely. Black replies ...Ne4, ...e6 or ...c5."],
  // ---- Flank openings
  ["c4", "English Opening", "A10", "Howard Staunton, the Englishman, used it against Saint-Amant in 1843. Botvinnik, Karpov and Kasparov gave it world championship credentials.",
   "A flank claim on d5 without committing the centre. White often fianchettoes with g3; Black chooses ...e5 (Reversed Sicilian), ...c5 (Symmetrical) or ...Nf6 with ...e6."],
  ["c4 e5", "Reversed Sicilian", "A20", "The natural reply: give White a Sicilian with an extra tempo and see if it matters.",
   "Black stakes out d4; White plays Nc3, g3 and Bg2 or the Botvinnik system with e4."],
  ["c4 e5 Nc3 Nf6 Nf3 Nc6", "English, Four Knights", "A28", "A standard Reversed Sicilian setup.",
   "White chooses g3, e3 or d4; Black plays ...Bb4 or ...d5."],
  ["c4 e5 Nc3 Nf6 g3 d5 cxd5 Nxd5 Bg2", "English, Reversed Dragon", "A22", "A Dragon Sicilian with colours reversed and a tempo up.",
   "White's Bg2 eyes the queenside; Black's knight on d5 and ...Nb6 plan hold the centre."],
  ["c4 c5", "Symmetrical English", "A30", "The equaliser's choice, played by Petrosian and Karpov.",
   "Mirrored structures; the Hedgehog (Black's ...b6, ...d6, ...a6) and the Botvinnik setup are the main plans."],
  ["c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 e4", "Botvinnik System", "A36", "Botvinnik's pawn triangle (c4, d3, e4) with a fianchetto.",
   "White clamps d5 and plays f4 for a kingside attack; Black mirrors or plays ...e6 and ...d5."],
  ["c4 Nf6 Nc3 e6 e4", "Mikėnas–Carls Variation", "A18", "Vladas Mikėnas's aggressive push against the Nimzo-style setup.",
   "White threatens e5; Black replies ...d5 or ...c5 with sharp play."],
  ["Nf3 d5 c4", "Réti Opening", "A09", "Richard Réti's hypermodern system beat Capablanca at New York 1924, ending his eight-year unbeaten run.",
   "White attacks d5 from the flank and fianchettoes one or both bishops. Black holds with ...e6 or ...c6, or advances ...d4."],
  ["Nf3 d5 c4 dxc4", "Réti Accepted", "A09", "Black takes the pawn; White regains it with Na3 or Qa4+.",
   "White gets a lead in development; Black must return the pawn sensibly."],
  ["Nf3 d5 c4 d4", "Réti, Advance Variation", "A09", "Black grabs space, creating a reversed Benoni.",
   "White undermines with e3 and b4; Black defends d4 with ...c5 and ...Nc6."],
  ["Nf3 d5 g3", "King's Indian Attack", "A07", "Fischer's favourite universal system against 1...e6 and 1...c6 players.",
   "White plays Bg2, O-O, d3, Nbd2, e4 and a kingside attack with e5 and h4. Same plan every game."],
  ["d4 Nf6 c4 e6 g3 d5 Bg2", "Catalan Opening", "E01", "Named when Tartakower was asked to honour Catalonia at Barcelona 1929. Kramnik and Carlsen made it a modern main line.",
   "White combines the Queen's Gambit with a fianchetto: the g2 bishop presses the long diagonal. Black either takes on c4 (Open Catalan) or holds with ...Be7 (Closed)."],
  ["d4 Nf6 c4 e6 g3 d5 Bg2 dxc4", "Open Catalan", "E02", "Black takes the pawn and tries to keep it with ...a6 and ...b5.",
   "White regains it with Qa4+ or Qc2 and keeps long-term pressure."],
  ["d4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O O-O", "Closed Catalan", "E06", "The solid main line of the Catalan.",
   "Black plays ...dxc4 later or ...c6 and ...b6; White presses with Qc2, Nbd2 and e4."],
  ["f4", "Bird's Opening", "A02", "Henry Bird's 19th-century speciality, a reversed Dutch.",
   "White stakes out e5 and often fianchettoes with b3 and Bb2. Black's ...d5 is the standard reply; ...e5 (From's Gambit) the sharp one."],
  ["b3", "Nimzo-Larsen Attack", "A01", "Nimzowitsch played it in the 1920s; Bent Larsen made it his own in the 1960s and 70s.",
   "White fianchettoes at once, targeting e5 and the long diagonal. Flexible and provocative."],
];

function buildBook() {
  const root = { children: {}, info: null };
  for (const [moves, name, eco, origin, plan] of BOOK_LINES) {
    let node = root;
    for (const san of moves.split(" ")) {
      if (!node.children[san]) node.children[san] = { children: {}, info: null };
      node = node.children[san];
    }
    node.info = { name, eco, origin, plan, depth: moves.split(" ").length };
  }
  return root;
}
const BOOK = buildBook();

// Walk the played SANs through the tree. Returns the deepest named card,
// whether we are still in book, and the candidate book replies.
function bookLookup(sans) {
  let node = BOOK, info = null, inBook = true, leftAt = null;
  for (let i = 0; i < sans.length; i++) {
    const next = node.children[sans[i]];
    if (!next) { inBook = false; leftAt = i + 1; break; }
    node = next;
    if (node.info) info = node.info;
  }
  return { info, inBook, leftAt, replies: inBook ? Object.keys(node.children) : [] };
}

/* ================= MOTIF RECOGNITION ================= */

const MOTIFS = {
  fork: { name: "Fork", kind: "tactic",
    origin: "One of the oldest tactical ideas; the term comes from 19th-century English chess writing. The knight fork of king and queen is the classic \"family fork\".",
    plan: "One piece attacks two or more targets at once. The opponent can save only one, so material is won. Watch for it whenever a knight lands near the king and queen." },
  pin: { name: "Pin", kind: "tactic",
    origin: "Philidor described pins in 1749; Ruy López's 3.Bb5 is chess's most famous positional pin. An absolute pin (to the king) makes the pinned piece legally immobile.",
    plan: "A line piece attacks a piece that cannot move without exposing something more valuable behind it. Pile on the pinned piece, or use its immobility elsewhere." },
  skewer: { name: "Skewer", kind: "tactic",
    origin: "The term was coined by Edgar Pennell in the 1930s for the reverse pin: the valuable piece is in front.",
    plan: "Attack a valuable piece along a line; when it moves, capture the piece behind it. Rook and bishop checks on open lines produce most skewers." },
  discovered: { name: "Discovered attack", kind: "tactic",
    origin: "A staple of Greco's 17th-century combinations. Legall's mate (1750) is the oldest famous example of a discovered attack combined with a queen sacrifice.",
    plan: "Moving one piece unmasks an attack from another. The moving piece can make its own threat, so the opponent faces two problems in one move." },
  doublecheck: { name: "Double check", kind: "tactic",
    origin: "The most forcing move in chess: Réti's mate and the Anderssen–Kieseritzky Immortal Game (1851) turn on it.",
    plan: "Two pieces check at once, so the king must move; capturing or blocking cannot answer both. Often the prelude to mate." },
  backrank: { name: "Back-rank mate", kind: "tactic",
    origin: "A pattern as old as castling. The remedy, a \"luft\" (air) for the king with h3 or ...h6, is one of the first defensive habits players learn.",
    plan: "A rook or queen delivers mate on the first rank because the king's own pawns block its escape. Check the back rank before every trade of rooks." },
  sacrifice: { name: "Sacrifice", kind: "tactic",
    origin: "The romantic school (Anderssen, Morphy) built whole games on sacrifice; Tal made intuitive sacrifices an art in the 1960s.",
    plan: "Material is given up for a concrete return: mate, a decisive attack, or a winning endgame. If the return is not concrete, it is a blunder with better publicity." },
  gambit: { name: "Gambit pawn", kind: "tactic",
    origin: "Ruy López borrowed \"gambetto\" (a wrestler's trip) from Italian in 1561 for a pawn offered in the opening.",
    plan: "A pawn is offered for time, open lines and initiative. The gambiteer must keep the pace up; the defender's job is to consolidate and cash in the pawn later." },
  castle: { name: "Castling", kind: "development",
    origin: "Evolved from the medieval \"king's leap\"; the modern rule was standardised by the 17th century in Italy and France. It is the only move that shifts two pieces at once.",
    plan: "Tuck the king behind its pawns and bring the rook towards the centre. Castling early is sound advice; castling into a pawn storm is not." },
  castleQ: { name: "Queenside castling", kind: "development",
    origin: "Rarer than kingside castling because it takes one move longer to prepare. Opposite-side castling (one king each wing) is the recipe for mutual pawn storms, as in the Sicilian Dragon.",
    plan: "The king goes to c1/c8 and the rook lands on the d-file at once. It signals an intention to attack with the kingside pawns." },
  fianchetto: { name: "Fianchetto", kind: "positional",
    origin: "Italian for \"little flank\". The hypermoderns (Réti, Nimzowitsch, Grünfeld) made it central to their theory in the 1920s: control the centre from a distance.",
    plan: "A bishop on the long diagonal exerts pressure across the whole board and shelters the castled king. The knight's pawn in front of it must not be traded away lightly." },
  duo: { name: "Central pawn duo", kind: "positional",
    origin: "The classical ideal, championed by Tarrasch: two pawns abreast on e4 and d4 (or e5 and d5).",
    plan: "Side by side, the pawns control four central squares and can advance to gain space. The duo is strong while it stays mobile and supported." },
  iqp: { name: "Isolated queen's pawn", kind: "positional",
    origin: "The great strategic debate of the classical era. Tarrasch praised its dynamism; Steinitz and later Nimzowitsch treated it as a target to blockade.",
    plan: "The side with the IQP has space and open lines and should attack before the endgame. The other side blockades on the square in front and trades pieces." },
  doubled: { name: "Doubled pawns", kind: "positional",
    origin: "Philidor warned against them in 1749. Doubled pawns cannot protect each other and leave a half-open file.",
    plan: "For the side accepting them: use the open file and extra central control. For the opponent: fix them and attack the base." },
  passed: { name: "Passed pawn", kind: "positional",
    origin: "Nimzowitsch: \"a passed pawn is a criminal which should be kept under lock and key.\" Its promotion threat decides most endgames.",
    plan: "No enemy pawn can stop it. Support it from behind with a rook and advance it in the endgame. The opponent must blockade it with a piece." },
  outpost: { name: "Outpost", kind: "positional",
    origin: "Nimzowitsch defined it in \"My System\" (1925): a square in the enemy camp protected by a pawn and immune to enemy pawns.",
    plan: "A knight on an outpost is worth a rook, Nimzowitsch claimed. Occupy it, support it, and let the opponent work out how to dislodge it." },
  openfile: { name: "Rook on an open file", kind: "positional",
    origin: "Rook play was systematised by the classical school; Nimzowitsch's rule was that the open file exists to be invaded to the seventh rank.",
    plan: "A rook on a file without pawns can penetrate. Double the rooks on it before the opponent contests it." },
  seventh: { name: "Rook on the seventh", kind: "positional",
    origin: "Nimzowitsch called the seventh rank the rook's \"ideal\". Two rooks there are the \"pigs on the seventh\", so named for the way they devour pawns.",
    plan: "A rook on the seventh attacks pawns from the side and confines the king. It is often worth a pawn to get it there." },
  bishops: { name: "Bishop pair", kind: "positional",
    origin: "Steinitz identified the two bishops as a long-term advantage in the 1880s. In open positions they are usually worth about half a pawn.",
    plan: "Open the position and avoid trading a bishop for a knight. The side without the pair wants a closed centre and secure knight squares." },
  pawnbreak: { name: "Pawn break", kind: "positional",
    origin: "Philidor taught that pawns should advance in phalanx and that the pawn lever opens the game at the right moment.",
    plan: "A pawn advance that contacts an enemy pawn to open lines or shift the structure. Timing is everything: break when your pieces are ready and the opponent's are not." },
  minority: { name: "Minority attack", kind: "positional",
    origin: "The signature plan of the Carlsbad structure, worked out in the 1920s and turned into a weapon by Botvinnik in the QGD Exchange.",
    plan: "Two pawns advance against three to create a weak pawn (usually on c6) rather than to win space. Patient, and hard to meet." },
  opposition: { name: "The opposition", kind: "endgame",
    origin: "The foundation of king-and-pawn endings, known since Philidor. The side not to move, with the kings facing one square apart, holds the opposition.",
    plan: "Whoever must move has to give way. Use it to force the enemy king back or to escort a pawn to promotion." },
  activeking: { name: "Active king", kind: "endgame",
    origin: "Steinitz's principle: \"the king is a strong piece, use it.\" In the endgame the king becomes a fighting unit worth about a minor piece.",
    plan: "Once the queens are off, march the king towards the centre and the enemy pawns. The more active king usually wins the pawn endgame." },
  enpassant: { name: "En passant", kind: "rule",
    origin: "Introduced in the 15th century alongside the pawn's double step, so a pawn could not sneak past an enemy pawn's guard. Italy only adopted it fully in the 1880s.",
    plan: "A pawn that has just moved two squares can be captured as if it had moved one, but only on the very next move." },
  promotion: { name: "Promotion", kind: "rule",
    origin: "Medieval rules promoted only to a queen (then a weak piece). Modern promotion to any piece dates from the 19th century.",
    plan: "A pawn reaching the last rank becomes a queen (usually). The whole endgame is about creating and escorting the pawn that will get there." },
  underpromotion: { name: "Underpromotion", kind: "rule",
    origin: "The Saavedra position (1895) is the most famous underpromotion: a rook, because a queen would allow a stalemate trick.",
    plan: "Promoting to a knight gives a check or fork a queen could not; a rook or bishop avoids stalemate. Rare, and worth understanding." },
  check: { name: "Check", kind: "tactic",
    origin: "The word comes from the Persian \"shah\" (king). Announcing check aloud was customary until the 20th century.",
    plan: "The king must be attended to at once, which makes check a way to gain tempo. A check with no follow-up merely helps the king find a better square." },
};

// ---- attack helpers
function attacksFrom(board, i) {
  const p = board[i];
  if (!p) return [];
  const r = rowOf(i), c = colOf(i), t = p[1], out = [];
  if (t === "p") {
    const dir = p[0] === "w" ? -1 : 1;
    for (const dc of [-1, 1]) if (inB(r + dir, c + dc)) out.push(idx(r + dir, c + dc));
    return out;
  }
  if (t === "n" || t === "k") {
    for (const [dr, dc] of t === "n" ? KN : KG) if (inB(r + dr, c + dc)) out.push(idx(r + dr, c + dc));
    return out;
  }
  const dirs = t === "b" ? DIAG : t === "r" ? ORTH : [...DIAG, ...ORTH];
  for (const [dr, dc] of dirs) {
    let rr = r + dr, cc = c + dc;
    while (inB(rr, cc)) {
      out.push(idx(rr, cc));
      if (board[idx(rr, cc)]) break;
      rr += dr; cc += dc;
    }
  }
  return out;
}
function attackersOf(board, sq, color) {
  const out = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p[0] === color && attacksFrom(board, i).includes(sq)) out.push(i);
  }
  return out;
}
const pv = (p) => (p[1] === "k" ? 10000 : VAL[p[1]]);

function pawnsOnFile(board, color, file) {
  let n = 0;
  for (let r = 0; r < 8; r++) if (board[idx(r, file)] === color + "p") n++;
  return n;
}
function isPassed(board, i) {
  const p = board[i];
  const color = p[0], enemy = color === "w" ? "b" : "w";
  const r = rowOf(i), c = colOf(i), dir = color === "w" ? -1 : 1;
  for (let rr = r + dir; rr >= 0 && rr < 8; rr += dir)
    for (const dc of [-1, 0, 1]) if (inB(rr, c + dc) && board[idx(rr, c + dc)] === enemy + "p") return false;
  return true;
}
function isOutpost(board, i) {
  const p = board[i];
  if (!p || p[1] !== "n") return false;
  const color = p[0], enemy = color === "w" ? "b" : "w";
  const r = rowOf(i), c = colOf(i);
  const inEnemyHalf = color === "w" ? r <= 3 && r >= 1 : r >= 4 && r <= 6;
  if (!inEnemyHalf) return false;
  const back = color === "w" ? r + 1 : r - 1;
  const guarded = [-1, 1].some((dc) => inB(back, c + dc) && board[idx(back, c + dc)] === color + "p");
  if (!guarded) return false;
  const dir = color === "w" ? -1 : 1;
  for (let rr = r + dir; rr >= 0 && rr < 8; rr += dir)
    for (const dc of [-1, 1]) if (inB(rr, c + dc) && board[idx(rr, c + dc)] === enemy + "p") return false;
  return true;
}

// Structural features present in a position, tagged by side.
function structure(state) {
  const b = state.board, f = new Set();
  const npm = nonPawnMaterial(b);
  const endgame = npm.w + npm.b <= 1300;
  for (const color of ["w", "b"]) {
    const enemy = color === "w" ? "b" : "w";
    const home4 = color === "w" ? 4 : 3;
    if (b[idx(home4, 3)] === color + "p" && b[idx(home4, 4)] === color + "p") f.add("duo:" + color);
    if (pawnsOnFile(b, color, 3) === 1 && pawnsOnFile(b, color, 2) === 0 && pawnsOnFile(b, color, 4) === 0) f.add("iqp:" + color);
    let doubled = 0, bishops = 0, ebishops = 0;
    for (let file = 0; file < 8; file++) { const n = pawnsOnFile(b, color, file); if (n > 1) doubled += n - 1; }
    if (doubled) f.add("doubled:" + color + ":" + doubled);
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p) continue;
      if (p === color + "b") bishops++;
      if (p === enemy + "b") ebishops++;
      if (p[0] !== color) continue;
      if (p[1] === "p" && isPassed(b, i)) f.add("passed:" + color + ":" + sqName(i));
      if (p[1] === "n" && isOutpost(b, i)) f.add("outpost:" + color + ":" + sqName(i));
      if (p[1] === "r") {
        const file = colOf(i);
        if (pawnsOnFile(b, "w", file) === 0 && pawnsOnFile(b, "b", file) === 0) f.add("openfile:" + color + ":" + FILES[file]);
        if (rowOf(i) === (color === "w" ? 1 : 6)) f.add("seventh:" + color);
      }
      if (p[1] === "k" && endgame) {
        const r = rowOf(i), c = colOf(i);
        if (r >= 2 && r <= 5 && c >= 2 && c <= 5) f.add("activeking:" + color);
      }
      if (p[1] === "b") {
        const fian = { w: [idx(6, 6), idx(6, 1)], b: [idx(1, 6), idx(1, 1)] }[color];
        const pawnSq = { w: [idx(5, 6), idx(5, 1)], b: [idx(2, 6), idx(2, 1)] }[color];
        fian.forEach((sq, k) => { if (i === sq && b[pawnSq[k]] === color + "p") f.add("fianchetto:" + color + ":" + sqName(sq)); });
      }
    }
    if (bishops === 2 && ebishops < 2) f.add("bishops:" + color);
    // minority attack: b-pawn reaches b5/b4 against c6/c3 with the c-file empty of own pawns
    const mSq = color === "w" ? idx(3, 1) : idx(4, 1), tSq = color === "w" ? idx(2, 2) : idx(5, 2);
    if (b[mSq] === color + "p" && b[tSq] === enemy + "p" && pawnsOnFile(b, color, 2) === 0) f.add("minority:" + color);
  }
  // opposition in pure king-and-pawn endings
  let onlyKP = true;
  for (let i = 0; i < 64; i++) if (b[i] && b[i][1] !== "p" && b[i][1] !== "k") { onlyKP = false; break; }
  if (onlyKP) {
    const wk = kingSq(b, "w"), bk = kingSq(b, "b");
    const dr = Math.abs(rowOf(wk) - rowOf(bk)), dc = Math.abs(colOf(wk) - colOf(bk));
    if ((dr === 2 && dc === 0) || (dr === 0 && dc === 2)) f.add("opposition:" + (state.turn === "w" ? "b" : "w"));
  }
  return f;
}

const MOTIF_ORDER = ["doublecheck", "backrank", "fork", "discovered", "skewer", "pin", "sacrifice", "gambit", "underpromotion", "promotion",
  "enpassant", "castleQ", "castle", "fianchetto", "duo", "outpost", "seventh", "openfile", "passed", "bishops", "iqp", "doubled",
  "pawnbreak", "minority", "opposition", "activeking", "check"];

function detectMotifs(before, mv, after, over) {
  const found = [];
  const add = (key, detail, side) => { if (!found.some((x) => x.key === key)) found.push({ key, detail, side }); };
  const b0 = before.board, b1 = after.board;
  const me = before.turn, enemy = me === "w" ? "b" : "w";
  const moved = b1[mv.to];
  const to = sqName(mv.to);
  const eKing = kingSq(b1, enemy);
  const givesCheck = eKing >= 0 && isAttacked(b1, rowOf(eKing), colOf(eKing), me);

  // rules
  if (mv.castle === "K") add("castle", `${me === "w" ? "White" : "Black"} castles kingside.`, me);
  if (mv.castle === "Q") add("castleQ", `${me === "w" ? "White" : "Black"} castles queenside.`, me);
  if (mv.ep) add("enpassant", `Pawn captures en passant on ${to}.`, me);
  if (mv.promo === "q") add("promotion", `Pawn promotes to a queen on ${to}.`, me);
  if (mv.promo && mv.promo !== "q") add("underpromotion", `Pawn promotes to a ${{ r: "rook", b: "bishop", n: "knight" }[mv.promo]} on ${to}.`, me);

  // double check / back rank
  if (givesCheck) {
    const checkers = attackersOf(b1, eKing, me);
    if (checkers.length >= 2) add("doublecheck", `Double check from ${checkers.map(sqName).join(" and ")}.`, me);
    if (over && over.reason === "Checkmate") {
      const homeRow = enemy === "w" ? 7 : 0;
      const lineMate = checkers.some((s) => rowOf(s) === homeRow && (b1[s][1] === "r" || b1[s][1] === "q"));
      if (rowOf(eKing) === homeRow && lineMate) add("backrank", `Mate on the back rank with the ${b1[checkers[0]][1] === "q" ? "queen" : "rook"}.`, me);
    }
  }

  if (moved && moved[1] !== "k") {
    // fork
    const targets = attacksFrom(b1, mv.to).filter((s) => {
      const t = b1[s];
      if (!t || t[0] !== enemy) return false;
      if (t[1] === "k") return true;
      return pv(t) > pv(moved) || attackersOf(b1, s, enemy).length === 0;
    });
    if (targets.length >= 2 && targets.some((s) => pv(b1[s]) >= 300)) {
      const names = targets.map((s) => ({ k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" }[b1[s][1]]));
      add("fork", `${{ n: "Knight", b: "Bishop", r: "Rook", q: "Queen", p: "Pawn" }[moved[1]]} on ${to} forks the ${names.join(" and ")}.`, me);
    }
    // pins and skewers along the mover's lines
    if ("brq".includes(moved[1])) {
      const dirs = moved[1] === "b" ? DIAG : moved[1] === "r" ? ORTH : [...DIAG, ...ORTH];
      for (const [dr, dc] of dirs) {
        let rr = rowOf(mv.to) + dr, cc = colOf(mv.to) + dc, first = null, second = null;
        while (inB(rr, cc)) {
          const s = idx(rr, cc);
          if (b1[s]) { if (!first) first = s; else { second = s; break; } }
          rr += dr; cc += dc;
        }
        if (first && second && b1[first][0] === enemy && b1[second][0] === enemy) {
          const a = b1[first], c = b1[second];
          if (c[1] === "k") add("pin", `The ${pieceName(a)} on ${sqName(first)} is pinned to the king.`, me);
          else if (a[1] === "k") add("skewer", `Check on ${sqName(first)} skewers the ${pieceName(c)} on ${sqName(second)}.`, me);
          else if (pv(c) > pv(a)) add("pin", `The ${pieceName(a)} on ${sqName(first)} is pinned to the ${pieceName(c)}.`, me);
          else if (pv(a) > pv(c) && pv(a) > pv(moved)) add("skewer", `The ${pieceName(a)} on ${sqName(first)} is skewered against the ${pieceName(c)}.`, me);
        }
      }
    }
  }
  // discovered attack: an own line piece now sees a valuable target through the vacated square
  for (let s = 0; s < 64; s++) {
    const p = b1[s];
    if (!p || p[0] !== me || !"brq".includes(p[1]) || s === mv.to) continue;
    const wasBlocked = !attacksFrom(b0, s).includes(mv.from) ? false : true;
    if (!wasBlocked) continue;
    const dr = Math.sign(rowOf(mv.from) - rowOf(s)), dc = Math.sign(colOf(mv.from) - colOf(s));
    let rr = rowOf(mv.from) + dr, cc = colOf(mv.from) + dc;
    while (inB(rr, cc)) {
      const t = b1[idx(rr, cc)];
      if (t) {
        if (t[0] === enemy && (t[1] === "k" || pv(t) >= 500)) add("discovered", `Moving from ${sqName(mv.from)} unmasks the ${pieceName(p)} on ${sqName(s)} against the ${pieceName(t)} on ${sqName(idx(rr, cc))}.`, me);
        break;
      }
      rr += dr; cc += dc;
    }
  }
  // sacrifice / gambit
  if (moved && moved[1] !== "k") {
    const attackers = attackersOf(b1, mv.to, enemy), defenders = attackersOf(b1, mv.to, me);
    if (attackers.length) {
      const cheapest = Math.min(...attackers.map((a) => pv(b1[a])));
      const gained = mv.capture ? VAL[mv.capture[1]] : 0;
      const hanging = defenders.length === 0 || cheapest < pv(moved);
      const loss = pv(moved) - gained - (defenders.length ? cheapest : 0);
      if (hanging && moved[1] === "p" && gained === 0 && before.fullmove <= 10) add("gambit", `A pawn is offered on ${to}.`, me);
      else if (hanging && loss >= 200) add("sacrifice", `The ${pieceName(moved)} on ${to} is offered for ${gained ? "less material" : "nothing immediate"}: a sacrifice.`, me);
    }
  }
  // pawn break
  if (moved && moved[1] === "p" && !mv.capture) {
    const c = colOf(mv.to);
    if (c >= 2 && c <= 5) {
      const hits = attacksFrom(b1, mv.to).some((s) => b1[s] === enemy + "p");
      if (hits) add("pawnbreak", `The ${to} push challenges the enemy pawn chain.`, me);
    }
  }
  // structural deltas
  const s0 = structure(before), s1 = structure(after);
  for (const tag of s1) {
    if (s0.has(tag)) continue;
    const [key, side, arg] = tag.split(":");
    const who = side === "w" ? "White" : "Black";
    if (key === "duo") add("duo", `${who} has the classical pawn duo in the centre.`, side);
    if (key === "iqp") add("iqp", `${who} now has an isolated queen's pawn.`, side);
    if (key === "doubled" && side === enemy) add("doubled", `${who}'s pawns are doubled.`, side);
    if (key === "passed" && side === me) add("passed", `${who} has a passed pawn on ${arg}.`, side);
    if (key === "outpost" && side === me) add("outpost", `Knight on ${arg} sits on an outpost.`, side);
    if (key === "openfile" && side === me) add("openfile", `${who}'s rook takes the open ${arg}-file.`, side);
    if (key === "seventh" && side === me) add("seventh", `${who}'s rook reaches the seventh rank.`, side);
    if (key === "bishops" && side === me) add("bishops", `${who} holds the bishop pair.`, side);
    if (key === "fianchetto" && side === me) add("fianchetto", `Bishop fianchettoed on ${arg}.`, side);
    if (key === "minority" && side === me) add("minority", `${who} launches a minority attack.`, side);
    if (key === "opposition") add("opposition", `${who} takes the opposition.`, side);
    if (key === "activeking" && side === me) add("activeking", `${who}'s king marches to the centre.`, side);
  }
  if (givesCheck && !found.some((x) => x.key === "doublecheck" || x.key === "backrank") && !(over && over.reason === "Checkmate")) add("check", `Check on the ${enemy === "w" ? "white" : "black"} king.`, me);

  found.sort((a, b) => MOTIF_ORDER.indexOf(a.key) - MOTIF_ORDER.indexOf(b.key));
  return found.slice(0, 3);
}
function pieceName(p) { return { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" }[p[1]]; }

/* ================= FIDE RATING ================= */

const FIDE_FLOOR = 1400;
const ENGINE_ELO = { casual: 900, club: 1350, strong: 1800 };
const LEVEL_LABEL = { casual: "Casual", club: "Club", strong: "Strong" };
const defaultRating = () => ({ rating: FIDE_FLOOR, games: 0, peak: FIDE_FLOOR, reached2400: false, history: [] });
function kFactor(r) { if (r.reached2400) return 10; if (r.games < 30) return 40; return 20; }
function expectedScore(own, opp) { const diff = Math.max(-400, Math.min(400, opp - own)); return 1 / (1 + Math.pow(10, diff / 400)); }
function ratingUpdate(r, oppRating, score, meta) {
  const K = kFactor(r), E = expectedScore(r.rating, oppRating), delta = K * (score - E);
  const newRating = Math.max(FIDE_FLOOR, r.rating + delta);
  const entry = { date: new Date().toISOString().slice(0, 10), opp: meta.opp, oppRating, score, delta, after: newRating, K };
  return { delta, next: { rating: newRating, games: r.games + 1, peak: Math.max(r.peak, newRating), reached2400: r.reached2400 || newRating >= 2400, history: [...r.history, entry].slice(-50) } };
}
const STORAGE_KEY = "chess-fide-rating-v1";
async function loadRating() {
  try { if (!window.storage) return null; const res = await window.storage.get(STORAGE_KEY, false); return res && res.value ? JSON.parse(res.value) : null; } catch (e) { return null; }
}
async function saveRating(r) {
  try { if (!window.storage) return false; await window.storage.set(STORAGE_KEY, JSON.stringify(r), false); return true; } catch (e) { return false; }
}

/* ================= SOUND ================= */

let audioCtx = null;
function playSound(kind, enabled) {
  if (!enabled) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    if (kind === "capture") { o.frequency.value = 180; o.type = "square"; g.gain.value = 0.06; }
    else if (kind === "end") { o.frequency.value = 520; o.type = "sine"; g.gain.value = 0.08; }
    else { o.frequency.value = 340; o.type = "sine"; g.gain.value = 0.05; }
    g.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "end" ? 0.4 : 0.12));
    o.start(now); o.stop(now + (kind === "end" ? 0.45 : 0.15));
  } catch (e) { /* ignore */ }
}

/* ================= GAME STATE ================= */

const TIME_CONTROLS = {
  none: { label: "No clock", ms: null, inc: 0 },
  "5+0": { label: "5 min", ms: 300000, inc: 0 },
  "10+0": { label: "10 min", ms: 600000, inc: 0 },
  "15+10": { label: "15 | 10", ms: 900000, inc: 10000 },
};

function freshGame(setup) {
  const st = START();
  return {
    st, hist: [], keys: { [posKey(st)]: 1 }, over: null, setup,
    clocks: TIME_CONTROLS[setup.time].ms ? { w: TIME_CONTROLS[setup.time].ms, b: TIME_CONTROLS[setup.time].ms } : null,
    started: false, rated: true, ratingApplied: null, evals: {}, hintUsed: false,
  };
}

function reduceMove(g, m, book) {
  const before = g.st, ns = applyMove(before, m);
  const san = sanFor(before, m, ns), key = posKey(ns);
  const keys = { ...g.keys, [key]: (g.keys[key] || 0) + 1 };
  let over = null;
  const nextMoves = legalMoves(ns);
  if (nextMoves.length === 0) over = inCheck(ns, ns.turn) ? { result: before.turn === "w" ? "1-0" : "0-1", reason: "Checkmate" } : { result: "½-½", reason: "Stalemate" };
  else if (ns.halfmove >= 100) over = { result: "½-½", reason: "Fifty-move rule" };
  else if (keys[key] >= 3) over = { result: "½-½", reason: "Threefold repetition" };
  else if (insufficientMaterial(ns.board)) over = { result: "½-½", reason: "Insufficient material" };
  let clocks = g.clocks;
  if (clocks) clocks = { ...clocks, [before.turn]: clocks[before.turn] + TIME_CONTROLS[g.setup.time].inc };
  const motifs = detectMotifs(before, m, ns, over);
  return { ...g, st: ns, hist: [...g.hist, { san, mv: m, before, keyAfter: key, motifs, book: !!book, ann: null, better: null }], keys, over, clocks, started: true };
}

// Fill in ?!/?/?? marks where the evaluations on both sides of a move are known.
function annotateAll(g) {
  let changed = false;
  const hist = g.hist.map((e, k) => {
    if (e.ann !== null) return e;
    const b = g.evals[k], a = g.evals[k + 1];
    if (!b || !a) return e;
    changed = true;
    const mover = e.before.turn;
    const mb = mover === "w" ? b.score : -b.score, ma = mover === "w" ? a.score : -a.score;
    if (e.book) return { ...e, ann: "book" };
    if (Math.abs(mb) > 3000 || Math.abs(ma) > 3000) return { ...e, ann: "" };
    const drop = mb - ma;
    let ann = "";
    if (drop >= 250) ann = "??"; else if (drop >= 120) ann = "?"; else if (drop >= 50) ann = "?!";
    else if (b.best && sameMove(e.mv, b.best) && e.motifs.some((x) => MOTIFS[x.key].kind === "tactic" && x.key !== "check")) ann = "!";
    let better = null;
    if (ann && ann !== "!" && b.best && !sameMove(b.best, e.mv)) better = sanFor(e.before, b.best, applyMove(e.before, b.best));
    return { ...e, ann, better };
  });
  return changed ? { ...g, hist } : g;
}

/* ================= UI ================= */

const GLYPH = { k: "\u265A\uFE0E", q: "\u265B\uFE0E", r: "\u265C\uFE0E", b: "\u265D\uFE0E", n: "\u265E\uFE0E", p: "\u265F\uFE0E" };
function fmtClock(ms) {
  if (ms === null || ms === undefined) return "";
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function fmtEval(score) {
  if (score === null || score === undefined) return "";
  if (Math.abs(score) > 3000) return score > 0 ? "White mates" : "Black mates";
  const v = score / 100;
  return (v > 0 ? "+" : "") + v.toFixed(1);
}

const CSS = `
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body, #root { margin: 0; height: 100%; }
.app { min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 14px 12px 28px; transition: background .35s, color .35s; }
.app[data-theme="wood"] {
  background: radial-gradient(1200px 700px at 50% -10%, #f4ead6, #e6d7ba 55%, #d9c6a0); color: #3c2a18; font-family: Georgia, 'Times New Roman', serif;
  --sq-light: #f0d9b5; --sq-dark: #b58863; --frame: linear-gradient(160deg,#7a5230,#5c3d20 60%,#4a3018);
  --accent: #2f6b3a; --accent-soft: rgba(47,107,58,.55); --panel: rgba(255,252,244,.72); --panel-border: rgba(90,60,30,.25);
  --pw: #fdf6e8; --pb: #2b1d10; --pw-edge: rgba(60,40,20,.55); --pb-edge: rgba(255,240,210,.25);
  --check: rgba(178,34,34,.55); --last: rgba(205,170,60,.45); --hint: rgba(60,110,200,.5); --btn: rgba(92,61,32,.1); --bar-w: #f6efe0; --bar-b: #3a2a1a;
}
.app[data-theme="dark"] {
  background: linear-gradient(180deg,#101218,#171a22 60%,#12141b); color: #dfe3ea; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --sq-light: #4a5262; --sq-dark: #2c313d; --frame: linear-gradient(160deg,#1b1e27,#12141b);
  --accent: #35c4a2; --accent-soft: rgba(53,196,162,.55); --panel: rgba(255,255,255,.05); --panel-border: rgba(255,255,255,.1);
  --pw: #eef1f5; --pb: #171a20; --pw-edge: rgba(0,0,0,.6); --pb-edge: rgba(255,255,255,.35);
  --check: rgba(235,80,80,.55); --last: rgba(53,196,162,.28); --hint: rgba(120,170,255,.5); --btn: rgba(255,255,255,.07); --bar-w: #e8ebf0; --bar-b: #262a33;
}
.title { font-size: 21px; letter-spacing: .06em; margin: 2px 0 10px; font-weight: 700; }
.app[data-theme="wood"] .title { font-variant: small-caps; letter-spacing: .12em; }
.stage { width: min(94vw, 480px); }
.playerbar { display: flex; align-items: center; justify-content: space-between; padding: 6px 4px; min-height: 40px; }
.pname { font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 8px; }
.turn-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); opacity: 0; transition: opacity .2s; }
.turn-dot.on { opacity: 1; }
.caps { font-size: 15px; opacity: .75; letter-spacing: 1px; min-height: 18px; }
.caps .adv { font-size: 12px; opacity: .8; margin-left: 4px; }
.clock { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 17px; padding: 3px 10px; border-radius: 8px; background: var(--btn); }
.clock.low { color: #e05656; }
.boardwrap { padding: 10px; border-radius: 14px; background: var(--frame); box-shadow: 0 12px 34px rgba(0,0,0,.35); }
.board { position: relative; width: 100%; aspect-ratio: 1; display: grid; grid-template-columns: repeat(8, 1fr); grid-template-rows: repeat(8, 1fr); border-radius: 6px; overflow: hidden; }
.sq { position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer; user-select: none; }
.sq.light { background: var(--sq-light); } .sq.dark { background: var(--sq-dark); }
.sq.last::before, .sq.sel::before, .sq.check::before, .sq.hint::before { content: ""; position: absolute; inset: 0; }
.sq.last::before { background: var(--last); }
.sq.sel::before { background: var(--accent-soft); }
.sq.hint::before { background: var(--hint); }
.sq.check::before { background: radial-gradient(circle, var(--check) 20%, transparent 72%); }
.dot { position: absolute; width: 26%; height: 26%; border-radius: 50%; background: var(--accent-soft); pointer-events: none; }
.ring { position: absolute; inset: 6%; border-radius: 50%; border: 3px solid var(--accent-soft); pointer-events: none; }
.pc { font-size: clamp(24px, 8.4vw, 42px); line-height: 1; position: relative; z-index: 2; transition: transform .08s; }
.sq:active .pc { transform: scale(1.12); }
.pc.w { color: var(--pw); text-shadow: 0 0 2px var(--pw-edge), 0 1px 2px var(--pw-edge); }
.pc.b { color: var(--pb); text-shadow: 0 0 2px var(--pb-edge), 0 1px 1px var(--pb-edge); }
.coord { position: absolute; font-size: 9px; font-weight: 700; opacity: .55; z-index: 1; }
.coord.file { bottom: 2px; right: 3px; } .coord.rank { top: 2px; left: 3px; }
.movelist { display: flex; gap: 6px; overflow-x: auto; padding: 10px 2px; margin-top: 8px; scrollbar-width: thin; }
.mv { flex: 0 0 auto; font-size: 13px; padding: 4px 9px; border-radius: 7px; background: var(--panel); border: 1px solid var(--panel-border); font-variant-numeric: tabular-nums; white-space: nowrap; }
.mv b { opacity: .55; font-weight: 600; margin-right: 4px; }
.ann { font-weight: 800; margin-left: 1px; }
.ann.good { color: #2f9e5b; } .ann.bad { color: #c9463d; } .ann.dub { color: #d08a2a; } .ann.book { color: var(--accent); opacity: .8; font-size: 10px; vertical-align: super; }
.controls { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
.btn { flex: 1 1 auto; min-width: 74px; padding: 9px 8px; border-radius: 10px; border: 1px solid var(--panel-border); background: var(--btn); color: inherit; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; transition: filter .15s; }
.btn:active { filter: brightness(1.25); }
.btn:disabled { opacity: .4; cursor: default; }
.btn.primary { background: var(--accent); color: #fff; border-color: transparent; }
.status { margin-top: 10px; text-align: center; font-size: 14px; min-height: 20px; opacity: .85; }
.thinking { animation: pulse 1.1s infinite; }
@keyframes pulse { 50% { opacity: .35; } }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 18px; }
.modal { width: min(92vw, 380px); max-height: 88vh; overflow-y: auto; border-radius: 16px; padding: 20px; border: 1px solid var(--panel-border); box-shadow: 0 20px 60px rgba(0,0,0,.4); }
.app[data-theme="wood"] .modal { background: #faf3e3; }
.app[data-theme="dark"] .modal { background: #1d212b; }
.modal h3 { margin: 0 0 14px; font-size: 17px; }
.optrow { margin-bottom: 14px; }
.optrow label { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; opacity: .6; margin-bottom: 6px; }
.seg { display: flex; gap: 6px; }
.seg .btn { padding: 8px 6px; font-size: 12.5px; }
.seg .btn.on { background: var(--accent); color: #fff; border-color: transparent; }
.promo { display: flex; gap: 10px; justify-content: center; }
.promo .btn { font-size: 34px; padding: 8px 0; line-height: 1.2; }
.result { text-align: center; }
.result .big { font-size: 30px; font-weight: 800; margin: 4px 0; }
.result .why { opacity: .7; margin-bottom: 16px; }
.toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--accent); color: #fff; padding: 9px 18px; border-radius: 999px; font-size: 13px; font-weight: 600; z-index: 60; box-shadow: 0 8px 24px rgba(0,0,0,.35); }
.panel { margin-top: 14px; padding: 12px 14px; border-radius: 12px; background: var(--panel); border: 1px solid var(--panel-border); }
.panel .head { display: flex; align-items: baseline; justify-content: space-between; }
.panel .num { font-size: 30px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; }
.panel .meta { font-size: 12px; opacity: .65; margin-top: 4px; }
.panel .k { font-size: 12px; opacity: .7; text-align: right; line-height: 1.5; }
.chips { display: flex; gap: 5px; margin-top: 10px; flex-wrap: wrap; }
.chip { font-size: 11px; font-weight: 700; padding: 3px 7px; border-radius: 6px; font-variant-numeric: tabular-nums; color: #fff; }
.chip.W { background: #2f9e5b; } .chip.L { background: #c9463d; } .chip.D { background: #7a7f8a; }
.delta { font-weight: 800; font-variant-numeric: tabular-nums; }
.delta.up { color: #2f9e5b; } .delta.down { color: #c9463d; }
.app[data-theme="dark"] .delta.up { color: #4fd68a; }
.note { font-size: 12px; opacity: .7; margin: -4px 0 12px; line-height: 1.4; }
.linkbtn { background: none; border: none; color: inherit; font: inherit; font-size: 12px; opacity: .6; text-decoration: underline; cursor: pointer; padding: 0; margin-top: 8px; }
.coach-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.coach-head .ttl { font-weight: 700; font-size: 14px; letter-spacing: .04em; }
.switch { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; opacity: .85; }
.switch .track { width: 34px; height: 20px; border-radius: 999px; background: var(--btn); border: 1px solid var(--panel-border); position: relative; transition: background .2s; }
.switch .track::after { content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: currentColor; opacity: .5; transition: transform .2s, opacity .2s; }
.switch.on .track { background: var(--accent); }
.switch.on .track::after { transform: translateX(14px); background: #fff; opacity: 1; }
.evalbar { display: flex; align-items: center; gap: 10px; margin: 6px 0 10px; }
.evalbar .bar { flex: 1; height: 10px; border-radius: 999px; background: var(--bar-b); overflow: hidden; border: 1px solid var(--panel-border); }
.evalbar .fill { height: 100%; background: var(--bar-w); transition: width .4s; }
.evalbar .val { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 13px; min-width: 40px; text-align: right; }
.opening { margin-bottom: 8px; }
.opening .name { font-weight: 700; font-size: 14px; }
.opening .eco { font-size: 11px; opacity: .6; margin-left: 6px; font-family: monospace; }
.opening .state { font-size: 12px; opacity: .65; }
.card { margin-top: 8px; padding: 9px 11px; border-radius: 10px; border: 1px solid var(--panel-border); background: var(--btn); cursor: pointer; }
.card .ct { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 700; }
.card .kind { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; opacity: .55; font-weight: 700; }
.card .detail { font-size: 12.5px; opacity: .85; margin-top: 3px; line-height: 1.4; }
.card .body { font-size: 12.5px; line-height: 1.5; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--panel-border); }
.card .body b { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; opacity: .55; margin: 6px 0 2px; }
.coach-row { display: flex; gap: 8px; margin-top: 10px; }
.review { font-size: 13px; line-height: 1.55; }
.review .item { padding: 7px 0; border-bottom: 1px dashed var(--panel-border); }
.review .item:last-child { border-bottom: none; }
@media (prefers-reduced-motion: reduce) { .thinking { animation: none; opacity: .6; } .evalbar .fill { transition: none; } }
`;

function Card({ title, kind, detail, origin, plan, open, onToggle }) {
  return (
    <div className="card" onClick={onToggle}>
      <div className="ct"><span>{title}</span><span className="kind">{kind}{open ? " ▴" : " ▾"}</span></div>
      {detail && <div className="detail">{detail}</div>}
      {open && (
        <div className="body">
          <b>Origin</b>{origin}
          <b>Objective and implication</b>{plan}
        </div>
      )}
    </div>
  );
}

export default function ChessApp() {
  const [theme, setTheme] = useState("wood");
  const [sound, setSound] = useState(true);
  const [coach, setCoach] = useState(true);
  const [game, setGame] = useState(() => freshGame({ playerColor: "w", level: "club", time: "none" }));
  const [selected, setSelected] = useState(null);
  const [promo, setPromo] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [showSetup, setShowSetup] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [draft, setDraft] = useState({ color: "w", level: "club", time: "none" });
  const [flipped, setFlipped] = useState(false);
  const [toast, setToast] = useState(null);
  const [hint, setHint] = useState(null);
  const [openCard, setOpenCard] = useState(null);
  const [rating, setRating] = useState(defaultRating);
  const [ratingLoaded, setRatingLoaded] = useState(false);
  const [persisted, setPersisted] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const gameRef = useRef(game); gameRef.current = game;
  const ratingRef = useRef(rating); ratingRef.current = rating;

  useEffect(() => {
    let alive = true;
    loadRating().then((r) => { if (!alive) return; if (r) { setRating(r); setPersisted(true); } setRatingLoaded(true); });
    return () => { alive = false; };
  }, []);
  useEffect(() => { if (ratingLoaded) saveRating(rating).then((ok) => setPersisted(ok)); }, [rating, ratingLoaded]);

  const playerColor = game.setup.playerColor;
  const aiColor = playerColor === "w" ? "b" : "w";
  const sans = useMemo(() => game.hist.map((e) => e.san), [game.hist]);
  const book = useMemo(() => bookLookup(sans), [sans]);
  const legal = useMemo(() => (game.over ? [] : legalMoves(game.st)), [game]);
  const myTargets = useMemo(() => (selected === null ? [] : legal.filter((m) => m.from === selected)), [legal, selected]);
  const lastMv = game.hist.length ? game.hist[game.hist.length - 1].mv : null;
  const checkedKing = inCheck(game.st, game.st.turn) ? kingSq(game.st.board, game.st.turn) : null;
  const ply = game.hist.length;

  const makeMove = useCallback((m, isBook) => {
    setSelected(null); setPromo(null); setHint(null);
    setGame((prev) => {
      const g = reduceMove(prev, m, isBook);
      playSound(g.over ? "end" : m.capture ? "capture" : "move", sound);
      return g;
    });
  }, [sound]);

  // Rating applied once per finished rated game
  useEffect(() => {
    if (!game.over || !game.rated || game.ratingApplied || !ratingLoaded) return;
    const res = game.over.result;
    const score = res === "½-½" ? 0.5 : (res === "1-0" ? "w" : "b") === playerColor ? 1 : 0;
    const before = ratingRef.current;
    const { next, delta } = ratingUpdate(before, ENGINE_ELO[game.setup.level], score, { opp: LEVEL_LABEL[game.setup.level] });
    setRating(next);
    setGame((prev) => (prev.over === game.over ? { ...prev, ratingApplied: { delta, before, after: next.rating } } : prev));
  }, [game.over, game.rated, game.ratingApplied, ratingLoaded, playerColor, game.setup.level]);

  // AI turn: book first, then search. The search score doubles as the eval of the position it faced.
  useEffect(() => {
    if (game.over || showSetup || promo || game.st.turn !== aiColor) return;
    setThinking(true);
    const t = setTimeout(() => {
      const g = gameRef.current;
      const lookup = bookLookup(g.hist.map((e) => e.san));
      const r = chooseAiMove(g.st, g.setup.level, lookup.replies);
      setThinking(false);
      if (!r.move) return;
      if (r.score !== null) {
        const k = g.hist.length;
        setGame((prev) => (prev.hist.length === k ? annotateAll({ ...prev, evals: { ...prev.evals, [k]: { score: r.score, best: r.move } } }) : prev));
      }
      makeMove(r.move, r.book);
    }, 350);
    return () => { clearTimeout(t); setThinking(false); };
  }, [game.st, game.over, aiColor, showSetup, promo, makeMove]);

  // Coach analysis: evaluate the current position (and the one before it if missing), then annotate.
  useEffect(() => {
    if (!coach || showSetup) return;
    const g = gameRef.current;
    const want = [];
    const k = g.hist.length;
    if (k > 0 && !g.evals[k - 1]) want.push(k - 1);
    const aiWillEval = !g.over && g.st.turn === aiColor && g.setup.level !== "casual";
    if (!g.evals[k] && !aiWillEval) want.push(k);
    if (!want.length) { setGame((prev) => annotateAll(prev)); return; }
    const t = setTimeout(() => {
      const cur = gameRef.current;
      if (cur.hist.length !== k) return;
      const add = {};
      for (const p of want) {
        const st = p === k ? cur.st : cur.hist[p].before;
        if (legalMoves(st).length === 0) continue;
        const r = analyse(st, 260, 3);
        add[p] = { score: r.score, best: r.move };
      }
      setGame((prev) => (prev.hist.length === k ? annotateAll({ ...prev, evals: { ...prev.evals, ...add } }) : prev));
    }, 60);
    return () => clearTimeout(t);
  }, [ply, coach, showSetup, game.over, aiColor]);

  // Clock
  useEffect(() => {
    const id = setInterval(() => {
      setGame((prev) => {
        if (!prev.clocks || prev.over || !prev.started) return prev;
        const side = prev.st.turn, left = prev.clocks[side] - 200;
        if (left <= 0) return { ...prev, clocks: { ...prev.clocks, [side]: 0 }, over: { result: side === "w" ? "0-1" : "1-0", reason: "Time out" } };
        return { ...prev, clocks: { ...prev.clocks, [side]: left } };
      });
    }, 200);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t); }, [toast]);

  function onSquare(i) {
    if (game.over || showSetup || promo || thinking || game.st.turn !== playerColor) return;
    const p = game.st.board[i];
    const targets = myTargets.filter((m) => m.to === i);
    if (selected !== null && targets.length) {
      if (targets[0].promo) setPromo({ to: i, moves: targets });
      else makeMove(targets[0], book.inBook && book.replies.includes(sanFor(game.st, targets[0], applyMove(game.st, targets[0]))));
      return;
    }
    if (p && p[0] === playerColor) setSelected(selected === i ? null : i); else setSelected(null);
  }
  function pickPromo(m) {
    makeMove(m, false);
  }

  function applyLossForAbandon() {
    const g = gameRef.current;
    if (!g.started || g.over || !g.rated) return;
    const { next } = ratingUpdate(ratingRef.current, ENGINE_ELO[g.setup.level], 0, { opp: LEVEL_LABEL[g.setup.level] + " (abandoned)" });
    setRating(next);
  }
  function startGame() {
    applyLossForAbandon();
    const color = draft.color === "rand" ? (Math.random() < 0.5 ? "w" : "b") : draft.color;
    setGame(freshGame({ playerColor: color, level: draft.level, time: draft.time }));
    setSelected(null); setPromo(null); setHint(null); setShowSetup(false); setShowReview(false); setOpenCard(null);
    setFlipped(color === "b");
  }
  function undo() {
    if (thinking || game.hist.length === 0) return;
    setSelected(null); setPromo(null); setHint(null);
    if (game.ratingApplied) setRating(game.ratingApplied.before);
    setGame((prev) => {
      let hist = prev.hist.slice(), keys = { ...prev.keys }, st = prev.st;
      while (hist.length) {
        const e = hist.pop();
        keys[e.keyAfter] = Math.max(0, (keys[e.keyAfter] || 1) - 1);
        st = e.before;
        if (st.turn === prev.setup.playerColor) break;
      }
      const evals = {};
      for (const k of Object.keys(prev.evals)) if (Number(k) <= hist.length) evals[k] = prev.evals[k];
      return { ...prev, st, hist, keys, over: null, rated: false, ratingApplied: null, evals };
    });
  }
  function resign() {
    setConfirm({ title: "Resign this game?", body: "It will be recorded as a loss and your rating adjusted.", yes: "Resign",
      onYes: () => { setConfirm(null); setGame((prev) => prev.over ? prev : { ...prev, over: { result: prev.setup.playerColor === "w" ? "0-1" : "1-0", reason: "Resignation" } }); } });
  }
  function resetRating() {
    setConfirm({ title: "Reset your rating?", body: "Rating, game count and history all return to the starting point. This cannot be undone.", yes: "Reset",
      onYes: () => { setConfirm(null); setRating(defaultRating()); } });
  }
  function askHint() {
    if (game.over || thinking || game.st.turn !== playerColor) return;
    const go = () => {
      const r = analyse(gameRef.current.st, 900, 4);
      if (!r.move) return;
      const san = sanFor(gameRef.current.st, r.move, applyMove(gameRef.current.st, r.move));
      setHint({ move: r.move, san, score: r.score });
      setGame((prev) => ({ ...prev, rated: false, hintUsed: true }));
    };
    if (game.rated && game.started) setConfirm({ title: "Ask the coach?", body: "Hints make this game unrated. The rating only counts games you play unaided.", yes: "Show hint", onYes: () => { setConfirm(null); go(); } });
    else go();
  }
  function fullReview() {
    setShowReview(true);
    const g = gameRef.current;
    const missing = [];
    for (let k = 0; k <= g.hist.length; k++) if (!g.evals[k]) missing.push(k);
    if (!missing.length) return;
    setReviewing(true);
    let i = 0;
    const step = () => {
      const cur = gameRef.current;
      const batch = missing.slice(i, i + 3);
      const add = {};
      for (const k of batch) {
        const st = k === cur.hist.length ? cur.st : cur.hist[k].before;
        if (legalMoves(st).length) { const r = analyse(st, 180, 3); add[k] = { score: r.score, best: r.move }; }
        else add[k] = { score: 0, best: null };
      }
      setGame((prev) => annotateAll({ ...prev, evals: { ...prev.evals, ...add } }));
      i += 3;
      if (i < missing.length) setTimeout(step, 30); else setReviewing(false);
    };
    setTimeout(step, 30);
  }
  function copyFEN() {
    const fen = toFEN(game.st);
    const done = () => setToast("FEN copied");
    const fallback = () => {
      const ta = document.createElement("textarea"); ta.value = fen; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { setToast(fen); }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(fen).then(done, fallback); else fallback();
  }

  const captured = useMemo(() => {
    const w = [], b = [];
    for (const e of game.hist) if (e.mv.capture) (e.mv.capture[0] === "w" ? w : b).push(e.mv.capture[1]);
    const val = (arr) => arr.reduce((s, t) => s + VAL[t], 0);
    return { byWhite: b, byBlack: w, adv: (val(b) - val(w)) / 100 };
  }, [game.hist]);
  const order = ["q", "r", "b", "n", "p"];
  const capStr = (arr) => order.flatMap((t) => arr.filter((x) => x === t)).map((t) => GLYPH[t]).join("");

  const nameOf = (c) => (c === aiColor ? `Engine · ${LEVEL_LABEL[game.setup.level]} (${ENGINE_ELO[game.setup.level]})` : `You (${Math.round(rating.rating)})`);
  function PlayerBar({ color }) {
    const isTurn = !game.over && game.st.turn === color;
    const caps = color === "w" ? captured.byWhite : captured.byBlack;
    const adv = color === "w" ? captured.adv : -captured.adv;
    const low = game.clocks && game.clocks[color] < 30000;
    return (
      <div className="playerbar">
        <div>
          <div className="pname">
            <span className={"turn-dot" + (isTurn ? " on" : "")} />{nameOf(color)}
            {color === aiColor && thinking && <span className="thinking" style={{ fontSize: 12, opacity: .7 }}>thinking…</span>}
          </div>
          <div className="caps">{capStr(caps)}{adv > 0 && <span className="adv">+{adv}</span>}</div>
        </div>
        {game.clocks && <div className={"clock" + (low ? " low" : "")}>{fmtClock(game.clocks[color])}</div>}
      </div>
    );
  }

  const topColor = flipped ? playerColor : aiColor;
  const bottomColor = flipped ? aiColor : playerColor;

  const squares = [];
  for (let d = 0; d < 64; d++) {
    const i = flipped ? 63 - d : d;
    const r = rowOf(i), c = colOf(i), p = game.st.board[i];
    const isTarget = myTargets.some((m) => m.to === i);
    const isCapTarget = isTarget && (p || myTargets.some((m) => m.to === i && m.ep));
    const cls = ["sq", (r + c) % 2 === 0 ? "light" : "dark"];
    if (lastMv && (lastMv.from === i || lastMv.to === i)) cls.push("last");
    if (hint && (hint.move.from === i || hint.move.to === i)) cls.push("hint");
    if (selected === i) cls.push("sel");
    if (checkedKing === i) cls.push("check");
    const dispR = Math.floor(d / 8), dispC = d % 8;
    squares.push(
      <div key={i} className={cls.join(" ")} onClick={() => onSquare(i)}>
        {dispC === 0 && <span className="coord rank">{8 - r}</span>}
        {dispR === 7 && <span className="coord file">{FILES[c]}</span>}
        {p && <span className={"pc " + p[0]}>{GLYPH[p[1]]}</span>}
        {isTarget && !isCapTarget && <span className="dot" />}
        {isCapTarget && <span className="ring" />}
      </div>
    );
  }

  const annEl = (e) => {
    if (!e.ann) return null;
    if (e.ann === "book") return <span className="ann book">book</span>;
    const cls = e.ann === "!" ? "good" : e.ann === "?!" ? "dub" : "bad";
    return <span className={"ann " + cls}>{e.ann}</span>;
  };
  const movePairs = [];
  for (let i = 0; i < game.hist.length; i += 2) {
    movePairs.push(
      <span key={i} className="mv">
        <b>{Math.floor(i / 2) + 1}.</b>{game.hist[i].san}{annEl(game.hist[i])}
        {game.hist[i + 1] ? <> {game.hist[i + 1].san}{annEl(game.hist[i + 1])}</> : null}
      </span>
    );
  }

  // Coach panel data
  const curEval = game.evals[ply] || (ply > 0 ? game.evals[ply - 1] : null);
  const evalPct = curEval ? 100 / (1 + Math.exp(-Math.max(-3000, Math.min(3000, curEval.score)) / 350)) : 50;
  const lastEntry = ply ? game.hist[ply - 1] : null;
  const prevEntry = ply > 1 ? game.hist[ply - 2] : null;
  const motifFeed = [...(lastEntry ? lastEntry.motifs.map((m) => ({ ...m, ply })) : []), ...(prevEntry ? prevEntry.motifs.map((m) => ({ ...m, ply: ply - 1 })) : [])].slice(0, 4);
  const reviewItems = game.hist.map((e, k) => ({ e, k })).filter(({ e }) => e.ann === "?!" || e.ann === "?" || e.ann === "??" || e.ann === "!");
  const moveLabel = (k) => `${Math.floor(k / 2) + 1}${k % 2 === 0 ? "." : "..."}`;

  return (
    <div className="app" data-theme={theme}>
      <style>{CSS}</style>
      <div className="title">{theme === "wood" ? "The Parlour Board" : "CHESS"}</div>

      <div className="stage">
        <PlayerBar color={topColor} />
        <div className="boardwrap"><div className="board">{squares}</div></div>
        <PlayerBar color={bottomColor} />

        <div className="movelist">
          {movePairs.length ? movePairs : <span className="mv" style={{ opacity: .5 }}>Moves appear here</span>}
        </div>

        <div className="controls">
          <button className="btn primary" onClick={() => { setDraft({ color: playerColor, level: game.setup.level, time: game.setup.time }); setShowSetup(true); }}>New game</button>
          <button className="btn" onClick={undo} disabled={thinking || game.hist.length === 0}>Undo</button>
          <button className="btn" onClick={resign} disabled={!game.started || !!game.over || thinking}>Resign</button>
          <button className="btn" onClick={() => setFlipped((f) => !f)}>Flip</button>
          <button className="btn" onClick={copyFEN}>Copy FEN</button>
          <button className="btn" onClick={() => setTheme(theme === "wood" ? "dark" : "wood")}>{theme === "wood" ? "Dark board" : "Wooden board"}</button>
          <button className="btn" onClick={() => setSound((s) => !s)}>{sound ? "Sound on" : "Sound off"}</button>
        </div>

        <div className="status">
          {game.over ? `${game.over.reason} · ${game.over.result}` : checkedKing !== null ? "Check" : game.st.turn === playerColor ? "Your move" : ""}
          {!game.rated && <span style={{ opacity: .6 }}> · unrated ({game.hintUsed ? "hint used" : "takeback used"})</span>}
        </div>

        {/* ---------- COACH ---------- */}
        <div className="panel">
          <div className="coach-head">
            <span className="ttl">COACH</span>
            <span className={"switch" + (coach ? " on" : "")} onClick={() => setCoach((c) => !c)}>
              {coach ? "Live" : "Off"}<span className="track" />
            </span>
          </div>
          {coach ? (
            <>
              <div className="evalbar">
                <div className="bar"><div className="fill" style={{ width: evalPct + "%" }} /></div>
                <div className="val">{curEval ? fmtEval(curEval.score) : "…"}</div>
              </div>
              <div className="opening">
                {book.info ? (
                  <>
                    <div><span className="name">{book.info.name}</span><span className="eco">{book.info.eco}</span></div>
                    <div className="state">{book.inBook ? (ply === 0 ? "Book position" : "Still in book") : `Left the book at move ${Math.ceil(book.leftAt / 2)}`}</div>
                    <Card title="About this opening" kind="lineage" origin={book.info.origin} plan={book.info.plan}
                      open={openCard === "opening"} onToggle={() => setOpenCard(openCard === "opening" ? null : "opening")} />
                  </>
                ) : (
                  <div className="state">{ply === 0 ? "Play a move to see the opening." : book.inBook ? "In book, no named line yet." : "Out of the book; no named opening matched."}</div>
                )}
              </div>
              {motifFeed.map((m, i) => (
                <Card key={m.key + m.ply + i} title={`${moveLabel(m.ply - 1)} ${game.hist[m.ply - 1].san} · ${MOTIFS[m.key].name}`} kind={MOTIFS[m.key].kind}
                  detail={m.detail} origin={MOTIFS[m.key].origin} plan={MOTIFS[m.key].plan}
                  open={openCard === m.key + m.ply} onToggle={() => setOpenCard(openCard === m.key + m.ply ? null : m.key + m.ply)} />
              ))}
              {lastEntry && lastEntry.better && (lastEntry.before.turn === playerColor) && (
                <div className="card" style={{ cursor: "default" }}>
                  <div className="ct"><span>Better was {lastEntry.better}</span><span className="kind">engine</span></div>
                  <div className="detail">Your {lastEntry.san}{lastEntry.ann} lost ground; the engine preferred {lastEntry.better}.</div>
                </div>
              )}
              {hint && <div className="card" style={{ cursor: "default" }}><div className="ct"><span>Hint: {hint.san}</span><span className="kind">{fmtEval(hint.score)}</span></div></div>}
              <div className="coach-row">
                <button className="btn" onClick={askHint} disabled={!!game.over || thinking || game.st.turn !== playerColor || !!hint}>Hint</button>
                <button className="btn" onClick={fullReview} disabled={!game.started || reviewing}>{reviewing ? "Analysing…" : "Review game"}</button>
              </div>
            </>
          ) : (
            <div className="note" style={{ margin: 0 }}>Coaching is off. Turn it on for the opening name and lineage, motif cards, the evaluation bar, hints and a post-game review.</div>
          )}
        </div>

        {/* ---------- RATING ---------- */}
        <div className="panel">
          <div className="head">
            <div>
              <div className="num">{Math.round(rating.rating)}</div>
              <div className="meta">FIDE-style rating · {rating.games} game{rating.games === 1 ? "" : "s"} · peak {Math.round(rating.peak)}{!persisted && " · not saved on this device"}</div>
            </div>
            <div className="k">K = {kFactor(rating)}<br />{rating.games < 30 && !rating.reached2400 ? `${30 - rating.games} to settle` : rating.reached2400 ? "established 2400+" : "established"}</div>
          </div>
          {rating.history.length > 0 && (
            <div className="chips">
              {rating.history.slice(-12).map((h, i) => {
                const tag = h.score === 1 ? "W" : h.score === 0 ? "L" : "D";
                return <span key={i} className={"chip " + tag} title={`${h.date} vs ${h.opp} (${h.oppRating})`}>{tag} {h.delta >= 0 ? "+" : ""}{h.delta.toFixed(1)}</span>;
              })}
            </div>
          )}
          {rating.games > 0 && <button className="linkbtn" onClick={resetRating}>Reset rating</button>}
        </div>
      </div>

      {promo && (
        <div className="overlay"><div className="modal">
          <h3>Promote to</h3>
          <div className="promo">
            {promo.moves.map((m) => <button key={m.promo} className="btn" onClick={() => pickPromo(m)}><span className={"pc " + playerColor} style={{ textShadow: "none" }}>{GLYPH[m.promo]}</span></button>)}
          </div>
        </div></div>
      )}

      {game.over && !showSetup && !showReview && (
        <div className="overlay" onClick={() => setShowSetup(false)}>
          <div className="modal result" onClick={(e) => e.stopPropagation()}>
            <div className="why">{game.over.reason}</div>
            <div className="big">{game.over.result}</div>
            <div className="why">{game.over.result === "½-½" ? "Draw" : (game.over.result === "1-0" ? "w" : "b") === playerColor ? "You win" : "Engine wins"}</div>
            {game.ratingApplied && (
              <div className="why">Rating <span className={"delta " + (game.ratingApplied.delta >= 0 ? "up" : "down")}>{game.ratingApplied.delta >= 0 ? "+" : ""}{game.ratingApplied.delta.toFixed(1)}</span> → {Math.round(game.ratingApplied.after)}</div>
            )}
            {!game.rated && <div className="why">Unrated game ({game.hintUsed ? "hint used" : "takeback used"})</div>}
            <button className="btn primary" style={{ width: "100%" }} onClick={() => { setDraft({ color: playerColor, level: game.setup.level, time: game.setup.time }); setShowSetup(true); }}>New game</button>
            <button className="btn" style={{ width: "100%", marginTop: 8 }} onClick={fullReview}>Review game</button>
            {game.over.reason !== "Time out" && game.over.reason !== "Resignation" && (
              <button className="btn" style={{ width: "100%", marginTop: 8 }} onClick={undo}>Take back last move</button>
            )}
          </div>
        </div>
      )}

      {showReview && (
        <div className="overlay" onClick={() => setShowReview(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Game review {reviewing && <span className="thinking" style={{ fontSize: 12, opacity: .7 }}>analysing…</span>}</h3>
            {book.info && <div className="note">{book.info.name} ({book.info.eco}){book.inBook ? "" : `, left the book at move ${Math.ceil(book.leftAt / 2)}`}.</div>}
            <div className="review">
              {reviewItems.length === 0 && <div className="item">{reviewing ? "Working through the moves…" : "No turning points found. Either a clean game or a very short one."}</div>}
              {reviewItems.map(({ e, k }) => (
                <div className="item" key={k}>
                  <b>{moveLabel(k)} {e.san}</b><span className={"ann " + (e.ann === "!" ? "good" : e.ann === "?!" ? "dub" : "bad")}>{e.ann}</span>
                  {e.better && <> · better was <b>{e.better}</b></>}
                  {e.motifs.length > 0 && <div style={{ opacity: .7, fontSize: 12 }}>{e.motifs.map((m) => MOTIFS[m.key].name).join(", ")}</div>}
                </div>
              ))}
            </div>
            <button className="btn" style={{ width: "100%", marginTop: 12 }} onClick={() => setShowReview(false)}>Close</button>
          </div>
        </div>
      )}

      {showSetup && (
        <div className="overlay"><div className="modal">
          <h3>New game</h3>
          {game.started && !game.over && game.rated && <div className="note">A rated game is in progress. Starting a new one records it as a loss, as an abandoned game would be.</div>}
          <div className="optrow"><label>Play as</label><div className="seg">
            {[["w", "White"], ["b", "Black"], ["rand", "Random"]].map(([v, l]) => <button key={v} className={"btn" + (draft.color === v ? " on" : "")} onClick={() => setDraft({ ...draft, color: v })}>{l}</button>)}
          </div></div>
          <div className="optrow"><label>Engine strength</label><div className="seg">
            {["casual", "club", "strong"].map((v) => <button key={v} className={"btn" + (draft.level === v ? " on" : "")} onClick={() => setDraft({ ...draft, level: v })}>{LEVEL_LABEL[v]}<br /><span style={{ fontSize: 11, opacity: .75 }}>{ENGINE_ELO[v]}</span></button>)}
          </div></div>
          <div className="optrow"><label>Time control</label><div className="seg">
            {Object.entries(TIME_CONTROLS).map(([v, t]) => <button key={v} className={"btn" + (draft.time === v ? " on" : "")} onClick={() => setDraft({ ...draft, time: v })}>{t.label}</button>)}
          </div></div>
          <button className="btn primary" style={{ width: "100%" }} onClick={startGame}>Start</button>
          {(game.started || game.over) && <button className="btn" style={{ width: "100%", marginTop: 8 }} onClick={() => setShowSetup(false)}>Cancel</button>}
        </div></div>
      )}

      {confirm && (
        <div className="overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{confirm.title}</h3>
            <div className="note" style={{ margin: "0 0 14px" }}>{confirm.body}</div>
            <button className="btn primary" style={{ width: "100%" }} onClick={confirm.onYes}>{confirm.yes}</button>
            <button className="btn" style={{ width: "100%", marginTop: 8 }} onClick={() => setConfirm(null)}>Keep playing</button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
