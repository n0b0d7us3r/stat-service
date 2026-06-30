/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_API_BASE?: string;
  readonly VITE_ALLOW_PUBLIC_REGISTER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
