import { describe, expect, it } from "vitest";
import type { AssetView, DeviceView } from "../api";
import { createMockHandler } from "./backend";
import { createMockData, placeholderThumbnail } from "./data";

const fast = { listDelayMs: 0, thumbDelayMs: [0, 0] as [number, number] };

describe("mock data", () => {
  it("is deterministic and has about 50 assets on the main device", () => {
    const a = createMockData();
    const b = createMockData();
    expect(a.devices).toEqual(b.devices);
    const main = a.devices[0]!;
    expect(main.assetCount).toBe(50);
    expect(a.assets.get(main.id)).toEqual(b.assets.get(main.id));
  });

  it("contains a mix of kinds, ratings and import states", () => {
    const assets = [...createMockData().assets.values()].flat();
    const kinds = new Set(assets.flatMap((x) => x.files.map((f) => f.kind)));
    expect(kinds).toEqual(new Set(["raw", "jpeg", "heif", "video"]));
    expect(assets.some((x) => x.rating === null)).toBe(true);
    expect(assets.some((x) => (x.rating ?? 0) >= 4)).toBe(true);
    expect(assets.some((x) => x.imported)).toBe(true);
    expect(new Set(assets.map((x) => x.id)).size).toBe(assets.length);
    // Capture times increase within a device.
    const times = createMockData().assets.get("mock:mtp:eos-r6m2")!.map((x) => x.captureTime!);
    expect([...times].sort()).toEqual(times);
  });

  it("renders placeholder thumbnails as SVG data URLs", () => {
    const asset = createMockData().devices[0]!;
    const first = createMockData().assets.get(asset.id)![0]!;
    expect(placeholderThumbnail(first)).toMatch(/^data:image\/svg\+xml/);
  });
});

describe("mock backend", () => {
  it("lists devices and assets", async () => {
    const { handle } = createMockHandler(fast);
    const devices = (await handle("list_devices")) as DeviceView[];
    expect(devices.map((d) => d.transport)).toEqual(["mtp", "massStorage"]);
    const assets = (await handle("list_assets", { deviceId: devices[1]!.id })) as AssetView[];
    expect(assets).toHaveLength(devices[1]!.assetCount);
    await expect(handle("list_assets", { deviceId: "nope" })).rejects.toThrow("unknown device");
  });

  it("sets and clears ratings", async () => {
    const { handle, data } = createMockHandler(fast);
    const [a, b] = data.assets.get("mock:mtp:eos-r6m2")!;
    const updated = (await handle("set_rating", { update: { assetIds: [a!.id, b!.id], rating: 4 } })) as AssetView[];
    expect(updated.map((x) => [x.rating, x.ratingSource])).toEqual([
      [4, "app"],
      [4, "app"],
    ]);
    const cleared = (await handle("set_rating", { update: { assetIds: [a!.id], rating: null } })) as AssetView[];
    expect(cleared[0]).toMatchObject({ rating: null, ratingSource: null });
  });

  it("rejects invalid ratings and unknown commands", async () => {
    const { handle, data } = createMockHandler(fast);
    const id = data.assets.get("mock:mtp:eos-r6m2")![0]!.id;
    await expect(handle("set_rating", { update: { assetIds: [id], rating: 6 } })).rejects.toThrow("invalid rating");
    await expect(handle("set_rating", { update: { assetIds: ["x"], rating: 1 } })).rejects.toThrow("unknown asset");
    await expect(handle("frobnicate")).rejects.toThrow("unsupported command");
  });
});
