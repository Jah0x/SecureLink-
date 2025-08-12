/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Env {
    AUTH_BASE_URL: string;
    AUTH_PATH_REGISTER?: string;
    AUTH_PATH_LOGIN?: string;
    AUTH_PATH_ME?: string;
    AUTH_PATH_LOGOUT?: string;
    SESSION_COOKIE_NAME?: string;
    SESSION_COOKIE_DOMAIN?: string;
    SESSION_COOKIE_SECURE?: string;
    SESSION_COOKIE_SAMESITE?: string;
    SESSION_COOKIE_MAXAGE?: string;
    NEXT_PUBLIC_API_BASE_URL?: string;
    DB: any;
  }
}

export {};
