/* eslint-disable */
// @ts-nocheck
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  exchangeCodeForSessionToken,
  getOAuthRedirectUrl,
  authMiddleware,
  deleteSession,
  HUNKO_SESSION_TOKEN_COOKIE_NAME,
} from "@/worker/auth";
import { getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { 
  createMarzbanService, 
  generateMarzbanUsername, 
  createDefaultProxies,
  bytesToGB,
  gbToBytes 
} from "@/shared/marzban";
import "./types";


const app = new Hono<{ Bindings: Env }>();

// Helper function to get Marzban service
async function getMarzbanService(env: Env) {
  if (!env.MARZBAN_API_URL || !env.MARZBAN_API_KEY) {
    throw new Error('Marzban API credentials not configured');
  }
  
  return createMarzbanService(env.MARZBAN_API_URL, env.MARZBAN_API_KEY);
}

// Helper function to sync user with Marzban
async function syncUserWithMarzban(env: Env, vpnUser: any, subscription: any) {
  try {
    const marzban = await getMarzbanService(env);
    const marzbanUsername = vpnUser.marzban_username || generateMarzbanUsername(vpnUser.email, vpnUser.id);
    
    // Check if user exists in Marzban
    let marzbanUser;
    try {
      marzbanUser = await marzban.getUser(marzbanUsername);
    } catch (error) {
      // User doesn't exist, create new one
      marzbanUser = null;
    }

    const userData = {
      username: marzbanUsername,
      proxies: createDefaultProxies(),
      data_limit: subscription.data_limit_gb ? gbToBytes(subscription.data_limit_gb) : 0,
      expire: subscription.expires_at ? Math.floor(new Date(subscription.expires_at).getTime() / 1000) : 0,
      status: subscription.is_active ? 'active' as const : 'disabled' as const,
      note: `Panel user: ${vpnUser.email}`,
    };

    if (marzbanUser) {
      // Update existing user
      await marzban.updateUser(marzbanUsername, userData);
    } else {
      // Create new user
      const createdUser = await marzban.createUser(userData);
      
      // Update our database with Marzban info
      await env.DB.prepare(
        `UPDATE vpn_users SET marzban_username = ?, marzban_user_id = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(marzbanUsername, createdUser.username, vpnUser.id).run();

      await env.DB.prepare(
        `UPDATE vpn_subscriptions SET marzban_subscription_url = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(createdUser.subscription_url, subscription.id).run();
    }

    return marzbanUsername;
  } catch (error) {
    console.error('Failed to sync with Marzban:', error);
    throw error;
  }
}

// Auth routes
app.get('/api/oauth/google/redirect_url', async (c) => {
  const redirectUrl = await getOAuthRedirectUrl('google', {
    apiUrl: c.env.HUNKO_USERS_SERVICE_API_URL,
    apiKey: c.env.HUNKO_USERS_SERVICE_API_KEY,
  });

  return c.json({ redirectUrl }, 200);
});

app.post("/api/sessions", zValidator("json", z.object({ code: z.string() })), async (c) => {
  const { code } = c.req.valid("json");

  const sessionToken = await exchangeCodeForSessionToken(code, {
    apiUrl: c.env.HUNKO_USERS_SERVICE_API_URL,
    apiKey: c.env.HUNKO_USERS_SERVICE_API_KEY,
  });

  setCookie(c, HUNKO_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 60 * 24 * 60 * 60, // 60 days
  });

  return c.json({ success: true }, 200);
});

app.get("/api/users/me", authMiddleware, async (c) => {
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }
  
  // Get or create VPN user record
  let vpnUser = await c.env.DB.prepare(
    "SELECT * FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!vpnUser) {
    // Create new VPN user
    const result = await c.env.DB.prepare(
      `INSERT INTO vpn_users (hunko_user_id, email, username, created_at, updated_at) 
       VALUES (?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(hunkoUser.id, hunkoUser.email, hunkoUser.google_user_data.name || null).run();

    vpnUser = await c.env.DB.prepare(
      "SELECT * FROM vpn_users WHERE id = ?"
    ).bind(result.meta.last_row_id).first();
  }

  return c.json({ hunkoUser, vpnUser });
});

app.get('/api/logout', async (c) => {
  const sessionToken = getCookie(c, HUNKO_SESSION_TOKEN_COOKIE_NAME);

  if (typeof sessionToken === 'string') {
    await deleteSession(sessionToken, {
      apiUrl: c.env.HUNKO_USERS_SERVICE_API_URL,
      apiKey: c.env.HUNKO_USERS_SERVICE_API_KEY,
    });
  }

  setCookie(c, HUNKO_SESSION_TOKEN_COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    sameSite: 'none',
    secure: true,
    maxAge: 0,
  });

  return c.json({ success: true }, 200);
});

// VPN API routes
app.get("/api/dashboard/stats", authMiddleware, async (c) => {
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }
  
  const vpnUser = await c.env.DB.prepare(
    "SELECT * FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!vpnUser) {
    return c.json({ error: "VPN user not found" }, 404);
  }

  const subscription = await c.env.DB.prepare(
    "SELECT * FROM vpn_subscriptions WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1"
  ).bind(vpnUser.id).first();

  let stats = {
    totalDataUsed: subscription?.used_data_gb || 0,
    dataLimit: subscription?.data_limit_gb || 0,
    activeConnections: 0,
    daysRemaining: subscription?.expires_at ? 
      Math.max(0, Math.ceil((new Date(subscription.expires_at as string).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0
  };

  // Try to get real stats from Marzban
  try {
    if (vpnUser.marzban_username && c.env.MARZBAN_API_URL && c.env.MARZBAN_API_KEY) {
      const marzban = createMarzbanService(c.env.MARZBAN_API_URL!, c.env.MARZBAN_API_KEY!);
      const marzbanUser = await marzban.getUser(vpnUser.marzban_username as string);
      
      stats.totalDataUsed = bytesToGB(marzbanUser.used_traffic);
      stats.dataLimit = marzbanUser.data_limit ? bytesToGB(marzbanUser.data_limit) : 0;
      
      // Update our database with real usage
      if (subscription) {
        await c.env.DB.prepare(
          "UPDATE vpn_subscriptions SET used_data_gb = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(stats.totalDataUsed, subscription.id).run();
      }
    }
  } catch (error) {
    console.error('Failed to fetch Marzban stats:', error);
    // Fall back to database stats
  }

  return c.json(stats);
});

app.get("/api/servers", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM vpn_servers WHERE is_active = 1 ORDER BY load_percentage ASC"
  ).all();

  return c.json(results);
});

app.get("/api/subscription", authMiddleware, async (c) => {
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }
  
  const vpnUser = await c.env.DB.prepare(
    "SELECT * FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!vpnUser) {
    return c.json({ error: "VPN user not found" }, 404);
  }

  const subscription = await c.env.DB.prepare(
    "SELECT * FROM vpn_subscriptions WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1"
  ).bind(vpnUser.id).first();

  return c.json(subscription);
});

// Plans API
app.get("/api/plans", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM vpn_plans WHERE is_active = 1 ORDER BY duration_months ASC"
  ).all();

  return c.json(results);
});

// Partners API - Register as partner
app.post("/api/partners/register", authMiddleware, async (c) => {
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }

  const vpnUser = await c.env.DB.prepare(
    "SELECT * FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!vpnUser) {
    return c.json({ error: "VPN user not found" }, 404);
  }

  // Check if already a partner
  const existingPartner = await c.env.DB.prepare(
    "SELECT * FROM partners WHERE user_id = ?"
  ).bind(vpnUser.id).first();

  if (existingPartner) {
    return c.json({ error: "Already a partner" }, 400);
  }

  // Generate unique partner code
  const partnerCode = `REF${vpnUser.id}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

  // Create partner record
  await c.env.DB.prepare(
    `INSERT INTO partners (user_id, partner_code, level_id, created_at, updated_at)
     VALUES (?, ?, 1, datetime('now'), datetime('now'))`
  ).bind(vpnUser.id, partnerCode).run();

  return c.json({ success: true, partner_code: partnerCode });
});

// Partners API - Get partner stats
app.get("/api/partners/stats", authMiddleware, async (c) => {
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }

  const vpnUser = await c.env.DB.prepare(
    "SELECT * FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!vpnUser) {
    return c.json({ error: "VPN user not found" }, 404);
  }

  const partner = await c.env.DB.prepare(
    "SELECT * FROM partners WHERE user_id = ?"
  ).bind(vpnUser.id).first();

  if (!partner) {
    return c.json(null);
  }

  // Get current level
  const level = await c.env.DB.prepare(
    "SELECT * FROM partner_levels WHERE id = ?"
  ).bind(partner.level_id).first();

  // Get next level
  const nextLevel = await c.env.DB.prepare(
    "SELECT * FROM partner_levels WHERE min_sales_amount > ? OR min_referrals_count > ? ORDER BY min_sales_amount ASC, min_referrals_count ASC LIMIT 1"
  ).bind(partner.total_sales, partner.total_referrals).first();

  // Calculate available earnings
  const pendingEarnings = await c.env.DB.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM partner_earnings WHERE partner_id = ? AND status = 'pending'"
  ).bind(partner.id).first();

  const availableEarnings = await c.env.DB.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM partner_earnings WHERE partner_id = ? AND status = 'ready'"
  ).bind(partner.id).first();

  let nextLevelData = null;
  if (nextLevel) {
    const salesProgress = Math.min(100, ((partner.total_sales as number) / (nextLevel.min_sales_amount as number)) * 100);
    const referralsProgress = Math.min(100, ((partner.total_referrals as number) / (nextLevel.min_referrals_count as number)) * 100);
    
    nextLevelData = {
      name: nextLevel.name,
      commission_percent: nextLevel.commission_percent,
      progress_sales: Math.round(salesProgress),
      progress_referrals: Math.round(referralsProgress)
    };
  }

  const stats = {
    level: {
      name: level?.name || 'Новичок',
      commission_percent: partner.custom_commission_percent || level?.commission_percent || 10.0,
      min_sales_amount: level?.min_sales_amount || 0,
      min_referrals_count: level?.min_referrals_count || 0
    },
    total_sales: partner.total_sales || 0,
    total_referrals: partner.total_referrals || 0,
    total_earnings: partner.total_earnings || 0,
    pending_earnings: pendingEarnings?.total || 0,
    available_for_payout: availableEarnings?.total || 0,
    partner_code: partner.partner_code,
    next_level: nextLevelData
  };

  return c.json(stats);
});

// Partners API - Get referrals
app.get("/api/partners/referrals", authMiddleware, async (c) => {
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }

  const vpnUser = await c.env.DB.prepare(
    "SELECT * FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!vpnUser) {
    return c.json({ error: "VPN user not found" }, 404);
  }

  const partner = await c.env.DB.prepare(
    "SELECT * FROM partners WHERE user_id = ?"
  ).bind(vpnUser.id).first();

  if (!partner) {
    return c.json([]);
  }

  const { results } = await c.env.DB.prepare(`
    SELECT r.*, u.email as user_email 
    FROM referrals r 
    LEFT JOIN vpn_users u ON r.user_id = u.id 
    WHERE r.partner_id = ? 
    ORDER BY r.created_at DESC
  `).bind(partner.id).all();

  return c.json(results);
});

// Partners API - Get earnings
app.get("/api/partners/earnings", authMiddleware, async (c) => {
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }

  const vpnUser = await c.env.DB.prepare(
    "SELECT * FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!vpnUser) {
    return c.json({ error: "VPN user not found" }, 404);
  }

  const partner = await c.env.DB.prepare(
    "SELECT * FROM partners WHERE user_id = ?"
  ).bind(vpnUser.id).first();

  if (!partner) {
    return c.json([]);
  }

  const { results } = await c.env.DB.prepare(`
    SELECT e.*, s.plan_name as subscription_plan
    FROM partner_earnings e 
    LEFT JOIN vpn_subscriptions s ON e.subscription_id = s.id 
    WHERE e.partner_id = ? 
    ORDER BY e.created_at DESC
  `).bind(partner.id).all();

  return c.json(results);
});

// Partners API - Track referral
app.post("/api/partners/track-referral", zValidator("json", z.object({
  partner_code: z.string(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional()
})), async (c) => {
  const { partner_code, utm_source, utm_medium, utm_campaign } = c.req.valid("json");

  // Find partner
  const partner = await c.env.DB.prepare(
    "SELECT * FROM partners WHERE partner_code = ? AND is_active = 1"
  ).bind(partner_code).first();

  if (!partner) {
    return c.json({ error: "Partner not found" }, 404);
  }

  // Get IP address
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  const userAgent = c.req.header('User-Agent') || '';

  // Create referral record
  await c.env.DB.prepare(
    `INSERT INTO referrals (partner_id, ip_address, user_agent, utm_source, utm_medium, utm_campaign, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(partner.id, ip, userAgent, utm_source, utm_medium, utm_campaign).run();

  return c.json({ success: true });
});

// Purchase API
app.post("/api/purchase", authMiddleware, zValidator("json", z.object({ planId: z.number() })), async (c) => {
  const { planId } = c.req.valid("json");
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }

  const plan = await c.env.DB.prepare(
    "SELECT * FROM vpn_plans WHERE id = ? AND is_active = 1"
  ).bind(planId).first();

  if (!plan) {
    return c.json({ error: "Plan not found" }, 404);
  }

  const vpnUser = await c.env.DB.prepare(
    "SELECT * FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!vpnUser) {
    return c.json({ error: "VPN user not found" }, 404);
  }

  // Check for referral
  let partnerId = null;
  let referralId = null;
  
  // Look for active referral for this user (within last 30 days)
  const referral = await c.env.DB.prepare(`
    SELECT r.*, p.id as partner_id FROM referrals r 
    JOIN partners p ON r.partner_id = p.id 
    WHERE r.ip_address = ? AND r.created_at > datetime('now', '-30 days') 
    ORDER BY r.created_at DESC LIMIT 1
  `).bind(c.req.header('CF-Connecting-IP') || 'unknown').first();

  if (referral) {
    partnerId = referral.partner_id;
    referralId = referral.id;
    
    // Mark referral as converted
    await c.env.DB.prepare(
      "UPDATE referrals SET converted = 1, user_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(vpnUser.id, referral.id).run();
  }

  // Mock payment system - generate order ID
  const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // In real app, here would be integration with payment provider
  // For now, automatically create successful subscription
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + (plan.duration_months as number));

  // Deactivate old subscriptions
  await c.env.DB.prepare(
    "UPDATE vpn_subscriptions SET is_active = 0, updated_at = datetime('now') WHERE user_id = ?"
  ).bind(vpnUser.id).run();

  // Create new subscription
  const result = await c.env.DB.prepare(
    `INSERT INTO vpn_subscriptions (user_id, plan_name, expires_at, data_limit_gb, max_connections, partner_id, referral_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(
    vpnUser.id,
    plan.name,
    expiresAt.toISOString(),
    plan.data_limit_gb,
    plan.max_connections,
    partnerId,
    referralId
  ).run();

  // Get the created subscription
  const subscription = await c.env.DB.prepare(
    "SELECT * FROM vpn_subscriptions WHERE id = ?"
  ).bind(result.meta.last_row_id).first();

  // Sync with Marzban
  try {
    await syncUserWithMarzban(c.env, vpnUser, subscription);
  } catch (error) {
    console.error('Failed to sync with Marzban after purchase:', error);
  }

  // Process partner commission if applicable
  if (partnerId && subscription) {
    try {
      const partner = await c.env.DB.prepare(
        "SELECT p.*, pl.commission_percent FROM partners p LEFT JOIN partner_levels pl ON p.level_id = pl.id WHERE p.id = ?"
      ).bind(partnerId).first();

      if (partner) {
        const planPrice = plan.price_rub as number;
        const commissionPercent = partner.custom_commission_percent || partner.commission_percent || 10.0;
        const commissionAmount = Math.round(planPrice * (Number(commissionPercent) / 100));

        // Create earning record
        await c.env.DB.prepare(
          `INSERT INTO partner_earnings (partner_id, referral_id, subscription_id, amount, commission_percent, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'ready', datetime('now'), datetime('now'))`
        ).bind(partnerId, referralId, subscription.id, commissionAmount, commissionPercent).run();

        // Update partner stats
        await c.env.DB.prepare(
          `UPDATE partners SET 
           total_sales = total_sales + ?, 
           total_referrals = total_referrals + 1, 
           total_earnings = total_earnings + ?,
           updated_at = datetime('now') 
           WHERE id = ?`
        ).bind(planPrice, commissionAmount, partnerId).run();

        // Check for level upgrade  
        const totalSales = Number(partner.total_sales || 0);
        const totalReferrals = Number(partner.total_referrals || 0);
        const newTotalSales = totalSales + planPrice;
        const newLevel = await c.env.DB.prepare(`
          SELECT * FROM partner_levels 
          WHERE min_sales_amount <= ? AND min_referrals_count <= ? 
          ORDER BY min_sales_amount DESC, min_referrals_count DESC 
          LIMIT 1
        `).bind(newTotalSales, Number(totalReferrals) + 1).first();

        if (newLevel && (newLevel.id as number) > (partner.level_id as number)) {
          await c.env.DB.prepare(
            "UPDATE partners SET level_id = ?, updated_at = datetime('now') WHERE id = ?"
          ).bind(newLevel.id, partnerId).run();
        }
      }
    } catch (error) {
      console.error('Failed to process partner commission:', error);
    }
  }

  return c.json({ 
    success: true, 
    orderId,
    message: "Subscription activated successfully" 
  });
});

// Admin API - Check admin status
app.get("/api/admin/check", authMiddleware, async (c) => {
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }

  const vpnUser = await c.env.DB.prepare(
    "SELECT is_admin FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!vpnUser?.is_admin) {
    return c.json({ error: "Access denied" }, 403);
  }

  return c.json({ isAdmin: true });
});

// Admin API - Get users
app.get("/api/admin/users", authMiddleware, async (c) => {
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }

  const adminUser = await c.env.DB.prepare(
    "SELECT is_admin FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!adminUser?.is_admin) {
    return c.json({ error: "Access denied" }, 403);
  }

  const { results } = await c.env.DB.prepare(`
    SELECT 
      u.id,
      u.email,
      u.username,
      u.is_active,
      u.created_at,
      s.plan_name,
      s.expires_at,
      s.used_data_gb,
      s.data_limit_gb
    FROM vpn_users u
    LEFT JOIN vpn_subscriptions s ON u.id = s.user_id AND s.is_active = 1
    ORDER BY u.created_at DESC
  `).all();

  const formattedUsers = results.map((user: any) => ({
    id: user.id,
    email: user.email,
    username: user.username,
    is_active: user.is_active,
    created_at: user.created_at,
    subscription: user.plan_name ? {
      plan_name: user.plan_name,
      expires_at: user.expires_at,
      used_data_gb: user.used_data_gb || 0,
      data_limit_gb: user.data_limit_gb
    } : null
  }));

  return c.json(formattedUsers);
});

// Admin API - Get plans
app.get("/api/admin/plans", authMiddleware, async (c) => {
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }

  const adminUser = await c.env.DB.prepare(
    "SELECT is_admin FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!adminUser?.is_admin) {
    return c.json({ error: "Access denied" }, 403);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM vpn_plans ORDER BY duration_months ASC"
  ).all();

  return c.json(results);
});

// Admin API - Create plan
app.post("/api/admin/plans", authMiddleware, zValidator("json", z.object({
  name: z.string(),
  duration_months: z.number(),
  price_rub: z.number(),
  data_limit_gb: z.number().nullable(),
  max_connections: z.number(),
  description: z.string(),
  is_active: z.boolean()
})), async (c) => {
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }

  const adminUser = await c.env.DB.prepare(
    "SELECT is_admin FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!adminUser?.is_admin) {
    return c.json({ error: "Access denied" }, 403);
  }

  const planData = c.req.valid("json");

  await c.env.DB.prepare(
    `INSERT INTO vpn_plans (name, duration_months, price_rub, data_limit_gb, max_connections, description, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(
    planData.name,
    planData.duration_months,
    planData.price_rub,
    planData.data_limit_gb,
    planData.max_connections,
    planData.description,
    planData.is_active ? 1 : 0
  ).run();

  return c.json({ success: true });
});

// Admin API - Update plan
app.put("/api/admin/plans/:id", authMiddleware, zValidator("json", z.object({
  name: z.string(),
  duration_months: z.number(),
  price_rub: z.number(),
  data_limit_gb: z.number().nullable(),
  max_connections: z.number(),
  description: z.string(),
  is_active: z.boolean()
})), async (c) => {
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }

  const adminUser = await c.env.DB.prepare(
    "SELECT is_admin FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!adminUser?.is_admin) {
    return c.json({ error: "Access denied" }, 403);
  }

  const planId = parseInt(c.req.param('id'));
  const planData = c.req.valid("json");

  await c.env.DB.prepare(
    `UPDATE vpn_plans 
     SET name = ?, duration_months = ?, price_rub = ?, data_limit_gb = ?, max_connections = ?, description = ?, is_active = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(
    planData.name,
    planData.duration_months,
    planData.price_rub,
    planData.data_limit_gb,
    planData.max_connections,
    planData.description,
    planData.is_active ? 1 : 0,
    planId
  ).run();

  return c.json({ success: true });
});

// Admin API - Delete plan
app.delete("/api/admin/plans/:id", authMiddleware, async (c) => {
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }

  const adminUser = await c.env.DB.prepare(
    "SELECT is_admin FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!adminUser?.is_admin) {
    return c.json({ error: "Access denied" }, 403);
  }

  const planId = parseInt(c.req.param('id'));

  await c.env.DB.prepare(
    "DELETE FROM vpn_plans WHERE id = ?"
  ).bind(planId).run();

  return c.json({ success: true });
});

// Admin API - Give subscription to user
app.post("/api/admin/give-subscription", authMiddleware, zValidator("json", z.object({
  userId: z.number(),
  planId: z.number()
})), async (c) => {
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }

  const adminUser = await c.env.DB.prepare(
    "SELECT is_admin FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!adminUser?.is_admin) {
    return c.json({ error: "Access denied" }, 403);
  }

  const { userId, planId } = c.req.valid("json");

  // Check if plan exists
  const plan = await c.env.DB.prepare(
    "SELECT * FROM vpn_plans WHERE id = ? AND is_active = 1"
  ).bind(planId).first();

  if (!plan) {
    return c.json({ error: "Plan not found" }, 404);
  }

  // Check if user exists
  const user = await c.env.DB.prepare(
    "SELECT * FROM vpn_users WHERE id = ?"
  ).bind(userId).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Calculate expiry date
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + (plan.duration_months as number));

  // Deactivate old subscriptions
  await c.env.DB.prepare(
    "UPDATE vpn_subscriptions SET is_active = 0, updated_at = datetime('now') WHERE user_id = ?"
  ).bind(userId).run();

  // Create new subscription  
  const result = await c.env.DB.prepare(
    `INSERT INTO vpn_subscriptions (user_id, plan_name, expires_at, data_limit_gb, max_connections, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(
    userId,
    plan.name,
    expiresAt.toISOString(),
    plan.data_limit_gb,
    plan.max_connections
  ).run();

  // Get the created subscription
  const subscription = await c.env.DB.prepare(
    "SELECT * FROM vpn_subscriptions WHERE id = ?"
  ).bind(result.meta.last_row_id).first();

  // Sync with Marzban
  try {
    await syncUserWithMarzban(c.env, user, subscription);
  } catch (error) {
    console.error('Failed to sync with Marzban after giving subscription:', error);
  }

  return c.json({ 
    success: true, 
    message: "Subscription given successfully" 
  });
});

// Get subscription URL for user
app.get("/api/subscription-url", authMiddleware, async (c) => {
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }
  
  const vpnUser = await c.env.DB.prepare(
    "SELECT * FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!vpnUser) {
    return c.json({ error: "VPN user not found" }, 404);
  }

  const subscription = await c.env.DB.prepare(
    "SELECT * FROM vpn_subscriptions WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1"
  ).bind(vpnUser.id).first();

  if (!subscription) {
    return c.json({ error: "No active subscription" }, 404);
  }

  try {
    if (vpnUser.marzban_username && c.env.MARZBAN_API_URL && c.env.MARZBAN_API_KEY) {
      const marzban = createMarzbanService(c.env.MARZBAN_API_URL, c.env.MARZBAN_API_KEY);
      const marzbanUser = await marzban.getUser(vpnUser.marzban_username as string);
      
      return c.json({
        subscription_url: marzbanUser.subscription_url,
        links: marzbanUser.links,
        username: marzbanUser.username,
        status: marzbanUser.status,
        expire: marzbanUser.expire,
        data_limit: marzbanUser.data_limit ? bytesToGB(marzbanUser.data_limit) : null,
        used_traffic: bytesToGB(marzbanUser.used_traffic)
      });
    } else {
      return c.json({ 
        error: "Marzban not configured or user not synced",
        subscription_url: subscription.marzban_subscription_url || null
      });
    }
  } catch (error) {
    console.error('Failed to get subscription URL from Marzban:', error);
    return c.json({ 
      error: "Failed to fetch subscription details",
      subscription_url: subscription.marzban_subscription_url || null
    });
  }
});

// Admin API - Marzban system stats
app.get("/api/admin/marzban/stats", authMiddleware, async (c) => {
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }

  const adminUser = await c.env.DB.prepare(
    "SELECT is_admin FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!adminUser?.is_admin) {
    return c.json({ error: "Access denied" }, 403);
  }

  try {
    if (!c.env.MARZBAN_API_URL || !c.env.MARZBAN_API_KEY) {
      return c.json({ error: "Marzban not configured" }, 500);
    }

    const marzban = createMarzbanService(c.env.MARZBAN_API_URL!, c.env.MARZBAN_API_KEY!);
    const [systemStats, coreStats] = await Promise.all([
      marzban.getSystemStats(),
      marzban.getCoreStats()
    ]);

    return c.json({
      system: systemStats,
      core: coreStats,
      connected: true
    });
  } catch (error) {
    console.error('Failed to get Marzban stats:', error);
    return c.json({ 
      error: "Failed to connect to Marzban",
      connected: false
    });
  }
});

// Admin API - Sync all users with Marzban
app.post("/api/admin/marzban/sync", authMiddleware, async (c) => {
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }

  const adminUser = await c.env.DB.prepare(
    "SELECT is_admin FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!adminUser?.is_admin) {
    return c.json({ error: "Access denied" }, 403);
  }

  try {
    // Get all users with active subscriptions
    const { results: usersWithSubs } = await c.env.DB.prepare(`
      SELECT u.*, s.* FROM vpn_users u
      JOIN vpn_subscriptions s ON u.id = s.user_id
      WHERE s.is_active = 1
    `).all();

    let synced = 0;
    let failed = 0;

    for (const userSub of usersWithSubs) {
      try {
        await syncUserWithMarzban(c.env, userSub, userSub);
        synced++;
      } catch (error) {
        console.error(`Failed to sync user ${userSub.email}:`, error);
        failed++;
      }
    }

    return c.json({
      success: true,
      synced,
      failed,
      total: usersWithSubs.length
    });
  } catch (error) {
    console.error('Failed to sync users:', error);
    return c.json({ error: "Sync failed" }, 500);
  }
});

// Admin API - Get partner levels
app.get("/api/admin/partner-levels", authMiddleware, async (c) => {
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }

  const adminUser = await c.env.DB.prepare(
    "SELECT is_admin FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!adminUser?.is_admin) {
    return c.json({ error: "Access denied" }, 403);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM partner_levels ORDER BY min_sales_amount ASC"
  ).all();

  return c.json(results);
});

// Admin API - Update partner levels
app.put("/api/admin/partner-levels", authMiddleware, zValidator("json", z.object({
  levels: z.array(z.object({
    id: z.number(),
    name: z.string(),
    commission_percent: z.number(),
    min_sales_amount: z.number(),
    min_referrals_count: z.number(),
    is_active: z.boolean()
  }))
})), async (c) => {
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }

  const adminUser = await c.env.DB.prepare(
    "SELECT is_admin FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!adminUser?.is_admin) {
    return c.json({ error: "Access denied" }, 403);
  }

  const { levels } = c.req.valid("json");

  // Update each level
  for (const level of levels) {
    await c.env.DB.prepare(
      `UPDATE partner_levels 
       SET name = ?, commission_percent = ?, min_sales_amount = ?, min_referrals_count = ?, is_active = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(
      level.name,
      level.commission_percent,
      level.min_sales_amount,
      level.min_referrals_count,
      level.is_active ? 1 : 0,
      level.id
    ).run();
  }

  return c.json({ success: true });
});

// Admin API - Get partner stats
app.get("/api/admin/partner-stats", authMiddleware, async (c) => {
  const hunkoUser = c.get("user");
  
  if (!hunkoUser) {
    return c.json({ error: "User not found" }, 401);
  }

  const adminUser = await c.env.DB.prepare(
    "SELECT is_admin FROM vpn_users WHERE hunko_user_id = ?"
  ).bind(hunkoUser.id).first();

  if (!adminUser?.is_admin) {
    return c.json({ error: "Access denied" }, 403);
  }

  const [totalPartners, activePartners, totalPayouts, totalReferrals] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) as count FROM partners").first(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM partners WHERE is_active = 1").first(),
    c.env.DB.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM partner_payouts WHERE status = 'completed'").first(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM referrals WHERE converted = 1").first()
  ]);

  return c.json({
    total_partners: totalPartners?.count || 0,
    active_partners: activePartners?.count || 0,
    total_payouts: totalPayouts?.total || 0,
    total_referrals: totalReferrals?.count || 0
  });
});

export default app;
