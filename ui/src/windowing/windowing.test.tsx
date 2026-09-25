import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestDesktop, MAIN_RECT } from "../test/desktop";
import { frame, installFakeLayout } from "../test/helpers";
import { SplitView } from "./SplitView";
import { createMemoryHub, type BusMessage } from "./bus";
import { createDockTracker, DOCK_SETTLE_MS, isOverMain, type Rect } from "./docking";
import { paneFromLocation } from "./host";

installFakeLayout();

type Title = "Thumbnails" | "Preview" | "Import Settings";


function pane(root: HTMLElement, title: Title) {
  return within(root).getByRole("region", { name: title });
}

function queryPane(root: HTMLElement, title: Title) {
  return within(root).queryByRole("region", { name: title });
}

function windowsList(root: HTMLElement) {
  return within(root).getByRole("list", { name: "Windows" });
}

function paneOrder(root: HTMLElement) {
  return within(root)
    .getAllByRole("region")
    .map((r) => r.getAttribute("aria-labelledby"));
}

// Window rectangles in screen coordinates (main window: MAIN_RECT).
const BESIDE_MAIN: Rect = { x: MAIN_RECT.x + MAIN_RECT.width + 16, y: 100, width: 900, height: 700 };
const OVER_MAIN: Rect = { x: 300, y: 200, width: 900, height: 700 };

async function setup() {
  const user = userEvent.setup();
  const desktop = createTestDesktop();
  await within(desktop.main.view.container).findByRole("grid", { name: "Frames" });
  const assets = desktop.data.assets.get("mock:mtp:eos-r6m2")!;
  return { user, desktop, assets, main: desktop.main.view.container };
}

async function popOut(user: ReturnType<typeof userEvent.setup>, main: HTMLElement, title: Title) {
  await user.click(within(pane(main, title)).getByRole("button", { name: `Open ${title} in its own window` }));
  await waitFor(() => expect(queryPane(main, title)).not.toBeInTheDocument());
}

describe("SplitView", () => {
  it("resizes with the keyboard within limits and remembers the ratio", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SplitView first={<p>A</p>} second={<p>B</p>} defaultRatio={50} />);
    const sep = screen.getByRole("separator", { name: "Resize panes" });
    expect(sep).toHaveAttribute("aria-valuenow", "50");
    expect(sep).toHaveAttribute("aria-orientation", "vertical");

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

  it("stacks panes vertically with up/down keys", async () => {
    const user = userEvent.setup();
    render(<SplitView direction="column" storageKey="t" first={<p>A</p>} second={<p>B</p>} defaultRatio={50} />);
    const sep = screen.getByRole("separator");
    expect(sep).toHaveAttribute("aria-orientation", "horizontal");
    sep.focus();
    await user.keyboard("{ArrowDown}");
    expect(sep).toHaveAttribute("aria-valuenow", "55");
    await user.keyboard("{ArrowLeft}");
    expect(sep).toHaveAttribute("aria-valuenow", "55");
  });
});

describe("paneFromLocation", () => {
  it("reads the pane kind from the query string", () => {
    expect(paneFromLocation("?pane=preview")).toBe("preview");
    expect(paneFromLocation("?pane=import")).toBe("import");
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

describe("dock tracker", () => {
  afterEach(() => vi.useRealTimers());

  it("treats the title bar over (or just outside) the main window as near", () => {
    expect(isOverMain(OVER_MAIN, MAIN_RECT)).toBe(true);
    expect(isOverMain(BESIDE_MAIN, MAIN_RECT)).toBe(false);
    // Title bar just above the main window, within the margin.
    expect(isOverMain({ x: 200, y: MAIN_RECT.y - 40, width: 600, height: 400 }, MAIN_RECT)).toBe(true);
  });

  it("docks after the window rests over the main window, once armed", () => {
    vi.useFakeTimers();
    const events: string[] = [];
    const t = createDockTracker({ onHover: (h) => events.push(h ? "hover" : "leave"), onDock: () => events.push("dock") });

    // Opened on top of the main window: ignored until moved away once.
    t.update(OVER_MAIN, MAIN_RECT);
    vi.advanceTimersByTime(DOCK_SETTLE_MS * 2);
    expect(events).toEqual([]);

    t.update(BESIDE_MAIN, MAIN_RECT);
    t.update(OVER_MAIN, MAIN_RECT);
    vi.advanceTimersByTime(DOCK_SETTLE_MS - 1);
    t.update({ ...OVER_MAIN, x: OVER_MAIN.x + 5 }, MAIN_RECT); // still moving
    vi.advanceTimersByTime(DOCK_SETTLE_MS - 1);
    expect(events).toEqual(["hover"]);
    vi.advanceTimersByTime(1);
    expect(events).toEqual(["hover", "dock"]);
  });

  it("cancels when the window leaves again", () => {
    vi.useFakeTimers();
    const events: string[] = [];
    const t = createDockTracker({ onHover: (h) => events.push(h ? "hover" : "leave"), onDock: () => events.push("dock") });
    t.update(BESIDE_MAIN, MAIN_RECT);
    t.update(OVER_MAIN, MAIN_RECT);
    t.update(BESIDE_MAIN, MAIN_RECT);
    vi.advanceTimersByTime(DOCK_SETTLE_MS * 2);
    expect(events).toEqual(["hover", "leave"]);
  });
});

describe("multiple windows", () => {
  it("lays out Thumbnails left and Preview over Import Settings on the right", async () => {
    const { main } = await setup();
    expect(within(main).getByRole("listbox", { name: "Devices" })).toBeInTheDocument();
    expect(within(main).getByRole("heading", { name: "Windows" })).toBeInTheDocument();
    expect(paneOrder(main)).toEqual(["pane-thumbnails-heading", "pane-preview-heading", "pane-import-heading"]);
    expect(within(main).getByRole("separator", { name: "Resize Thumbnails and side panes" })).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
    expect(within(main).getByRole("separator", { name: "Resize Preview and Import Settings" })).toHaveAttribute(
      "aria-orientation",
      "horizontal",
    );

    const popOutButton = within(pane(main, "Preview")).getByRole("button", { name: "Open Preview in its own window" });
    expect(popOutButton.querySelector("svg")).not.toBeNull();
    expect(popOutButton).toHaveTextContent("");
    expect(within(main).queryByRole("button", { name: /new/i })).not.toBeInTheDocument();
  });

  it("gives Import Settings the whole right side when Preview is elsewhere", async () => {
    const { user, main } = await setup();
    await popOut(user, main, "Preview");
    expect(paneOrder(main)).toEqual(["pane-thumbnails-heading", "pane-import-heading"]);
    expect(within(main).getAllByRole("separator")).toHaveLength(1);
  });

  it("pops the preview out, syncs both ways, and docks it back by button", async () => {
    const { user, desktop, assets, main } = await setup();
    await popOut(user, main, "Preview");

    const previewWin = desktop.window("preview")!;
    expect(within(windowsList(main)).getByText("Own window")).toBeInTheDocument();

    const pw = previewWin.view.container;
    await user.click(within(frame(main, assets[2]!.name)).getByText(assets[2]!.name));
    expect(await within(pw).findByRole("heading", { name: assets[2]!.name })).toBeInTheDocument();

    await user.click(within(pw).getByRole("radio", { name: "3 stars" }));
    await waitFor(() =>
      expect(within(frame(main, assets[2]!.name)).getByRole("group", { name: "3 stars" })).toBeInTheDocument(),
    );

    await user.click(within(pw).getByRole("button", { name: "Dock Preview into the main window" }));
    await waitFor(() => expect(previewWin.closed).toBe(true));
    await waitFor(() =>
      expect(paneOrder(main)).toEqual(["pane-thumbnails-heading", "pane-preview-heading", "pane-import-heading"]),
    );
  });

  it("docks a pane window when the window is dragged over the main window", async () => {
    const { user, desktop, main } = await setup();
    await popOut(user, main, "Preview");
    const previewWin = desktop.window("preview")!;

    // The user drags the window by its title bar: first away, then over main.
    desktop.moveWindow("preview", BESIDE_MAIN);
    desktop.moveWindow("preview", OVER_MAIN);
    expect(await within(main).findByText("Release to dock Preview into the main window.")).toBeInTheDocument();

    await waitFor(() => expect(previewWin.closed).toBe(true), { timeout: DOCK_SETTLE_MS + 1000 });
    expect(await within(main).findByRole("region", { name: "Preview" })).toBeInTheDocument();
    expect(within(main).queryByText(/Release to dock/)).not.toBeInTheDocument();
  });

  it("does not dock a window that is only placed next to the main window", async () => {
    const { user, desktop, main } = await setup();
    await popOut(user, main, "Import Settings");
    desktop.moveWindow("import", BESIDE_MAIN);
    desktop.moveWindow("import", { ...BESIDE_MAIN, y: 300 });
    await new Promise((r) => setTimeout(r, DOCK_SETTLE_MS + 100));
    expect(desktop.window("import")).toBeDefined();
    expect(queryPane(main, "Import Settings")).not.toBeInTheDocument();
  });

  it("keeps a single window per pane and docks it when that window is closed", async () => {
    const { user, desktop, main } = await setup();
    await popOut(user, main, "Thumbnails");
    await user.click(within(windowsList(main)).getByRole("button", { name: "Bring Thumbnails to front" }));
    expect(desktop.focusCount()).toBe(1);
    expect(desktop.openWindows().filter((w) => w.pane === "thumbnails")).toHaveLength(1);

    desktop.window("thumbnails")!.close();
    expect(await within(main).findByRole("region", { name: "Thumbnails" })).toBeInTheDocument();
    expect(within(windowsList(main)).getAllByText("Main window")).toHaveLength(3);
  });

  it("hides a docked pane and shows it again from the Windows list", async () => {
    const { user, main } = await setup();
    await user.click(within(pane(main, "Preview")).getByRole("button", { name: "Hide Preview" }));
    expect(queryPane(main, "Preview")).not.toBeInTheDocument();
    expect(within(windowsList(main)).getByText("Hidden")).toBeInTheDocument();

    await user.click(within(windowsList(main)).getByRole("button", { name: "Show Preview" }));
    expect(paneOrder(main)).toEqual(["pane-thumbnails-heading", "pane-preview-heading", "pane-import-heading"]);
  });

  it("a pane window starts with the main window's current state", async () => {
    const { user, desktop, assets, main } = await setup();
    await user.click(within(frame(main, assets[4]!.name)).getByText(assets[4]!.name));
    await popOut(user, main, "Preview");
    const win = desktop.window("preview")!;
    expect(await within(win.view.container).findByRole("heading", { name: assets[4]!.name })).toBeInTheDocument();
  });
});
