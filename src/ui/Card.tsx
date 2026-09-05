import { useId } from "react";
import type { Story } from "../coach/stories";

interface CardProps {
  title: string;
  kind: string;
  detail?: string;
  origin: string;
  plan: string;
  story?: Story;
  open: boolean;
  onToggle(): void;
}

export function Card({ title, kind, detail, origin, plan, story, open, onToggle }: CardProps) {
  const bodyId = useId();
  return (
    <article className="card story-card">
      <button
        aria-expanded={open}
        aria-controls={bodyId}
        className="card-toggle"
        onClick={onToggle}
        type="button"
      >
        <span className="ct">
          <span>{title}</span>
          <span className="kind">{kind}</span>
        </span>
        {detail && <span className="detail">{detail}</span>}
      </button>
      {open && (
        <div className="body" id={bodyId}>
          {(!story || story.scope) && (
            <>
              <b>Where it comes from</b>
              {origin}
              <b>What to do</b>
              {plan}
            </>
          )}
          {story && (
            <>
              <b>{story.scope ?? "Historical connection"}</b>
              <p>{story.history}</p>
              <b>Why the idea works</b>
              <p>{story.idea}</p>
              <b>How to counter it</b>
              <p>{story.counter}</p>
              <b>Further reading</b>
              <ul className="story-links">
                {story.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noopener noreferrer">
                      {source.title}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </article>
  );
}
