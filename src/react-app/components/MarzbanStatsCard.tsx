import { useEffect, useState } from 'react';
import { Activity, Users, HardDrive, Wifi, AlertCircle, CheckCircle } from 'lucide-react';

interface MarzbanStats {
  system: {
    users_total: number;
    users_active: number;
    incoming_bandwidth: number;
    outgoing_bandwidth: number;
    incoming_bandwidth_speed: number;
    outgoing_bandwidth_speed: number;
  };
  core: {
    version: string;
    started: boolean;
  };
  connected: boolean;
}

export default function MarzbanStatsCard() {
  const [stats, setStats] = useState<MarzbanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMarzbanStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchMarzbanStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMarzbanStats = async () => {
    try {
      const response = await fetch('/api/admin/marzban/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch stats');
        setStats(null);
      }
    } catch {
      setError('Connection failed');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin">
            <Activity className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
        <div className="flex items-center space-x-3 mb-4">
          <AlertCircle className="w-6 h-6 text-red-400" />
          <h3 className="text-lg font-semibold text-white">Marzban Status</h3>
        </div>
        <div className="text-center py-4">
          <p className="text-red-400 mb-2">Connection Failed</p>
          <p className="text-slate-400 text-sm">{error}</p>
          <button
            onClick={fetchMarzbanStats}
            className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <CheckCircle className="w-6 h-6 text-green-400" />
          <h3 className="text-lg font-semibold text-white">Marzban System</h3>
        </div>
        <div className="flex items-center space-x-2 px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span>Connected</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-slate-300 text-sm">Total Users</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.system.users_total}</div>
        </div>
        
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="w-4 h-4 text-green-400" />
            <span className="text-slate-300 text-sm">Active Users</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.system.users_active}</div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <HardDrive className="w-4 h-4 text-purple-400" />
            <span className="text-slate-300 text-sm">Bandwidth Usage</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-slate-400">Download</div>
              <div className="text-white font-medium">{formatBytes(stats.system.incoming_bandwidth)}</div>
            </div>
            <div>
              <div className="text-slate-400">Upload</div>
              <div className="text-white font-medium">{formatBytes(stats.system.outgoing_bandwidth)}</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Wifi className="w-4 h-4 text-orange-400" />
            <span className="text-slate-300 text-sm">Current Speed</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-slate-400">Download</div>
              <div className="text-white font-medium">{formatSpeed(stats.system.incoming_bandwidth_speed)}</div>
            </div>
            <div>
              <div className="text-slate-400">Upload</div>
              <div className="text-white font-medium">{formatSpeed(stats.system.outgoing_bandwidth_speed)}</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Core Version</span>
            <span className="text-white font-medium">{stats.core.version}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-slate-400">Core Status</span>
            <span className={`font-medium ${stats.core.started ? 'text-green-400' : 'text-red-400'}`}>
              {stats.core.started ? 'Running' : 'Stopped'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
