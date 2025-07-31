declare global {
  interface Env {
    MOCHA_USERS_SERVICE_API_URL: string;
    MOCHA_USERS_SERVICE_API_KEY: string;
    MARZBAN_API_URL?: string;
    MARZBAN_API_KEY?: string;
    DB: D1Database;
  }
}

export {};
