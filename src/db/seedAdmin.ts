import { users } from './schema';
import { sql } from 'drizzle-orm';
import argon2 from 'argon2';

export async function seedFirstAdmin(db: any) {
  const res = await (db as any).select({ c: sql<number>`count(*)` }).from(users);
  const count = res[0]?.c ?? 0;
  if (count === 0) {
    const email = process.env.FIRST_ADMIN_EMAIL;
    const password = process.env.FIRST_ADMIN_PASSWORD;
    if (!email || !password) {
      console.warn('FIRST_ADMIN_EMAIL/FIRST_ADMIN_PASSWORD not set, skipping admin seed');
      return;
    }
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await (db as any).insert(users).values({ email, passwordHash, role: 'admin' });
    console.log('Seeded initial admin:', email);
  }
}
