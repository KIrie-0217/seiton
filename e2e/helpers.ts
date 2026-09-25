import { expect, type Locator, type Page } from "@playwright/test";

/** Opens the mock app without simulated latency, optionally in a locale. */
export async function openApp(page: Page, options: { lang?: "en" | "ja" } = {}) {
  const params = new URLSearchParams({ mock: "fast" });
  if (options.lang) params.set("lang", options.lang);
  await page.goto(`/?${params}`);
  await expect(frames(page)).toBeVisible();
  await expect(frame(page, "IMG_0001")).toBeVisible();
}

export function frames(page: Page): Locator {
  return page.getByRole("grid", { name: "Frames" });
}

/** A frame (GridList row) by asset name; row names are "<name>, Frame <n>". */
export function frame(page: Page, name: string): Locator {
  return frames(page).getByRole("row", { name: new RegExp(`^${name},`) });
}

export function pane(page: Page, title: "Thumbnails" | "Preview" | "Import Settings"): Locator {
  return page.getByRole("region", { name: title, exact: true });
}

/** Picks an option from the React Aria Select labelled `label` inside `scope`. */
export async function choose(page: Page, scope: Locator, label: string, option: string) {
  await scope.locator(".select-field", { has: page.getByText(label, { exact: true }) }).getByRole("button").click();
  await page.getByRole("listbox").getByRole("option", { name: option, exact: true }).click();
}

/** Scroll offsets of the page and of every scrolled element. */
export async function scrollState(page: Page) {
  return page.evaluate(() => ({
    window: window.scrollY,
    main: document.querySelector(".app > main")?.scrollTop ?? 0,
    library: document.querySelector(".library")?.scrollTop ?? 0,
  }));
}
