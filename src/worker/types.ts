/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Env {
    HUNKO_USERS_SERVICE_API_URL: string;
    HUNKO_USERS_SERVICE_API_KEY: string;
    MARZBAN_API_URL?: string;
    MARZBAN_API_KEY?: string;
    HUNKO_SESSION_TOKEN_COOKIE_NAME?: string;
    NEXT_PUBLIC_API_BASE_URL?: string;
    NEXT_PUBLIC_HANKO_API_URL?: string;
    DB: any;
  }
}

export {};
