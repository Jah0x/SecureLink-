import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

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

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan?: VpnPlan | null;
  onSave: (plan: VpnPlanForm) => void;
}

export default function PlanModal({ isOpen, onClose, plan, onSave }: PlanModalProps) {
  const [formData, setFormData] = useState<VpnPlanForm>({
    name: '',
    duration_months: 1,
    price_rub: 0,
    data_limit_gb: null,
    max_connections: 5,
    description: '',
    is_active: true
  });

  useEffect(() => {
    if (plan) {
      setFormData({ ...plan });
    } else {
      setFormData({
        name: '',
        duration_months: 1,
        price_rub: 0,
        data_limit_gb: null,
        max_connections: 5,
        description: '',
        is_active: true
      });
    }
  }, [plan]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Описание
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Срок (месяцев)
              </label>
              <input
                type="number"
                min="1"
                value={formData.duration_months}
                onChange={(e) => setFormData({ ...formData, duration_months: parseInt(e.target.value) })}
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
                value={formData.price_rub}
                onChange={(e) => setFormData({ ...formData, price_rub: parseInt(e.target.value) })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Лимит трафика (ГБ)
              </label>
              <input
                type="number"
                min="0"
                value={formData.data_limit_gb || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  data_limit_gb: e.target.value ? parseInt(e.target.value) : null 
                })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Безлимит"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Макс. подключений
              </label>
              <input
                type="number"
                min="1"
                value={formData.max_connections}
                onChange={(e) => setFormData({ ...formData, max_connections: parseInt(e.target.value) })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-slate-300">
              Активный план
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
