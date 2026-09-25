import { useId, useState, type MouseEvent } from "react";

const STARS = [1, 2, 3, 4, 5] as const;

interface StarBarProps {
  /** Name of the rated item, used in button labels. */
  name: string;
  rating: number | null;
  /** Clicking the current rating clears it (Lightroom style). */
  onRate: (rating: number | null) => void;
}

/**
 * Clickable stars for a grid cell, shown like a gauge: pointing at ★3
 * lights ★1–★3. The buttons are not tab stops: inside the grid, keyboard
 * users rate the focused cell with 0–5.
 */
export function StarBar({ name, rating, onRate }: StarBarProps) {
  const stars = rating ?? 0;
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? stars;

  function click(e: MouseEvent, n: number) {
    // Do not change the selection or focus when rating from the cell.
    e.stopPropagation();
    onRate(n === stars ? null : n);
  }

  return (
    <div
      className={`star-bar${hover !== null ? " previewing" : ""}`}
      role="group"
      aria-label={stars === 0 ? "評価なし" : `評価 ${stars}`}
      onMouseLeave={() => setHover(null)}
    >
      {STARS.map((n) => (
        <button
          key={n}
          type="button"
          tabIndex={-1}
          className={n <= shown ? "lit" : undefined}
          aria-label={n === stars ? `${name} の評価を解除` : `${name} を★${n}にする`}
          aria-pressed={n <= stars}
          onMouseEnter={() => setHover(n)}
          onClick={(e) => click(e, n)}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {n <= shown ? "★" : "☆"}
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

/** Rating editor as a radio group (native keyboard support), lit like a gauge. */
export function StarInput({ value, onChange, disabled }: StarInputProps) {
  const name = useId();
  const [hover, setHover] = useState<number | null>(null);
  const options: { rating: number | null; label: string; text: string }[] = [
    { rating: null, label: "評価なし", text: "×" },
    ...STARS.map((n) => ({ rating: n, label: `★${n}`, text: "★" })),
  ];
  const shown = hover ?? (value === "mixed" ? 0 : value);
  return (
    <fieldset className="star-input" disabled={disabled} onMouseLeave={() => setHover(null)}>
      <legend>評価{value === "mixed" && "（混在）"}</legend>
      {options.map((o) => {
        const checked = value !== "mixed" && (o.rating ?? 0) === value;
        const lit = o.rating !== null && o.rating <= shown;
        return (
          <label
            key={o.label}
            className={lit ? "lit" : undefined}
            title={o.label}
            onMouseEnter={() => setHover(o.rating ?? 0)}
          >
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
