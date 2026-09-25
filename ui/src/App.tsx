import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getAppInfo, type AppInfo } from "./api";
import { FolderBrowser } from "./FolderBrowser";
import { Library } from "./library/Library";

type State =
  | { status: "loading" }
  | { status: "ready"; info: AppInfo }
  | { status: "error"; message: string };

export function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
}

interface AppProps {
  /**
   * Show the library UI. It is backed by the mock backend until the real
   * commands exist (Tasks 4–7); otherwise the Task 2 folder browser is shown.
   */
  library?: boolean;
  queryClient?: QueryClient;
}

export function App({ library = false, queryClient }: AppProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [client] = useState(() => queryClient ?? createQueryClient());

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
    <QueryClientProvider client={client}>
      <div className="app">
        <header className="app-header">
          <h1>seiton</h1>
          <p className="app-version" aria-live="polite">
            {state.status === "loading" && "読み込み中…"}
            {state.status === "ready" && `${state.info.name} v${state.info.version}`}
            {state.status === "error" && `エラー: ${state.message}`}
          </p>
        </header>
        <main>{library ? <Library /> : <FolderBrowser />}</main>
      </div>
    </QueryClientProvider>
  );
}
