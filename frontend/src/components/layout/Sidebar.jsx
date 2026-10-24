import React from 'react';
import { useRole, ROLES } from '../../context/RoleContext';
import { getRoleNavItems } from '../../config/roleAccess';
import AicteLogo from '../common/AicteLogo';

export default function Sidebar() {
  const {
    currentRole,
    currentUser,
    activeRoute,
    setActiveRoute,
    setIsRoleModalOpen,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
  } = useRole();

  const isInstitution = currentRole === ROLES.INSTITUTION_OFFICER;
  const isVerifier = currentRole === ROLES.VERIFICATION_OFFICER;
  const isApprover = currentRole === ROLES.APPROVING_AUTHORITY;
  const { primaryNav, secondaryNav } = getRoleNavItems(currentRole);

  const renderBadge = (badge, badgeType) => {
    if (!badge) return null;
    if (badgeType === 'warning') {
      return (
        <span className="font-label-sm text-[11px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded-full font-bold">
          {badge}
        </span>
      );
    }
    if (badgeType === 'error') {
      return (
        <span className="font-label-sm text-[11px] bg-error-container text-on-error-container px-2 py-0.5 rounded-full font-bold">
          {badge}
        </span>
      );
    }
    if (badgeType === 'primary-add') {
      return (
        <span className="font-label-sm text-[11px] bg-primary-fixed text-on-primary-fixed px-2 py-0.5 rounded font-bold">
          {badge}
        </span>
      );
    }
    if (badgeType === 'info') {
      return (
        <span className="text-[11px] bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700 font-bold px-2 py-0.5 rounded-full">
          {badge}
        </span>
      );
    }
    if (badgeType === 'purple') {
      return (
        <span className="text-[11px] bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700 font-bold px-2 py-0.5 rounded-full">
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
              ) : isVerifier ? (
                <div className="w-9 h-9 rounded-lg bg-cyan-600 flex items-center justify-center shrink-0 shadow-xs text-white">
                  <span className="material-symbols-outlined text-[20px]">fact_check</span>
                </div>
              ) : isApprover ? (
                <div className="w-9 h-9 rounded-lg bg-purple-700 flex items-center justify-center shrink-0 shadow-xs text-white">
                  <span className="material-symbols-outlined text-[20px]">gavel</span>
                </div>
              ) : (
                <AicteLogo className="h-8 w-8" />
              )}
              <div className="flex flex-col min-w-0">
                <span className="font-headline-sm text-sm lg:text-[15px] font-bold tracking-tight text-primary leading-tight truncate">
                  AICTE FDR Portal
                </span>
                <span className="font-label-sm text-[11px] text-on-surface-variant leading-tight truncate">
                  {isInstitution
                    ? 'Institution Portal'
                    : isVerifier
                    ? 'Scrutiny & Verification Desk'
                    : isApprover
                    ? 'Statutory Council Adjudication'
                    : 'Ministry of Education, GoI'}
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

          {/* Role Perspective Card Banner */}
          {isVerifier && (
            <div className="mx-3 mt-3 px-3 py-2.5 rounded-xl bg-cyan-50/80 dark:bg-cyan-950/30 border border-cyan-200/80 dark:border-cyan-800/50 flex items-center gap-2.5">
              <span className="material-symbols-outlined text-cyan-700 dark:text-cyan-400 text-[20px]">verified</span>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-cyan-900 dark:text-cyan-200">Verification Desk</span>
                <span className="text-[10px] text-cyan-700/80 dark:text-cyan-400">Document completeness & discrepancy check</span>
              </div>
            </div>
          )}

          {isApprover && (
            <div className="mx-3 mt-3 px-3 py-2.5 rounded-xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/50 flex items-center gap-2.5">
              <span className="material-symbols-outlined text-purple-700 dark:text-purple-400 text-[20px]">policy</span>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-purple-900 dark:text-purple-200">Approval Council</span>
                <span className="text-[10px] text-purple-700/80 dark:text-purple-400">Statutory decision & lien endorsement</span>
              </div>
            </div>
          )}

          {/* Primary Nav Items */}
          <div className="px-space-xs lg:px-space-md py-space-sm">
            <div className="px-space-md py-space-xs font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              {isInstitution
                ? 'Main Modules'
                : isVerifier
                ? 'Scrutiny Modules'
                : isApprover
                ? 'Council Modules'
                : 'Operational Modules'}
            </div>

            <nav className="flex flex-col gap-1 mt-1">
              {primaryNav.map((item) => {
                const isActive = activeRoute === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveRoute(item.id)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors text-left ${
                      isActive
                        ? isInstitution
                          ? 'bg-primary text-on-primary font-semibold shadow-sm'
                          : isVerifier
                          ? 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-900 dark:text-cyan-200 shadow-xs border border-cyan-300 dark:border-cyan-700 font-semibold'
                          : isApprover
                          ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 shadow-xs border border-purple-300 dark:border-purple-700 font-semibold'
                          : 'bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 shadow-xs border border-teal-200/80 dark:border-teal-800/60 font-semibold'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`material-symbols-outlined text-[19px] ${
                          isActive
                            ? isInstitution
                              ? 'text-on-primary'
                              : isVerifier
                              ? 'text-cyan-700 dark:text-cyan-400'
                              : isApprover
                              ? 'text-purple-700 dark:text-purple-400'
                              : 'text-teal-700 dark:text-teal-400'
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

          {/* Secondary Nav Block (only rendered if role has secondary items) */}
          {secondaryNav.length > 0 && (
            <div className="px-space-xs lg:px-space-md py-space-xs mt-auto">
              <div className="px-space-md py-space-xs font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                {isInstitution ? 'Compliance & Utilities' : 'Governance'}
              </div>

              <nav className="flex flex-col gap-1 mt-1">
                {secondaryNav.map((item) => {
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
          )}
        </div>

        {/* Control #1: Bottom-left user/role control */}
        <div className="p-3 m-3 rounded-xl bg-surface-container-low border border-surface-container-high">
          {isInstitution ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-on-surface font-semibold truncate">
                    {currentUser?.institutionName || "St. Xavier's Institute"}
                  </span>
                  <span className="font-data-mono text-[11px] text-on-surface-variant truncate">
                    PID: {currentUser?.aictePid || '1-10928374'}
                  </span>
                </div>
                <span className="text-[10px] bg-primary-fixed text-on-primary-fixed px-1.5 py-0.2 rounded font-bold shrink-0">
                  Grade A
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-surface-container text-xs">
                <span className="text-[11px] text-on-surface-variant">{currentUser?.roleLabel}</span>
                <button
                  onClick={() => setIsRoleModalOpen(true)}
                  className="flex items-center text-primary hover:underline text-[11px] font-semibold transition-colors"
                  title="Switch Role"
                >
                  <span className="material-symbols-outlined text-[14px] mr-0.5">switch_account</span>
                  Switch Role
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsRoleModalOpen(true)}
              className="w-full flex items-center justify-between gap-2 text-left hover:bg-surface-container p-1 rounded-lg transition-colors group"
              title="Switch Account Role"
              type="button"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs shrink-0 shadow-xs">
                  {currentUser?.name ? currentUser.name.split(' ').filter(n => !n.includes('.')).map(n => n[0]).slice(0, 2).join('') : 'AI'}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-on-surface truncate leading-tight group-hover:text-primary transition-colors">
                    {currentUser?.name || 'Authorized User'}
                  </span>
                  <span className="text-[11px] text-on-surface-variant truncate leading-tight">
                    {currentUser?.roleLabel || 'Official'}
                  </span>
                </div>
              </div>
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant group-hover:text-on-surface shrink-0">
                unfold_more
              </span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
