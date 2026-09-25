import { useId, type MouseEvent } from "react";

const STARS = [1, 2, 3, 4, 5] as const;

interface StarBarProps {
  /** Name of the rated item, used in button labels. */
  name: string;
  rating: number | null;
  /** Clicking the current rating clears it (Lightroom style). */
  onRate: (rating: number | null) => void;
}

/**
 * Clickable stars for a grid cell. The buttons are not tab stops: inside the
 * grid, keyboard users rate with 0–5 on the focused cell.
 */
export function StarBar({ name, rating, onRate }: StarBarProps) {
  const stars = rating ?? 0;
  function click(e: MouseEvent, n: number) {
    // Do not change the selection or focus when rating from the cell.
    e.stopPropagation();
    onRate(n === stars ? null : n);
  }
  return (
    <div className="star-bar" role="group" aria-label={stars === 0 ? "評価なし" : `評価 ${stars}`}>
      {STARS.map((n) => (
        <button
          key={n}
          type="button"
          tabIndex={-1}
          className={n <= stars ? "lit" : undefined}
          aria-label={n === stars ? `${name} の評価を解除` : `${name} を★${n}にする`}
          aria-pressed={n <= stars}
          onClick={(e) => click(e, n)}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {n <= stars ? "★" : "☆"}
        </button>
      ))}
    </div>
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
