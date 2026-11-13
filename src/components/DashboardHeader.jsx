'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardHeader({ user }) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-baseline">
            <span className="font-extrabold text-2xl text-orange-500">U</span>
            <span className="font-extrabold text-2xl text-slate-900">NS</span>
          </Link>
          <span className="text-xs text-slate-500 font-semibold tracking-wider uppercase border-l border-slate-300 pl-3 hidden sm:inline">
            University Navigation System
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">
            Reg No: <strong className="text-slate-800 font-mono">{user?.registrationNo || '11111111'}</strong>
          </span>
          {user?.role && (
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              {user.role === 'estate_staff' ? 'Estate Staff' : 'Student'}
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}

