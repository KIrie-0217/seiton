import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { planImport } from "./plan";
import { DEFAULT_IMPORT_SETTINGS } from "./template";
import { createTestDesktop } from "../test/desktop";

const originals = {
  offsetWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth"),
  offsetHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight"),
};

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 900 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 600 });
});

afterAll(() => {
  for (const [key, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor);
  }
});

async function setup(mock?: Parameters<typeof createTestDesktop>[0]) {
  const user = userEvent.setup();
  const desktop = createTestDesktop(mock);
  const main = desktop.main.view.container;
  await within(main).findByRole("grid");
  const settingsPane = within(main).getByRole("region", { name: "Import Settings" });
  await within(settingsPane).findByRole("form", { name: "取り込み設定" });
  return { user, desktop, main, settingsPane };
}

describe("Import Settings pane", () => {
  it("switches between one format for all ratings and one per rating", async () => {
    const { user, settingsPane } = await setup();
    const s = within(settingsPane);
    expect(s.getByLabelText("形式")).toHaveValue("rawAndJpeg");

    await user.selectOptions(s.getByLabelText("保存設定"), "perRating");
    const items = within(s.getByRole("list", { name: "星ごとの形式" })).getAllByRole("listitem");
    expect(items).toHaveLength(6);
    for (const label of ["未評価", "★1", "★2", "★3", "★4", "★5"]) {
      expect(s.getByLabelText(label).tagName).toBe("SELECT");
    }
    expect(s.queryByLabelText("形式")).not.toBeInTheDocument();
    expect(s.getByLabelText("★1")).toHaveValue("jpegOnly");
    await user.selectOptions(s.getByLabelText("★1"), "rawOnly");
    expect(s.getByLabelText("★1")).toHaveValue("rawOnly");
  });

  it("builds folders from checkboxes and shows example paths", async () => {
    const { user, settingsPane } = await setup();
    const s = within(settingsPane);
    await user.type(s.getByLabelText("保存先フォルダ"), "D:\\Photos");
    await user.click(s.getByRole("checkbox", { name: "RAW と JPG を別フォルダにする" }));
    await user.click(s.getByRole("checkbox", { name: "星ごとにフォルダを分ける" }));
    expect(s.getByText("D:\\Photos\\2026-09-20\\star3\\RAW\\IMG_0001.CR3")).toBeInTheDocument();
    expect(s.getByText("D:\\Photos\\2026-09-20\\star3\\JPG\\IMG_0001.JPG")).toBeInTheDocument();
  });

  it("uses a validated template in the advanced mode, prefilled from the simple one", async () => {
    const { user, settingsPane } = await setup();
    const s = within(settingsPane);
    await user.click(s.getByRole("checkbox", { name: "時間でフォルダを分ける" }));
    await user.selectOptions(s.getByLabelText("設定方法"), "advanced");
    const input = s.getByLabelText("フォルダ名のテンプレート");
    expect(input).toHaveValue("{yyyy}-{MM}-{dd}/{HH}");
    expect(s.getByText("{star}")).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "{{yy}{{MM}{{dd}-{{HH}{{mm}/{{fil");
    expect(s.getByRole("alert")).toHaveTextContent("閉じていません");
    await user.type(input, "e}");
    expect(s.queryByRole("alert")).not.toBeInTheDocument();
    expect(s.getByText("<保存先>/260920-1015/RAW/IMG_0001.CR3")).toBeInTheDocument();
  });

  it("shares settings with other windows", async () => {
    const { user, desktop, main, settingsPane } = await setup();
    await user.click(within(settingsPane).getByRole("checkbox", { name: "日付でフォルダを分ける" }));
    await user.click(
      within(within(main).getByRole("region", { name: "Import Settings" })).getByRole("button", {
        name: "Import Settings を別ウィンドウで開く",
      }),
    );
    const win = desktop.window("import")!;
    const pane = within(win.view.container);
    expect(await pane.findByRole("checkbox", { name: "日付でフォルダを分ける" })).not.toBeChecked();
  });
});

describe("import dialog and progress", () => {
  async function configured() {
    const ctx = await setup();
    await ctx.user.type(within(ctx.settingsPane).getByLabelText("保存先フォルダ"), "D:\\Photos");
    return ctx;
  }

  it("links the 'all' checkboxes to the individual ones", async () => {
    const { user, main } = await configured();
    await user.click(within(main).getByRole("button", { name: "取り込み" }));
    const dialog = within(within(main).getByRole("dialog", { name: "取り込み" }));
    const ratings = within(dialog.getByRole("group", { name: "評価" }));
    const all = ratings.getByRole("checkbox", { name: "全て" });
    expect(all).toBeChecked();

    await user.click(ratings.getByRole("checkbox", { name: "★1" }));
    expect(all).not.toBeChecked();
    expect((all as HTMLInputElement).indeterminate).toBe(true);

    await user.click(all);
    expect(all).toBeChecked();
    expect(ratings.getByRole("checkbox", { name: "★1" })).toBeChecked();

    await user.click(all);
    expect(ratings.getAllByRole("checkbox").every((c) => !(c as HTMLInputElement).checked)).toBe(true);
    expect(dialog.getByRole("button", { name: "取り込み開始" })).toBeDisabled();
    expect(dialog.getByText("評価が 1 つも選ばれていません")).toBeInTheDocument();

    const media = within(dialog.getByRole("group", { name: "メディア形式" }));
    expect(media.getAllByRole("checkbox").map((c) => c.parentElement?.textContent)).toEqual([
      "全て",
      "画像",
      "動画",
      "メタデータ",
    ]);
  });

  it("requires a destination and closes with Escape", async () => {
    const { user, main } = await setup();
    await user.click(within(main).getByRole("button", { name: "取り込み" }));
    const dialog = within(main).getByRole("dialog");
    expect(within(dialog).getByText(/保存先フォルダが設定されていません/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "取り込み開始" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(within(main).queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(main).getByRole("button", { name: "取り込み" })).toHaveFocus();
  });

  it("imports the selected files and shows progress in the status bar", async () => {
    const { user, desktop, main } = await configured();
    const assets = desktop.data.assets.get("mock:mtp:eos-r6m2")!;
    await user.click(within(main).getByRole("button", { name: "取り込み" }));
    const dialog = within(main).getByRole("dialog");
    const media = within(within(dialog).getByRole("group", { name: "メディア形式" }));
    await user.click(media.getByRole("checkbox", { name: "動画" }));

    const expected = planImport(
      assets,
      { ...DEFAULT_IMPORT_SETTINGS, destinationRoot: "D:\\Photos" },
      { deviceId: "mock:mtp:eos-r6m2", ratings: [0, 1, 2, 3, 4, 5], media: ["image", "metadata"] },
    );
    expect(within(dialog).getByText(new RegExp(`${expected.assetCount} 件・${expected.files.length} ファイル`))).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "取り込み開始" }));
    expect(within(main).queryByRole("dialog")).not.toBeInTheDocument();

    const bar = await within(main).findByRole("status", { name: "取り込みの状況" });
    await waitFor(() => expect(bar).toHaveTextContent(`取り込み完了: ${expected.files.length} ファイル`));
    expect(within(bar).getByRole("progressbar", { name: "取り込みの進行状況" })).toHaveValue(100);

    // Imported assets get the badge; videos were not imported.
    const grid = within(main).getByRole("grid");
    const firstImage = assets.find((a) => a.files.every((f) => f.kind !== "video"))!;
    await waitFor(() =>
      expect(within(within(grid).getByRole("gridcell", { name: new RegExp(`^${firstImage.name}`) })).getByText("取込済")).toBeInTheDocument(),
    );

    await user.click(within(bar).getByRole("button", { name: "表示を消す" }));
    expect(within(main).queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("can cancel a running import", async () => {
    const { user, main } = await setup({ mock: { copyDelayMs: { perFile: 30, perMb: 0 } } });
    await user.type(
      within(within(main).getByRole("region", { name: "Import Settings" })).getByLabelText("保存先フォルダ"),
      "/Volumes/Photos",
    );
    await user.click(within(main).getByRole("button", { name: "取り込み" }));
    await user.click(within(within(main).getByRole("dialog")).getByRole("button", { name: "取り込み開始" }));

    const bar = await within(main).findByRole("status", { name: "取り込みの状況" });
    await waitFor(() => expect(bar).toHaveTextContent("取り込み中"));
    expect(within(main).getByRole("button", { name: "取り込み" })).toBeDisabled();
    await user.click(within(bar).getByRole("button", { name: "取り込みを中止" }));
    await waitFor(() => expect(bar).toHaveTextContent("取り込みを中止しました"));
    expect(within(main).getByRole("button", { name: "取り込み" })).toBeEnabled();
  });
});
