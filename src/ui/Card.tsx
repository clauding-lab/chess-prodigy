interface CardProps {
  title: string;
  kind: string;
  detail?: string;
  origin: string;
  plan: string;
  open: boolean;
  onToggle(): void;
}

export function Card({ title, kind, detail, origin, plan, open, onToggle }: CardProps) {
  return (
    <button aria-expanded={open} className="card" onClick={onToggle} type="button">
      <span className="ct">
        <span>{title}</span>
        <span className="kind">{kind}</span>
      </span>
      {detail && <span className="detail">{detail}</span>}
      {open && (
        <span className="body">
          <b>Where it comes from</b>
          {origin}
          <b>What to do</b>
          {plan}
        </span>
      )}
    </button>
  );
}
