import type { Level } from "../engine/types";
export const FIDE_FLOOR = 1400;
export const ENGINE_ELO: Record<Level, number> = { casual: 900, club: 1350, strong: 1800 };
export const LEVEL_LABEL: Record<Level, string> = {
  casual: "Casual",
  club: "Club",
  strong: "Strong",
};
export interface RatingEntry {
  date: string;
  opp: string;
  oppRating: number;
  score: number;
  delta: number;
  after: number;
  K: number;
}
export interface Rating {
  rating: number;
  games: number;
  peak: number;
  reached2400: boolean;
  history: RatingEntry[];
}
export const defaultRating = (): Rating => ({
  rating: FIDE_FLOOR,
  games: 0,
  peak: FIDE_FLOOR,
  reached2400: false,
  history: [],
});
export function kFactor(r: Rating) {
  return r.reached2400 ? 10 : r.games < 30 ? 40 : 20;
}
export function expectedScore(own: number, opp: number) {
  const diff = Math.max(-400, Math.min(400, opp - own));
  return 1 / (1 + 10 ** (diff / 400));
}
export function ratingUpdate(
  r: Rating,
  oppRating: number,
  score: number,
  meta: { opp: string },
  now: number,
) {
  const K = kFactor(r),
    E = expectedScore(r.rating, oppRating);
  const after = Math.max(FIDE_FLOOR, r.rating + K * (score - E)),
    delta = after - r.rating;
  const entry: RatingEntry = {
    date: new Date(now + 6 * 60 * 60 * 1000).toISOString().slice(0, 10),
    opp: meta.opp,
    oppRating,
    score,
    delta,
    after,
    K,
  };
  return {
    delta,
    next: {
      rating: after,
      games: r.games + 1,
      peak: Math.max(r.peak, after),
      reached2400: r.reached2400 || after >= 2400,
      history: [...r.history, entry].slice(-50),
    },
  };
}
