import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, tokenStore, type Student } from './api';
import { resetSocket } from './socket';

interface AuthValue {
  student: Student | null;
  loading: boolean;
  signIn: (studentId: string, fullName: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on load. The token is the identity, so nothing else
  // needs to be kept in storage — and a stale one is discarded rather than
  // trusted.
  useEffect(() => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((r) => setStudent(r.student))
      .catch(() => {
        tokenStore.clear();
        setStudent(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (studentId: string, fullName: string) => {
    const { token, student: signedIn } = await api.signIn(studentId, fullName);
    tokenStore.set(token);
    setStudent(signedIn);
  }, []);

  const signOut = useCallback(() => {
    tokenStore.clear();
    // Drop the live connection too. On a shared machine the next student
    // would otherwise inherit a socket authenticated as the previous one.
    resetSocket();
    setStudent(null);
  }, []);

  const value = useMemo(
    () => ({ student, loading, signIn, signOut }),
    [student, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
