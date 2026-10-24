import React, { useState } from 'react';
import AicteLogo from '../components/common/AicteLogo';

export default function LoginPage({ onLoginSuccess }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState(null);

  const DEMO_PERSONAS = [
    {
      role: 'AICTE_ADMIN',
      label: 'AICTE Admin',
      name: 'Dr. R. K. Sridhar',
      title: 'Joint Director - Finance, HQ New Delhi',
      username: 'admin_sridhar',
      password: 'AdminDemo@2026',
      badge: 'Central Custody',
      color: 'border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-blue-900',
    },
    {
      role: 'INSTITUTION_OFFICER_A',
      label: "Institution Officer (St. Xavier's)",
      name: 'Dr. Anand Deshmukh',
      title: 'Secretary / Trustee (PID: 1-10928374)',
      username: 'officer_deshmukh',
      password: 'OfficerDemo@2026',
      badge: 'College A (WRO)',
      color: 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-900',
    },
    {
      role: 'INSTITUTION_OFFICER_B',
      label: 'Institution Officer (Bharati Vidyapeeth)',
      name: 'Dr. K. S. Venkatesh',
      title: 'Principal / Authorized Officer (PID: 1-28374619)',
      username: 'officer_venkatesh',
      password: 'OfficerDemo@2026',
      badge: 'College B (WRO)',
      color: 'border-teal-200 bg-teal-50/50 hover:bg-teal-50 text-teal-900',
    },
    {
      role: 'VERIFICATION_OFFICER',
      label: 'Verification Officer',
      name: 'Shri V. K. Malhotra',
      title: 'Regional Scrutiny Officer, WRO',
      username: 'verif_malhotra',
      password: 'VerifDemo@2026',
      badge: 'Scrutiny Desk',
      color: 'border-amber-200 bg-amber-50/50 hover:bg-amber-50 text-amber-900',
    },
    {
      role: 'APPROVING_AUTHORITY',
      label: 'Approving Authority',
      name: 'Prof. Rajive Kumar',
      title: 'Member Secretary, AICTE Executive Council',
      username: 'approver_kumar',
      password: 'ApproverDemo@2026',
      badge: 'Statutory Council',
      color: 'border-purple-200 bg-purple-50/50 hover:bg-purple-50 text-purple-900',
    },
  ];

  const validate = () => {
    const errs = {};
    if (!identifier.trim()) {
      errs.identifier = 'Username or email address is required';
    }
    if (!password) {
      errs.password = 'Password is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSelectPersona = (persona) => {
    setIdentifier(persona.username);
    setPassword(persona.password);
    setAuthError(null);
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onLoginSuccess({
        username: identifier.includes('@') ? null : identifier.trim(),
        email: identifier.includes('@') ? identifier.trim() : null,
        password,
      });
    } catch (err) {
      console.error('Login failed:', err);
      setAuthError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/30 flex flex-col justify-between text-slate-800 font-sans">
      {/* Top Government Tricolor Stripe */}
      <div className="w-full h-1.5 bg-gradient-to-r from-orange-500 via-white to-green-600 shadow-xs"></div>

      {/* Main Header Bar */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AicteLogo className="w-11 h-11 shrink-0 drop-shadow-xs" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-slate-900 tracking-tight leading-none">
                अखिल भारतीय तकनीकी शिक्षा परिषद
              </span>
              <span className="hidden sm:inline-block text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-semibold">
                Govt. of India
              </span>
            </div>
            <span className="text-xs text-slate-600 font-medium tracking-tight mt-0.5">
              All India Council for Technical Education
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3 text-right">
          <div className="flex flex-col text-xs text-slate-500">
            <span className="font-semibold text-slate-700">National Regulatory Portal</span>
            <span className="text-[11px]">Regulation 14(B) Lien Management</span>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
        </div>
      </header>

      {/* Center Body */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Portal Overview & Credentials Guide */}
          <div className="lg:col-span-5 flex flex-col gap-6 order-2 lg:order-1">
            <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-2">
                <span className="material-symbols-outlined text-[18px] text-blue-700">verified_user</span>
                <span>Statutory Compliance Architecture</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 leading-snug">
                AICTE Fixed Deposit Receipt (FDR) Regulatory Custody Portal
              </h2>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                A secure tripartite system for technical institutions, core banking verification officers, and the AICTE Executive Council to register, scrutinize, and endorse statutory security deposits.
              </p>

              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs text-slate-700">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-[18px] shrink-0 mt-0.5">shield</span>
                  <div>
                    <span className="font-semibold block text-slate-900">RBAC Security</span>
                    <span className="text-[11px] text-slate-500">Role-scoped cryptographic JWT authorization</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0 mt-0.5">lock</span>
                  <div>
                    <span className="font-semibold block text-slate-900">Institution Isolation</span>
                    <span className="text-[11px] text-slate-500">Zero cross-tenant IDOR access</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Evaluation Personas / Quick-Fill Chips */}
            <div className="bg-white/90 backdrop-blur-md rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-amber-600 text-[16px]">key</span>
                  Quick Sign-In Personas (Demo)
                </span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                  One-Click Fill
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {DEMO_PERSONAS.map((persona) => (
                  <button
                    key={persona.username}
                    type="button"
                    onClick={() => handleSelectPersona(persona)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${persona.color}`}
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate">{persona.label}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-white/70 border border-current/20">
                          {persona.badge}
                        </span>
                      </div>
                      <span className="text-[11px] opacity-80 truncate">{persona.name} • {persona.username}</span>
                    </div>
                    <span className="material-symbols-outlined text-[16px] opacity-70 shrink-0">arrow_forward</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Secure Login Card */}
          <div className="lg:col-span-7 w-full order-1 lg:order-2">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl shadow-slate-200/50 relative overflow-hidden">
              {/* Subtle top card accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-700"></div>

              <div className="mb-6">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-semibold mb-2">
                  <span className="material-symbols-outlined text-[14px]">lock</span>
                  <span>Single Sign-On (SSO) & Regulatory Auth</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Sign In to AICTE Portal
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Enter your assigned username or official institutional email to proceed.
                </p>
              </div>

              {/* Error Alert Banner */}
              {authError && (
                <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                  <span className="material-symbols-outlined text-[18px] text-red-600 shrink-0 mt-0.5">error</span>
                  <div className="flex flex-col">
                    <span className="font-bold">Authentication Failed</span>
                    <span className="mt-0.5 text-red-700">{authError}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4.5" noValidate>
                {/* Username / Email Field */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Username or Official Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                      person
                    </span>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        if (errors.identifier) setErrors((prev) => ({ ...prev, identifier: null }));
                      }}
                      placeholder="e.g. officer_deshmukh or admin_sridhar"
                      autoComplete="username"
                      disabled={isSubmitting}
                      className={`w-full h-11 pl-10 pr-4 bg-slate-50 border rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                        errors.identifier
                          ? 'border-red-300 focus:ring-red-200 focus:border-red-500 bg-red-50/20'
                          : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                      }`}
                    />
                  </div>
                  {errors.identifier && (
                    <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">info</span>
                      {errors.identifier}
                    </p>
                  )}
                </div>

                {/* Password Field with Show/Hide Toggle */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] text-blue-700 hover:underline cursor-pointer">
                      Forgot password?
                    </span>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                      lock
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                      }}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      disabled={isSubmitting}
                      className={`w-full h-11 pl-10 pr-11 bg-slate-50 border rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                        errors.password
                          ? 'border-red-300 focus:ring-red-200 focus:border-red-500 bg-red-50/20'
                          : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">info</span>
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* Session Persistence Checkbox */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Remember active session on this workstation</span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 mt-2 rounded-xl bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-bold text-xs shadow-md shadow-blue-700/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Verifying Regulatory Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Regulatory Workspace</span>
                      <span className="material-symbols-outlined text-[16px]">login</span>
                    </>
                  )}
                </button>
              </form>

              {/* Statutory Legal Disclaimer Notice */}
              <div className="mt-6 pt-5 border-t border-slate-100 flex items-start gap-2.5 text-[10px] text-slate-500 leading-normal">
                <span className="material-symbols-outlined text-[16px] text-amber-600 shrink-0 mt-0.5">gavel</span>
                <span>
                  <strong>Statutory Notice:</strong> This is a secure Government of India computing system. Unauthorized access or data manipulation is prohibited and subject to legal prosecution under Sections 43, 65, and 66 of the IT Act, 2000. All activities and IP telemetry are audited.
                </span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 border-t border-slate-200/80 bg-white/50 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 All India Council for Technical Education (AICTE). All Rights Reserved.</span>
          <span className="text-[11px] text-slate-400">Version 1.0.0 (Phase 1–4 Production Build) • NIC / Finacle Linked</span>
        </div>
      </footer>
    </div>
  );
}
