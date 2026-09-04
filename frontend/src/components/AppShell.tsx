import type { ReactNode } from 'react';
import { HelpCircle, Hexagon, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../lib/auth';

/**
 * The chrome: product mark on the left, account actions on the right, content
 * on a raised card. The indigo-to-purple ground is carried over from the
 * previous system.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const { student, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-100">
      <header className="bg-white/80 backdrop-blur border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <Hexagon className="h-4 w-4 text-white" />
            </span>
            <span className="font-semibold text-gray-800">
              Design Thinking System
            </span>
          </div>

          <div className="flex items-center gap-4 text-gray-500">
            {student && (
              <span className="hidden sm:inline text-sm text-gray-600">
                {student.fullName}
                <span className="text-gray-400"> · {student.studentId}</span>
              </span>
            )}
            <button
              type="button"
              aria-label="Help"
              className="hover:text-violet-600 transition-colors"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Settings"
              className="hover:text-violet-600 transition-colors"
            >
              <Settings className="h-5 w-5" />
            </button>
            {student && (
              <button
                type="button"
                onClick={signOut}
                aria-label="Sign out"
                title="Sign out"
                className="hover:text-violet-600 transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
