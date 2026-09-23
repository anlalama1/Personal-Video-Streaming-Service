/// <reference types="vite/client" />
declare module 'shaka-player';

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_USER_POOL_ID: string;
  readonly VITE_APP_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
