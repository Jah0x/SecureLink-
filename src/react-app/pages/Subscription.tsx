import { useAuth } from '@/auth';
import Header from '@/react-app/components/Header';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/react-app/api';

export default function SubscriptionPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<any | null>(null);
  const [link, setLink] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/subs/status?login=${encodeURIComponent(user?.email || '')}`);
      if (res.ok) setStatus(await res.json());
      else setStatus(null);
    } catch (e) {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const doAssign = async () => { await apiFetch('/api/subs/assign', { method: 'POST', body: JSON.stringify({ login: user?.email }) }); await refresh(); };
  const doReassign = async () => { await apiFetch('/api/subs/reassign', { method: 'POST', body: JSON.stringify({ login: user?.email }) }); await refresh(); };
  const doRevoke = async () => { await apiFetch('/api/subs/revoke', { method: 'POST', body: JSON.stringify({ login: user?.email }) }); await refresh(); };
  const getLink = async () => { const txt = await apiFetch(`/api/subs/link?login=${encodeURIComponent(user?.email || '')}&fmt=plain`); setLink(txt as string); };
  const getQr = async () => { const res = await fetch(`/api/subs/qrcode?login=${encodeURIComponent(user?.email || '')}`); const blob = await res.blob(); setQr(URL.createObjectURL(blob)); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8 text-white">
        <h1 className="text-2xl font-bold mb-4">Подписка</h1>
        {loading ? (
          <p>Загрузка...</p>
        ) : status ? (
          <div className="space-y-4">
            <p>UID: {status.uid}</p>
            <p>Выдана: {status.createdAt || status.issued_at}</p>
            <p>Активна: {String(status.active ?? true)}</p>
            <div className="space-x-2">
              <button onClick={doReassign} className="bg-blue-600 px-3 py-2 rounded">Перевыдать</button>
              <button onClick={doRevoke} className="bg-red-600 px-3 py-2 rounded">Отозвать</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p>Нет активной подписки</p>
            <button onClick={doAssign} className="bg-green-600 px-3 py-2 rounded">Выдать</button>
          </div>
        )}
        <div className="mt-6 space-y-2">
          <button onClick={getLink} className="bg-slate-700 px-3 py-2 rounded">Скопировать ссылку</button>
          {link && (<p className="break-all text-slate-300">{link}</p>)}
          <button onClick={getQr} className="bg-slate-700 px-3 py-2 rounded">Показать QR</button>
          {qr && (<img src={qr} alt="QR" className="mt-2" />)}
        </div>
      </main>
    </div>
  );
}
