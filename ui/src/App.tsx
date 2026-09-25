import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getAppInfo, type AppInfo } from "./api";
import { FolderBrowser } from "./FolderBrowser";
import { Library, PANE_TITLE, PaneWindowLayout } from "./library/Library";
import type { Bus, PaneKind } from "./windowing/bus";
import type { WindowHost } from "./windowing/host";
import { WorkspaceProvider } from "./windowing/Workspace";

type State =
  | { status: "loading" }
  | { status: "ready"; info: AppInfo }
  | { status: "error"; message: string };

export function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
}

/** The library UI and the windowing it needs. */
export interface LibraryConfig {
  host: WindowHost;
  bus: Bus;
  /** Set in pane windows: which pane this window shows. */
  pane: PaneKind | null;
}

interface AppProps {
  /**
   * Show the library UI. It is backed by the mock backend until the real
   * commands exist (Tasks 4–7); without it the Task 2 folder browser is shown.
   */
  library?: LibraryConfig;
  queryClient?: QueryClient;
}

export function App({ library, queryClient }: AppProps) {
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

  const pane = library?.pane ?? null;
  const title = pane ? `seiton — ${PANE_TITLE[pane]}` : "seiton";

  useEffect(() => {
    document.title = title;
  }, [title]);

  let body = <FolderBrowser />;
  if (library) {
    body = (
      <WorkspaceProvider host={library.host} bus={library.bus}>
        {pane ? <PaneWindowLayout kind={pane} /> : <Library />}
      </WorkspaceProvider>
    );
  }

  return (
    <QueryClientProvider client={client}>
      <div className="app">
        <header className="app-header">
          <h1>{title}</h1>
          <p className="app-version" aria-live="polite">
            {state.status === "loading" && "読み込み中…"}
            {state.status === "ready" && `${state.info.name} v${state.info.version}`}
            {state.status === "error" && `エラー: ${state.message}`}
          </p>
        </header>
        <main>{body}</main>
      </div>
    </QueryClientProvider>
  );
}
