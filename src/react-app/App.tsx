import { BrowserRouter as Router, Routes, Route } from "react-router";
import { AuthProvider } from '@/auth';
import HomePage from "@/react-app/pages/Home";
import Dashboard from "@/react-app/pages/Dashboard";
import Pricing from "@/react-app/pages/Pricing";
import Earnings from "@/react-app/pages/Earnings";
import Subscription from '@/react-app/pages/Subscription'
import Admin from "@/react-app/pages/Admin";
import { ErrorBoundary } from "@/react-app/components/ErrorBoundary";
import Register from "@/react-app/pages/Register";
import Privacy from "@/pages/privacy";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<HomePage />} />
          <Route path="/auth" element={<HomePage />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
<Route path="/subscription" element={<Subscription />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/admin" element={<ErrorBoundary><Admin /></ErrorBoundary>} />
          <Route path="/privacy" element={<Privacy />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
