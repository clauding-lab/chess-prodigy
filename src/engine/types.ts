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
  from: number;
  to: number;
  promo?: "q" | "r" | "b" | "n";
  capture?: Piece;
  ep?: boolean;
  double?: boolean;
  castle?: "K" | "Q";
}

export interface SearchResult {
  move: Move | null;
  score: number;
  depth: number;
}
export interface AiResult {
  move: Move | null;
  score: number | null;
  book: boolean;
}
