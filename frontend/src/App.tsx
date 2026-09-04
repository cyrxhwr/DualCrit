import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import SignIn from './pages/SignIn';
import Dashboard from './pages/Dashboard';
import ActivityRoom from './pages/ActivityRoom';

export default function App() {
  const { student, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  if (!student) return <SignIn />;

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/activity/:id" element={<ActivityRoom />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
