import { expect, test } from "@playwright/test";
import { choose, frame, frames, openApp, pane } from "./helpers";

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test("shows devices, the contact sheet and the side panes", async ({ page }) => {
  const devices = page.getByRole("listbox", { name: "Devices" });
  await expect(devices.getByRole("option").first()).toContainText("Canon EOS R6 Mark II");
  await expect(devices.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("50 of 50")).toBeVisible();
  for (const title of ["Thumbnails", "Preview", "Import Settings"] as const) {
    await expect(pane(page, title)).toBeVisible();
  }
  await expect(frame(page, "IMG_0001")).toContainText("001");
  // Only visible frames are rendered (virtualized).
  expect(await frames(page).getByRole("row").count()).toBeLessThan(50);
});

test("selects with click and arrows and rates with number keys", async ({ page }) => {
  await frame(page, "IMG_0001").getByText("IMG_0001", { exact: true }).click();
  await page.keyboard.press("ArrowRight");
  const second = frame(page, "IMG_0002");
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("4");
  await expect(second.getByRole("group", { name: "4 stars" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Details" }).getByRole("radio", { name: "4 stars" })).toBeChecked();

  await page.keyboard.press("0");
  await expect(second.getByRole("group", { name: "Unrated" })).toBeVisible();
});

test("rates one frame from its stars without changing the selection", async ({ page }) => {
  await frame(page, "IMG_0001").getByText("IMG_0001", { exact: true }).click();
  const third = frame(page, "IMG_0003");
  await third.getByRole("button", { name: "Rate IMG_0003 2 stars" }).click();
  await expect(third.getByRole("group", { name: "2 stars" })).toBeVisible();
  await expect(frame(page, "IMG_0001")).toHaveAttribute("aria-selected", "true");
  await expect(third).toHaveAttribute("aria-selected", "false");
});

test("filters by rating and type", async ({ page }) => {
  const thumbnails = pane(page, "Thumbnails");
  await choose(page, thumbnails, "Rating", "5 stars");
  const count = thumbnails.locator(".filter-count");
  await expect(count).not.toHaveText("50 of 50");
  const rows = frames(page).getByRole("row");
  for (const row of await rows.all()) {
    await expect(row.getByRole("group", { name: "5 stars" })).toBeVisible();
  }

  await choose(page, thumbnails, "Rating", "All");
  await thumbnails.locator(".checkbox", { hasText: "Video" }).click();
  await expect(count).toHaveText(/^\d+ of 50$/);
  await expect(frames(page).getByRole("row").first()).toContainText("Video");
});
