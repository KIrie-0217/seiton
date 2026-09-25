import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestDesktop } from "../test/desktop";
import { SplitView } from "./SplitView";
import { createMemoryHub, type BusMessage } from "./bus";
import { paneFromLocation } from "./host";

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

function cell(root: HTMLElement, name: string) {
  const grid = within(root).getByRole("grid", { name: "写真と動画" });
  return within(grid).getByRole("gridcell", { name: new RegExp(`^${name}`) });
}

function paneRegion(root: HTMLElement, title: "一覧" | "プレビュー") {
  return within(root).getByRole("region", { name: title });
}

async function setup() {
  const user = userEvent.setup();
  const desktop = createTestDesktop();
  await within(desktop.main.view.container).findByRole("grid");
  const assets = desktop.data.assets.get("mock:mtp:eos-r6m2")!;
  return { user, desktop, assets, main: desktop.main.view.container };
}

describe("SplitView", () => {
  it("resizes with the keyboard within limits and remembers the ratio", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SplitView first={<p>A</p>} second={<p>B</p>} defaultRatio={50} />);
    const sep = screen.getByRole("separator", { name: "パネルの境界" });
    expect(sep).toHaveAttribute("aria-valuenow", "50");

    sep.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(sep).toHaveAttribute("aria-valuenow", "60");
    await user.keyboard("{End}");
    expect(sep).toHaveAttribute("aria-valuenow", "80");
    await user.keyboard("{ArrowRight}");
    expect(sep).toHaveAttribute("aria-valuenow", "80");
    await user.keyboard("{Home}{ArrowLeft}");
    expect(sep).toHaveAttribute("aria-valuenow", "20");

    unmount();
    render(<SplitView first={<p>A</p>} second={<p>B</p>} defaultRatio={50} />);
    expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "20");
  });
});

describe("paneFromLocation", () => {
  it("reads the pane kind from the query string", () => {
    expect(paneFromLocation("?pane=preview")).toBe("preview");
    expect(paneFromLocation("?pane=thumbnails&x=1")).toBe("thumbnails");
    expect(paneFromLocation("?pane=evil")).toBeNull();
    expect(paneFromLocation("")).toBeNull();
  });
});

describe("memory bus", () => {
  it("never delivers a window's own messages back to it", async () => {
    const hub = createMemoryHub();
    const a = hub.connect("a");
    const b = hub.connect("b");
    const gotA: BusMessage[] = [];
    const gotB: BusMessage[] = [];
    a.subscribe((m) => gotA.push(m));
    b.subscribe((m) => gotB.push(m));
    a.publish({ type: "stateRequest", from: "a" });
    hub.backend.publish({ type: "assetsUpdated", from: "backend", assets: [] });
    await Promise.resolve();
    await Promise.resolve();
    expect(gotA.map((m) => m.type)).toEqual(["assetsUpdated"]);
    expect(gotB.map((m) => m.type)).toEqual(["stateRequest", "assetsUpdated"]);
  });
});

describe("multiple windows", () => {
  it("shows thumbnails and preview split in the main window", async () => {
    const { main } = await setup();
    expect(paneRegion(main, "一覧")).toBeInTheDocument();
    expect(paneRegion(main, "プレビュー")).toBeInTheDocument();
    expect(within(main).getByRole("separator")).toBeInTheDocument();
  });

  it("pops the preview out into its own window and docks it back", async () => {
    const { user, desktop, assets, main } = await setup();
    await user.click(within(paneRegion(main, "プレビュー")).getByRole("button", { name: "別ウィンドウで開く" }));

    const [, previewWin] = desktop.openWindows();
    expect(previewWin?.pane).toBe("preview");
    // The main window keeps only the thumbnails, without a split.
    await waitFor(() => expect(within(main).queryByRole("region", { name: "プレビュー" })).not.toBeInTheDocument());
    expect(within(main).queryByRole("separator")).not.toBeInTheDocument();
    // The last docked pane cannot be moved out.
    expect(within(paneRegion(main, "一覧")).getByRole("button", { name: "別ウィンドウで開く" })).toBeDisabled();

    // Selecting in the main window updates the external preview.
    const pw = previewWin!.view.container;
    await user.click(cell(main, assets[2]!.name));
    expect(await within(pw).findByRole("heading", { name: assets[2]!.name })).toBeInTheDocument();

    // Rating in the external window updates the main window's grid.
    await user.click(within(pw).getByRole("radio", { name: "★3" }));
    await waitFor(() =>
      expect(within(cell(main, assets[2]!.name)).getByRole("img", { name: "評価 3" })).toBeInTheDocument(),
    );

    // Dock back from the external window.
    await user.click(within(pw).getByRole("button", { name: "メインウィンドウに戻す" }));
    await waitFor(() => expect(previewWin!.closed).toBe(true));
    expect(await within(main).findByRole("region", { name: "プレビュー" })).toBeInTheDocument();
    expect(within(main).getByRole("separator")).toBeInTheDocument();
  });

  it("re-docks a popped-out pane when its window is closed", async () => {
    const { user, desktop, main } = await setup();
    await user.click(within(paneRegion(main, "一覧")).getByRole("button", { name: "別ウィンドウで開く" }));
    const listWin = desktop.openWindows()[1]!;
    await waitFor(() => expect(within(main).queryByRole("region", { name: "一覧" })).not.toBeInTheDocument());

    listWin.close();
    expect(await within(main).findByRole("region", { name: "一覧" })).toBeInTheDocument();
  });

  it("opens an extra thumbnail window that shares the selection", async () => {
    const { user, desktop, assets, main } = await setup();
    await user.click(within(main).getByRole("button", { name: "新しい一覧ウィンドウ" }));
    const extra = desktop.openWindows()[1]!;
    const ew = extra.view.container;
    await within(ew).findByRole("grid");

    // Main keeps both panes; the extra window is listed.
    expect(paneRegion(main, "一覧")).toBeInTheDocument();
    const listed = within(main).getByRole("list", { name: "開いているウィンドウ" });
    expect(within(listed).getByText("一覧")).toBeInTheDocument();

    // Filters are per window, selection is shared.
    await user.selectOptions(within(ew).getByLabelText("評価"), "unrated");
    expect(within(main).getByText("50 / 50 件")).toBeInTheDocument();

    const target = assets.find((a) => a.rating === null)!;
    await user.click(cell(ew, target.name));
    await waitFor(() => expect(cell(main, target.name)).toHaveAttribute("aria-selected", "true"));

    // Closing an extra window does not add panes to the main window.
    extra.close();
    await waitFor(() => expect(within(main).queryByRole("list", { name: "開いているウィンドウ" })).toBeNull());
    expect(within(main).getAllByRole("region")).toHaveLength(2);
  });

  it("a new window starts with the main window's current state", async () => {
    const { user, desktop, assets, main } = await setup();
    await user.click(cell(main, assets[4]!.name));
    await user.click(within(main).getByRole("button", { name: "新しいプレビューウィンドウ" }));
    const win = desktop.openWindows()[1]!;
    expect(await within(win.view.container).findByRole("heading", { name: assets[4]!.name })).toBeInTheDocument();
  });
});
