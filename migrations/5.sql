
-- Добавляем поле partner_id в таблицу подписок для отслеживания реферальных продаж
ALTER TABLE vpn_subscriptions ADD COLUMN partner_id INTEGER;
ALTER TABLE vpn_subscriptions ADD COLUMN referral_id INTEGER;
