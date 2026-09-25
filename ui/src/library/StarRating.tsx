import { useState } from "react";
import { Button, Label, Radio, RadioGroup } from "react-aria-components";
import { useI18n } from "../i18n";
import { ClearIcon, StarIcon } from "../icons";

const STARS = [1, 2, 3, 4, 5] as const;

interface StarBarProps {
  /** Name of the rated item, used in button labels. */
  name: string;
  rating: number | null;
  /** Pressing the current rating clears it. */
  onRate: (rating: number | null) => void;
}

/**
 * Stars on a frame, lit like a gauge: pointing at the third star lights
 * stars one to three. Pressing a star rates only this frame; it does not
 * select it or take focus (keyboard users rate the focused frame with 0–5).
 */
export function StarBar({ name, rating, onRate }: StarBarProps) {
  const { t } = useI18n();
  const stars = rating ?? 0;
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? stars;

  return (
    <div
      className="star-bar"
      data-previewing={hover !== null || undefined}
      role="group"
      aria-label={stars === 0 ? t.unrated : t.starsLabel(stars)}
      onMouseLeave={() => setHover(null)}
    >
      {STARS.map((n) => (
        <Button
          key={n}
          className="star"
          excludeFromTabOrder
          preventFocusOnPress
          data-lit={n <= shown || undefined}
          aria-label={n === stars ? t.clearAssetRating(name) : t.rateAsset(name, n)}
          aria-pressed={n <= stars}
          onHoverStart={() => setHover(n)}
          onPress={() => onRate(n === stars ? null : n)}
        >
          <StarIcon on={n <= shown} size={17} />
        </Button>
      ))}
    </div>
  );
}

interface StarInputProps {
  /** Current stars (0 = unrated), or `mixed` for a selection with different ratings. */
  value: number | "mixed";
  onChange: (rating: number | null) => void;
  isDisabled?: boolean;
}

/** Rating editor: a radio group lit like a gauge. */
export function StarInput({ value, onChange, isDisabled }: StarInputProps) {
  const { t } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? (value === "mixed" ? 0 : value);

  return (
    <RadioGroup
      className="star-input"
      orientation="horizontal"
      isDisabled={isDisabled}
      value={value === "mixed" ? null : String(value)}
      onChange={(v) => onChange(v === "0" ? null : Number(v))}
      onMouseLeave={() => setHover(null)}
    >
      <Label>
        {t.rating}
        {value === "mixed" && t.mixed}
      </Label>
      <Radio value="0" className="star-radio clear" aria-label={t.noRating} onHoverStart={() => setHover(0)}>
        <ClearIcon />
      </Radio>
      {STARS.map((n) => (
        <Radio
          key={n}
          value={String(n)}
          className="star-radio"
          data-lit={n <= shown || undefined}
          aria-label={t.starsLabel(n)}
          onHoverStart={() => setHover(n)}
        >
          <StarIcon on={n <= shown} size={22} />
        </Radio>
      ))}
    </RadioGroup>
  );
}
