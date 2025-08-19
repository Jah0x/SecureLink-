import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

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

interface GiveSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  userEmail: string;
  onGive: (userId: number, planId: number) => void;
}

export default function GiveSubscriptionModal({ 
  isOpen, 
  onClose, 
  userId, 
  userEmail, 
  onGive 
}: GiveSubscriptionModalProps) {
  const [plans, setPlans] = useState<VpnPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
    }
  }, [isOpen]);

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/admin/plans?active=1');
      if (response.ok) {
        const data = await response.json();
        setPlans(data);
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) return;
    
    setLoading(true);
    try {
      await onGive(userId, selectedPlanId);
      onClose();
    } catch (error) {
      console.error('Failed to give subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    }).format(price);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">
            Выдать подписку
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Пользователь
            </label>
            <div className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-300">
              {userEmail}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Выберите план
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {plans.map((plan) => (
                <label
                  key={plan.id}
                  className={`block cursor-pointer p-3 rounded-lg border transition-colors ${
                    selectedPlanId === plan.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-600 hover:border-slate-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value={plan.id}
                    checked={selectedPlanId === plan.id}
                    onChange={() => setSelectedPlanId(plan.id)}
                    className="sr-only"
                  />
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-white font-medium">{plan.name}</div>
                      <div className="text-slate-300 text-sm mt-1">
                        {plan.periodDays} дн. • {plan.trafficMb ? `${plan.trafficMb} МБ` : 'Безлимит'}
                      </div>
                    </div>
                    <div className="text-blue-400 font-semibold">
                      {formatPrice(plan.price)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-600 hover:bg-slate-500 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!selectedPlanId || loading}
              className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors"
            >
              {loading ? 'Выдача...' : 'Выдать подписку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
