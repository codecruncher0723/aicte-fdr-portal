import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import RoleSwitcherModal from './RoleSwitcherModal';
import { useRole } from '../../context/RoleContext';

export default function AppLayout({ children }) {
  const { currentRole, currentUser, setIsRoleModalOpen } = useRole();

  return (
    <div className="min-h-screen bg-surface flex flex-col antialiased">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Wrapper with Left Margin for Sidebar */}
      <div className="flex-1 flex flex-col lg:pl-64 xl:pl-72 min-h-screen">
        {/* Header */}
        <Header />

        {/* Floating Quick Role Badge (Bottom Right for easy demo evaluation) */}
        <div className="fixed bottom-4 right-4 z-40">
          <button
            onClick={() => setIsRoleModalOpen(true)}
            className="flex items-center gap-2 bg-on-surface text-surface px-3.5 py-2 rounded-full shadow-lg border border-surface-container hover:bg-slate-800 transition-all text-xs font-semibold group"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Role: <strong className="text-teal-300">{currentUser.roleLabel}</strong></span>
            <span className="text-[10px] bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded font-mono">
              Switch
            </span>
          </button>
        </div>

        {/* Main Content Area */}
        <main className="w-full pt-16 flex-1 flex flex-col">
          {children}
        </main>
      </div>

      {/* Role Switcher Modal */}
      <RoleSwitcherModal />
    </div>
  );
}
