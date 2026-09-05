import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import Logo from '../components/Logo';

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
    <div className="app-bg min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm fade-in">
        <div className="flex justify-center mb-7">
          <Logo size="lg" />
        </div>

        <form onSubmit={onSubmit} className="card p-7">
          <h1 className="text-lg font-semibold text-gray-900 mb-5">Sign in</h1>

          <label
            htmlFor="studentId"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Student ID
          </label>
          <input
            id="studentId"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
            autoComplete="username"
            placeholder="202XXXXX"
            className="field mb-4"
          />

          <label
            htmlFor="fullName"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Full name
          </label>
          <input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
            placeholder="Juan Dela Cruz"
            className="field mb-5"
          />

          {error && (
            <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn btn-primary w-full py-2.5"
          >
            {busy ? 'Signing in…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
