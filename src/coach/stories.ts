import type { MotifKey } from "./types";
import { OPENING_STORIES } from "./openingStories";

export interface Story {
  scope?: string;
  history: string;
  idea: string;
  counter: string;
  sources: Array<{ title: string; url: string }>;
}
const term = (title: string, slug: string) => ({
  title: `Chess.com: ${title}`,
  url: `https://www.chess.com/terms/${slug}`,
});
const system = {
  title: "Nimzowitsch’s My System: background and chapter guide",
  url: "https://en.wikipedia.org/wiki/My_System",
};
const hypermodern = {
  title: "The hypermodern school: history and players",
  url: "https://en.wikipedia.org/wiki/Hypermodernism_(chess)",
};
const immortal = {
  title: "Anderssen–Kieseritzky, 1851: the Immortal Game",
  url: "https://en.wikipedia.org/wiki/Immortal_Game",
};
const saavedra = {
  title: "The Saavedra position: the 1895 discovery",
  url: "https://en.wikipedia.org/wiki/Saavedra_position",
};

// Supplementary lessons, separate from the preserved original 27 cards.
// Sources checked 5 September 2026 BDT. Historical examples are thematic,
// never a claim that the current game reproduces a master's position.
export const MOTIF_STORIES: Record<MotifKey, Story> = {
  fork: {
    history:
      "Forks have no securely identified inventor. A memorable master example in the linked lesson is Petrosian against Spassky: a queen offer leads to a fork that wins back more material. The lesson is to look one move beyond the apparent sacrifice.",
    idea: "Two threats compete for one reply. A checking fork is especially forcing, but a fork only wins if the attacker survives and the opponent has no stronger response.",
    counter:
      "Look first for a check, capture of the attacking piece, or a move that saves one target while defending the other. Before a knight approaches, avoid lining up valuable pieces on its landing squares.",
    sources: [term("forks, with Petrosian–Spassky", "fork-chess")],
  },
  pin: {
    history:
      "The pin belongs to the shared vocabulary of chess, rather than one inventor. The linked Panno–Mecking example shows its defensive side: pins can protect pawns and restrain an opponent even in an endgame, far beyond the familiar opening bishop move.",
    idea: "The piece in front is tied to something behind it. A pin to the king forbids moves that expose check; a pin to the queen is a practical restriction, not a legal one. A piece can sometimes move along the pinning line.",
    counter:
      "Move the valuable rear piece off the line, interpose a defender, or exchange the pinning piece. Count legal defenders carefully: an apparently defending pinned knight may be unable to capture.",
    sources: [term("pins and ways to escape them", "pin-chess")],
  },
  skewer: {
    history:
      "The skewer is the pin’s reversed geometry. The linked teaching examples show how an exposed valuable piece becomes a doorway to a second target. A reliable inventor of the tactic is not established by this source; recognizing the pattern matters more than assigning it a birthday.",
    idea: "A bishop, rook or queen attacks along a line. When the front target escapes, the rear target becomes available. A checking skewer narrows the defender’s choices most sharply.",
    counter:
      "Break the alignment before the attack arrives. Once skewered, look for a king move that protects the rear piece, an interposition, or a capture of the attacker.",
    sources: [term("skewers and examples", "skewer-chess")],
  },
  discovered: {
    history:
      "Discovered attacks are part of the combination tradition: one move activates two pieces. The linked Nakamura–Shabalov example gives that old idea a modern use: a knight moves out of a bishop’s way to help trap the opposing queen. It illustrates the pattern rather than identifying its inventor.",
    idea: "The departing piece opens a line for a bishop, rook or queen. Give the departing piece a useful threat of its own, so the opponent cannot answer both comfortably.",
    counter:
      "Notice a line piece aimed through another piece toward your king or queen. Move the target, exchange the line piece, or keep the blocking piece from departing with tempo.",
    sources: [term("discovered attacks", "discovered-attack-chess")],
  },
  doublecheck: {
    history:
      "Réti–Tartakower, Vienna 1910, is a famous teaching example: Réti offers his queen, then opens a double check that forces mate. Its lasting lesson is that forcing the king to move can matter more than keeping the queen. Réti illustrated the tactic brilliantly; he did not originate double check.",
    idea: "Two attackers check at once, so the king must move. This can force it onto an exposed square even when one checking piece appears available for capture.",
    counter:
      "Prevent the discovered-check alignment or preserve a safe king square. Once double check is on the board, examine legal king moves, including king captures; blocking one line with another piece cannot solve both checks.",
    sources: [term("double check and mating patterns", "double-check-chess")],
  },
  backrank: {
    history:
      "In the linked Gligorić–Fischer example, Fischer’s knight fork works because the defending rook cannot leave the back rank without allowing mate. This is how a familiar mating pattern becomes a deeper combination: the threat can win material even when no checkmate is played.",
    idea: "The pawn shield becomes a cage. A defending rook may be tied to the last rank, allowing combinations elsewhere that depend on it being unable to leave.",
    counter:
      "Make a safe escape square when there is time, or keep a reliable defender. Check which escape squares enemy bishops control before assuming a pawn move has created useful breathing room.",
    sources: [term("back-rank mates and prevention", "back-rank-mate-chess")],
  },
  sacrifice: {
    history:
      "Anderssen’s 1851 Immortal Game became an emblem of Romantic attacking chess: activity and king exposure outweighed lost material. Its famous published mating continuation is a lesson in coordination, not a licence to give pieces away. Historical versions of the score differ.",
    idea: "An offer can buy open lines, development or access to the king. This card detects material being offered; it does not certify that the compensation is sufficient.",
    counter:
      "Calculate the forcing continuation before accepting. Sometimes returning material exchanges the dangerous attackers and leaves a safe king; sometimes declining the offer removes the attacker’s whole point.",
    sources: [immortal, term("sacrifices and compensation", "chess-sacrifice")],
  },
  gambit: {
    history:
      "The King’s Gambit was a signature opening of the Romantic era. Anderssen’s Immortal Game began with a pawn offer, turning development into an attack. Its fame explains the appeal of gambits, while improved defensive play explains why accepting material need not be fatal.",
    idea: "A pawn buys time or open lines. The price is permanent unless the initiative produces something tangible. A detected pawn offer may also be a simple oversight.",
    counter:
      "Develop and secure the king. Do not spend several moves protecting an extra pawn while your pieces sleep; return it if that extinguishes the attack.",
    sources: [immortal, term("sacrifices and compensation", "chess-sacrifice")],
  },
  castle: {
    history:
      "Castling is an inherited rule, not a tactic invented by a champion. It couples king safety with rook development, which is why generations of opening instruction emphasize it. The linked guide distinguishes the legal requirements from the strategic decision about when to castle.",
    idea: "One move brings the rook nearer the centre and usually puts pawns between the king and enemy pieces. The destination still needs to be safe: legal castling can be strategically dangerous.",
    counter:
      "Against a castled king, prepare open lines before pushing its shield away. Against an uncastled king, consider opening the centre while development is in your favour.",
    sources: [term("castling rules and timing", "castling-chess")],
  },
  castleQ: {
    history:
      "Queenside castling belongs to the same rule as kingside castling. Opposite-wing attacking systems, including the Sicilian Dragon’s Yugoslav Attack, made its practical trade-off familiar: each side can advance pawns toward the other king without stripping its own king’s shield.",
    idea: "The rook arrives on the d-file immediately, but the king on c1 or c8 may still need shelter. The a-pawn is no longer protected by the castled king.",
    counter:
      "Compare attacking speed before starting a pawn race. Open files near the king and watch central counterplay; a move to improve king safety may be more valuable than another pawn push.",
    sources: [
      term("castling on either wing", "castling-chess"),
      {
        title: "Sicilian Defense: attacking systems",
        url: "https://www.chess.com/openings/Sicilian-Defense",
      },
    ],
  },
  fianchetto: {
    history:
      "The hypermodern school of the 1920s, associated with Réti and Nimzowitsch, championed pressure on the centre from a distance. A bishop developed on the flank embodies that approach. They helped make this setup part of a systematic strategy for challenging a large pawn centre.",
    idea: "A long diagonal can connect defence of your king with pressure on the opposite wing. Its power depends on whether pawns block its view.",
    counter:
      "Blunt the diagonal with a supported centre or exchange the bishop. If it guards a castled king, removing it can leave weak squares of its colour.",
    sources: [hypermodern, term("the fianchetto", "fianchetto-chess")],
  },
  duo: {
    history:
      "The classical ideal put pawns in the centre; hypermodern players later challenged the assumption that occupying it meant controlling it. That historical debate explains this position’s central question: can the pawn pair advance safely, or will it become a target?",
    idea: "Two neighbouring central pawns claim space and restrict pieces. Their strength depends on support and mobility, not merely their presence.",
    counter:
      "Attack the base with a pawn break and develop pressure before the pair rolls forward. Exchanges can turn an impressive centre into isolated targets.",
    sources: [hypermodern, term("pawn structures", "pawn-structure")],
  },
  iqp: {
    history:
      "Nimzowitsch’s My System made blockade and pawn weaknesses part of a systematic strategic education. The isolated queen’s pawn is a natural classroom for that tradition: attacking activity must be weighed against a weakness that remains after pieces are exchanged.",
    idea: "An isolated d-pawn supplies space and nearby open files but has no pawn neighbour to defend it. Its owner often needs active pieces and a timely advance.",
    counter:
      "Occupy the square in front with a secure piece, limit the pawn’s advance and trade attacking pieces. Do not blockade so passively that the opponent gets a free kingside attack.",
    sources: [system, term("pawn weaknesses", "pawn-structure")],
  },
  doubled: {
    history:
      "The Ruy Lopez Exchange and Nimzo-Indian made the trade of a bishop for damaged pawns a recurring strategic bargain. The point is not that doubled pawns always lose: the bishop pair and an open file may repay the structural cost.",
    idea: "Pawns on one file can be hard to mobilize, but they may control useful squares. Evaluate the pieces and open lines alongside the pawn shape.",
    counter:
      "Fix the pawns where they cannot advance together, then attack the vulnerable one. If you own them, activate your pieces before the opponent can force a static ending.",
    sources: [
      term("pawn structure weaknesses", "pawn-structure"),
      {
        title: "Ruy Lopez: the Exchange Variation",
        url: "https://www.chess.com/openings/Ruy-Lopez-Opening",
      },
    ],
  },
  passed: {
    history:
      "Passed pawns and their blockade receive dedicated treatment in Nimzowitsch’s My System. This strategic tradition treats a passer as a demand on the enemy’s pieces, not just a pawn racing forward.",
    idea: "The promotion threat can tie a rook or king to defence, creating chances elsewhere. Being passed does not mean being unstoppable: pieces can still blockade or capture it.",
    counter:
      "Blockade before it advances too far, attack its support and seek counterplay. The owner should coordinate king and rook rather than rush the pawn beyond protection.",
    sources: [system, term("passed pawns", "passed-pawn")],
  },
  outpost: {
    history:
      "Nimzowitsch’s strategic teaching connected secure squares with restraint and blockade. An outpost carries that tradition into an ordinary middlegame: a knight can dominate without delivering an immediate threat.",
    idea: "A supported piece on a square enemy pawns cannot readily attack gains time to influence both wings. A beautiful square matters only if there are useful targets nearby.",
    counter:
      "Exchange the occupying piece, undermine its pawn support or play away from its reach. Before creating the hole, consider whether a pawn advance leaves it permanently undefended.",
    sources: [system, term("outposts and examples", "outpost-chess")],
  },
  openfile: {
    history:
      "My System gave open files their own chapter and connected control of a file with entry into the enemy position. That teaching made rook activity a plan with a destination, rather than merely placing a rook on an empty column.",
    idea: "A file without pawns is a route inward. Control the entry squares and bring another rook if needed; an open file with no safe entry can be less useful than it looks.",
    counter:
      "Contest the file early or control the invasion square with minor pieces. Trade the active rook when the resulting ending is acceptable.",
    sources: [
      system,
      { title: "Open files and rook penetration", url: "https://en.wikipedia.org/wiki/Open_file" },
    ],
  },
  seventh: {
    history:
      "Nimzowitsch followed his open-file discussion with a chapter on the seventh and eighth ranks. The sequence is the story: first find an entrance, then attack pawns from behind their front line.",
    idea: "A rook on the opponent’s second rank can attack several pawns and restrict the king. Two coordinated rooks may create mating threats as well as material threats.",
    counter:
      "Prevent entry when possible. If the rook has arrived, seek an exchange or active counterplay; defending every pawn separately can leave all your pieces tied down.",
    sources: [
      system,
      {
        title: "Open files: the route to the seventh rank",
        url: "https://en.wikipedia.org/wiki/Open_file",
      },
    ],
  },
  bishops: {
    history:
      "The bishop pair is a recurring bargain in the Ruy Lopez Exchange: Black accepts doubled pawns and keeps both bishops. Master practice made this a lasting example of piece activity compensating for an imperfect pawn structure.",
    idea: "Two bishops cover both square colours and switch wings quickly when lines are open. Their advantage is conditional; locked pawns can leave them with little work.",
    counter:
      "Restrict diagonals with a stable centre, establish knight squares or exchange one bishop. If you own the pair, prepare pawn breaks that give both bishops targets.",
    sources: [
      {
        title: "Ruy Lopez: bishop pair versus pawn structure",
        url: "https://www.chess.com/openings/Ruy-Lopez-Opening",
      },
      term("open and closed pawn structures", "pawn-structure"),
    ],
  },
  pawnbreak: {
    history:
      "The French Defense gives a classic opening-to-middlegame example: Black’s ...c5 challenges White’s d4 support, and ...f6 can challenge e5. Generations of French games teach that a cramped position often needs a pawn lever, not aimless piece shuffling.",
    idea: "Contact between pawns can open a file, free a bishop or change which squares are weak. Calculate the resulting structure before committing, because pawns cannot step back.",
    counter:
      "Meet the break with a capture, an advance or a counter-break according to the resulting lines. Keep the king safe before helping the opponent open the centre.",
    sources: [
      {
        title: "French Defense: central pawn breaks",
        url: "https://www.chess.com/openings/French-Defense",
      },
    ],
  },
  minority: {
    history:
      "Capablanca–Golombek, 1939, and the linked Karpov–Lautier game show the minority attack across generations. In Karpov’s example, queenside pawn advances leave a weak c6-pawn that he eventually wins. The idea became a standard plan in the Carlsbad structure: fewer pawns can create targets in a larger pawn group.",
    idea: "A well-timed b-pawn advance can force exchanges that leave a backward or isolated target. The pieces must be ready to use the weakness afterward.",
    counter:
      "Create central or kingside play before the weakness can be exploited. A timely pawn advance or exchange can alter the structure and remove the attacker’s intended target.",
    sources: [term("minority attacks and the Carlsbad structure", "minority-attack-chess")],
  },
  opposition: {
    history:
      "Opposition belongs to the long tradition of king-and-pawn endgame study. Its value is that a seemingly tiny fact, whose turn it is, can decide whether the attacking king gets through. The linked lesson includes direct and more distant forms rather than assigning a single inventor.",
    idea: "Facing kings can force the side to move to yield ground. Opposition is a means of reaching useful squares, not a prize to hold regardless of the pawns.",
    counter:
      "Use a spare pawn move to pass the turn, seek distant opposition or calculate a route around the enemy king. Check whether the pawn’s key squares are already accessible.",
    sources: [term("opposition in pawn endings", "opposition-chess")],
  },
  activeking: {
    history:
      "King-and-pawn endgame teaching turns the sheltered opening king into an active fighting piece. Opposition exercises preserve that tradition: progress comes from the king escorting its pawn and taking away the opposing king’s routes.",
    idea: "With fewer attacking pieces around, the king can defend pawns, attack enemy pawns and escort a passer. Queen exchange alone does not guarantee that centralization is safe.",
    counter:
      "Cut the king off with a rook or use your own king to deny entry. Calculate checks and pawn races before marching toward a distant target.",
    sources: [
      term("king routes and opposition", "opposition-chess"),
      term("passed pawns and their support", "passed-pawn"),
    ],
  },
  enpassant: {
    history:
      "En passant preserves the pawn’s ability to challenge an adjacent pawn despite the two-square first move. It is a rule inherited through chess’s development, not a champion’s invention. The French name means ‘in passing’.",
    idea: "The capture changes two files at once: the capturing pawn moves diagonally and the bypassing pawn disappears from the neighbouring file. That can unexpectedly open a rook or bishop line.",
    counter:
      "Before a double pawn push, check whether the opponent has this immediate reply. Before capturing, verify king safety; an en passant capture that exposes your king is illegal.",
    sources: [term("en passant: rule and examples", "en-passant")],
  },
  promotion: {
    history:
      "The 1895 Saavedra study is a famous reminder that promotion is a choice. A position thought drawn became winning when Fernando Saavedra found promotion to a rook instead of a queen. It is a historical study, not a claim that this position has the same solution.",
    idea: "Reaching the last rank converts a pawn into a much stronger resource. A queen is usually right, but the opponent’s legal replies determine the best choice.",
    counter:
      "Control the promotion square, blockade early or calculate whether giving up a piece stops the pawn profitably. Always check for stalemate after promotion.",
    sources: [saavedra, term("promotion choices", "pawn-promotion")],
  },
  underpromotion: {
    history:
      "Fernando Saavedra’s 1895 discovery made a rook promotion famous: choosing a queen allowed a drawing stalemate trick, while the rook preserved a win. The study shows why ‘take the strongest piece’ is an excellent default with real exceptions.",
    idea: "A knight can deliver a unique check or fork; a rook or bishop can avoid stalemate. The smaller piece is chosen for a concrete job, not for surprise alone.",
    counter:
      "Calculate every relevant promotion choice. If defending, look for stalemate resources and ways to exchange the promoted piece before it can act.",
    sources: [saavedra, term("promotion and underpromotion", "pawn-promotion")],
  },
  check: {
    history:
      "Check is part of chess’s rules and shared tactical language, with no individual inventor credited here. The linked lesson connects this elementary threat to its practical importance: it restricts replies, which is why checks are examined first in many combinations.",
    idea: "A forcing move can gain time for an attack or rescue a piece. A harmless check may instead improve the opponent’s king position.",
    counter:
      "Compare capturing the attacker, blocking the line and moving the king. Choose the reply that leaves the safest position, rather than automatically moving the king.",
    sources: [term("check and legal responses", "check-chess")],
  },
};

export function openingStory(sans: readonly string[]): Story | undefined {
  let match: (typeof OPENING_STORIES)[number] | undefined;
  for (const entry of OPENING_STORIES) {
    const prefix = entry.moves.split(" ");
    if (
      prefix.length <= sans.length &&
      prefix.every((move, index) => sans[index] === move) &&
      (!match || prefix.length > match.moves.split(" ").length)
    )
      match = entry;
  }
  return match?.story;
}
