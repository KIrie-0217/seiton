import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { clearMocks } from "@tauri-apps/api/mocks";
import { setBackendOverride } from "../api";

afterEach(() => {
  cleanup();
  clearMocks();
  setBackendOverride(null);
  localStorage.clear();
});
