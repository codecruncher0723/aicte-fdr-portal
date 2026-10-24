import React from 'react';
import { useRole, ROLES } from '../../context/RoleContext';

export default function RoleSwitcherModal() {
  const { isRoleModalOpen, setIsRoleModalOpen, currentRole, currentUser, logout } = useRole();

  if (!isRoleModalOpen || !currentUser) return null;

  const handleLogout = async () => {
    setIsRoleModalOpen(false);
    await logout();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-blue-700 text-[24px]">account_circle</span>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-slate-900">Authenticated Session Profile</span>
              <span className="text-[11px] text-slate-500">AICTE Regulatory Portal • JWT Protected</span>
            </div>
          </div>
          <button
            onClick={() => setIsRoleModalOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Current User Card */}
        <div className="p-6 flex flex-col gap-5">
          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-700 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-sm">
              {currentUser.name ? currentUser.name.split(' ').filter(n => !n.includes('.')).map(n => n[0]).slice(0, 2).join('') : 'AI'}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-slate-900">{currentUser.name}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  {currentUser.roleLabel}
                </span>
              </div>
              <span className="text-xs text-slate-600 font-medium mt-0.5">{currentUser.title}</span>
              <span className="text-[11px] text-slate-500 mt-0.5 truncate">{currentUser.department}</span>
              {currentUser.institution && (
                <span className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">domain</span>
                  {currentUser.institution} (PID: {currentUser.aictePid})
                </span>
              )}
            </div>
          </div>

          {/* Session Attributes Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-50 px-3.5 py-2 font-semibold text-slate-700 border-b border-slate-200">
              Security & Identity Parameters
            </div>
            <div className="divide-y divide-slate-100">
              <div className="px-3.5 py-2 flex justify-between">
                <span className="text-slate-500">Username / ID</span>
                <span className="font-mono font-medium text-slate-800">{currentUser.username} (ID: {currentUser.userId})</span>
              </div>
              <div className="px-3.5 py-2 flex justify-between">
                <span className="text-slate-500">Official Email</span>
                <span className="font-mono text-slate-800">{currentUser.email}</span>
              </div>
              <div className="px-3.5 py-2 flex justify-between">
                <span className="text-slate-500">Assigned Role</span>
                <span className="font-semibold text-blue-700">{currentUser.role}</span>
              </div>
              <div className="px-3.5 py-2 flex justify-between">
                <span className="text-slate-500">Institution Isolation</span>
                <span className="text-slate-800">{currentUser.institutionId ? `Scoped to Inst ID ${currentUser.institutionId}` : 'National Custody (Unrestricted)'}</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] text-amber-600 shrink-0 mt-0.5">info</span>
            <span>
              To switch roles or access another institution's account, sign out and authenticate using the respective credentials on the login screen.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => setIsRoleModalOpen(false)}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Sign Out & Switch Account</span>
          </button>
        </div>

      </div>
    </div>
  );
}
