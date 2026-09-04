import { useState, type FormEvent } from 'react';
import { Hexagon } from 'lucide-react';
import { useAuth } from '../lib/auth';

export default function SignIn() {
  const { signIn } = useAuth();
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(studentId.trim(), fullName.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-100 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <Hexagon className="h-5 w-5 text-white" />
          </span>
          <span className="font-semibold text-lg text-gray-800">
            Design Thinking System
          </span>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 fade-in"
        >
          <h1 className="text-lg font-semibold text-gray-800 mb-1">Sign in</h1>
          <p className="text-sm text-gray-500 mb-5">
            Your work is saved to your student ID.
          </p>

          <label
            htmlFor="studentId"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Student ID
          </label>
          <input
            id="studentId"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
            autoComplete="username"
            placeholder="20260001"
            className="w-full mb-4 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />

          <label
            htmlFor="fullName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Full name
          </label>
          <input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
            placeholder="Renz Samuel Gutierrez"
            className="w-full mb-5 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />

          {error && (
            <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-violet-600 text-white rounded-lg py-2.5 font-semibold hover:bg-violet-700 disabled:opacity-60 btn-lift shadow-sm"
          >
            {busy ? 'Signing in…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
