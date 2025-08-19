import { useState, useEffect } from 'react';
import { useAuth } from '@/auth';
import { useNavigate } from 'react-router';
import Header from '@/react-app/components/Header';
import { Check, Shield, Zap, Globe } from 'lucide-react';

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

export default function Pricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<VpnPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<number | null>(null);

  const ICONS = { zap: Zap, globe: Globe, shield: Shield, check: Check } as const;
  type IconName = keyof typeof ICONS;
  const commonFeatures: { icon: IconName; title: string; description: string; gradient: string }[] = [
    {
      icon: 'shield',
      title: 'Максимальная безопасность',
      description: 'AES-256 шифрование и строгая политика отсутствия логов',
      gradient: 'from-blue-500 to-purple-600',
    },
    {
      icon: 'zap',
      title: 'Высокая скорость',
      description: 'Оптимизированные серверы для максимальной производительности',
      gradient: 'from-green-500 to-blue-500',
    },
    {
      icon: 'globe',
      title: 'Глобальное покрытие',
      description: 'Серверы в 50+ странах мира для лучшего подключения',
      gradient: 'from-purple-500 to-pink-500',
    },
  ];

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    const fetchPlans = async () => {
      try {
        const response = await fetch('/api/pricing');
        if (response.ok) {
          const data = await response.json();
          setPlans(data);
        }
      } catch (error) {
        console.error('Failed to fetch plans:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, [user, navigate]);

  const handlePurchase = async (planId: number) => {
    setPurchasing(planId);
    
    try {
      const response = await fetch('/api/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId }),
      });

      if (response.ok) {
        const data = await response.json();
        // В реальном приложении здесь будет редирект на платежную систему
        alert(`Покупка инициирована! ID заказа: ${data.orderId}\nВ реальном приложении здесь будет редирект на платежную систему.`);
        navigate('/dashboard');
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.message}`);
      }
    } catch (error) {
      console.error('Purchase error:', error);
      alert('Произошла ошибка при покупке');
    } finally {
      setPurchasing(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    }).format(price);
  };

  const getPopularBadge = (periodDays: number) => {
    const months = periodDays / 30;
    return months === 6 ? (
      <div className="absolute -top-3 -right-3 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
        Популярный
      </div>
    ) : null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin">
            <Shield className="w-10 h-10 text-blue-500" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Выберите тарифный план
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Безопасный и быстрый VPN с серверами по всему миру. Защитите свою конфиденциальность уже сегодня.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="relative bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-slate-600 transition-all duration-300 group hover:shadow-2xl hover:shadow-blue-500/10"
            >
              {getPopularBadge(plan.periodDays)}

              <div className="text-center mb-8">
                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                <div className="text-3xl font-bold text-white mb-1">{formatPrice(plan.price)}</div>
                <p className="text-slate-400 text-sm">{plan.periodDays} дн.</p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center space-x-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-slate-300">
                    {plan.trafficMb ? `${plan.trafficMb} МБ трафика` : 'Безлимитный трафик'}
                </span>
              </div>
                {/* индивидуальные особенности плана не передаются */}
              </div>

              <button
                onClick={() => handlePurchase(plan.id)}
                disabled={purchasing === plan.id}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-blue-500/20"
              >
                {purchasing === plan.id ? 'Оформление...' : 'Купить план'}
              </button>

              <p className="text-slate-500 text-xs text-center mt-4">
                30 дней гарантия возврата средств
              </p>
            </div>
          ))}
        </div>

        <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl p-8 border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Все планы включают
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {commonFeatures.map((f) => {
              const Icon = ICONS[f.icon];
              return (
                <div key={f.title} className="text-center">
                  <div className={`bg-gradient-to-r ${f.gradient} p-4 rounded-xl w-16 h-16 mx-auto mb-4`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-slate-400">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
