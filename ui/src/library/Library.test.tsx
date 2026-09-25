import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestDesktop } from "../test/desktop";

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

async function setup() {
  const user = userEvent.setup();
  const desktop = createTestDesktop();
  const main = within(desktop.main.view.container);
  const grid = await main.findByRole("grid", { name: "写真と動画" });
  const mainAssets = () => desktop.data.assets.get("mock:mtp:eos-r6m2")!;
  return { user, desktop, main, grid, mainAssets };
}

function cell(grid: HTMLElement, name: string) {
  return within(grid).getByRole("gridcell", { name: new RegExp(`^${name}`) });
}

describe("Library (mock backend)", () => {
  it("lists devices and shows the first device's assets virtualized", async () => {
    const { main, grid } = await setup();

    const nav = main.getByRole("navigation", { name: "デバイス" });
    expect(within(nav).getByRole("button", { name: /Canon EOS R6 Mark II/ })).toHaveAttribute("aria-current", "true");
    expect(within(nav).getByRole("button", { name: /EOS_DIGITAL/ })).toHaveTextContent("SD カード");

    expect(main.getByText("50 / 50 件")).toBeInTheDocument();
    expect(grid).toHaveAttribute("aria-colcount", "5");
    expect(grid).toHaveAttribute("aria-rowcount", "10");
    const rendered = within(grid).getAllByRole("gridcell").length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(50);
    await waitFor(() => expect(grid.querySelector("img.thumb")).not.toBeNull());
  });

  it("switches devices", async () => {
    const { user, main } = await setup();
    await user.click(main.getByRole("button", { name: /EOS_DIGITAL/ }));
    expect(await main.findByText("8 / 8 件")).toBeInTheDocument();
  });

  it("moves focus with arrow keys and rates with number keys", async () => {
    const { user, main, grid, mainAssets } = await setup();
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
    const detail = main.getByRole("complementary", { name: "詳細" });
    expect(within(detail).getByRole("radio", { name: "★4" })).toBeChecked();
    expect(within(detail).getByText("seiton")).toBeInTheDocument();

    await user.keyboard("0");
    await waitFor(() =>
      expect(within(cell(grid, sixth!.name)).getByRole("img", { name: "評価なし" })).toBeInTheDocument(),
    );
  });

  it("rates a multi-selection from the preview pane", async () => {
    const { user, main, grid, mainAssets } = await setup();
    const [first, second, third] = mainAssets();

    await user.click(cell(grid, first!.name));
    await user.keyboard("{Control>}{ArrowRight}{/Control} ");
    await user.keyboard("{Control>}{ArrowRight}{/Control} ");
    expect(main.getByText(/（3 件選択）/)).toBeInTheDocument();

    const detail = main.getByRole("complementary", { name: "詳細" });
    expect(within(detail).getByRole("heading", { name: "3 件を選択中" })).toBeInTheDocument();
    await user.click(within(detail).getByRole("radio", { name: "★5" }));

    for (const a of [first, second, third]) {
      await waitFor(() =>
        expect(within(cell(grid, a!.name)).getByRole("img", { name: "評価 5" })).toBeInTheDocument(),
      );
    }
  });

  it("filters by minimum rating and kind", async () => {
    const { user, main, grid, mainAssets } = await setup();
    const assets = mainAssets();

    await user.selectOptions(main.getByLabelText("評価"), "3");
    const min3 = assets.filter((a) => (a.rating ?? 0) >= 3);
    expect(main.getByText(`${min3.length} / 50 件`)).toBeInTheDocument();
    for (const c of within(grid).getAllByRole("gridcell")) {
      const stars = within(c).getByRole("img", { name: /評価/ }).getAttribute("aria-label")!;
      expect(Number(stars.replace("評価 ", ""))).toBeGreaterThanOrEqual(3);
    }

    await user.selectOptions(main.getByLabelText("評価"), "all");
    await user.click(main.getByRole("checkbox", { name: "動画" }));
    const videos = assets.filter((a) => a.files.some((f) => f.kind === "video"));
    expect(main.getByText(`${videos.length} / 50 件`)).toBeInTheDocument();

    await user.click(main.getByRole("checkbox", { name: "取込済みを隠す" }));
    const notImported = videos.filter((a) => !a.imported);
    expect(main.getByText(`${notImported.length} / 50 件`)).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", async () => {
    const user = userEvent.setup();
    const desktop = createTestDesktop({
      prepare: (data) => data.assets.get("mock:mtp:eos-r6m2")!.forEach((a) => (a.rating = null)),
    });
    const main = within(desktop.main.view.container);
    await main.findByRole("grid");

    await user.selectOptions(main.getByLabelText("評価"), "5");

    expect(main.getByText("0 / 50 件")).toBeInTheDocument();
    expect(main.getByText("条件に一致する写真・動画はありません。")).toBeInTheDocument();
    expect(main.queryByRole("grid")).not.toBeInTheDocument();
  });
});
