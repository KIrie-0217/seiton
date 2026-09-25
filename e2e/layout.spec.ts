import { expect, test } from "@playwright/test";
import { choose, frame, openApp, pane, scrollState } from "./helpers";

// Regression for "the whole UI scrolls when a checkbox is clicked": React
// Aria's hidden inputs must stay inside their labels. jsdom cannot see this.
test.describe("clicking controls never scrolls the window", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test("Import Settings checkboxes", async ({ page }) => {
    const settings = pane(page, "Import Settings");
    for (const name of ["By hour", "By rating", "Separate RAW and JPG"]) {
      const box = settings.getByRole("checkbox", { name });
      await box.scrollIntoViewIfNeeded();
      const before = await scrollState(page);
      await settings.locator(".checkbox", { hasText: name }).click();
      await expect(box).toBeChecked();
      const after = await scrollState(page);
      expect(after).toEqual({ ...before, window: 0, main: 0, library: 0 });
    }
  });

  test("filter chips and preview rating", async ({ page }) => {
    await pane(page, "Thumbnails").locator(".checkbox", { hasText: "Video" }).click();
    expect(await scrollState(page)).toEqual({ window: 0, main: 0, library: 0 });
    await pane(page, "Thumbnails").locator(".checkbox", { hasText: "Video" }).click();

    await frame(page, "IMG_0002").getByText("IMG_0002", { exact: true }).click();
    await page.getByRole("complementary", { name: "Details" }).locator(".star-radio").nth(3).click();
    expect(await scrollState(page)).toEqual({ window: 0, main: 0, library: 0 });
  });

  test("selects in the settings form", async ({ page }) => {
    await choose(page, pane(page, "Import Settings"), "Apply to", "Each rating separately");
    expect(await scrollState(page)).toEqual({ window: 0, main: 0, library: 0 });
  });
});

test("the sidebar can be hidden, and the sheet takes the space", async ({ page }) => {
  await openApp(page);
  const sheet = pane(page, "Thumbnails");
  const before = (await sheet.boundingBox())!.width;
  await page.getByRole("button", { name: "Hide sidebar" }).click();
  await expect(page.getByRole("listbox", { name: "Devices" })).toBeHidden();
  await expect.poll(async () => (await sheet.boundingBox())!.width).toBeGreaterThan(before);
  await page.reload();
  await expect(frame(page, "IMG_0001")).toBeVisible();
  await expect(page.getByRole("listbox", { name: "Devices" })).toBeHidden();
  await page.keyboard.press("ControlOrMeta+b");
  await expect(page.getByRole("listbox", { name: "Devices" })).toBeVisible();
});
