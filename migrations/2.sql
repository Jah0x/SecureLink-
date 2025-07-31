
CREATE TABLE vpn_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  duration_months INTEGER NOT NULL,
  price_rub INTEGER NOT NULL,
  data_limit_gb INTEGER,
  max_connections INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO vpn_plans (name, duration_months, price_rub, data_limit_gb, max_connections, description) VALUES
('Базовый 1 месяц', 1, 300, 100, 3, 'Доступ к VPN на 1 месяц с лимитом 100 ГБ'),
('Стандарт 3 месяца', 3, 800, 350, 5, 'Доступ к VPN на 3 месяца с лимитом 350 ГБ'),
('Премиум 6 месяцев', 6, 1500, 750, 8, 'Доступ к VPN на 6 месяцев с лимитом 750 ГБ'),
('Годовой', 12, 2800, 1500, 10, 'Доступ к VPN на 12 месяцев с лимитом 1500 ГБ');

ALTER TABLE vpn_users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
