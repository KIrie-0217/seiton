import { expect, test } from "@playwright/test";
import { choose, frame, openApp, pane } from "./helpers";

test("Japanese shows Japanese guidance and keeps English labels", async ({ page }) => {
  await openApp(page, { lang: "ja" });
  await expect(page.getByText(/矢印キーで移動/)).toBeVisible();
  await expect(pane(page, "Import Settings").getByText(/JPG には HEIF を含みます/)).toBeVisible();
  await expect(page.getByRole("listbox", { name: "Devices" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
});

test("the language choice is remembered", async ({ page }) => {
  await openApp(page);
  await choose(page, page.locator(".app-header"), "Language", "日本語");
  await expect(page.getByText(/矢印キーで移動/)).toBeVisible();
  await page.goto("/?mock=fast");
  await expect(frame(page, "IMG_0001")).toBeVisible();
  await expect(page.getByText(/矢印キーで移動/)).toBeVisible();
});
