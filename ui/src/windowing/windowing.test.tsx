import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PANE_MIME } from "../library/Library";
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

type Title = "Thumbnails" | "Preview";

function cell(root: HTMLElement, name: string) {
  const grid = within(root).getByRole("grid", { name: "写真と動画" });
  return within(grid).getByRole("gridcell", { name: new RegExp(`^${name}`) });
}

function pane(root: HTMLElement, title: Title) {
  return within(root).getByRole("region", { name: title });
}

function queryPane(root: HTMLElement, title: Title) {
  return within(root).queryByRole("region", { name: title });
}

function windowsList(root: HTMLElement) {
  return within(root).getByRole("list", { name: "Windows" });
}

/** A minimal DataTransfer for jsdom drag events. */
function dataTransfer(withData: boolean) {
  const store = new Map<string, string>();
  return {
    types: [] as string[],
    dropEffect: "none",
    effectAllowed: "all",
    setData(type: string, value: string) {
      if (!withData) return;
      store.set(type, value);
      this.types.push(type);
    },
    getData: (type: string) => store.get(type) ?? "",
  };
}

async function setup() {
  const user = userEvent.setup();
  const desktop = createTestDesktop();
  await within(desktop.main.view.container).findByRole("grid");
  const assets = desktop.data.assets.get("mock:mtp:eos-r6m2")!;
  return { user, desktop, assets, main: desktop.main.view.container };
}

async function popOut(user: ReturnType<typeof userEvent.setup>, main: HTMLElement, title: Title) {
  await user.click(within(pane(main, title)).getByRole("button", { name: `${title} を別ウィンドウで開く` }));
  await waitFor(() => expect(queryPane(main, title)).not.toBeInTheDocument());
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
  it("uses English names and icon buttons, split in the main window", async () => {
    const { main } = await setup();
    expect(within(main).getByRole("heading", { name: "Devices" })).toBeInTheDocument();
    expect(within(main).getByRole("heading", { name: "Windows" })).toBeInTheDocument();
    expect(pane(main, "Thumbnails")).toBeInTheDocument();
    expect(pane(main, "Preview")).toBeInTheDocument();
    expect(within(main).getByRole("separator")).toBeInTheDocument();

    const popOutButton = within(pane(main, "Preview")).getByRole("button", { name: "Preview を別ウィンドウで開く" });
    expect(popOutButton.querySelector("svg")).not.toBeNull();
    expect(popOutButton).toHaveTextContent("");
    expect(within(pane(main, "Preview")).getByRole("button", { name: "Preview を閉じる" })).toHaveAttribute(
      "title",
      "Preview を閉じる",
    );
    // There is no way to open duplicate windows.
    expect(within(main).queryByRole("button", { name: /新しい/ })).not.toBeInTheDocument();
  });

  it("pops the preview out, syncs both ways, and docks it back by button", async () => {
    const { user, desktop, assets, main } = await setup();
    await popOut(user, main, "Preview");

    const previewWin = desktop.window("preview")!;
    expect(within(windowsList(main)).getByText("別ウィンドウ")).toBeInTheDocument();
    expect(within(main).queryByRole("separator")).not.toBeInTheDocument();
    // The last docked pane cannot be moved out.
    expect(within(pane(main, "Thumbnails")).getByRole("button", { name: /別ウィンドウで開く/ })).toBeDisabled();

    const pw = previewWin.view.container;
    await user.click(cell(main, assets[2]!.name));
    expect(await within(pw).findByRole("heading", { name: assets[2]!.name })).toBeInTheDocument();

    await user.click(within(pw).getByRole("radio", { name: "★3" }));
    await waitFor(() =>
      expect(within(cell(main, assets[2]!.name)).getByRole("group", { name: "評価 3" })).toBeInTheDocument(),
    );

    await user.click(within(pw).getByRole("button", { name: "Preview をメインウィンドウに戻す" }));
    await waitFor(() => expect(previewWin.closed).toBe(true));
    expect(await within(main).findByRole("region", { name: "Preview" })).toBeInTheDocument();
    expect(within(main).getByRole("separator")).toBeInTheDocument();
  });

  it("keeps a single window per pane and docks it when that window is closed", async () => {
    const { user, desktop, main } = await setup();
    await popOut(user, main, "Thumbnails");
    const list = windowsList(main);
    await user.click(within(list).getByRole("button", { name: "Thumbnails を前面に表示" }));
    expect(desktop.focusCount()).toBe(1);
    expect(desktop.openWindows().filter((w) => w.pane === "thumbnails")).toHaveLength(1);

    desktop.window("thumbnails")!.close();
    expect(await within(main).findByRole("region", { name: "Thumbnails" })).toBeInTheDocument();
    expect(within(windowsList(main)).getAllByText("メインウィンドウ")).toHaveLength(2);
  });

  it("hides a docked pane and shows it again from the Windows list", async () => {
    const { user, main } = await setup();
    await user.click(within(pane(main, "Preview")).getByRole("button", { name: "Preview を閉じる" }));
    expect(queryPane(main, "Preview")).not.toBeInTheDocument();
    expect(within(windowsList(main)).getByText("非表示")).toBeInTheDocument();

    await user.click(within(windowsList(main)).getByRole("button", { name: "Preview を表示" }));
    expect(pane(main, "Preview")).toBeInTheDocument();
  });

  it("docks a pane window by dragging its header onto the main window", async () => {
    const { user, desktop, main } = await setup();
    await popOut(user, main, "Preview");
    const pw = desktop.window("preview")!.view.container;
    const header = within(pw).getByRole("heading", { name: "Preview" }).closest("header")!;
    expect(header).toHaveAttribute("draggable", "true");

    const dt = dataTransfer(true);
    fireEvent.dragStart(header, { dataTransfer: dt });
    expect(dt.getData(PANE_MIME)).toBe("preview");
    // The main window shows drop zones once the pane window starts dragging.
    const left = await within(main).findByRole("region", { name: "左側に結合" });
    fireEvent.dragOver(left, { dataTransfer: dt });
    fireEvent.drop(left, { dataTransfer: dt });
    fireEvent.dragEnd(header, { dataTransfer: dt });

    await waitFor(() => expect(desktop.window("preview")).toBeUndefined());
    // Dropped on the left: Preview comes first.
    const regions = within(main)
      .getAllByRole("region")
      .map((r) => r.getAttribute("aria-labelledby"));
    expect(regions).toEqual(["pane-preview-heading", "pane-thumbnails-heading"]);
    expect(within(main).queryByRole("region", { name: "左側に結合" })).not.toBeInTheDocument();
  });

  it("docks by drop even when drag data does not cross windows", async () => {
    const { user, desktop, main } = await setup();
    await popOut(user, main, "Thumbnails");
    const tw = desktop.window("thumbnails")!.view.container;
    const header = within(tw).getByRole("heading", { name: "Thumbnails" }).closest("header")!;

    const empty = dataTransfer(false);
    fireEvent.dragStart(header, { dataTransfer: empty });
    const right = await within(main).findByRole("region", { name: "右側に結合" });
    fireEvent.drop(right, { dataTransfer: empty });

    await waitFor(() => expect(desktop.window("thumbnails")).toBeUndefined());
    const order = within(main)
      .getAllByRole("region")
      .map((r) => r.getAttribute("aria-labelledby"));
    expect(order).toEqual(["pane-preview-heading", "pane-thumbnails-heading"]);
  });

  it("hides the drop zones when the drag is cancelled", async () => {
    const { user, desktop, main } = await setup();
    await popOut(user, main, "Preview");
    const header = within(desktop.window("preview")!.view.container)
      .getByRole("heading", { name: "Preview" })
      .closest("header")!;
    fireEvent.dragStart(header, { dataTransfer: dataTransfer(true) });
    await within(main).findByRole("region", { name: "左側に結合" });
    fireEvent.dragEnd(header, { dataTransfer: dataTransfer(true) });
    await waitFor(() => expect(within(main).queryByRole("region", { name: "左側に結合" })).not.toBeInTheDocument());
    expect(desktop.window("preview")).toBeDefined();
  });

  it("a pane window starts with the main window's current state", async () => {
    const { user, desktop, assets, main } = await setup();
    await user.click(cell(main, assets[4]!.name));
    await popOut(user, main, "Preview");
    const win = desktop.window("preview")!;
    expect(await within(win.view.container).findByRole("heading", { name: assets[4]!.name })).toBeInTheDocument();
  });
});
