import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface VpnPlan {
  id: number;
  name: string;
  price_cents: number;
  periodDays: number;
  trafficMb: number | null;
  active: boolean;
  is_demo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface VpnPlanForm {
  id?: number;
  name: string;
  price_cents: number;
  periodDays: number;
  trafficMb: number | null;
  active: boolean;
  is_demo: boolean;
}

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan?: VpnPlan | null;
  onSave: (plan: VpnPlanForm) => void;
}

export default function PlanModal({ isOpen, onClose, plan, onSave }: PlanModalProps) {
  const [formData, setFormData] = useState<VpnPlanForm>({
    name: '',
    price_cents: 0,
    periodDays: 30,
    trafficMb: null,
    active: true,
    is_demo: false,
  });

  useEffect(() => {
    if (plan) {
      setFormData({
        id: plan.id,
        name: plan.name,
        price_cents: plan.price_cents,
        periodDays: plan.periodDays,
        trafficMb: plan.trafficMb,
        active: plan.active,
        is_demo: plan.is_demo,
      })
    } else {
      setFormData({
        name: '',
        price_cents: 0,
        periodDays: 30,
        trafficMb: null,
        active: true,
        is_demo: false,
      })
    }
  }, [plan]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.length < 1 || formData.name.length > 100) {
      alert('Название должно быть от 1 до 100 символов');
      return;
    }
    if (!formData.is_demo && formData.price_cents <= 0) {
      alert('Цена должна быть больше 0');
      return;
    }
    if (formData.periodDays < 1) {
      alert('Период должен быть не менее 1 дня');
      return;
    }
    if (formData.trafficMb != null && formData.trafficMb < 0) {
      alert('Лимит трафика должен быть 0 или больше');
      return;
    }
    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">
            {plan ? 'Редактировать план' : 'Добавить план'}
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
              Название плана
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Период (дней)
              </label>
              <input
                type="number"
                min="1"
                value={formData.periodDays}
                onChange={(e) => setFormData({ ...formData, periodDays: parseInt(e.target.value) })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Цена (руб.)
              </label>
              <input
                type="number"
                min="0"
                value={formData.price_cents / 100}
                onChange={(e) =>
                  setFormData({ ...formData, price_cents: Math.round(parseFloat(e.target.value) * 100) })
                }
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={formData.is_demo}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Лимит трафика (МБ)
            </label>
            <input
              type="number"
              min="0"
              value={formData.trafficMb ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  trafficMb: e.target.value ? parseInt(e.target.value) : null,
                })
              }
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Безлимит"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-slate-300">
              Активный план
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_demo"
              checked={formData.is_demo}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  is_demo: e.target.checked,
                  price_cents: e.target.checked ? 0 : formData.price_cents,
                })
              }
              className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_demo" className="ml-2 text-sm text-slate-300">
              Демо-тариф
            </label>
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
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors"
            >
              {plan ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
