import { useState, useEffect } from 'react';
import { Copy, ExternalLink, Download, RefreshCw, AlertCircle, CheckCircle, QrCode } from 'lucide-react';

interface SubscriptionDetails {
  subscription_url?: string;
  links?: string[];
  username?: string;
  status?: 'active' | 'disabled' | 'limited' | 'expired';
  expire?: number;
  data_limit?: number | null;
  used_traffic?: number;
  error?: string;
}

export default function SubscriptionCard() {
  const [details, setDetails] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscriptionDetails();
  }, []);

  const fetchSubscriptionDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/subscription-url');
      if (response.ok) {
        const data = await response.json();
        setDetails(data);
      } else {
        const errorData = await response.json();
        setDetails({ error: errorData.error });
      }
    } catch (error) {
      setDetails({ error: 'Failed to fetch subscription details' });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active':
        return 'text-green-400';
      case 'expired':
        return 'text-red-400';
      case 'limited':
        return 'text-yellow-400';
      case 'disabled':
        return 'text-gray-400';
      default:
        return 'text-slate-400';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'active':
        return 'Активна';
      case 'expired':
        return 'Истекла';
      case 'limited':
        return 'Ограничена';
      case 'disabled':
        return 'Отключена';
      default:
        return 'Неизвестно';
    }
  };

  const formatExpiry = (timestamp?: number) => {
    if (!timestamp) return 'Бессрочно';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('ru-RU');
  };

  const formatTraffic = (gb?: number) => {
    if (gb === undefined) return '0 ГБ';
    return `${gb.toFixed(2)} ГБ`;
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin">
            <RefreshCw className="w-6 h-6 text-blue-500" />
          </div>
        </div>
      </div>
    );
  }

  if (details?.error) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
        <div className="flex items-center space-x-3 mb-4">
          <AlertCircle className="w-6 h-6 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">Конфигурация VPN</h3>
        </div>
        <div className="text-center py-4">
          <p className="text-yellow-400 mb-2">Конфигурация недоступна</p>
          <p className="text-slate-400 text-sm mb-4">{details.error}</p>
          <button
            onClick={fetchSubscriptionDetails}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
          >
            Обновить
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
          <h3 className="text-lg font-semibold text-white">Конфигурация VPN</h3>
        </div>
        <button
          onClick={fetchSubscriptionDetails}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          title="Обновить"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {details?.username && (
        <div className="mb-6 space-y-3">
          <div className="bg-slate-700/50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-slate-400">Пользователь</div>
                <div className="text-white font-medium">{details.username}</div>
              </div>
              <div>
                <div className="text-slate-400">Статус</div>
                <div className={`font-medium ${getStatusColor(details.status)}`}>
                  {getStatusText(details.status)}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Истекает</div>
                <div className="text-white font-medium">{formatExpiry(details.expire)}</div>
              </div>
              <div>
                <div className="text-slate-400">Использовано</div>
                <div className="text-white font-medium">
                  {formatTraffic(details.used_traffic)}
                  {details.data_limit && ` / ${formatTraffic(details.data_limit)}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {details?.subscription_url && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Subscription URL
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={details.subscription_url}
              readOnly
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
            />
            <button
              onClick={() => copyToClipboard(details.subscription_url!, 'subscription')}
              className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              title="Копировать"
            >
              {copied === 'subscription' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <a
              href={details.subscription_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
              title="Открыть"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}

      {details?.links && details.links.length > 0 && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-300">
            Конфигурационные ссылки
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {details.links.map((link, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={link}
                  readOnly
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono"
                />
                <button
                  onClick={() => copyToClipboard(link, `link-${index}`)}
                  className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  title="Копировать"
                >
                  {copied === `link-${index}` ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-slate-600">
        <div className="flex flex-wrap gap-2">
          <button className="flex items-center space-x-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg text-sm transition-colors">
            <Download className="w-4 h-4" />
            <span>Скачать конфиг</span>
          </button>
          <button className="flex items-center space-x-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg text-sm transition-colors">
            <QrCode className="w-4 h-4" />
            <span>QR-код</span>
          </button>
        </div>
      </div>
    </div>
  );
}
