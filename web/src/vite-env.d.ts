/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the api answers. The compose file sets it at build time. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
