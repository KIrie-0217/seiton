import { useId } from "react";

const STARS = [1, 2, 3, 4, 5] as const;

/** Read-only star display, e.g. ★★★☆☆. */
export function StarDisplay({ rating }: { rating: number | null }) {
  const stars = rating ?? 0;
  const label = stars === 0 ? "評価なし" : `評価 ${stars}`;
  return (
    <span className="stars" role="img" aria-label={label}>
      {STARS.map((n) => (n <= stars ? "★" : "☆")).join("")}
    </span>
  );
}

interface StarInputProps {
  /** Current stars (0 = unrated), or `mixed` for a selection with different ratings. */
  value: number | "mixed";
  onChange: (rating: number | null) => void;
  disabled?: boolean;
}

/** Rating editor as a radio group (native keyboard support). */
export function StarInput({ value, onChange, disabled }: StarInputProps) {
  const name = useId();
  const options: { rating: number | null; label: string; text: string }[] = [
    { rating: null, label: "評価なし", text: "×" },
    ...STARS.map((n) => ({ rating: n, label: `★${n}`, text: "★" })),
  ];
  const current = value === "mixed" ? 0 : value;
  return (
    <fieldset className="star-input" disabled={disabled}>
      <legend>評価{value === "mixed" && "（混在）"}</legend>
      {options.map((o) => {
        const checked = value !== "mixed" && (o.rating ?? 0) === value;
        const lit = o.rating !== null && o.rating <= current;
        return (
          <label key={o.label} className={lit ? "lit" : undefined} title={o.label}>
            <input
              type="radio"
              name={name}
              className="visually-hidden"
              checked={checked}
              onChange={() => onChange(o.rating)}
              aria-label={o.label}
            />
            <span aria-hidden="true">{o.text}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
