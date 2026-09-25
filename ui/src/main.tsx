import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

/** `npm run dev:mock` (or VITE_USE_MOCK=true) serves every command from memory. */
const useMock = import.meta.env.VITE_USE_MOCK === "true";

if (useMock) {
  const { installMockBackend } = await import("./mock/backend");
  installMockBackend();
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("root element not found");
}

createRoot(root).render(
  <StrictMode>
    <App library={useMock} />
  </StrictMode>,
);
