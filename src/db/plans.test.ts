import { test } from 'node:test';
import assert from 'node:assert';

interface PlanRow {
  id: number;
  name: string;
  price_cents: number;
  period_days: number;
  traffic_mb: number | null;
  is_active: boolean;
  is_demo: boolean;
  created_at: Date;
  updated_at: Date;
}

class InMemoryPlanRepo {
  private rows: PlanRow[] = [];
  private seq = 1;

  create(
    data: Omit<PlanRow, 'id' | 'created_at' | 'updated_at' | 'is_demo'> & {
      is_demo?: boolean;
    },
  ): PlanRow {
    const row: PlanRow = {
      id: this.seq++,
      created_at: new Date(),
      updated_at: new Date(),
      is_demo: false,
      ...data,
    };
    this.rows.push(row);
    return row;
  }

  update(id: number, patch: Partial<Omit<PlanRow, 'id' | 'created_at'>>): PlanRow | undefined {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return undefined;
    Object.assign(row, patch, { updated_at: new Date() });
    return row;
  }

  listActive(): PlanRow[] {
    return this.rows.filter((r) => r.is_active);
  }
}

test('create, update and list active plans', () => {
  const repo = new InMemoryPlanRepo();
    const plan = repo.create({
    name: 'Basic',
    price_cents: 1000,
    period_days: 30,
    traffic_mb: 500,
    is_active: true,
  });
  assert.strictEqual(plan.id, 1);

  repo.update(plan.id, { is_active: false });
  const active = repo.listActive();
  assert.strictEqual(active.length, 0);
});
