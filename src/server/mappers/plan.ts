export function mapPlanRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    price: (typeof row.price_cents === 'number' ? row.price_cents : Number(row.price_cents)) / 100,
    periodDays: Number(row.period_days),
    trafficMb: row.traffic_mb == null ? null : Number(row.traffic_mb),
    active: Boolean(row.is_active),
    createdAt: (row.created_at instanceof Date ? row.created_at : new Date(row.created_at)).toISOString(),
    updatedAt: (row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at)).toISOString(),
  };
}
