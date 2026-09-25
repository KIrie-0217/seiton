import type { ButtonHTMLAttributes, ReactNode } from "react";

/** 16px line icons (stroke = currentColor). Decorative: the button has the label. */
function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Box with an arrow leaving it: open in a separate window. */
export const PopOutIcon = () => (
  <Svg>
    <path d="M9 2.5h4.5V7" />
    <path d="M13.5 2.5 7.5 8.5" />
    <path d="M12 9.5v3.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-8a.5.5 0 0 1 .5-.5H7" />
  </Svg>
);

/** Arrow entering a frame: back into the main window. */
export const DockIcon = () => (
  <Svg>
    <rect x="2.5" y="2.5" width="11" height="11" rx="1" />
    <path d="M6 5.5v4.5h4.5" />
    <path d="M6 10 11 5" />
  </Svg>
);

export const CloseIcon = () => (
  <Svg>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Svg>
);

/** Two overlapping windows: bring to front. */
export const FocusIcon = () => (
  <Svg>
    <rect x="5" y="5" width="8.5" height="7" rx="1" />
    <path d="M3 10V3.5a1 1 0 0 1 1-1h6.5" />
  </Svg>
);

/** Eye: show a hidden pane. */
export const ShowIcon = () => (
  <Svg>
    <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" />
    <circle cx="8" cy="8" r="2" />
  </Svg>
);

/** Drag handle. */
export const GripIcon = () => (
  <Svg>
    <path d="M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01" strokeWidth="2.5" />
  </Svg>
);

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  /** Accessible name, also shown as a tooltip. */
  label: string;
  icon: ReactNode;
}

export function IconButton({ label, icon, className, title, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      className={`icon-button${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {icon}
    </button>
  );
}
