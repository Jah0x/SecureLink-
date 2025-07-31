import { useState, useEffect } from 'react';
import { useAuth } from '@/auth';
import { Link, useLocation } from 'react-router';
import { Shield, LogOut, User, Settings, ShoppingCart } from 'lucide-react';

export default function AdminHeader() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setAdminCheckLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/admin/check');
        setIsAdmin(response.ok);
      } catch (error) {
        console.error('Admin check failed:', error);
        setIsAdmin(false);
      } finally {
        setAdminCheckLoading(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  return (
    <header className="bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/dashboard" className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">SecureLink VPN</h1>
              <p className="text-xs text-slate-400">Личный кабинет</p>
            </div>
          </Link>
          
          {user && (
            <div className="flex items-center space-x-4">
              <nav className="hidden md:flex items-center space-x-1">
                <Link
                  to="/dashboard"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === '/dashboard'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  Главная
                </Link>
                <Link
                  to="/pricing"
                  className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === '/pricing'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Тарифы</span>
                </Link>
                {!adminCheckLoading && isAdmin && (
                  <Link
                    to="/admin"
                    className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname === '/admin'
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span>Админ</span>
                  </Link>
                )}
              </nav>
              
              <div className="flex items-center space-x-2 text-slate-300">
                <User className="w-4 h-4" />
                <span className="text-sm">{user.google_user_data?.name || user.email}</span>
              </div>
              <button
                onClick={logout}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Выйти</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
