import { useState, useEffect } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import { useNavigate } from 'react-router';
import Header from '@/react-app/components/Header';
import StatsCard from '@/react-app/components/StatsCard';
import SubscriptionCard from '@/react-app/components/SubscriptionCard';
import { DashboardStats, VpnSubscription } from '@/shared/types';
import { Activity, HardDrive, Users, Calendar, ShoppingCart, BarChart3, Download } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [subscription, setSubscription] = useState<VpnSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, subscriptionRes] = await Promise.all([
          fetch('/api/dashboard/stats'),
          fetch('/api/subscription')
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        if (subscriptionRes.ok) {
          const subscriptionData = await subscriptionRes.json();
          setSubscription(subscriptionData);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getConnectionStatus = () => {
    // В реальном приложении здесь будет проверка подключения к балансировщику
    return Math.random() > 0.5 ? 'connected' : 'disconnected';
  };

  const connectionStatus = getConnectionStatus();

  const formatDataUsage = (used: number, limit: number) => {
    if (limit === 0) return `${used} ГБ / ∞`;
    return `${used} ГБ / ${limit} ГБ`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin">
            <Activity className="w-10 h-10 text-blue-500" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Добро пожаловать, {user?.google_user_data?.given_name || 'пользователь'}!
          </h1>
          <p className="text-slate-400">Управляйте своими VPN-подключениями</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Использовано данных"
            value={stats ? formatDataUsage(stats.totalDataUsed, stats.dataLimit) : '0 ГБ'}
            icon={<HardDrive className="w-6 h-6 text-white" />}
            gradient="from-blue-500 to-blue-600"
          />
          <StatsCard
            title="Активные подключения"
            value={stats?.activeConnections || 0}
            subtitle="из 5 максимум"
            icon={<Users className="w-6 h-6 text-white" />}
            gradient="from-green-500 to-green-600"
          />
          <StatsCard
            title="Дней осталось"
            value={stats?.daysRemaining || 0}
            subtitle="до окончания подписки"
            icon={<Calendar className="w-6 h-6 text-white" />}
            gradient="from-purple-500 to-purple-600"
          />
          <StatsCard
            title="Скорость"
            value="100 Mbps"
            subtitle="средняя скорость"
            icon={<Activity className="w-6 h-6 text-white" />}
            gradient="from-orange-500 to-orange-600"
          />
        </div>

        {/* Connection Status */}
        <div className="mb-8">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Статус подключения</h2>
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${
                connectionStatus === 'connected' 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                }`} />
                <span>{connectionStatus === 'connected' ? 'Подключен' : 'Отключен'}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-slate-400">Сервер</p>
                <p className="text-white font-medium">
                  {connectionStatus === 'connected' ? 'Auto-balanced' : 'Не выбран'}
                </p>
              </div>
              <div>
                <p className="text-slate-400">IP-адрес</p>
                <p className="text-white font-medium">
                  {connectionStatus === 'connected' ? '185.xxx.xxx.xxx' : '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Время подключения</p>
                <p className="text-white font-medium">
                  {connectionStatus === 'connected' ? '2 ч 15 мин' : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Status */}
        {!subscription ? (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-sm rounded-xl p-6 border border-blue-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">У вас нет активной подписки</h3>
                  <p className="text-slate-300">Выберите подходящий тарифный план для начала работы</p>
                </div>
                <button
                  onClick={() => navigate('/pricing')}
                  className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-blue-500/20"
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span>Выбрать план</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8">
            <SubscriptionCard />
          </div>
        )}

        {/* Network Statistics (Grafana placeholder) */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">Мониторинг сети</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Пропускная способность</h3>
                <BarChart3 className="w-5 h-5 text-blue-400" />
              </div>
              <div className="h-48 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>График Grafana будет здесь</p>
                  <p className="text-xs mt-1">Отображение в реальном времени</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Нагрузка на кластер</h3>
                <Activity className="w-5 h-5 text-green-400" />
              </div>
              <div className="h-48 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>График нагрузки будет здесь</p>
                  <p className="text-xs mt-1">Мониторинг серверов</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
          <h3 className="text-xl font-semibold text-white mb-4">Быстрые действия</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button className="bg-slate-700 hover:bg-slate-600 text-white p-4 rounded-lg transition-colors text-left group">
              <div className="flex items-center space-x-2 mb-2">
                <Download className="w-5 h-5 text-blue-400 group-hover:text-blue-300" />
                <h4 className="font-medium">Скачать приложение</h4>
              </div>
              <p className="text-sm text-slate-400">Мобильное приложение для iOS/Android</p>
            </button>
            <button className="bg-slate-700 hover:bg-slate-600 text-white p-4 rounded-lg transition-colors text-left group">
              <div className="flex items-center space-x-2 mb-2">
                <Activity className="w-5 h-5 text-green-400 group-hover:text-green-300" />
                <h4 className="font-medium">Настройки подключения</h4>
              </div>
              <p className="text-sm text-slate-400">Конфигурация OpenVPN и WireGuard</p>
            </button>
            <button 
              onClick={() => navigate('/pricing')}
              className="bg-slate-700 hover:bg-slate-600 text-white p-4 rounded-lg transition-colors text-left group"
            >
              <div className="flex items-center space-x-2 mb-2">
                <ShoppingCart className="w-5 h-5 text-purple-400 group-hover:text-purple-300" />
                <h4 className="font-medium">Купить подписку</h4>
              </div>
              <p className="text-sm text-slate-400">Выбрать тарифный план</p>
            </button>
            <button className="bg-slate-700 hover:bg-slate-600 text-white p-4 rounded-lg transition-colors text-left group">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="w-5 h-5 text-orange-400 group-hover:text-orange-300" />
                <h4 className="font-medium">Поддержка</h4>
              </div>
              <p className="text-sm text-slate-400">Получить помощь 24/7</p>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
