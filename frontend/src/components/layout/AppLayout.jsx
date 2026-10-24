import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import RoleSwitcherModal from './RoleSwitcherModal';

export default function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col antialiased transition-colors">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Wrapper with Left Margin for Sidebar */}
      <div className="flex-1 flex flex-col lg:pl-64 xl:pl-72 min-h-screen">
        {/* Header */}
        <Header />

        {/* Main Content Area */}
        <main className="w-full pt-16 flex-1 flex flex-col">
          {children}
        </main>
      </div>

      {/* Exactly 1 Role Switcher Modal triggered only by the 2 designated controls */}
      <RoleSwitcherModal />
    </div>
  );
}
