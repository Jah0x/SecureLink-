/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MarzbanClient {
  baseUrl: string;
  apiKey: string;
}

export class MarzbanService {
  private client: MarzbanClient;

  constructor(baseUrl: string, apiKey: string) {
    this.client = {
      baseUrl: baseUrl.replace(/\/$/, ''), // Remove trailing slash
      apiKey,
    };
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.client.baseUrl}/api${endpoint}`;
    
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.client.apiKey}`,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`Marzban API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // User management
  async createUser(userData: {
    username: string;
    proxies: Record<string, any>;
    data_limit?: number;
    expire?: number;
    status?: 'active' | 'disabled';
    note?: string;
  }) {
    return this.request('/user', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getUser(username: string) {
    return this.request(`/user/${username}`);
  }

  async updateUser(username: string, userData: {
    proxies?: Record<string, any>;
    data_limit?: number;
    expire?: number;
    status?: 'active' | 'disabled';
    note?: string;
  }) {
    return this.request(`/user/${username}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(username: string) {
    return this.request(`/user/${username}`, {
      method: 'DELETE',
    });
  }

  async getUserUsage(username: string) {
    return this.request(`/user/${username}/usage`);
  }

  async resetUserUsage(username: string) {
    return this.request(`/user/${username}/reset`, {
      method: 'POST',
    });
  }

  // System stats
  async getSystemStats() {
    return this.request('/system');
  }

  async getCoreStats() {
    return this.request('/core');
  }

  // Admin management
  async getAdmins() {
    return this.request('/admins');
  }

  // Node management
  async getNodes() {
    return this.request('/nodes');
  }

  // Get all users with pagination
  async getUsers(offset = 0, limit = 100) {
    return this.request(`/users?offset=${offset}&limit=${limit}`);
  }

  // Health check
  async healthCheck() {
    try {
      await this.request('/system');
      return true;
    } catch {
      return false;
    }
  }
}

export const createMarzbanService = (baseUrl: string, apiKey: string): MarzbanService => {
  return new MarzbanService(baseUrl, apiKey);
};

// Helper functions for user creation
export const generateMarzbanUsername = (email: string, userId: number): string => {
  const emailPart = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
  return `${emailPart}_${userId}`.toLowerCase();
};

export const createDefaultProxies = () => {
  return {
    "vless": {},
    "vmess": {},
    "trojan": {},
    "shadowsocks": {}
  };
};

export const calculateExpireTimestamp = (months: number): number => {
  const now = new Date();
  now.setMonth(now.getMonth() + months);
  return Math.floor(now.getTime() / 1000);
};

export const bytesToGB = (bytes: number): number => {
  return Math.round((bytes / (1024 ** 3)) * 100) / 100;
};

export const gbToBytes = (gb: number): number => {
  return gb * (1024 ** 3);
};
