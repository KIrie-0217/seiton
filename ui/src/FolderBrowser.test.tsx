import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockIPC } from "@tauri-apps/api/mocks";
import { FolderBrowser } from "./FolderBrowser";
import type { FolderScan } from "./api";

const SCAN: FolderScan = {
  sourceLabel: "EOS_DIGITAL",
  profileId: "canon",
  profileName: "Canon",
  groups: [
    {
      key: "DCIM/100CANON/IMG_0001",
      name: "IMG_0001",
      files: [
        { name: "IMG_0001.CR3", path: "DCIM/100CANON/IMG_0001.CR3", kind: "raw", size: 28311552 },
        { name: "IMG_0001.JPG", path: "DCIM/100CANON/IMG_0001.JPG", kind: "jpeg", size: 8388608 },
      ],
    },
    {
      key: "DCIM/100CANON/MVI_0002",
      name: "MVI_0002",
      files: [{ name: "MVI_0002.MP4", path: "DCIM/100CANON/MVI_0002.MP4", kind: "video", size: null }],
    },
  ],
};

function mockBackend(scan: (path: string) => FolderScan, picked: string | null = "/Volumes/EOS_DIGITAL") {
  const calls: string[] = [];
  mockIPC((cmd, args) => {
    calls.push(cmd);
    if (cmd === "plugin:dialog|open") return picked;
    if (cmd === "scan_folder") return scan((args as { path: string }).path);
    throw new Error(`unexpected command: ${cmd}`);
  });
  return calls;
}

describe("FolderBrowser", () => {
  it("lists grouped files after picking a folder", async () => {
    let scannedPath = "";
    mockBackend((path) => {
      scannedPath = path;
      return SCAN;
    });
    render(<FolderBrowser />);

    await userEvent.click(screen.getByRole("button", { name: "フォルダを選択…" }));

    expect(await screen.findByText(/EOS_DIGITAL（プロファイル: Canon）: 2 件/)).toBeInTheDocument();
    expect(scannedPath).toBe("/Volumes/EOS_DIGITAL");
    const row = screen.getByRole("row", { name: /IMG_0001/ });
    expect(within(row).getByText("RAW + JPEG")).toBeInTheDocument();
    expect(within(row).getByText("IMG_0001.CR3")).toBeInTheDocument();
    expect(screen.getByText("動画")).toBeInTheDocument();
  });

  it("does nothing when the dialog is cancelled", async () => {
    const calls = mockBackend(() => SCAN, null);
    render(<FolderBrowser />);

    await userEvent.click(screen.getByRole("button", { name: "フォルダを選択…" }));

    expect(calls).toEqual(["plugin:dialog|open"]);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows scan errors", async () => {
    mockBackend(() => {
      throw new Error("not found: /Volumes/X");
    });
    render(<FolderBrowser />);

    await userEvent.click(screen.getByRole("button", { name: "フォルダを選択…" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("not found: /Volumes/X");
  });
});
