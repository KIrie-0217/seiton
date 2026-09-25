import { afterAll, beforeAll } from "vitest";
import { screen, within } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

type User = ReturnType<typeof userEvent.setup>;

/**
 * jsdom has no layout. Give elements a size so React Aria's Virtualizer lays
 * out the contact sheet (900 × 600 → a few columns and rows).
 */
export function installFakeLayout(width = 900, height = 600) {
  const props = { clientWidth: width, offsetWidth: width, clientHeight: height, offsetHeight: height };
  const originals = Object.fromEntries(
    Object.keys(props).map((k) => [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)]),
  );
  beforeAll(() => {
    for (const [k, v] of Object.entries(props)) {
      Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get: () => v });
    }
  });
  afterAll(() => {
    for (const [k, d] of Object.entries(originals)) {
      if (d) Object.defineProperty(HTMLElement.prototype, k, d);
    }
  });
}

/** The trigger button of the React Aria Select labelled `label` inside `root`. */
export function selectTrigger(root: HTMLElement, label: string): HTMLElement {
  const labelEl = within(root)
    .getAllByText(label, { selector: ".react-aria-Label" })
    .find((el) => el.closest(".select-field"));
  const field = labelEl?.closest<HTMLElement>(".select-field");
  if (!field) throw new Error(`no select labelled ${label}`);
  return within(field).getByRole("button");
}

/** Opens the Select labelled `label` and picks the option `option`. */
export async function chooseOption(user: User, root: HTMLElement, label: string, option: string) {
  await user.click(selectTrigger(root, label));
  const listbox = await screen.findByRole("listbox");
  await user.click(within(listbox).getByRole("option", { name: option }));
}

/** The frame (GridList row) for an asset name. */
export function frame(root: HTMLElement, name: string): HTMLElement {
  const grid = within(root).getByRole("grid", { name: "Frames" });
  return within(grid).getByRole("row", { name: new RegExp(`^${name},`) });
}
