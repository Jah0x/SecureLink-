import { MapPin, Wifi, Activity } from 'lucide-react';
import { VpnServer } from '@/shared/types';

interface ServerCardProps {
  server: VpnServer;
  onConnect: (serverId: number) => void;
  isConnecting?: boolean;
}

export default function ServerCard({ server, onConnect, isConnecting }: ServerCardProps) {
  const getLoadColor = (load: number) => {
    if (load < 30) return 'text-green-400';
    if (load < 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getLoadBg = (load: number) => {
    if (load < 30) return 'bg-green-400';
    if (load < 70) return 'bg-yellow-400';
    return 'bg-red-400';
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-lg">
            <Wifi className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold">{server.name}</h3>
            <div className="flex items-center space-x-1 text-slate-400 text-sm">
              <MapPin className="w-3 h-3" />
              <span>{server.location}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Activity className={`w-4 h-4 ${getLoadColor(server.load_percentage)}`} />
          <span className={`text-sm font-medium ${getLoadColor(server.load_percentage)}`}>
            {server.load_percentage}%
          </span>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>Загрузка сервера</span>
          <span>{server.load_percentage}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div 
            className={`h-2 rounded-full ${getLoadBg(server.load_percentage)} transition-all duration-300`}
            style={{ width: `${server.load_percentage}%` }}
          />
        </div>
      </div>

      <button
        onClick={() => onConnect(server.id)}
        disabled={isConnecting}
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 group-hover:shadow-lg group-hover:shadow-blue-500/20"
      >
        {isConnecting ? 'Подключение...' : 'Подключиться'}
      </button>
    </div>
  );
}
