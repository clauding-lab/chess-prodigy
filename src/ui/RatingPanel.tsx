import { kFactor, type Rating } from "../rating/fide";

export function RatingPanel({
  rating,
  saved,
  onReset,
}: {
  rating: Rating;
  saved: boolean;
  onReset(): void;
}) {
  return (
    <section className="panel" aria-labelledby="rating-title">
      <div className="head">
        <div>
          <div className="num" id="rating-title">
            {Math.round(rating.rating)}
          </div>
          <div className="meta">
            FIDE-style rating · {rating.games} game{rating.games === 1 ? "" : "s"} · peak{" "}
            {Math.round(rating.peak)}
            {!saved && " · not saved on this device"}
          </div>
        </div>
        <div className="k">
          K = {kFactor(rating)}
          <br />
          {rating.games < 30 && !rating.reached2400
            ? `${30 - rating.games} to settle`
            : rating.reached2400
              ? "established 2400+"
              : "established"}
        </div>
      </div>
      {!!rating.history.length && (
        <div className="chips">
          {rating.history.slice(-12).map((h, i) => {
            const tag = h.score === 1 ? "W" : h.score === 0 ? "L" : "D";
            return (
              <span
                className={`chip ${tag}`}
                key={`${h.date}-${i}`}
                title={`${h.date} vs ${h.opp} (${h.oppRating})`}
              >
                {tag} {h.delta >= 0 ? "+" : ""}
                {h.delta.toFixed(1)}
              </span>
            );
          })}
        </div>
      )}
      {rating.games > 0 && (
        <button className="linkbtn" onClick={onReset} type="button">
          Reset rating
        </button>
      )}
    </section>
  );
}
