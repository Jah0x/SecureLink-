import { BrowserRouter as Router, Routes, Route } from "react-router";
import { AuthProvider } from '@/auth';
import HomePage from "@/react-app/pages/Home";
import Dashboard from "@/react-app/pages/Dashboard";
import Pricing from "@/react-app/pages/Pricing";
import Earnings from "@/react-app/pages/Earnings";
import Admin from "@/react-app/pages/Admin";
import Register from "@/react-app/pages/Register";

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
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
