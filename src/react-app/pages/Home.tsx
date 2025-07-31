import { useAuth } from '@/auth';
import LoginScreen from '@/react-app/components/LoginScreen';
import Dashboard from '@/react-app/pages/Dashboard';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, isPending } = useAuth();

  if (isPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin">
          <Loader2 className="w-10 h-10 text-blue-500" />
        </div>
      </div>
    );
  }

  return user ? <Dashboard /> : <LoginScreen />;
}
