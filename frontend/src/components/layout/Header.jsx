import React, { useRef, useEffect } from 'react';
import { useRole, ROLES } from '../../context/RoleContext';
import { useTheme } from '../../context/ThemeContext';
import NotificationPopover from './NotificationPopover';

export default function Header() {
  const {
    currentRole,
    currentUser,
    fiscalYear,
    setFiscalYear,
    searchQuery,
    setSearchQuery,
    setIsRoleModalOpen,
    setIsMobileSidebarOpen,
    isNotificationOpen,
    setIsNotificationOpen,
    logout,
  } = useRole();

  const { isDark, toggleTheme } = useTheme();
  const searchInputRef = useRef(null);

  // Keyboard shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isInstitution = currentRole === ROLES.INSTITUTION_OFFICER;

  return (
    <header className="fixed top-0 left-0 lg:left-64 xl:left-72 right-0 h-16 bg-surface-container-lowest/95 backdrop-blur-xl border-b border-surface-container-high shadow-xs z-30 px-4 sm:px-6 flex items-center justify-between transition-colors">
      {/* Left: Mobile Toggle & Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="p-2 -ml-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl lg:hidden"
          title="Open Menu"
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>

        {/* Institution Info for Institution Officer */}
        {isInstitution && (
          <div className="hidden xl:flex flex-col min-w-0 pr-3 border-r border-surface-container">
            <div className="flex items-center gap-1.5">
              <span className="font-headline-sm text-xs font-bold text-on-surface truncate">
                AICTE FDR Portal
              </span>
              <span className="font-label-sm text-[10px] bg-surface-container text-on-surface-variant px-1.5 py-0.2 rounded font-semibold">
                Official
              </span>
            </div>
            <span className="font-label-sm text-[11px] text-on-surface-variant truncate">
              PID: {currentUser?.aictePid || '1-10928374'} • WRO
            </span>
          </div>
        )}

        {/* Global Search Bar */}
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isInstitution
                ? 'Search FDR ref, bank, receipt... ⌘K'
                : 'Search FDR by receipt no, institution code, or bank...'
            }
            className="w-full h-9 pl-9 pr-14 bg-surface-container-low border border-surface-container-high rounded-xl font-body-sm text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest transition-colors"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 bg-surface-container-high rounded font-data-mono text-on-surface-variant text-[10px]">
            <span>⌘K</span>
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
        {/* FY Selector */}
        <div className="hidden md:flex items-center gap-1 px-2.5 py-1 bg-surface-container-low border border-surface-container-high rounded-xl text-xs">
          <span className="material-symbols-outlined text-primary text-[15px]">calendar_today</span>
          <span className="text-[11px] text-on-surface-variant font-medium">FY:</span>
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
            className="bg-transparent font-semibold text-on-surface focus:outline-none cursor-pointer pr-1"
          >
            <option className="bg-surface-container-lowest text-on-surface">2024 - 2025</option>
            <option className="bg-surface-container-lowest text-on-surface">2023 - 2024</option>
            <option className="bg-surface-container-lowest text-on-surface">2022 - 2023</option>
          </select>
        </div>

        {/* Notifications Button & Popover */}
        <div className="relative">
          <button
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            className="relative p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl border border-surface-container-high transition-colors"
            title="Compliance Notifications"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full ring-2 ring-surface-container-lowest"></span>
          </button>
          <NotificationPopover
            isOpen={isNotificationOpen}
            onClose={() => setIsNotificationOpen(false)}
          />
        </div>

        {/* Dark Mode Toggle Button (to the left of profile menu) */}
        <button
          onClick={toggleTheme}
          aria-label={isDark ? 'Light mode' : 'Dark mode'}
          title={isDark ? 'Light mode' : 'Dark mode'}
          className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl border border-surface-container-high transition-colors"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">
            {isDark ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        <div className="h-5 w-px bg-surface-container-high hidden sm:block"></div>

        {/* Control #2: Profile Menu / Role Switcher (top-right of top bar) */}
        <div
          onClick={() => setIsRoleModalOpen(true)}
          className="flex items-center gap-2 cursor-pointer p-1 rounded-xl hover:bg-surface-container transition-colors"
          title="Switch Account Role"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setIsRoleModalOpen(true);
          }}
        >
          <div className="flex flex-col text-right hidden sm:flex">
            <span className="text-xs font-semibold text-on-surface leading-tight truncate max-w-[130px]">
              {currentUser?.name || 'Authorized User'}
            </span>
            <span className="text-[10px] text-on-surface-variant leading-tight truncate max-w-[130px]">
              {currentUser?.roleLabel || 'Official'}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs shrink-0 shadow-xs ring-1 ring-surface-container-highest">
            {currentUser?.name ? currentUser.name.split(' ').filter(n => !n.includes('.')).map(n => n[0]).slice(0, 2).join('') : 'AI'}
          </div>
        </div>

        {/* Quick Logout Button */}
        <button
          onClick={logout}
          className="p-2 text-on-surface-variant hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border border-surface-container-high transition-colors"
          title="Sign Out of Session"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
        </button>
      </div>
    </header>
  );
}
