import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App, createQueryClient } from "../App";
import { installMockBackend } from "../mock/backend";
import type { MockData } from "../mock/data";

// jsdom has no layout; give elements a size so the virtualizer renders rows.
const WIDTH = 900; // 5 columns of >= 180px
const HEIGHT = 600; // 3 rows of 200px visible
const originals = {
  offsetWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth"),
  offsetHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight"),
};

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => WIDTH });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => HEIGHT });
});

afterAll(() => {
  for (const [key, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor);
  }
});

let data: MockData;

beforeEach(() => {
  data = installMockBackend({ listDelayMs: 0, thumbDelayMs: [0, 0] }).data;
});

async function renderLibrary() {
  const user = userEvent.setup();
  render(<App library queryClient={createQueryClient()} />);
  const grid = await screen.findByRole("grid", { name: "写真と動画" });
  return { user, grid };
}

function mainAssets() {
  return data.assets.get("mock:mtp:eos-r6m2")!;
}

function cell(grid: HTMLElement, name: string) {
  return within(grid).getByRole("gridcell", { name: new RegExp(`^${name}`) });
}

describe("Library (mock backend)", () => {
  it("lists devices and shows the first device's assets virtualized", async () => {
    const { grid } = await renderLibrary();

    const nav = screen.getByRole("navigation", { name: "デバイス" });
    expect(within(nav).getByRole("button", { name: /Canon EOS R6 Mark II/ })).toHaveAttribute("aria-current", "true");
    expect(within(nav).getByRole("button", { name: /EOS_DIGITAL/ })).toHaveTextContent("SD カード");

    expect(screen.getByText("50 / 50 件")).toBeInTheDocument();
    expect(grid).toHaveAttribute("aria-colcount", "5");
    expect(grid).toHaveAttribute("aria-rowcount", "10");
    // Only the visible rows plus overscan are in the DOM.
    const rendered = within(grid).getAllByRole("gridcell").length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(50);
    // Thumbnails load asynchronously.
    await waitFor(() => expect(grid.querySelector("img.thumb")).not.toBeNull());
  });

  it("switches devices", async () => {
    const { user } = await renderLibrary();
    await user.click(screen.getByRole("button", { name: /EOS_DIGITAL/ }));
    expect(await screen.findByText("8 / 8 件")).toBeInTheDocument();
  });

  it("moves focus with arrow keys and rates with number keys", async () => {
    const { user, grid } = await renderLibrary();
    const [first, second, , , , sixth] = mainAssets();

    await user.click(cell(grid, first!.name));
    expect(cell(grid, first!.name)).toHaveFocus();
    expect(cell(grid, first!.name)).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowRight}");
    expect(cell(grid, second!.name)).toHaveFocus();
    expect(cell(grid, second!.name)).toHaveAttribute("aria-selected", "true");
    expect(cell(grid, first!.name)).toHaveAttribute("aria-selected", "false");

    await user.keyboard("{ArrowLeft}{ArrowDown}");
    expect(cell(grid, sixth!.name)).toHaveFocus();

    await user.keyboard("4");
    await waitFor(() =>
      expect(within(cell(grid, sixth!.name)).getByRole("img", { name: "評価 4" })).toBeInTheDocument(),
    );
    const detail = screen.getByRole("complementary", { name: "詳細" });
    expect(within(detail).getByRole("radio", { name: "★4" })).toBeChecked();
    expect(within(detail).getByText("seiton")).toBeInTheDocument();

    await user.keyboard("0");
    await waitFor(() =>
      expect(within(cell(grid, sixth!.name)).getByRole("img", { name: "評価なし" })).toBeInTheDocument(),
    );
  });

  it("rates a multi-selection from the detail panel", async () => {
    const { user, grid } = await renderLibrary();
    const [first, second, third] = mainAssets();

    await user.click(cell(grid, first!.name));
    await user.keyboard("{Control>}{ArrowRight}{/Control} ");
    await user.keyboard("{Control>}{ArrowRight}{/Control} ");
    expect(screen.getByText(/（3 件選択）/)).toBeInTheDocument();

    const detail = screen.getByRole("complementary", { name: "詳細" });
    expect(within(detail).getByRole("heading", { name: "3 件を選択中" })).toBeInTheDocument();
    await user.click(within(detail).getByRole("radio", { name: "★5" }));

    for (const a of [first, second, third]) {
      await waitFor(() =>
        expect(within(cell(grid, a!.name)).getByRole("img", { name: "評価 5" })).toBeInTheDocument(),
      );
    }
  });

  it("filters by minimum rating and kind", async () => {
    const { user, grid } = await renderLibrary();
    const assets = mainAssets();

    await user.selectOptions(screen.getByLabelText("評価"), "3");
    const min3 = assets.filter((a) => (a.rating ?? 0) >= 3);
    expect(screen.getByText(`${min3.length} / 50 件`)).toBeInTheDocument();
    for (const c of within(grid).getAllByRole("gridcell")) {
      const stars = within(c).getByRole("img", { name: /評価/ }).getAttribute("aria-label")!;
      expect(Number(stars.replace("評価 ", ""))).toBeGreaterThanOrEqual(3);
    }

    await user.selectOptions(screen.getByLabelText("評価"), "all");
    await user.click(screen.getByRole("checkbox", { name: "動画" }));
    const videos = assets.filter((a) => a.files.some((f) => f.kind === "video"));
    expect(screen.getByText(`${videos.length} / 50 件`)).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "取込済みを隠す" }));
    const notImported = videos.filter((a) => !a.imported);
    expect(screen.getByText(`${notImported.length} / 50 件`)).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", async () => {
    for (const a of mainAssets()) a.rating = null;
    const { user } = await renderLibrary();

    await user.selectOptions(screen.getByLabelText("評価"), "5");

    expect(screen.getByText("0 / 50 件")).toBeInTheDocument();
    expect(screen.getByText("条件に一致する写真・動画はありません。")).toBeInTheDocument();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });
});
