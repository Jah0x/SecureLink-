export function mapPlanRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    price_cents: typeof row.price_cents === 'number' ? row.price_cents : Number(row.price_cents),
    periodDays: Number(row.period_days),
    trafficMb: row.traffic_mb == null ? null : Number(row.traffic_mb),
    active: Boolean(row.is_active),
    is_demo: Boolean(row.is_demo),
    createdAt: (row.created_at instanceof Date ? row.created_at : new Date(row.created_at)).toISOString(),
    updatedAt: (row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at)).toISOString(),
  };
}
