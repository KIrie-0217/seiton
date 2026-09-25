import { expect, test } from "@playwright/test";
import { frame, openApp, pane } from "./helpers";

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test("imports with the configured destination and marks frames imported", async ({ page }) => {
  await pane(page, "Import Settings").getByRole("textbox", { name: "Destination folder" }).fill("D:\\Photos");
  await expect(page.locator(".status-bar")).toContainText("D:\\Photos");

  await page.getByRole("button", { name: "Import", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Import" });
  await expect(dialog).toBeVisible();

  // "All" is linked to the individual boxes.
  const ratings = dialog.getByRole("group", { name: "Rating" });
  const all = ratings.getByRole("checkbox", { name: "All" });
  await ratings.locator(".checkbox", { hasText: "1 star" }).click();
  await expect(all).not.toBeChecked();
  await ratings.locator(".checkbox", { hasText: "All" }).click();
  await expect(all).toBeChecked();

  await dialog.getByRole("group", { name: "Media" }).locator(".checkbox", { hasText: "Video" }).click();
  await expect(dialog.locator(".modal-summary")).toHaveText(/^\d+ shots · \d+ files · /);
  await dialog.getByRole("button", { name: "Start import" }).click();
  await expect(dialog).toBeHidden();

  const status = page.getByRole("status", { name: "Import status" });
  await expect(status).toContainText(/Imported \d+ files/, { timeout: 15_000 });
  await expect(frame(page, "IMG_0001").getByText("Imported", { exact: true })).toBeVisible();
});

test("the dialog explains what is missing and closes with Escape", async ({ page }) => {
  const importButton = page.getByRole("button", { name: "Import", exact: true });
  await importButton.click();
  const dialog = page.getByRole("dialog", { name: "Import" });
  await expect(dialog.getByText("Set a destination folder in Import Settings.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Start import" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(importButton).toBeFocused();
});
