import type { ReactNode } from 'react';
import { HelpCircle, Hexagon, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../lib/auth';

/**
 * The chrome from the mockup: product mark on the left, help and settings on
 * the right, content on a card below.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const { student, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
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
            <button type="button" aria-label="Help" className="hover:text-gray-700">
              <HelpCircle className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Settings"
              className="hover:text-gray-700"
            >
              <Settings className="h-5 w-5" />
            </button>
            {student && (
              <button
                type="button"
                onClick={signOut}
                aria-label="Sign out"
                title="Sign out"
                className="hover:text-gray-700"
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
