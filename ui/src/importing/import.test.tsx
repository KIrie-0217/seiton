import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestDesktop } from "../test/desktop";
import { chooseOption, frame, selectTrigger, installFakeLayout } from "../test/helpers";
import { planImport } from "./plan";
import { DEFAULT_IMPORT_SETTINGS } from "./template";

installFakeLayout();

async function setup(options?: Parameters<typeof createTestDesktop>[0]) {
  const user = userEvent.setup();
  const desktop = createTestDesktop(options);
  const main = desktop.main.view.container;
  await within(main).findByRole("grid", { name: "Frames" });
  const settingsPane = within(main).getByRole("region", { name: "Import Settings" });
  await within(settingsPane).findByRole("form", { name: "Import settings" });
  return { user, desktop, main, settingsPane };
}

describe("Import Settings pane", () => {
  it("switches between one format for all ratings and one per rating", async () => {
    const { user, settingsPane } = await setup();
    expect(selectTrigger(settingsPane, "Format")).toHaveTextContent("JPG + RAW");

    await chooseOption(user, settingsPane, "Apply to", "Each rating separately");
    const list = within(settingsPane).getByRole("list", { name: "Format per rating" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(6);
    expect(within(settingsPane).queryByText("Format", { selector: ".react-aria-Label" })).not.toBeInTheDocument();
    expect(selectTrigger(settingsPane, "1 star")).toHaveTextContent("JPG only");

    await chooseOption(user, settingsPane, "1 star", "RAW only");
    expect(selectTrigger(settingsPane, "1 star")).toHaveTextContent("RAW only");
  });

  it("builds folders from checkboxes and shows example paths", async () => {
    const { user, settingsPane } = await setup();
    const s = within(settingsPane);
    await user.type(s.getByRole("textbox", { name: "Destination folder" }), "D:\\Photos");
    await user.click(s.getByRole("checkbox", { name: "Separate RAW and JPG" }));
    await user.click(s.getByRole("checkbox", { name: "By rating" }));
    expect(s.getByText("D:\\Photos\\2026-09-20\\star3\\RAW\\IMG_0001.CR3")).toBeInTheDocument();
    expect(s.getByText("D:\\Photos\\2026-09-20\\star3\\JPG\\IMG_0001.JPG")).toBeInTheDocument();
  });

  it("uses a validated template, prefilled from the simple layout", async () => {
    const { user, settingsPane } = await setup();
    const s = within(settingsPane);
    await user.click(s.getByRole("checkbox", { name: "By hour" }));
    await chooseOption(user, settingsPane, "Mode", "Template");
    const input = s.getByRole("textbox", { name: "Folder template" });
    expect(input).toHaveValue("{yyyy}-{MM}-{dd}/{HH}");
    expect(s.getByText("{star}")).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "{{yy}{{MM}{{dd}-{{HH}{{mm}/{{fil");
    expect(s.getByRole("alert")).toHaveTextContent("is not closed");
    await user.type(input, "e}");
    expect(s.queryByRole("alert")).not.toBeInTheDocument();
    expect(s.getByText("<destination>/260920-1015/RAW/IMG_0001.CR3")).toBeInTheDocument();
  });

  it("shares settings with other windows", async () => {
    const { user, desktop, settingsPane } = await setup();
    await user.click(within(settingsPane).getByRole("checkbox", { name: "By date" }));
    await user.click(within(settingsPane).getByRole("button", { name: "Open Import Settings in its own window" }));
    const pane = within(desktop.window("import")!.view.container);
    expect(await pane.findByRole("checkbox", { name: "By date" })).not.toBeChecked();
  });

  it("shows Japanese guidance in the Japanese locale", async () => {
    const { user, main, settingsPane } = await setup();
    await chooseOption(user, main, "Language", "日本語");
    expect(within(settingsPane).getByText(/JPG には HEIF を含みます/)).toBeInTheDocument();
    expect(within(settingsPane).getByRole("checkbox", { name: "By date" })).toBeInTheDocument();
  });
});

describe("import dialog and progress", () => {
  async function configured(options?: Parameters<typeof createTestDesktop>[0]) {
    const ctx = await setup(options);
    await ctx.user.type(within(ctx.settingsPane).getByRole("textbox", { name: "Destination folder" }), "D:\\Photos");
    return ctx;
  }

  async function openDialog(user: ReturnType<typeof userEvent.setup>, main: HTMLElement) {
    await user.click(within(main).getByRole("button", { name: "Import" }));
    return within(await screen.findByRole("dialog", { name: "Import" }));
  }

  it("links the 'All' box to the individual ratings", async () => {
    const { user, main } = await configured();
    const dialog = await openDialog(user, main);
    const ratings = within(dialog.getByRole("group", { name: "Rating" }));
    const all = ratings.getByRole("checkbox", { name: "All" });
    expect(all).toBeChecked();

    await user.click(ratings.getByRole("checkbox", { name: "1 star" }));
    expect(all).not.toBeChecked();
    expect((all as HTMLInputElement).indeterminate).toBe(true);

    await user.click(all);
    expect(all).toBeChecked();
    expect(ratings.getByRole("checkbox", { name: "1 star" })).toBeChecked();

    await user.click(all);
    expect(ratings.getAllByRole("checkbox").every((c) => !(c as HTMLInputElement).checked)).toBe(true);
    expect(dialog.getByRole("button", { name: "Start import" })).toBeDisabled();
    expect(dialog.getByText("Select at least one rating.")).toBeInTheDocument();

    const media = within(dialog.getByRole("group", { name: "Media" }));
    expect(media.getAllByRole("checkbox").map((c) => c.closest("label")?.textContent)).toEqual([
      "All",
      "Images",
      "Video",
      "Metadata",
    ]);
  });

  it("requires a destination and closes with Escape", async () => {
    const { user, main } = await setup();
    const dialog = await openDialog(user, main);
    expect(dialog.getByText("Set a destination folder in Import Settings.")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Start import" })).toBeDisabled();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(within(main).getByRole("button", { name: "Import" })).toHaveFocus());
  });

  it("imports the selected files and shows progress in the status bar", async () => {
    const { user, desktop, main } = await configured();
    const assets = desktop.data.assets.get("mock:mtp:eos-r6m2")!;
    const dialog = await openDialog(user, main);
    await user.click(within(dialog.getByRole("group", { name: "Media" })).getByRole("checkbox", { name: "Video" }));

    const expected = planImport(
      assets,
      { ...DEFAULT_IMPORT_SETTINGS, destinationRoot: "D:\\Photos" },
      { deviceId: "mock:mtp:eos-r6m2", ratings: [0, 1, 2, 3, 4, 5], media: ["image", "metadata"] },
    );
    expect(dialog.getByText(new RegExp(`^${expected.assetCount} shots · ${expected.files.length} files`))).toBeInTheDocument();

    await user.click(dialog.getByRole("button", { name: "Start import" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const bar = await within(main).findByRole("status", { name: "Import status" });
    await waitFor(() => expect(bar).toHaveTextContent(`Imported ${expected.files.length} files`));
    expect(within(bar).getByRole("progressbar", { name: "Import progress" })).toHaveAttribute("aria-valuenow", "100");

    const firstImage = assets.find((a) => a.files.every((f) => f.kind !== "video"))!;
    await waitFor(() => expect(within(frame(main, firstImage.name)).getByText("Imported")).toBeInTheDocument());

    await user.click(within(bar).getByRole("button", { name: "Dismiss" }));
    expect(within(main).queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("can cancel a running import", async () => {
    const { user, main } = await configured({ mock: { copyDelayMs: { perFile: 30, perMb: 0 } } });
    const dialog = await openDialog(user, main);
    await user.click(dialog.getByRole("button", { name: "Start import" }));

    const bar = await within(main).findByRole("status", { name: "Import status" });
    await waitFor(() => expect(bar).toHaveTextContent("Importing"));
    expect(within(main).getByRole("button", { name: "Import" })).toBeDisabled();
    await user.click(within(bar).getByRole("button", { name: "Cancel import" }));
    await waitFor(() => expect(bar).toHaveTextContent("Import cancelled"));
    expect(within(main).getByRole("button", { name: "Import" })).toBeEnabled();
  });
});
