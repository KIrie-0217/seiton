import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { mockIPC } from "@tauri-apps/api/mocks";
import { App } from "./App";

describe("App", () => {
  it("shows the version returned by the backend", async () => {
    mockIPC((cmd) => {
      if (cmd === "app_info") return { name: "seiton", version: "0.1.0" };
      throw new Error(`unexpected command: ${cmd}`);
    });

    render(<App />);

    expect(await screen.findByText("v0.1.0")).toBeInTheDocument();
  });

  it("shows an error when the backend call fails", async () => {
    mockIPC(() => {
      throw new Error("boom");
    });

    render(<App />);

    expect(await screen.findByText(/Error:.*boom/)).toBeInTheDocument();
  });
});
