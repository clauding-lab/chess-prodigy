import { useEffect, useMemo, useRef, useState } from "react";
import type { GameRecord } from "../account/types";
import { isSupportedOpponent, opponentName } from "../engine/opponents";
import {
  ARCHIVE_LIMIT,
  replayRecord,
  retainedArchive,
  rivalryKey,
  rivalrySummary,
} from "../game/archive";
import { TIME_CONTROLS } from "../game/state";
import { LEVEL_LABEL } from "../rating/fide";
import type { HistoryResult } from "../storage/history";
import { Board } from "./Board";
import { Modal } from "./Modal";
import "./recorded-games.css";

type Rival = Pick<GameRecord, "opponent" | "level">;
export interface RecordedGamesModalProps {
  history: HistoryResult;
  target: Rival;
  scope: "guest" | "account";
  betaEnabled: boolean;
  onRematch(record: GameRecord): void;
  onClose(): void;
  onRetry(): void;
  loading: boolean;
  error: string | null;
}

export function canRematch(record: Pick<GameRecord, "opponent">, betaEnabled: boolean): boolean {
  return isSupportedOpponent(record.opponent) && (record.opponent.id === "classic" || betaEnabled);
}

const rivalLabel = ({ opponent, level }: Rival) =>
  `${opponentName(opponent)} · v${opponent.version} · ${LEVEL_LABEL[level]}`;
const completedDate = (date: string) =>
  `${new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date))} BDT`;
const outcome = (record: GameRecord) =>
  record.result === "½-½"
    ? "Draw"
    : (record.result === "1-0" ? "w" : "b") === record.playerColor
      ? "You won"
      : "You lost";
const assistance = (record: GameRecord) =>
  record.assisted === null ? "Unknown assistance" : record.assisted ? "Assisted" : "Unassisted";
const unratedReasons = {
  beta: "Unrated beta",
  hint: "Unrated — hint used",
  takeback: "Unrated — takeback used",
  "rating-reset": "Unrated — rating reset",
  "legacy-unrated": "Unrated — legacy record",
};

export function RecordedRivalry({ history, target }: { history: HistoryResult; target: Rival }) {
  const summary = rivalrySummary(history.games, target);
  const totalsAvailable = history.status === "ready" || summary.total > 0;
  return (
    <section aria-label="Recorded rivalry" className="recorded-rivalry">
      <h4>Recorded rivalry</h4>
      <p>
        {rivalLabel(target)} ·{" "}
        {totalsAvailable
          ? `${summary.total} recorded ${summary.total === 1 ? "game" : "games"}`
          : "Recorded totals unavailable"}
      </p>
      {totalsAvailable && (
        <table>
          <caption>Results from your side, within retained records</caption>
          <thead>
            <tr>
              <th scope="col">Assistance</th>
              <th scope="col">Wins</th>
              <th scope="col">Draws</th>
              <th scope="col">Losses</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["Unassisted", summary.unassisted],
                ["Assisted", summary.assisted],
                ["Unknown assistance", summary.unknown],
              ] as const
            ).map(([label, counts]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{counts.wins}</td>
                <td>{counts.draws}</td>
                <td>{counts.losses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="recorded-caption">
        Comparable opponent configuration and difficulty only. Retained totals, not lifetime
        results.
        {history.status !== "ready" && " Available records may be incomplete."}
        {history.pending && " Includes results waiting to sync."}
      </p>
    </section>
  );
}

function RecordedReplay({ record, onClose }: { record: GameRecord; onClose(): void }) {
  const replay = useMemo(() => replayRecord(record), [record]);
  const [ply, setPly] = useState(0);
  const [flipped, setFlipped] = useState(record.playerColor === "b");
  const region = useRef<HTMLElement>(null);
  useEffect(() => {
    region.current?.focus();
  }, []);
  const end = replay?.moves.length ?? 0;
  const go = (next: number) => setPly(Math.max(0, Math.min(next, end)));
  return (
    <section
      ref={region}
      tabIndex={-1}
      aria-label="Recorded game replay"
      className="recorded-replay"
    >
      <h4>{rivalLabel(record)} · replay</h4>
      <p>Read-only recorded moves. Your current game stays in place.</p>
      {!replay ? (
        <p role="alert">
          This recorded game cannot be legally replayed. The original record has been preserved.
        </p>
      ) : (
        <>
          <div className="boardwrap">
            <Board
              board={replay.positions[ply].board}
              flipped={flipped}
              selected={null}
              targets={[]}
              lastMove={replay.moves[ply - 1] ?? null}
              hint={null}
              checkedKing={null}
              onSquare={() => {}}
              disabled
              ply={ply}
            />
          </div>
          <p aria-live="polite" className="recorded-position">
            {ply === 0
              ? "Starting position"
              : `${Math.ceil(ply / 2)}${ply % 2 ? "." : "..."} ${record.moves[ply - 1]}`}{" "}
            · {ply} / {end} half-moves
          </p>
          <input
            aria-label="Replay position"
            type="range"
            min={0}
            max={end}
            value={ply}
            step={1}
            onChange={(event) => go(Number(event.target.value))}
            onKeyDown={(event) => {
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? end
                    : ["ArrowRight", "ArrowUp"].includes(event.key)
                      ? ply + 1
                      : ["ArrowLeft", "ArrowDown"].includes(event.key)
                        ? ply - 1
                        : null;
              if (next !== null) {
                event.preventDefault();
                go(next);
              }
            }}
          />
          <div className="recorded-actions">
            <button type="button" className="btn" onClick={() => go(0)} disabled={ply === 0}>
              First position
            </button>
            <button type="button" className="btn" onClick={() => go(ply - 1)} disabled={ply === 0}>
              Previous move
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => go(ply + 1)}
              disabled={ply === end}
            >
              Next move
            </button>
            <button type="button" className="btn" onClick={() => go(end)} disabled={ply === end}>
              Last position
            </button>
            <button
              type="button"
              className="btn"
              aria-pressed={flipped}
              onClick={() => setFlipped(!flipped)}
            >
              Flip replay board
            </button>
          </div>
          <p className="recorded-caption">
            Use the position slider with arrow keys, Home or End. Board shown from{" "}
            {flipped ? "Black" : "White"}’s side.
          </p>
        </>
      )}
      <button className="btn full spaced" type="button" onClick={onClose}>
        Close replay
      </button>
    </section>
  );
}

export function RecordedGamesModal({
  history,
  target,
  scope,
  betaEnabled,
  onRematch,
  onClose,
  onRetry,
  loading,
  error,
}: RecordedGamesModalProps) {
  const [filter, setFilter] = useState(() => rivalryKey(target));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const replayButton = useRef<HTMLButtonElement | null>(null);
  const games = retainedArchive(history.games);
  const rivals = new Map([
    [rivalryKey(target), target],
    ...games.map((game) => [rivalryKey(game), game] as const),
  ]);
  const currentFilter = rivals.has(filter) ? filter : rivalryKey(target);
  const selectedTarget = rivals.get(currentFilter)!;
  const visible = games.filter((game) => rivalryKey(game) === currentFilter);
  // Resolve against current owner-scoped props; never retain a stale game object after refresh.
  const selected = visible.find((game) => game.id === selectedId);
  function downloadOriginal() {
    if (history.raw === undefined) return;
    let url: string | undefined;
    try {
      url = URL.createObjectURL(new Blob([history.raw], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "chess-prodigy-history-recovery.txt";
      link.click();
      setDownloadError(null);
    } catch {
      setDownloadError(
        "The recovery download could not start. Your original history is still preserved; try again.",
      );
    } finally {
      if (url) {
        const objectUrl = url;
        const revoke = URL.revokeObjectURL.bind(URL);
        setTimeout(() => revoke(objectUrl), 1000);
      }
    }
  }
  return (
    <Modal title="Recorded games" onClose={onClose} className="recorded-games-modal">
      <p className="recorded-caption">
        {scope === "guest"
          ? "Guest records — this browser only. They are not imported into an account."
          : "Private records — this account only. Guest games stay separate."}{" "}
        Up to {ARCHIVE_LIMIT} completed games are retained.
      </p>
      <p className="recorded-caption">
        A running current game clock continues while Games is open.
      </p>
      <div className="recorded-actions">
        <button className="btn" type="button" onClick={onRetry} disabled={loading}>
          Refresh records
        </button>
        <button className="btn" type="button" onClick={onClose}>
          Close games
        </button>
      </div>
      {loading && <p role="status">Loading recorded games…</p>}
      {error && <p role="alert">{error}</p>}
      {history.status === "corrupt" && (
        <p role="alert">
          Saved history could not be read. The original history is kept for recovery; it has not
          been replaced.
        </p>
      )}
      {history.status === "unavailable" && (
        <p role="status">Recorded history is unavailable. Refresh records to try again.</p>
      )}
      {history.status === "incomplete" && (
        <p role="status">
          Recorded history is incomplete. Connect and refresh to check for remaining account
          records.
        </p>
      )}
      {history.raw !== undefined && (
        <button className="btn" type="button" onClick={downloadOriginal}>
          Download original history
        </button>
      )}
      {downloadError && <p role="alert">{downloadError}</p>}
      <label className="recorded-filter">
        Opponent and difficulty
        <select
          aria-label="Opponent and difficulty"
          value={currentFilter}
          onChange={(event) => {
            setFilter(event.target.value);
            setSelectedId(null);
          }}
        >
          {[...rivals].map(([key, rival]) => (
            <option key={key} value={key}>
              {rivalLabel(rival)}
              {!isSupportedOpponent(rival.opponent) ? " · unavailable configuration" : ""}
            </option>
          ))}
        </select>
      </label>
      <RecordedRivalry history={history} target={selectedTarget} />
      {selected && (
        <RecordedReplay
          key={JSON.stringify(selected)}
          record={selected}
          onClose={() => {
            setSelectedId(null);
            replayButton.current?.focus();
          }}
        />
      )}
      {visible.length === 0 && (
        <p>
          {history.status === "ready" && !loading
            ? "No completed games yet for this opponent and difficulty."
            : "No matching records are available here yet."}
        </p>
      )}
      <ol className="recorded-list" aria-label="Recorded games">
        {visible.map((record, index) => (
          <li key={record.id}>
            <h4>
              {outcome(record)} · {record.result}
            </h4>
            <p>
              {rivalLabel(record)} · You played {record.playerColor === "w" ? "White" : "Black"}
              {record.time !== undefined && ` · ${TIME_CONTROLS[record.time].label}`}
            </p>
            <p>
              <time dateTime={record.completedAt}>{completedDate(record.completedAt)}</time> ·{" "}
              {record.reason}
            </p>
            <p>
              {assistance(record)} ·{" "}
              {record.rated
                ? "Practice Rating recorded"
                : record.unratedReason
                  ? unratedReasons[record.unratedReason]
                  : "Unrated"}
            </p>
            <div className="recorded-actions">
              <button
                className="btn"
                type="button"
                aria-label={`Replay recorded game ${index + 1}`}
                onClick={(event) => {
                  replayButton.current = event.currentTarget;
                  setSelectedId(record.id);
                }}
              >
                Replay
              </button>
              <button
                className="btn"
                type="button"
                aria-label={`Rematch recorded game ${index + 1}`}
                disabled={!canRematch(record, betaEnabled)}
                onClick={() => {
                  if (canRematch(record, betaEnabled)) onRematch(record);
                }}
              >
                Rematch
              </button>
            </div>
            {!canRematch(record, betaEnabled) && (
              <p className="recorded-caption">
                {isSupportedOpponent(record.opponent)
                  ? "Rematch unavailable: Paul Morphy beta is disabled in this build."
                  : "Rematch unavailable: this recorded opponent configuration is not supported."}{" "}
                Recorded moves remain available for replay.
              </p>
            )}
          </li>
        ))}
      </ol>
    </Modal>
  );
}
