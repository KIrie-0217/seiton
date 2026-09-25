import { describe, expect, it } from "vitest";
import { waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestDesktop } from "../test/desktop";
import { chooseOption, frame, selectTrigger, installFakeLayout } from "../test/helpers";

installFakeLayout();

async function setup(options?: Parameters<typeof createTestDesktop>[0]) {
  const user = userEvent.setup();
  const desktop = createTestDesktop(options);
  const main = desktop.main.view.container;
  const grid = await within(main).findByRole("grid", { name: "Frames" });
  const mainAssets = () => desktop.data.assets.get("mock:mtp:eos-r6m2")!;
  return { user, desktop, main, grid, mainAssets };
}

function starsOf(root: HTMLElement, name: string) {
  return within(frame(root, name)).getByRole("group", { name: /^(Unrated|\d stars?)$/ });
}

describe("Library (mock backend)", () => {
  it("lists devices and shows the first device's frames", async () => {
    const { main } = await setup();
    const devices = within(main).getByRole("listbox", { name: "Devices" });
    const options = within(devices).getAllByRole("option");
    expect(options[0]).toHaveTextContent("Canon EOS R6 Mark II");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveTextContent("SD card");
    expect(within(main).getByText("50 of 50")).toBeInTheDocument();
    await waitFor(() => expect(main.querySelector("img.thumb")).not.toBeNull());
  });

  it("numbers frames like a contact sheet", async () => {
    const { main, mainAssets } = await setup();
    const first = mainAssets()[0]!;
    expect(frame(main, first.name)).toHaveTextContent("001");
    expect(frame(main, first.name)).toHaveAccessibleName(`${first.name}, Frame 1`);
  });

  it("switches devices", async () => {
    const { user, main } = await setup();
    await user.click(within(main).getByRole("option", { name: /EOS_DIGITAL/ }));
    expect(await within(main).findByText("8 of 8")).toBeInTheDocument();
  });

  it("selects with click and arrows, and rates with number keys", async () => {
    const { user, main, mainAssets } = await setup();
    const [first, second] = mainAssets();

    await user.click(within(frame(main, first!.name)).getByText(first!.name));
    expect(frame(main, first!.name)).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowRight}");
    expect(frame(main, second!.name)).toHaveFocus();
    expect(frame(main, second!.name)).toHaveAttribute("aria-selected", "true");
    expect(frame(main, first!.name)).toHaveAttribute("aria-selected", "false");

    await user.keyboard("4");
    await waitFor(() => expect(starsOf(main, second!.name)).toHaveAccessibleName("4 stars"));
    const detail = within(main).getByRole("complementary", { name: "Details" });
    expect(within(detail).getByRole("radio", { name: "4 stars" })).toBeChecked();
    expect(within(detail).getByText("seiton")).toBeInTheDocument();

    await user.keyboard("0");
    await waitFor(() => expect(starsOf(main, second!.name)).toHaveAccessibleName("Unrated"));
  });

  it("rates a multi-selection from the preview", async () => {
    const { user, main, mainAssets } = await setup();
    const [first, second, third] = mainAssets();

    await user.click(within(frame(main, first!.name)).getByText(first!.name));
    await user.keyboard("{Shift>}{ArrowRight}{ArrowRight}{/Shift}");
    expect(within(main).getByText("50 of 50 · 3 selected")).toBeInTheDocument();

    const detail = within(main).getByRole("complementary", { name: "Details" });
    expect(within(detail).getByRole("heading", { name: "3 selected" })).toBeInTheDocument();
    await user.click(within(detail).getByRole("radio", { name: "5 stars" }));

    for (const a of [first, second, third]) {
      await waitFor(() => expect(starsOf(main, a!.name)).toHaveAccessibleName("5 stars"));
    }
  });

  it("lights stars up to the pointer like a gauge", async () => {
    const { user, main, mainAssets } = await setup();
    const target = mainAssets().find((a) => a.rating === null)!;
    const bar = starsOf(main, target.name);
    const lit = () => within(bar).getAllByRole("button").map((b) => b.hasAttribute("data-lit"));

    expect(lit()).toEqual([false, false, false, false, false]);
    await user.hover(within(bar).getByRole("button", { name: `Rate ${target.name} 3 stars` }));
    expect(lit()).toEqual([true, true, true, false, false]);
    await user.unhover(bar);
    expect(lit()).toEqual([false, false, false, false, false]);
  });

  it("rates one frame from its stars without changing the selection", async () => {
    const { user, main, mainAssets } = await setup();
    const [first, second] = mainAssets();

    await user.click(within(frame(main, first!.name)).getByText(first!.name));
    await user.click(within(frame(main, second!.name)).getByRole("button", { name: `Rate ${second!.name} 4 stars` }));

    await waitFor(() => expect(starsOf(main, second!.name)).toHaveAccessibleName("4 stars"));
    expect(frame(main, first!.name)).toHaveAttribute("aria-selected", "true");
    expect(frame(main, second!.name)).toHaveAttribute("aria-selected", "false");

    // Pressing the current rating clears it.
    await user.click(within(frame(main, second!.name)).getByRole("button", { name: `Clear rating of ${second!.name}` }));
    await waitFor(() => expect(starsOf(main, second!.name)).toHaveAccessibleName("Unrated"));
  });

  it("filters by minimum rating, type and import state", async () => {
    const { user, main, mainAssets } = await setup();
    const assets = mainAssets();

    await chooseOption(user, main, "Rating", "3+ stars");
    const min3 = assets.filter((a) => (a.rating ?? 0) >= 3);
    expect(within(main).getByText(`${min3.length} of 50`)).toBeInTheDocument();
    expect(selectTrigger(main, "Rating")).toHaveTextContent("3+ stars");

    await chooseOption(user, main, "Rating", "All");
    await user.click(within(main).getByRole("checkbox", { name: "Video" }));
    const videos = assets.filter((a) => a.files.some((f) => f.kind === "video"));
    expect(within(main).getByText(`${videos.length} of 50`)).toBeInTheDocument();

    await user.click(within(main).getByRole("checkbox", { name: "Hide imported" }));
    const notImported = videos.filter((a) => !a.imported);
    expect(within(main).getByText(`${notImported.length} of 50`)).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", async () => {
    const { user, main } = await setup({
      prepare: (data) => data.assets.get("mock:mtp:eos-r6m2")!.forEach((a) => (a.rating = null)),
    });
    await chooseOption(user, main, "Rating", "5 stars");
    expect(within(main).getByText("0 of 50")).toBeInTheDocument();
    expect(within(main).getByText("No frames match the filter.")).toBeInTheDocument();
  });

  it("hides and shows the sidebar, and remembers the choice", async () => {
    const { user, main } = await setup();
    const toggle = within(main).getByRole("button", { name: "Hide sidebar" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle);
    expect(within(main).queryByRole("listbox", { name: "Devices" })).not.toBeInTheDocument();
    expect(within(main).getByRole("button", { name: "Show sidebar" })).toHaveAttribute("aria-expanded", "false");
    expect(localStorage.getItem("seiton.sidebar.open")).toBe("false");

    await user.keyboard("{Control>}b{/Control}");
    expect(within(main).getByRole("listbox", { name: "Devices" })).toBeInTheDocument();
  });

  it("switches supplementary text to Japanese and keeps English labels", async () => {
    const { user, main } = await setup();
    await chooseOption(user, main, "Language", "日本語");
    expect(within(main).getByText(/矢印キーで移動/)).toBeInTheDocument();
    expect(within(main).getByRole("listbox", { name: "Devices" })).toBeInTheDocument();
    expect(within(main).getByRole("region", { name: "Thumbnails" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("ja");
  });
});
