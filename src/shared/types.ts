import z from "zod";

export const VpnUserSchema = z.object({
  id: z.number(),
  auth_user_id: z.string(),
  username: z.string().nullable(),
  email: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const VpnSubscriptionSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  plan_name: z.string(),
  expires_at: z.string().nullable(),
  is_active: z.boolean(),
  data_limit_gb: z.number().nullable(),
  used_data_gb: z.number(),
  max_connections: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const VpnServerSchema = z.object({
  id: z.number(),
  name: z.string(),
  location: z.string(),
  server_ip: z.string(),
  is_active: z.boolean(),
  load_percentage: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const VpnConnectionSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  server_id: z.number(),
  connected_at: z.string(),
  disconnected_at: z.string().nullable(),
  data_used_mb: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const VpnPlanSchema = z.object({
  id: z.number(),
  name: z.string(),
  duration_months: z.number(),
  price_rub: z.number(),
  data_limit_gb: z.number().nullable(),
  max_connections: z.number(),
  is_active: z.boolean(),
  description: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type VpnUser = z.infer<typeof VpnUserSchema>;
export type VpnSubscription = z.infer<typeof VpnSubscriptionSchema>;
export type VpnServer = z.infer<typeof VpnServerSchema>;
export type VpnConnection = z.infer<typeof VpnConnectionSchema>;
export type VpnPlan = z.infer<typeof VpnPlanSchema>;

export interface DashboardStats {
  totalDataUsed: number;
  dataLimit: number;
  activeConnections: number;
  daysRemaining: number;
}

// Marzban types
export const MarzbanUserSchema = z.object({
  username: z.string(),
  proxies: z.record(z.any()),
  expire: z.number().nullable(),
  data_limit: z.number().nullable(),
  data_limit_reset_strategy: z.string(),
  status: z.enum(['active', 'disabled', 'limited', 'expired']),
  used_traffic: z.number(),
  lifetime_used_traffic: z.number(),
  created_at: z.string(),
  links: z.array(z.string()),
  subscription_url: z.string(),
  excluded_inbounds: z.record(z.array(z.string())),
  admin: z.string(),
  note: z.string().optional(),
});

export const MarzbanConfigSchema = z.object({
  id: z.number(),
  server_url: z.string(),
  api_key: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type MarzbanUser = z.infer<typeof MarzbanUserSchema>;
export type MarzbanConfig = z.infer<typeof MarzbanConfigSchema>;

export interface MarzbanStats {
  users_total: number;
  users_active: number;
  incoming_bandwidth: number;
  outgoing_bandwidth: number;
  incoming_bandwidth_speed: number;
  outgoing_bandwidth_speed: number;
}
