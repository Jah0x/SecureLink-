-- Добавляем таблицы аффилиатов и тарифных фич
CREATE TABLE IF NOT EXISTS plan_features (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  feature TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS affiliate_links (
  id SERIAL PRIMARY KEY,
  affiliate_id INTEGER NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS affiliate_stats (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ref_id INTEGER REFERENCES affiliates(id) ON DELETE CASCADE,
  earnings_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_aff_stats_user_created ON affiliate_stats (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_aff_stats_ref_created ON affiliate_stats (ref_id, created_at);
