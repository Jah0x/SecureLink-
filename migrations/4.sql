
-- Партнерские уровни
CREATE TABLE partner_levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  commission_percent REAL NOT NULL DEFAULT 10.0,
  min_sales_amount INTEGER DEFAULT 0,
  min_referrals_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Партнеры
CREATE TABLE partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  partner_code TEXT NOT NULL UNIQUE,
  level_id INTEGER DEFAULT 1,
  custom_commission_percent REAL,
  total_sales INTEGER DEFAULT 0,
  total_referrals INTEGER DEFAULT 0,
  total_earnings INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Реферальные переходы
CREATE TABLE referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL,
  user_id INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  converted BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Заработок партнеров
CREATE TABLE partner_earnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL,
  referral_id INTEGER,
  subscription_id INTEGER,
  amount INTEGER NOT NULL,
  commission_percent REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  paid_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Выплаты партнерам
CREATE TABLE partner_payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  payment_method TEXT,
  payment_details TEXT,
  status TEXT DEFAULT 'pending',
  processed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Добавляем дефолтные уровни
INSERT INTO partner_levels (name, commission_percent, min_sales_amount, min_referrals_count) VALUES 
('Новичок', 10.0, 0, 0),
('Бронза', 15.0, 10000, 10),
('Серебро', 20.0, 50000, 50),
('Золото', 25.0, 100000, 100),
('Платина', 30.0, 250000, 250);
