import type { ReactNode } from 'react';
import { HelpCircle, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth';
import Logo from './Logo';

/**
 * The chrome: product mark on the left, account actions on the right, content
 * on a raised card over the washed ground.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const { student, signOut } = useAuth();

  return (
    <div className="app-bg min-h-screen">
      <header className="sticky top-0 z-10 bg-white/70 backdrop-blur-md border-b border-gray-900/[0.06]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />

          <div className="flex items-center gap-2">
            {student && (
              <span className="hidden sm:flex items-center gap-2 text-sm bg-white rounded-full pl-3 pr-1.5 py-1 outline outline-1 -outline-offset-1 outline-gray-900/10">
                <span className="text-gray-700">{student.fullName}</span>
                <span className="text-[11px] font-medium text-violet-700 bg-violet-50 rounded-full px-2 py-0.5">
                  {student.studentId}
                </span>
              </span>
            )}
            <button
              type="button"
              aria-label="Help"
              className="p-2 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
            {student && (
              <button
                type="button"
                onClick={signOut}
                aria-label="Sign out"
                title="Sign out"
                className="p-2 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
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
