/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `"true"` routes all commands to the in-memory mock backend. */
  readonly VITE_USE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
