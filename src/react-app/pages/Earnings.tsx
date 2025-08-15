import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router';
import Header from '@/react-app/components/Header';
import { Copy, DollarSign } from 'lucide-react';
import { useAuth } from '@/auth';
import { apiFetch } from '@/react-app/api';

const StatsTable = lazy(() => import('@/react-app/components/AffStatsTable'));

const REF_ENABLED = import.meta.env.VITE_FEATURE_REFERRALS !== 'false';

interface AffData {
  code: string;
  share_url: string;
  stats: { clicks: number; signups: number; earnings_cents: number };
}

export default function Earnings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<AffData | null>(null);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!REF_ENABLED) return;
    (async () => {
      try {
        const d = await apiFetch('/api/aff/me');
        setData(d as AffData);
        const from = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
        const to = new Date().toISOString();
        const s = await apiFetch(`/api/aff/stats?from=${from}&to=${to}`);
        setStats(s as any[]);
        setStatsLoading(false);
      } catch (e) {
        console.error('Failed to load affiliate data', e);
      }
    })();
  }, [user, navigate]);

  if (!user) return null;
  if (!REF_ENABLED) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-white mb-6">Партнёрская программа</h1>
          <p className="text-slate-400">Реферальная система отключена</p>
        </main>
      </div>
    );
  }

  const copyLink = () => {
    if (data) {
      navigator.clipboard.writeText(data.share_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-6">Партнёрская программа</h1>
        {data && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Ваша ссылка:</span>
                <button
                  onClick={copyLink}
                  className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copied ? 'Скопировано' : 'Копировать'}</span>
                </button>
              </div>
              <p className="mt-2 text-white break-all">{data.share_url}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 text-center">
                <p className="text-2xl font-bold text-white">{data.stats.clicks}</p>
                <p className="text-slate-400">Переходы</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 text-center">
                <p className="text-2xl font-bold text-white">{data.stats.signups}</p>
                <p className="text-slate-400">Регистрации</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 text-center">
                <p className="text-2xl font-bold text-white">{formatCurrency(data.stats.earnings_cents)}</p>
                <p className="text-slate-400">Заработок</p>
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
              {statsLoading && (
                <div className="h-24 animate-pulse bg-slate-700 rounded" />
              )}
              {!statsLoading && (
                <Suspense fallback={<div className="h-24 animate-pulse bg-slate-700 rounded" />}>
                  <StatsTable stats={stats} />
                </Suspense>
              )}
            </div>
          </div>
        )}
        {!data && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin">
              <DollarSign className="w-10 h-10 text-green-500" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
