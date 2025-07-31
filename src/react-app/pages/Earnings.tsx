import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import Header from '@/react-app/components/Header';
import StatsCard from '@/react-app/components/StatsCard';
import { DollarSign, Users, TrendingUp, Copy, Wallet, Gift } from 'lucide-react';

interface PartnerStats {
  level: {
    name: string;
    commission_percent: number;
    min_sales_amount: number;
    min_referrals_count: number;
  };
  total_sales: number;
  total_referrals: number;
  total_earnings: number;
  pending_earnings: number;
  available_for_payout: number;
  partner_code: string;
  next_level?: {
    name: string;
    commission_percent: number;
    progress_sales: number;
    progress_referrals: number;
  };
}

interface Referral {
  id: number;
  converted: boolean;
  user_email?: string;
  created_at: string;
  utm_source?: string;
  utm_campaign?: string;
}

interface Earning {
  id: number;
  amount: number;
  commission_percent: number;
  status: string;
  subscription_plan: string;
  created_at: string;
}

export default function Earnings() {
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'referrals' | 'earnings' | 'payouts'>('overview');
  const [copied, setCopied] = useState(false);

  // Check if user came from referral link
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      // Track referral visit
      fetch('/api/partners/track-referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          partner_code: ref,
          utm_source: searchParams.get('utm_source'),
          utm_medium: searchParams.get('utm_medium'),
          utm_campaign: searchParams.get('utm_campaign')
        })
      }).catch(console.error);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, referralsRes, earningsRes] = await Promise.all([
        fetch('/api/partners/stats'),
        fetch('/api/partners/referrals'),
        fetch('/api/partners/earnings')
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (referralsRes.ok) {
        const referralsData = await referralsRes.json();
        setReferrals(referralsData);
      }

      if (earningsRes.ok) {
        const earningsData = await earningsRes.json();
        setEarnings(earningsData);
      }
    } catch (error) {
      console.error('Failed to fetch partner data:', error);
    } finally {
      setLoading(false);
    }
  };

  const becomePartner = async () => {
    try {
      const response = await fetch('/api/partners/register', {
        method: 'POST',
      });

      if (response.ok) {
        await fetchData();
      } else {
        alert('Ошибка при регистрации в партнерской программе');
      }
    } catch (error) {
      console.error('Failed to become partner:', error);
      alert('Ошибка при регистрации в партнерской программе');
    }
  };

  const copyReferralLink = () => {
    if (stats) {
      const referralLink = `${window.location.origin}/?ref=${stats.partner_code}`;
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin">
            <DollarSign className="w-10 h-10 text-green-500" />
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 backdrop-blur-sm rounded-2xl p-8 border border-green-500/20">
              <div className="bg-gradient-to-r from-green-500 to-blue-600 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <DollarSign className="w-10 h-10 text-white" />
              </div>
              
              <h1 className="text-4xl font-bold text-white mb-4">Заработай с нами!</h1>
              <p className="text-xl text-slate-300 mb-8">
                Присоединяйтесь к нашей партнерской программе и получайте <span className="text-green-400 font-bold">до 30%</span> от продаж
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                  <Users className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-white mb-2">Приглашайте друзей</h3>
                  <p className="text-slate-400 text-sm">Делитесь реферальной ссылкой в социальных сетях</p>
                </div>
                
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                  <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-white mb-2">Получайте комиссию</p>
                  <p className="text-slate-400 text-sm">От 10% до 30% с каждой продажи по вашей ссылке</p>
                </div>
                
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                  <Wallet className="w-8 h-8 text-purple-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-white mb-2">Выводите деньги</h3>
                  <p className="text-slate-400 text-sm">Быстрые выплаты на карту или электронный кошелек</p>
                </div>
              </div>
              
              <button
                onClick={becomePartner}
                className="bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-green-500/20 text-lg"
              >
                <Gift className="w-5 h-5 inline mr-2" />
                Стать партнером
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Партнерская программа</h1>
          <p className="text-slate-400">Ваш уровень: <span className="text-green-400 font-medium">{stats.level.name}</span> ({stats.level.commission_percent}%)</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Всего заработано"
            value={formatCurrency(stats.total_earnings)}
            icon={<DollarSign className="w-6 h-6 text-white" />}
            gradient="from-green-500 to-green-600"
          />
          <StatsCard
            title="К выплате"
            value={formatCurrency(stats.available_for_payout)}
            subtitle="доступно сейчас"
            icon={<Wallet className="w-6 h-6 text-white" />}
            gradient="from-blue-500 to-blue-600"
          />
          <StatsCard
            title="Рефералы"
            value={stats.total_referrals}
            subtitle="всего приглашено"
            icon={<Users className="w-6 h-6 text-white" />}
            gradient="from-purple-500 to-purple-600"
          />
          <StatsCard
            title="Продажи"
            value={formatCurrency(stats.total_sales)}
            subtitle="общий оборот"
            icon={<TrendingUp className="w-6 h-6 text-white" />}
            gradient="from-orange-500 to-orange-600"
          />
        </div>

        {/* Progress to next level */}
        {stats.next_level && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">
              Прогресс до уровня "{stats.next_level.name}" ({stats.next_level.commission_percent}%)
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Продажи</span>
                  <span className="text-white">{stats.next_level.progress_sales}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(stats.next_level.progress_sales, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Рефералы</span>
                  <span className="text-white">{stats.next_level.progress_referrals}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-pink-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(stats.next_level.progress_referrals, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Referral Link */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Ваша реферальная ссылка</h3>
          <div className="flex items-center space-x-3">
            <div className="flex-1 bg-slate-700 rounded-lg px-4 py-3 text-slate-300 font-mono text-sm">
              {`${window.location.origin}/?ref=${stats.partner_code}`}
            </div>
            <button
              onClick={copyReferralLink}
              className={`px-4 py-3 rounded-lg transition-colors ${
                copied 
                  ? 'bg-green-500 text-white' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {copied ? 'Скопировано!' : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-slate-400 text-sm mt-2">
            Код партнера: <span className="text-white font-medium">{stats.partner_code}</span>
          </p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-8 bg-slate-800/50 backdrop-blur-sm rounded-xl p-1">
          <button
            onClick={() => setActiveTab('referrals')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'referrals'
                ? 'bg-blue-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Рефералы</span>
          </button>
          <button
            onClick={() => setActiveTab('earnings')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'earnings'
                ? 'bg-blue-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Доходы</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'referrals' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-semibold text-white">Рефералы ({referrals.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left p-4 text-slate-300 font-medium">Дата</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Пользователь</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Источник</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((referral) => (
                    <tr key={referral.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="p-4 text-slate-300">{formatDate(referral.created_at)}</td>
                      <td className="p-4 text-slate-300">
                        {referral.user_email || 'Гость'}
                      </td>
                      <td className="p-4 text-slate-300">
                        {referral.utm_source || '—'}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          referral.converted 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {referral.converted ? 'Конверсия' : 'Переход'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {referrals.length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  Пока нет переходов по вашей ссылке
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'earnings' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-semibold text-white">Доходы</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left p-4 text-slate-300 font-medium">Дата</th>
                    <th className="text-left p-4 text-slate-300 font-medium">План</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Комиссия</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Сумма</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.map((earning) => (
                    <tr key={earning.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="p-4 text-slate-300">{formatDate(earning.created_at)}</td>
                      <td className="p-4 text-slate-300">{earning.subscription_plan}</td>
                      <td className="p-4 text-slate-300">{earning.commission_percent}%</td>
                      <td className="p-4 text-green-400 font-medium">
                        {formatCurrency(earning.amount)}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          earning.status === 'paid' 
                            ? 'bg-green-500/20 text-green-400' 
                            : earning.status === 'pending'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {earning.status === 'paid' ? 'Выплачено' : 
                           earning.status === 'pending' ? 'В ожидании' : 'Готово к выплате'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {earnings.length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  Пока нет доходов
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
