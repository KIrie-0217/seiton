import type { ReactNode } from "react";

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

/** Square: stop. */
export const StopIcon = () => (
  <Svg>
    <rect x="4" y="4" width="8" height="8" rx="1" />
  </Svg>
);

/** Arrow into a tray: import. */
export const ImportIcon = () => (
  <Svg>
    <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5" />
    <path d="M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2" />
  </Svg>
);

const STAR_PATH = "M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6Z";

/** Star mark for ratings: filled when `on`, outline otherwise. */
export function StarIcon({ on, size = 16 }: { on: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      fill={on ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinejoin="round"
    >
      <path d={STAR_PATH} />
    </svg>
  );
}

/** Slash through a circle: clear rating. */
export const ClearIcon = () => (
  <Svg>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M4.2 11.8 11.8 4.2" />
  </Svg>
);

/** Window with a left column: show or hide the sidebar. */
export const SidebarIcon = () => (
  <Svg>
    <rect x="2" y="3" width="12" height="10" rx="1" />
    <path d="M6 3v10" />
  </Svg>
);

export const ChevronIcon = () => (
  <Svg>
    <path d="M4.5 6.5 8 10l3.5-3.5" />
  </Svg>
);
