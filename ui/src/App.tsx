import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getAppInfo, type AppInfo } from "./api";
import { SelectField } from "./controls";
import { FolderBrowser } from "./FolderBrowser";
import { I18nProvider, LOCALES, useI18n, type Locale } from "./i18n";
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
  /** Fixes the locale (tests); otherwise the saved or system language. */
  locale?: Locale;
}

function LanguageSelect() {
  const { t, locale, setLocale } = useI18n();
  return (
    <SelectField
      className="language inline"
      label={t.language}
      value={locale}
      options={LOCALES}
      onChange={(l) => setLocale(l)}
    />
  );
}

function Shell({ library }: { library?: LibraryConfig }) {
  const { t } = useI18n();
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
    <div className="app">
      <header className="app-header">
        <h1>
          <span className="wordmark">seiton</span>
          {pane && <span className="app-pane">{PANE_TITLE[pane]}</span>}
        </h1>
        <p className="app-version" aria-live="polite">
          {state.status === "loading" && t.loading}
          {state.status === "ready" && `v${state.info.version}`}
          {state.status === "error" && t.error(state.message)}
        </p>
        <LanguageSelect />
      </header>
      <main>{body}</main>
    </div>
  );
}

export function App({ library, queryClient, locale }: AppProps) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <I18nProvider locale={locale}>
      <QueryClientProvider client={client}>
        <Shell library={library} />
      </QueryClientProvider>
    </I18nProvider>
  );
}
