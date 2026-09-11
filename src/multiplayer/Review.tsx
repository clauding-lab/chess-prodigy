import { useEffect, useRef, useState } from "react";
import type { Game } from "../game/types";
import type { Color } from "../engine/types";
import { EngineClient } from "../worker/client";
import { annotateAll } from "../coach/annotate";
import { CoachPanel } from "../ui/CoachPanel";
import { ReviewModal } from "../ui/Modals";
import { REVIEWER, isNeutralEvaluation, reviewHistory } from "../engine/reviewer";
export function CompletedReview({ game, color }: { game: Game; color: Color }) {
  const [review, setReview] = useState(game);
  const [enabled, setEnabled] = useState(true);
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const client = useRef<EngineClient | null>(null);
  const revision = useRef(0);
  useEffect(
    () => () => {
      revision.current++;
      client.current?.dispose();
    },
    [],
  );
  async function analyse() {
    if (working) return;
    const token = ++revision.current;
    client.current?.dispose();
    const worker = new EngineClient();
    client.current = worker;
    setOpen(true);
    setWorking(true);
    setError("");
    let next = game;
    try {
      for (let ply = 0; ply <= game.hist.length; ply++) {
        const result = await worker.request({
          type: "analyse",
          gameId: game.id,
          revision: game.revision,
          position: game.hist[ply]?.before ?? game.st,
          reviewer: REVIEWER,
          policy: "review-v1",
          history: reviewHistory(game, ply),
        });
        if (revision.current !== token) return;
        if (result.score === null || !("review" in result))
          throw new Error("Position review was unavailable. Please retry.");
        const value = { score: result.score, best: result.move, review: result.review };
        if (
          !isNeutralEvaluation(
            value,
            game.hist[ply]?.before ?? game.st,
            reviewHistory(game, ply),
            "review-v1",
          )
        )
          throw new Error("Position review was incompatible. Please retry.");
        next = annotateAll({
          ...next,
          evals: { ...next.evals, [ply]: value },
        });
        setReview(next);
      }
    } catch (reason) {
      if (revision.current === token)
        setError(reason instanceof Error ? reason.message : "Review failed. Please retry.");
    } finally {
      if (revision.current === token) {
        setWorking(false);
        worker.dispose();
        client.current = null;
      }
    }
  }
  return (
    <aside>
      {error && <p role="alert">{error}</p>}
      <CoachPanel
        game={review}
        playerColor={color}
        enabled={enabled}
        thinking={false}
        reviewing={working}
        hint={null}
        onToggle={() => setEnabled(!enabled)}
        onHint={() => {}}
        onReview={() => void analyse()}
      />
      {open && (
        <ReviewModal
          game={review}
          reviewing={working}
          onClose={() => {
            revision.current++;
            client.current?.dispose();
            client.current = null;
            setWorking(false);
            setOpen(false);
          }}
        />
      )}
    </aside>
  );
}
