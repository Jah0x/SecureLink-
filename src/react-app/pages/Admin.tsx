import { useState, useEffect } from 'react';
import { useAuth } from '@/auth';
import { useNavigate } from 'react-router';
import Header from '@/react-app/components/Header';
import PlanModal from '@/react-app/components/PlanModal';
import GiveSubscriptionModal from '@/react-app/components/GiveSubscriptionModal';
import PartnerLevelsModal from '@/react-app/components/PartnerLevelsModal';
import { Users, Settings, CreditCard, Plus, Edit, Trash2, Gift, RefreshCw, Server, DollarSign, TrendingUp } from 'lucide-react';
import MarzbanStatsCard from '@/react-app/components/MarzbanStatsCard';

interface VpnPlan {
  id: number;
  name: string;
  duration_months: number;
  price_rub: number;
  data_limit_gb: number | null;
  max_connections: number;
  description: string;
  is_active: boolean;
}

interface VpnPlanForm {
  id?: number;
  name: string;
  duration_months: number;
  price_rub: number;
  data_limit_gb: number | null;
  max_connections: number;
  description: string;
  is_active: boolean;
}

interface VpnUserInfo {
  id: number;
  email: string;
  username: string | null;
  is_active: boolean;
  subscription: {
    plan_name: string;
    expires_at: string | null;
    used_data_gb: number;
    data_limit_gb: number | null;
  } | null;
  created_at: string;
}

interface PartnerStats {
  total_partners: number;
  active_partners: number;
  total_payouts: number;
  total_referrals: number;
}

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'users' | 'plans' | 'partners' | 'marzban'>('users');
  const [syncing, setSyncing] = useState(false);
  const [users, setUsers] = useState<VpnUserInfo[]>([]);
  const [plans, setPlans] = useState<VpnPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Modal states
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<VpnPlan | null>(null);
  const [showGiveSubModal, setShowGiveSubModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: number; email: string } | null>(null);
  const [showPartnerLevelsModal, setShowPartnerLevelsModal] = useState(false);
  const [partnerStats, setPartnerStats] = useState<PartnerStats | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/api/admin/check');
        if (response.ok) {
          setIsAdmin(true);
          await fetchData();
        } else {
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Admin check failed:', error);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      const [usersRes, plansRes, partnerStatsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/plans'),
        fetch('/api/admin/partner-stats')
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData);
      }

      if (partnerStatsRes.ok) {
        const partnerStatsData = (await partnerStatsRes.json()) as PartnerStats;
        setPartnerStats(partnerStatsData);
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    }
  };

  const handleSavePlan = async (planData: VpnPlanForm) => {
    try {
      const isEditing = editingPlan && editingPlan.id;
      const url = isEditing ? `/api/admin/plans/${editingPlan.id}` : '/api/admin/plans';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(planData),
      });

      if (response.ok) {
        await fetchData();
        setShowPlanModal(false);
        setEditingPlan(null);
      } else {
        alert('Ошибка при сохранении плана');
      }
    } catch (error) {
      console.error('Failed to save plan:', error);
      alert('Ошибка при сохранении плана');
    }
  };

  const handleDeletePlan = async (planId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот план?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/plans/${planId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchData();
      } else {
        alert('Ошибка при удалении плана');
      }
    } catch (error) {
      console.error('Failed to delete plan:', error);
      alert('Ошибка при удалении плана');
    }
  };

  const handleGiveSubscription = async (userId: number, planId: number) => {
    try {
      const response = await fetch('/api/admin/give-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, planId }),
      });

      if (response.ok) {
        await fetchData();
        setShowGiveSubModal(false);
        setSelectedUser(null);
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to give subscription:', error);
      alert('Ошибка при выдаче подписки');
    }
  };

  const handleSyncMarzban = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/admin/marzban/sync', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Синхронизация завершена!\nУспешно: ${data.synced}\nОшибок: ${data.failed}\nВсего: ${data.total}`);
        await fetchData();
      } else {
        const error = await response.json();
        alert(`Ошибка синхронизации: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to sync with Marzban:', error);
      alert('Ошибка при синхронизации с Marzban');
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin">
            <Settings className="w-10 h-10 text-blue-500" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Доступ запрещен</h2>
            <p className="text-slate-400">У вас нет прав администратора</p>
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
          <h1 className="text-3xl font-bold text-white mb-2">Админ-панель</h1>
          <p className="text-slate-400">Управление пользователями и тарифными планами</p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-8 bg-slate-800/50 backdrop-blur-sm rounded-xl p-1">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'users'
                ? 'bg-blue-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Пользователи</span>
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'plans'
                ? 'bg-blue-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Тарифные планы</span>
          </button>
          <button
            onClick={() => setActiveTab('partners')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'partners'
                ? 'bg-blue-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Партнеры</span>
          </button>
          <button
            onClick={() => setActiveTab('marzban')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'marzban'
                ? 'bg-blue-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Marzban</span>
          </button>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-semibold text-white">
                Пользователи ({users.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left p-4 text-slate-300 font-medium">Email</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Подписка</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Трафик</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Истекает</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Статус</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Регистрация</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="p-4">
                        <div>
                          <div className="text-white font-medium">{user.email}</div>
                          {user.username && (
                            <div className="text-slate-400 text-sm">{user.username}</div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {user.subscription ? (
                          <span className="text-slate-300">{user.subscription.plan_name}</span>
                        ) : (
                          <span className="text-slate-500">Нет подписки</span>
                        )}
                      </td>
                      <td className="p-4">
                        {user.subscription ? (
                          <span className="text-slate-300">
                            {user.subscription.used_data_gb} ГБ
                            {user.subscription.data_limit_gb && 
                              ` / ${user.subscription.data_limit_gb} ГБ`
                            }
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        {user.subscription?.expires_at ? (
                          <span className="text-slate-300">
                            {formatDate(user.subscription.expires_at)}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          user.is_active 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {user.is_active ? 'Активен' : 'Заблокирован'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-300">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => {
                            setSelectedUser({ id: user.id, email: user.email });
                            setShowGiveSubModal(true);
                          }}
                          className="p-2 text-slate-400 hover:text-green-400 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Выдать подписку"
                        >
                          <Gift className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Plans Tab */}
        {activeTab === 'plans' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">
                Тарифные планы ({plans.length})
              </h2>
              <button
                onClick={() => {
                  setEditingPlan(null);
                  setShowPlanModal(true);
                }}
                className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить план</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left p-4 text-slate-300 font-medium">Название</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Срок</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Цена</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Трафик</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Подключения</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Статус</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr key={plan.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="p-4">
                        <div className="text-white font-medium">{plan.name}</div>
                        <div className="text-slate-400 text-sm">{plan.description}</div>
                      </td>
                      <td className="p-4 text-slate-300">
                        {plan.duration_months} мес.
                      </td>
                      <td className="p-4 text-slate-300">
                        {formatPrice(plan.price_rub)}
                      </td>
                      <td className="p-4 text-slate-300">
                        {plan.data_limit_gb ? `${plan.data_limit_gb} ГБ` : 'Безлимит'}
                      </td>
                      <td className="p-4 text-slate-300">
                        {plan.max_connections}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          plan.is_active 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {plan.is_active ? 'Активен' : 'Отключен'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setEditingPlan(plan);
                              setShowPlanModal(true);
                            }}
                            className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePlan(plan.id)}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Partners Tab */}
        {activeTab === 'partners' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
              <h2 className="text-xl font-semibold text-white mb-6">Управление партнерами</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="bg-slate-700/30 rounded-xl p-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    <span className="text-slate-300 text-sm">Всего партнеров</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{partnerStats?.total_partners || 0}</div>
                </div>
                
                <div className="bg-slate-700/30 rounded-xl p-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <span className="text-slate-300 text-sm">Активных партнеров</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{partnerStats?.active_partners || 0}</div>
                </div>
                
                <div className="bg-slate-700/30 rounded-xl p-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <DollarSign className="w-5 h-5 text-purple-400" />
                    <span className="text-slate-300 text-sm">Общие выплаты</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{formatPrice(partnerStats?.total_payouts || 0)}</div>
                </div>
                
                <div className="bg-slate-700/30 rounded-xl p-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <Gift className="w-5 h-5 text-orange-400" />
                    <span className="text-slate-300 text-sm">Рефералы</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{partnerStats?.total_referrals || 0}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-700/30 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Уровни партнеров</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Новичок</span>
                      <span className="text-green-400 font-medium">10%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Бронза</span>
                      <span className="text-green-400 font-medium">15%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Серебро</span>
                      <span className="text-green-400 font-medium">20%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Золото</span>
                      <span className="text-green-400 font-medium">25%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Платина</span>
                      <span className="text-green-400 font-medium">30%</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowPartnerLevelsModal(true)}
                    className="w-full mt-4 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    Настроить уровни
                  </button>
                </div>
                
                <div className="bg-slate-700/30 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Недавняя активность</h3>
                  <div className="space-y-3 text-sm">
                    <div className="text-slate-400">
                      Пока нет активности партнеров
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Marzban Tab */}
        {activeTab === 'marzban' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-white mb-2">Управление Marzban</h2>
                  <p className="text-slate-400">Синхронизация пользователей и мониторинг системы</p>
                </div>
                <button
                  onClick={handleSyncMarzban}
                  disabled={syncing}
                  className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Синхронизация...' : 'Синхронизировать всех'}</span>
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MarzbanStatsCard />
                
                <div className="bg-slate-700/30 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Информация о системе</h3>
                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Интеграция</span>
                      <span className="text-green-400 font-medium">Активна</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Автосинхронизация</span>
                      <span className="text-green-400 font-medium">Включена</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Тип подключения</span>
                      <span className="text-white font-medium">REST API</span>
                    </div>
                    <div className="pt-4 border-t border-slate-600">
                      <p className="text-slate-300">
                        Все новые подписки автоматически создаются в Marzban. 
                        Статистика трафика обновляется в реальном времени.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <PlanModal
        isOpen={showPlanModal}
        onClose={() => {
          setShowPlanModal(false);
          setEditingPlan(null);
        }}
        plan={editingPlan}
        onSave={handleSavePlan}
      />

      {selectedUser && (
        <GiveSubscriptionModal
          isOpen={showGiveSubModal}
          onClose={() => {
            setShowGiveSubModal(false);
            setSelectedUser(null);
          }}
          userId={selectedUser.id}
          userEmail={selectedUser.email}
          onGive={handleGiveSubscription}
        />
      )}

      <PartnerLevelsModal
        isOpen={showPartnerLevelsModal}
        onClose={() => setShowPartnerLevelsModal(false)}
        onSave={fetchData}
      />
    </div>
  );
}
