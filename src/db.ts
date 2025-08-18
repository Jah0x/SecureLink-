import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

type DB = ReturnType<typeof drizzle>
let _db: DB | null = null

/**
 * Возвращает инстанс базы данных или `null`, если переменная окружения не задана.
 * Никакой автоматической инициализации или миграций здесь не выполняется.
 */
export function getDb(): DB | null {
  const cn = process.env.DB
  if (!cn) return null
  if (_db) return _db
  const pool = new pg.Pool({ connectionString: cn })
  _db = drizzle(pool)
  return _db
}
