
ALTER TABLE vpn_users ADD COLUMN marzban_user_id TEXT;
ALTER TABLE vpn_users ADD COLUMN marzban_username TEXT;
ALTER TABLE vpn_subscriptions ADD COLUMN marzban_subscription_url TEXT;
CREATE TABLE marzban_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
