/// <reference types="vite/client" />

// Typed environment variables used in the frontend.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_BRIDGE_URL?: string;
  readonly VITE_BRIDGE_TOKEN?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
