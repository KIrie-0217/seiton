import { expect, test } from "@playwright/test";
import { frame, openApp, pane } from "./helpers";

// In the browser mock, pane windows are pop-ups kept in sync over a
// BroadcastChannel. Real Tauri windows and drag-to-dock are not covered here.
test("pops Preview out, syncs the selection, and docks it back when closed", async ({ page, context }) => {
  await openApp(page);
  const popupPromise = context.waitForEvent("page");
  await pane(page, "Preview").getByRole("button", { name: "Open Preview in its own window" }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState();

  await expect(pane(page, "Preview")).toBeHidden();
  await expect(page.getByRole("list", { name: "Windows" })).toContainText("Own window");

  await frame(page, "IMG_0004").getByText("IMG_0004", { exact: true }).click();
  await expect(popup.getByRole("heading", { name: "IMG_0004" })).toBeVisible();

  await popup.close();
  await expect(pane(page, "Preview")).toBeVisible();
});
