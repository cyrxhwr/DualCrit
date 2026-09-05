import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import Logo from '../components/Logo';

/** Eight digits, the first four being the year the student entered school. */
const STUDENT_ID = /^\d{8}$/;

export default function SignIn() {
  const { signIn } = useAuth();
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Which fields the student has left, so an untouched form is not scolded
  // for being empty before they have had a chance to fill it in.
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const idValid = STUDENT_ID.test(studentId);
  const nameValid = fullName.trim().length > 0;
  const idProblem =
    touched.studentId && !idValid
      ? studentId.length === 0
        ? 'Enter your student ID'
        : 'Student ID must be exactly 8 digits'
      : null;
  const nameProblem =
    touched.fullName && !nameValid ? 'Enter your full name' : null;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched({ studentId: true, fullName: true });
    if (!idValid || !nameValid) return;

    setError(null);
    setBusy(true);
    try {
      await signIn(studentId, fullName.trim());
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

        <form onSubmit={onSubmit} noValidate className="card p-7">
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
            // Digits only as they type, so a stray space or dash never
            // becomes an error message they have to read and act on.
            onChange={(e) =>
              setStudentId(e.target.value.replace(/\D/g, '').slice(0, 8))
            }
            onBlur={() => setTouched((t) => ({ ...t, studentId: true }))}
            inputMode="numeric"
            autoComplete="username"
            placeholder="202XXXXX"
            aria-invalid={idProblem ? true : undefined}
            aria-describedby={idProblem ? 'studentId-problem' : undefined}
            className="field"
          />
          <p
            id="studentId-problem"
            className={`text-xs mt-1.5 mb-4 ${
              idProblem ? 'text-red-600' : 'text-gray-400'
            }`}
          >
            {idProblem ?? '8 digits'}
          </p>

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
            onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
            autoComplete="name"
            placeholder="Juan Dela Cruz"
            aria-invalid={nameProblem ? true : undefined}
            aria-describedby={nameProblem ? 'fullName-problem' : undefined}
            className="field"
          />
          <p
            id="fullName-problem"
            className={`text-xs mt-1.5 mb-5 text-red-600 ${
              nameProblem ? '' : 'invisible'
            }`}
          >
            {nameProblem ?? ' '}
          </p>

          {error && <p className="note note-error mb-4">{error}</p>}

          <button
            type="submit"
            disabled={busy || !idValid || !nameValid}
            className="btn btn-primary w-full py-2.5"
          >
            {busy ? 'Signing in…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
