import { BOOK_LINES, type OpeningInfo } from "./lines";

interface BookNode {
  children: Record<string, BookNode>;
  info: OpeningInfo | null;
}

export interface BookLookup {
  info: OpeningInfo | null;
  inBook: boolean;
  leftAt: number | null;
  replies: string[];
}

function buildBook(): BookNode {
  const root: BookNode = { children: {}, info: null };
  for (const [moves, name, eco, origin, plan] of BOOK_LINES) {
    let node = root;
    for (const san of moves.split(" ")) {
      node.children[san] ??= { children: {}, info: null };
      node = node.children[san];
    }
    node.info = { name, eco, origin, plan, depth: moves.split(" ").length };
  }
  return root;
}

const BOOK = buildBook();

export function bookLookup(sans: readonly string[]): BookLookup {
  let node = BOOK;
  let info: OpeningInfo | null = null;
  let inBook = true;
  let leftAt: number | null = null;
  for (let i = 0; i < sans.length; i += 1) {
    const next = node.children[sans[i]];
    if (!next) {
      inBook = false;
      leftAt = i + 1;
      break;
    }
    node = next;
    if (node.info) info = node.info;
  }
  return { info, inBook, leftAt, replies: inBook ? Object.keys(node.children) : [] };
}
