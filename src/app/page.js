'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [registrationNo, setRegistrationNo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationNo, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-7xl flex flex-col lg:flex-row items-center justify-center gap-16 lg:gap-32">
        
        {/* Left Side: Campus Route Map Banner (Desktop only) */}
        <div className="hidden lg:flex flex-col justify-between w-full max-w-md h-[580px] bg-orange-500 text-white rounded-2xl p-8 shadow-lg">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
              <span className="text-xs font-bold tracking-widest uppercase">
                CAMPUS NAVIGATION
              </span>
            </div>
            <h2 className="text-2xl font-bold leading-snug">
              University Accessible Movement & Route Guide
            </h2>
            <p className="text-sm text-white/90 mt-2">
              Step-free pathways, verified ramps, and obstacle tracking across all campus academic blocks.
            </p>
          </div>

          {/* Campus Map Graphic */}
          <div className="bg-white rounded-xl p-4 shadow text-slate-800">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-3 px-1">
              <span>CAMPUS ACCESSIBILITY MAP</span>
              <span className="text-orange-500">● Step-Free Route</span>
            </div>

            <svg viewBox="0 0 360 210" className="w-full h-auto rounded-lg bg-slate-50 border border-slate-200">
              {/* Roads */}
              <rect x="0" y="95" width="360" height="24" fill="#e2e8f0" />
              <rect x="165" y="0" width="24" height="210" fill="#e2e8f0" />

              {/* Accessible Route */}
              <path
                d="M 30 107 L 177 107 L 177 40 L 310 40"
                fill="none"
                stroke="#16a34a"
                strokeWidth="5"
                strokeDasharray="8 4"
                strokeLinecap="round"
              />

              {/* Buildings */}
              <rect x="15" y="60" width="70" height="30" rx="4" fill="#1e293b" />
              <text x="50" y="79" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">Main Gate</text>

              <rect x="15" y="125" width="70" height="40" rx="4" fill="#334155" />
              <text x="50" y="149" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">Library</text>

              <rect x="200" y="25" width="135" height="35" rx="4" fill="#f97316" />
              <text x="267" y="47" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">Academic Block A</text>

              <rect x="200" y="130" width="135" height="50" rx="4" fill="#475569" />
              <text x="267" y="160" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">Student Center</text>

              {/* Route Markers */}
              <circle cx="30" cy="107" r="7" fill="#16a34a" />
              <circle cx="30" cy="107" r="3" fill="#ffffff" />

              <rect x="110" y="88" width="45" height="18" rx="4" fill="#16a34a" />
              <text x="132" y="101" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">♿ RAMP</text>

              <circle cx="310" cy="40" r="7" fill="#16a34a" />
              <circle cx="310" cy="40" r="3" fill="#ffffff" />
            </svg>

            <div className="flex items-center justify-between text-xs text-slate-500 mt-2 px-1">
              <span>Gate 1 ➔ Academic Block A</span>
              <span className="font-semibold text-green-700">100% Accessible (No Steps)</span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/20 text-xs text-white/90 flex items-center justify-between">
            <span>UNS Campus Mobility Portal</span>
            <span>Real-time Navigation</span>
          </div>
        </div>

        {/* Right Side: Login Card */}
        <div className="w-full max-w-md flex flex-col items-center">
          
          {/* Logo Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full border-2 border-slate-900 bg-white flex flex-col items-center justify-center shadow-sm">
              <svg viewBox="0 0 100 100" className="w-10 h-10 text-slate-900 fill-current">
                <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="4" />
                <path d="M50 8 L50 92 M8 50 L92 50 M20 20 L80 80 M20 80 L80 20" stroke="#f97316" strokeWidth="6" />
                <circle cx="50" cy="50" r="18" fill="#1e293b" />
              </svg>
              <span className="text-xs font-bold text-slate-900 uppercase">NAV</span>
            </div>

            <div>
              <div className="flex items-baseline">
                <span className="text-4xl font-extrabold text-orange-500">U</span>
                <span className="text-4xl font-extrabold text-slate-900">N</span>
                <span className="text-4xl font-extrabold text-slate-900">S</span>
              </div>
              <div className="border-t border-slate-300 pt-0.5">
                <span className="block text-xs font-bold tracking-widest text-slate-800 uppercase">
                  UNIVERSITY NAVIGATION SYSTEM
                </span>
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div className="w-full bg-white rounded-2xl shadow-lg p-8 sm:p-10 border border-slate-100">
            <h1 className="text-3xl font-semibold text-slate-800 mb-6">
              Log in
            </h1>

            {error && (
              <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Registration Input */}
              <div className="relative">
                <input
                  type="text"
                  required
                  value={registrationNo}
                  onChange={(e) => setRegistrationNo(e.target.value)}
                  placeholder="11111111"
                  className="w-full bg-blue-50 text-slate-900 py-3.5 pl-4 pr-12 rounded-xl outline-none focus:ring-2 focus:ring-blue-400 font-medium"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>

              {/* Password Input */}
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full bg-blue-50 text-slate-900 py-3.5 pl-4 pr-12 rounded-xl outline-none focus:ring-2 focus:ring-blue-400 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-600 hover:text-slate-800"
                >
                  {showPassword ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Login Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-lg rounded-xl shadow transition disabled:opacity-60"
                >
                  {loading ? 'Logging in...' : 'Login'}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
