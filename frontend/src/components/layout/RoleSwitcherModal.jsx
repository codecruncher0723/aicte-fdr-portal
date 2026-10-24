import React from 'react';
import { useRole, ROLES, DEMO_USERS } from '../../context/RoleContext';

export default function RoleSwitcherModal() {
  const { isRoleModalOpen, setIsRoleModalOpen, currentRole, switchRole } = useRole();

  if (!isRoleModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-xl overflow-hidden border border-surface-container animate-in fade-in zoom-in-95 duration-150">
        <div className="px-space-lg py-space-md bg-surface-container-low border-b border-surface-container flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">switch_account</span>
            <div className="flex flex-col">
              <span className="font-headline-sm text-base font-bold text-on-surface">Switch User Role & Persona</span>
              <span className="font-label-sm text-xs text-on-surface-variant">24-Hour Hackathon RBAC Role Switcher</span>
            </div>
          </div>
          <button
            onClick={() => setIsRoleModalOpen(false)}
            className="p-1.5 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-space-lg flex flex-col gap-3">
          <p className="font-body-sm text-xs text-secondary mb-1">
            Toggle between the 4 authorized roles to experience the portal from each stakeholder's perspective:
          </p>

          {Object.entries(DEMO_USERS).map(([roleKey, user]) => {
            const isSelected = currentRole === roleKey;
            return (
              <div
                key={roleKey}
                onClick={() => switchRole(roleKey)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'border-primary bg-primary-container/10 ring-1 ring-primary shadow-xs'
                    : 'border-surface-container-high bg-surface-container-low/40 hover:bg-surface-container-low hover:border-surface-container'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    isSelected ? 'bg-primary text-on-primary' : 'bg-surface-container text-secondary'
                  }`}>
                    <span className="material-symbols-outlined text-[20px]">
                      {roleKey === ROLES.AICTE_ADMIN ? 'admin_panel_settings' :
                       roleKey === ROLES.INSTITUTION_OFFICER ? 'account_balance' :
                       roleKey === ROLES.VERIFICATION_OFFICER ? 'verified' : 'gavel'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-headline-sm text-sm font-bold text-on-surface">
                        {user.roleLabel}
                      </span>
                      <span className="font-label-sm text-[10px] px-2 py-0.2 rounded-full font-semibold bg-surface-container text-secondary">
                        {user.roleBadge}
                      </span>
                      {isSelected && (
                        <span className="font-label-sm text-[10px] bg-primary text-on-primary px-2 py-0.2 rounded-full font-bold">
                          Current
                        </span>
                      )}
                    </div>
                    <span className="font-label-md text-xs font-semibold text-primary mt-0.5">
                      {user.name} <span className="font-normal text-secondary">• {user.title}</span>
                    </span>
                    <span className="font-body-sm text-[11px] text-secondary mt-0.5">
                      {roleKey === ROLES.AICTE_ADMIN && 'National monitoring, master FDR registry, maturity tracking, notice dispatch.'}
                      {roleKey === ROLES.INSTITUTION_OFFICER && 'College portfolio management, Form L-1 resubmissions, renewals, template downloads.'}
                      {roleKey === ROLES.VERIFICATION_OFFICER && 'Multi-source telemetry cross-check (Entry vs OCR vs Bank API), discrepancy flagging.'}
                      {roleKey === ROLES.APPROVING_AUTHORITY && 'Executive council adjudication, digital DSC endorsement sign-off, release authorization.'}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 pt-1">
                  <button
                    type="button"
                    className={`h-7 px-3 rounded-lg text-xs font-semibold transition-colors ${
                      isSelected
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    {isSelected ? 'Active' : 'Select'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-space-lg py-3 bg-surface-container-low border-t border-surface-container flex items-center justify-between text-xs text-secondary">
          <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Authenticated: Live FastAPI JWT Session
          </span>
          <button
            onClick={() => setIsRoleModalOpen(false)}
            className="px-3 py-1 rounded-lg hover:bg-surface-container text-on-surface font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
