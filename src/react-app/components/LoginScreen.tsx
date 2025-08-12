import { useAuth } from '@/auth';
import { Shield, Lock, Globe, Zap } from 'lucide-react';
import { useState } from 'react';

export default function LoginScreen() {
  const { login, isFetching } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 rounded-2xl w-16 h-16 mx-auto mb-6">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">SecureLink VPN</h1>
          <p className="text-slate-400">Безопасный и быстрый VPN-сервис</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700">
          <div className="space-y-6 mb-8">
            <div className="flex items-center space-x-3">
              <Lock className="w-5 h-5 text-blue-400" />
              <span className="text-slate-300">Военная шифрование</span>
            </div>
            <div className="flex items-center space-x-3">
              <Globe className="w-5 h-5 text-purple-400" />
              <span className="text-slate-300">Серверы по всему миру</span>
            </div>
            <div className="flex items-center space-x-3">
              <Zap className="w-5 h-5 text-green-400" />
              <span className="text-slate-300">Высокая скорость</span>
            </div>
          </div>

          <form onSubmit={handlePasswordLogin} className="space-y-4 mb-6">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              disabled={isFetching}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              {isFetching ? 'Загрузка...' : 'Войти'}
            </button>
          </form>

          <p className="text-slate-500 text-xs text-center mt-4">
            Нажимая "Войти", вы соглашаетесь с условиями использования
          </p>

          <p className="text-slate-400 text-center mt-4">
            Нет аккаунта? <a href="/register" className="text-blue-500 hover:underline">Зарегистрируйтесь</a>
          </p>
        </div>
      </div>
    </div>
  );
}
