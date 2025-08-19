import { useState, useEffect } from 'react';
import { useAuth } from '@/auth';
import { useNavigate } from 'react-router';
import Header from '@/react-app/components/Header';
import PlanModal from '@/react-app/components/PlanModal';
import { Users, CreditCard, Plus, Edit, Ban, Check, Link as LinkIcon } from 'lucide-react';
import { apiFetch } from '@/react-app/api';

interface VpnPlan {
  id: number;
  name: string;
  price: number;
  periodDays: number;
  trafficMb: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface VpnPlanForm {
  id?: number;
  name: string;
  price: number;
  periodDays: number;
  trafficMb: number | null;
  active: boolean;
}

interface AdminUser {
  id: number;
  email: string;
  role: string;
  created_at: string;
}

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'users' | 'plans' | 'affiliates'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plans, setPlans] = useState<VpnPlan[]>([]);
  const [affiliatesList, setAffiliatesList] = useState<any[]>([]);
  const REF_ENABLED = import.meta.env.VITE_FEATURE_REFERRALS !== 'false';
  const [planFilter, setPlanFilter] = useState<'all' | '1' | '0'>('all');
  const [loading, setLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<VpnPlan | null>(null);
  const handleAddUser = async () => {
    const email = prompt('Email пользователя');
    if (!email) return;
    const password = prompt('Пароль пользователя');
    if (!password) return;
    try {
      await apiFetch('/api/admin/users', { method: 'POST', body: JSON.stringify({ email, password }) });
      await fetchData();
    } catch (e) {
      console.error('Failed to create user:', e);
      alert('Ошибка при создании пользователя');
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'admin') {
      setLoading(false);
      return;
    }
    fetchData().finally(() => setLoading(false));
  }, [user, navigate, planFilter]);

  const fetchData = async () => {
    try {
      const reqs: Promise<any>[] = [
        apiFetch('/api/admin/users'),
        apiFetch(`/api/admin/plans?active=${planFilter}`),
      ];
      if (REF_ENABLED) reqs.push(apiFetch('/api/admin/affiliates'));
      const [usersData, plansData, affData] = await Promise.all(reqs);
      setUsers(usersData as AdminUser[]);
      setPlans(plansData as VpnPlan[]);
      setAffiliatesList((affData || []) as any[]);
    } catch (e) {
      if ((e as Error).message === '401') {
        alert('Сессия истекла');
        navigate('/login');
      } else {
        console.error('Failed to fetch admin data:', e);
      }
    }
  };

  const handleSavePlan = async (planData: VpnPlanForm) => {
    try {
      const payload = {
        name: planData.name,
        price: planData.price,
        periodDays: planData.periodDays,
        trafficMb: planData.trafficMb,
        active: planData.active,
      };
      const method = planData.id ? 'PUT' : 'POST';
      const url = planData.id ? `/api/admin/plans/${planData.id}` : '/api/admin/plans';
      await apiFetch(url, { method, body: JSON.stringify(payload) });
      setShowPlanModal(false);
      setEditingPlan(null);
      await fetchData();
    } catch (e) {
      console.error('Failed to save plan:', e);
      alert('Ошибка при сохранении плана');
    }
  };

  const handleDeactivatePlan = async (planId: number) => {
    if (!confirm('Отключить этот план?')) return;
    try {
      await apiFetch(`/api/admin/plans/${planId}`, { method: 'DELETE' });
      await fetchData();
    } catch (e) {
      console.error('Failed to deactivate plan:', e);
      alert('Ошибка при отключении плана');
    }
  };

  const handleActivatePlan = async (planId: number) => {
    try {
      await apiFetch(`/api/admin/plans/${planId}/activate`, { method: 'POST' });
      await fetchData();
    } catch (e) {
      console.error('Failed to activate plan:', e);
      alert('Ошибка при активации плана');
    }
  };

  const formatDate = (dateStr: string) => {
    const dt = new Date(dateStr);
    return isNaN(+dt) ? '—' : dt.toLocaleString('ru-RU');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    }).format(price);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin">
            <Users className="w-10 h-10 text-blue-500" />
          </div>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
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
          {REF_ENABLED && (
            <button
              onClick={() => setActiveTab('affiliates')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'affiliates'
                  ? 'bg-blue-500 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <LinkIcon className="w-4 h-4" />
              <span>Реферальная система</span>
            </button>
          )}
        </div>

        {activeTab === 'users' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">
                Пользователи ({users.length})
              </h2>
              <button
                onClick={handleAddUser}
                className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить пользователя</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left p-4 text-slate-300 font-medium">Email</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Роль</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Создан</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-700/50">
                      <td className="p-4 text-white">{u.email}</td>
                      <td className="p-4 text-slate-300">{u.role}</td>
                      <td className="p-4 text-slate-300">{formatDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'plans' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">
                Тарифные планы ({plans.length})
              </h2>
              <div className="flex items-center space-x-4">
                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value as 'all' | '1' | '0')}
                  className="bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-3 py-2"
                >
                  <option value="all">Все</option>
                  <option value="1">Активные</option>
                  <option value="0">Неактивные</option>
                </select>
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
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left p-4 text-slate-300 font-medium">Название</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Цена</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Период (дней)</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Трафик</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Статус</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Создан</th>
                    <th className="text-left p-4 text-slate-300 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr key={plan.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="p-4">
                        <div className="text-white font-medium">{plan.name}</div>
                      </td>
                      <td className="p-4 text-slate-300">{formatPrice(plan.price)}</td>
                      <td className="p-4 text-slate-300">{plan.periodDays}</td>
                      <td className="p-4 text-slate-300">{plan.trafficMb ? `${plan.trafficMb} МБ` : 'Безлимит'}</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            plan.active
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {plan.active ? 'Активен' : 'Отключен'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-300">{formatDate(plan.createdAt)}</td>
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
                          {plan.active ? (
                            <button
                              onClick={() => handleDeactivatePlan(plan.id)}
                              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActivatePlan(plan.id)}
                              className="p-2 text-slate-400 hover:text-green-400 hover:bg-slate-700 rounded-lg transition-colors"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {REF_ENABLED && activeTab === 'affiliates' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700">
            {affiliatesList.length === 0 ? (
              <div className="p-6 text-center text-slate-400">Данных пока нет</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left p-4 text-slate-300 font-medium">Код</th>
                      <th className="text-left p-4 text-slate-300 font-medium">Процент</th>
                    </tr>
                  </thead>
                  <tbody>
                    {affiliatesList.map((a) => (
                      <tr key={a.id} className="border-b border-slate-700/50">
                        <td className="p-4 text-white">{a.code}</td>
                        <td className="p-4 text-slate-300">{a.percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      <PlanModal
        isOpen={showPlanModal}
        onClose={() => {
          setShowPlanModal(false);
          setEditingPlan(null);
        }}
        plan={editingPlan}
        onSave={handleSavePlan}
      />
    </div>
  );
}
