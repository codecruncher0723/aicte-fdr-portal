import React from 'react';
import { useRole, ROLES } from '../../context/RoleContext';

export default function RoleSwitcherModal() {
  const { isRoleModalOpen, setIsRoleModalOpen, currentRole, switchRole, logout } = useRole();

  if (!isRoleModalOpen) return null;

  const roles = [
    {
      role: ROLES.INSTITUTION_OFFICER,
      label: 'Institution Officer',
      name: 'Dr. Anand Deshmukh',
      dept: "St. Xavier's Engineering College",
      icon: 'school',
      desc: 'Submit and manage institutional FDRs and own requests',
    },
    {
      role: ROLES.VERIFICATION_OFFICER,
      label: 'Verification Officer',
      name: 'Shri V. K. Malhotra',
      dept: 'AICTE Western Regional Office (WRO)',
      icon: 'verified',
      desc: 'Review submitted FDRs and check document completeness',
    },
    {
      role: ROLES.APPROVING_AUTHORITY,
      label: 'Approving Authority',
      name: 'Prof. Rajive Kumar',
      dept: 'AICTE Statutory Executive Council',
      icon: 'gavel',
      desc: 'Review referred cases, approve or reject within authority',
    },
    {
      role: ROLES.AICTE_ADMIN,
      label: 'Admin',
      name: 'Dr. R. K. Sridhar',
      dept: 'Central Regulatory Financial Custody Division',
      icon: 'admin_panel_settings',
      desc: 'Full visibility across regulatory registries and system governance',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest text-on-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-surface-container-high animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[22px]">switch_account</span>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-on-surface">Switch Account Role</span>
              <span className="text-[11px] text-secondary">Select an active role for this session</span>
            </div>
          </div>
          <button
            onClick={() => setIsRoleModalOpen(false)}
            className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
            title="Close"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Roles List */}
        <div className="p-4 flex flex-col gap-2">
          {roles.map((r) => {
            const isCurrent = currentRole === r.role;
            return (
              <button
                key={r.role}
                onClick={() => switchRole(r.role)}
                className={`w-full text-left p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                  isCurrent
                    ? 'border-primary bg-primary/10 text-on-surface shadow-xs ring-1 ring-primary'
                    : 'border-surface-container hover:border-surface-container-high hover:bg-surface-container text-on-surface'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isCurrent ? 'bg-primary text-on-primary' : 'bg-surface-container text-secondary'
                  }`}>
                    <span className="material-symbols-outlined text-[20px]">{r.icon}</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs truncate">{r.label}</span>
                      {isCurrent && (
                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-primary text-on-primary">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-secondary truncate mt-0.5">{r.name}</span>
                    <span className="text-[10px] text-secondary/80 line-clamp-1 mt-0.5">{r.desc}</span>
                  </div>
                </div>
                {isCurrent ? (
                  <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-1">check_circle</span>
                ) : (
                  <span className="material-symbols-outlined text-secondary/50 text-[18px] shrink-0 mt-1">chevron_right</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-surface-container-low border-t border-surface-container-high flex items-center justify-between text-xs">
          <button
            onClick={() => setIsRoleModalOpen(false)}
            className="px-3 py-1.5 rounded-lg font-semibold text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={logout}
            className="px-3 py-1.5 rounded-lg text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>

      </div>
    </div>
  );
}
