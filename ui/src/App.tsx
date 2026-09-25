import { useEffect, useState } from "react";
import { getAppInfo, type AppInfo } from "./api";

type State =
  | { status: "loading" }
  | { status: "ready"; info: AppInfo }
  | { status: "error"; message: string };

export function App() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getAppInfo()
      .then((info) => {
        if (!cancelled) setState({ status: "ready", info });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: "error", message: String(error) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app">
      <h1>seiton</h1>
      <p aria-live="polite">
        {state.status === "loading" && "読み込み中…"}
        {state.status === "ready" && `${state.info.name} v${state.info.version}`}
        {state.status === "error" && `エラー: ${state.message}`}
      </p>
    </main>
  );
}
