import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface PartnerLevel {
  id: number;
  name: string;
  commission_percent: number;
  min_sales_amount: number;
  min_referrals_count: number;
  is_active: boolean;
}

interface PartnerLevelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function PartnerLevelsModal({ isOpen, onClose, onSave }: PartnerLevelsModalProps) {
  const [levels, setLevels] = useState<PartnerLevel[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchLevels();
    }
  }, [isOpen]);

  const fetchLevels = async () => {
    try {
      const response = await fetch('/api/admin/partner-levels');
      if (response.ok) {
        const data = await response.json();
        setLevels(data);
      }
    } catch (error) {
      console.error('Failed to fetch partner levels:', error);
    }
  };

  const updateLevel = (
    id: number,
    field: keyof PartnerLevel,
    value: string | number | boolean,
  ) => {
    setLevels(levels.map(level => 
      level.id === id ? { ...level, [field]: value } : level
    ));
  };

  const saveChanges = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/partner-levels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ levels }),
      });

      if (response.ok) {
        onSave();
        onClose();
      } else {
        alert('Ошибка при сохранении уровней');
      }
    } catch (error) {
      console.error('Failed to save levels:', error);
      alert('Ошибка при сохранении уровней');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Настройка уровней партнеров</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-4">
            {levels.map((level) => (
              <div key={level.id} className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Название
                    </label>
                    <input
                      type="text"
                      value={level.name}
                      onChange={(e) => updateLevel(level.id, 'name', e.target.value)}
                      className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-white text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Комиссия (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={level.commission_percent}
                      onChange={(e) => updateLevel(level.id, 'commission_percent', parseFloat(e.target.value))}
                      className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-white text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Мин. продажи
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={level.min_sales_amount}
                      onChange={(e) => updateLevel(level.id, 'min_sales_amount', parseInt(e.target.value))}
                      className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-white text-sm"
                    />
                    <div className="text-xs text-slate-400 mt-1">
                      {formatCurrency(level.min_sales_amount)}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Мин. рефералы
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={level.min_referrals_count}
                      onChange={(e) => updateLevel(level.id, 'min_referrals_count', parseInt(e.target.value))}
                      className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-white text-sm"
                    />
                  </div>
                  
                  <div className="flex items-center justify-center">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={level.is_active}
                        onChange={(e) => updateLevel(level.id, 'is_active', e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-12 h-6 rounded-full transition-colors ${
                        level.is_active ? 'bg-green-500' : 'bg-slate-600'
                      }`}>
                        <div className={`w-5 h-5 bg-white rounded-full transition-transform transform ${
                          level.is_active ? 'translate-x-6' : 'translate-x-0.5'
                        } mt-0.5`} />
                      </div>
                      <span className="ml-2 text-sm text-slate-300">
                        {level.is_active ? 'Активен' : 'Отключен'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex space-x-3 p-6 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-600 hover:bg-slate-500 text-white py-2 px-4 rounded-lg transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={saveChanges}
            disabled={loading}
            className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Сохранение...' : 'Сохранить изменения'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
