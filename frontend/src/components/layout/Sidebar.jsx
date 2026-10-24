import React from 'react';
import { useRole, ROLES } from '../../context/RoleContext';
import AicteLogo from '../common/AicteLogo';

export default function Sidebar() {
  const {
    currentRole,
    currentUser,
    activeRoute,
    setActiveRoute,
    setIsRoleModalOpen,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen
  } = useRole();

  const isInstitution = currentRole === ROLES.INSTITUTION_OFFICER;

  const isApprover = currentRole === ROLES.APPROVING_AUTHORITY;
  const isVerifier = currentRole === ROLES.VERIFICATION_OFFICER;

  // AICTE Admin / Officer Nav Items
  const adminNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', badge: null },
    { id: 'registry', label: 'FDR Registry', icon: 'account_balance', badge: null },
    { 
      id: 'verification_audit', 
      label: isApprover ? 'Approval Queue' : (isVerifier ? 'Verification Queue' : 'Verification Queue'), 
      icon: isApprover ? 'gavel' : 'verified', 
      badge: null 
    },
    { id: 'maturity_renewals', label: 'Maturity & Renewals', icon: 'event_repeat', badge: null },
    { id: 'release_requests', label: 'Release Requests', icon: 'lock_open', badge: null },
    { id: 'reports', label: 'Reports', icon: 'analytics', badge: null },
    { id: 'institutions', label: 'Institutions', icon: 'domain', badge: null },
    { id: 'audit_logs', label: 'Audit Logs', icon: 'policy', badge: null },
  ];

  // Institution Officer Nav Items
  const institutionNavItems = [
    { id: 'institution_dashboard', label: 'Dashboard', icon: 'dashboard', badge: null },
    { id: 'my_fdrs', label: 'My FDRs', icon: 'account_balance_wallet', badge: null },
    { id: 'submit_new_fdr', label: 'Submit New FDR', icon: 'add_circle', badge: '+ Add', badgeType: 'primary-add' },
    { id: 'renewals', label: 'Renewals', icon: 'autorenew', badge: '1 Due', badgeType: 'warning' },
    { id: 'release_refund_requests', label: 'Release/Refund Requests', icon: 'currency_exchange', badge: null },
  ];

  const institutionComplianceNavItems = [
    { id: 'notifications', label: 'Notifications', icon: 'notifications', badge: '2', badgeType: 'error' },
    { id: 'profile_trust_details', label: 'Profile & Trust Details', icon: 'verified_user', badge: null },
    { id: 'aph_guidelines_templates', label: 'APH Guidelines & Templates', icon: 'description', badge: null },
  ];

  const adminGovernanceNavItems = [
    { id: 'settings', label: 'Settings', icon: 'settings', badge: null },
    { id: 'help_manuals', label: 'Help & Manuals', icon: 'help_outline', badge: null },
  ];

  const renderBadge = (badge, badgeType) => {
    if (!badge) return null;
    if (badgeType === 'tertiary') {
      return (
        <span className="text-[11px] bg-tertiary-fixed text-on-tertiary-fixed font-bold px-2 py-0.5 rounded-full">
          {badge}
        </span>
      );
    }
    if (badgeType === 'warning') {
      return (
        <span className="font-label-sm text-label-sm bg-tertiary-fixed text-on-tertiary-fixed px-space-xs py-0.5 rounded font-bold">
          {badge}
        </span>
      );
    }
    if (badgeType === 'error') {
      return (
        <span className="font-label-sm text-label-sm bg-error-container text-on-error-container px-space-xs py-0.5 rounded-full font-bold">
          {badge}
        </span>
      );
    }
    if (badgeType === 'primary-add') {
      return (
        <span className="font-label-sm text-label-sm bg-primary-fixed text-on-primary-fixed px-space-xs py-0.5 rounded font-bold">
          {badge}
        </span>
      );
    }
    return (
      <span className="text-[11px] bg-teal-700 text-white font-bold px-2 py-0.5 rounded-full">
        {badge}
      </span>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-on-surface/50 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-64 lg:w-72 bg-surface-container-lowest border-r border-surface-container-high z-50 flex flex-col justify-between shadow-sm transition-transform duration-200 lg:translate-x-0 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Header Brand */}
          <div className="h-16 px-space-md lg:px-space-lg flex items-center justify-between border-b border-surface-container-high">
            <div className="flex items-center gap-space-sm min-w-0">
              {isInstitution ? (
                <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-xs">
                  <span className="material-symbols-outlined text-on-primary text-[20px]">account_balance</span>
                </div>
              ) : (
                <AicteLogo className="h-8 w-8" />
              )}
              <div className="flex flex-col min-w-0">
                <span className="font-headline-sm text-sm lg:text-[15px] font-bold tracking-tight text-primary leading-tight truncate">
                  AICTE FDR Portal
                </span>
                <span className="font-label-sm text-[11px] text-on-surface-variant leading-tight truncate">
                  {isInstitution ? 'Institution Portal' : 'Ministry of Education, GoI'}
                </span>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="p-1 rounded-lg text-secondary hover:text-on-surface lg:hidden"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Nav Items */}
          <div className="px-space-xs lg:px-space-md py-space-sm">
            <div className="px-space-md py-space-xs font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              {isInstitution ? 'Main Modules' : 'Operational Modules'}
            </div>

            <nav className="flex flex-col gap-1 mt-1">
              {(isInstitution ? institutionNavItems : adminNavItems).map((item) => {
                const isActive = activeRoute === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveRoute(item.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                      isActive
                        ? isInstitution
                          ? 'bg-primary text-on-primary font-semibold shadow-sm'
                          : 'bg-teal-50 text-teal-900 shadow-xs border border-teal-200/80 font-semibold'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`material-symbols-outlined text-[18px] ${
                          isActive
                            ? isInstitution
                              ? 'text-on-primary'
                              : 'text-teal-700'
                            : item.id === 'submit_new_fdr'
                            ? 'text-primary'
                            : 'text-secondary'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className={isActive ? 'font-semibold' : ''}>{item.label}</span>
                    </div>
                    {renderBadge(item.badge, item.badgeType)}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Secondary Nav Block */}
          <div className="px-space-xs lg:px-space-md py-space-xs mt-auto">
            <div className="px-space-md py-space-xs font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              {isInstitution ? 'Compliance & Utilities' : 'Governance'}
            </div>

            <nav className="flex flex-col gap-1 mt-1">
              {(isInstitution ? institutionComplianceNavItems : adminGovernanceNavItems).map((item) => {
                const isActive = activeRoute === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveRoute(item.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                      isActive
                        ? 'bg-primary text-on-primary font-semibold shadow-sm'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[18px] text-secondary">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {renderBadge(item.badge, item.badgeType)}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Profile / Institution Card */}
        {isInstitution ? (
          <div className="p-space-md bg-surface-container-low m-space-sm rounded-xl flex flex-col gap-space-sm border border-surface-container">
            <div className="flex items-start justify-between">
              <div className="flex flex-col min-w-0">
                <span className="font-label-md text-xs text-on-surface font-semibold truncate">
                  St. Xavier's Institute
                </span>
                <span className="font-data-mono text-[11px] text-on-surface-variant truncate">
                  PID: 1-10928374
                </span>
              </div>
              <span className="font-label-sm text-[10px] bg-primary-fixed text-on-primary-fixed px-1.5 py-0.2 rounded font-bold shrink-0">
                Grade A
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-surface-container text-xs">
              <span className="font-label-sm text-[11px] text-on-surface-variant">Regulatory Standing</span>
              <button
                onClick={() => setIsRoleModalOpen(true)}
                className="flex items-center text-primary hover:underline font-label-sm text-[11px] font-semibold transition-colors"
                title="Switch Demo Role"
              >
                <span className="material-symbols-outlined text-[14px] mr-1">switch_account</span>
                Switch Role
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 m-3 rounded-xl bg-surface-container-low border border-surface-container-high">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs shrink-0 shadow-xs ring-1 ring-surface-container-highest">
                  {currentUser?.name ? currentUser.name.split(' ').filter(n => !n.includes('.')).map(n => n[0]).slice(0, 2).join('') : 'AI'}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-on-surface truncate leading-tight">
                    {currentUser?.name || 'Authorized User'}
                  </span>
                  <span className="text-[11px] text-on-surface-variant truncate leading-tight">
                    {currentUser?.title || 'Official'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsRoleModalOpen(true)}
                className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
                title="Switch Account Role"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">unfold_more</span>
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
