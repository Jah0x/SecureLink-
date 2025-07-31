/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Env {
    HUNKO_USERS_SERVICE_API_URL: string;
    HUNKO_USERS_SERVICE_API_KEY: string;
    MARZBAN_API_URL?: string;
    MARZBAN_API_KEY?: string;
    DB: any;
  }
}

export {};
