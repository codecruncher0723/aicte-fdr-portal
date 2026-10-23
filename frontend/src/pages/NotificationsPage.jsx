import React, { useState } from 'react';
import { useRole } from '../context/RoleContext';

export default function NotificationsPage() {
  const { setActiveRoute, setSelectedFdrRef } = useRole();

  const [notifications, setNotifications] = useState([
    {
      id: 'notif_01',
      title: 'WRO Deficiency Notice: FDR-PNB-883921',
      message: 'Joint Account Mandate text omits regional office descriptor (AICTE WRO, Pune/Mumbai). Form L-1 amendment required.',
      type: 'error',
      timestamp: 'Today 09:15 AM',
      read: false,
      targetRoute: 'verification_audit',
      fdrNumber: 'FDR-PNB-883921'
    },
    {
      id: 'notif_02',
      title: 'Maturity Horizon Surveillance: 118 Days Left',
      message: 'FDR-SBI-440192 (₹75 Lakhs) is approaching maturity on 14 Mar 2025. Standard 3-year term rollover window is active.',
      type: 'warning',
      timestamp: 'Yesterday 14:20 PM',
      read: false,
      targetRoute: 'maturity_renewals',
      fdrNumber: 'FDR-SBI-440192'
    },
    {
      id: 'notif_03',
      title: 'Council Release Sanction Ratified',
      message: 'Order 884/2024 signed by Member Secretary for FDR-UBI-994411 (₹1.00 Cr). Awaiting upload of payment confirmation advice.',
      type: 'success',
      timestamp: '05 Nov 2024',
      read: true,
      targetRoute: 'release_requests',
      fdrNumber: 'FDR-UBI-994411'
    },
    {
      id: 'notif_04',
      title: 'Statutory Lien Encashment Lock Confirmed',
      message: 'Bank of Baroda Finacle SFMS gateway confirmed statutory lien registration for FDR-BOB-910283.',
      type: 'info',
      timestamp: '02 Nov 2024',
      read: true,
      targetRoute: 'registry',
      fdrNumber: 'FDR-BOB-910283'
    }
  ]);

  const [filter, setFilter] = useState('all');

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'deficiency') return n.type === 'error' || n.type === 'warning';
    return true;
  });

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNavigate = (notif) => {
    if (notif.fdrNumber) setSelectedFdrRef(notif.fdrNumber);
    setActiveRoute(notif.targetRoute);
  };

  return (
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-lowest p-5 lg:p-6 rounded-2xl border border-surface-container shadow-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-primary font-label-sm uppercase tracking-wider text-xs">
            <span className="material-symbols-outlined text-[16px]">notifications</span>
            <span>Regulatory Dispatch & Action Alerts</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <h1 className="font-headline-lg text-xl sm:text-2xl text-on-surface font-bold tracking-tight">
              Notification & Scrutiny Center
            </h1>
            <span className="font-label-sm text-xs text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded-full font-medium">
              {notifications.filter(n => !n.read).length} Unread
            </span>
          </div>
          <p className="text-xs text-secondary mt-1">
            Real-time alerts regarding WRO scrutiny deficiencies, maturity horizons, and Council release orders.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleMarkAllRead}
            className="rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface hover:bg-surface-container-low font-label-md text-xs px-3.5 py-2 shadow-xs inline-flex items-center gap-1.5 transition-colors font-semibold"
          >
            <span className="material-symbols-outlined text-[17px]">done_all</span>
            <span>Mark All as Read</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-surface-container-lowest p-3 rounded-2xl border border-surface-container">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            filter === 'all' ? 'bg-primary text-white shadow-xs' : 'text-secondary hover:text-on-surface'
          }`}
        >
          All Notifications ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            filter === 'unread' ? 'bg-primary text-white shadow-xs' : 'text-secondary hover:text-on-surface'
          }`}
        >
          Unread Only ({notifications.filter(n => !n.read).length})
        </button>
        <button
          onClick={() => setFilter('deficiency')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            filter === 'deficiency' ? 'bg-primary text-white shadow-xs' : 'text-secondary hover:text-on-surface'
          }`}
        >
          Scrutiny & Deficiencies
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filtered.map((notif) => {
          return (
            <div
              key={notif.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                notif.read
                  ? 'bg-surface-container-lowest border-surface-container'
                  : 'bg-surface-container-low border-primary/30 shadow-xs'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  notif.type === 'error'
                    ? 'bg-rose-100 text-rose-800'
                    : notif.type === 'warning'
                    ? 'bg-amber-100 text-amber-800'
                    : notif.type === 'success'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-teal-100 text-teal-800'
                }`}>
                  <span className="material-symbols-outlined text-[22px]">
                    {notif.type === 'error'
                      ? 'report'
                      : notif.type === 'warning'
                      ? 'warning'
                      : notif.type === 'success'
                      ? 'check_circle'
                      : 'info'}
                  </span>
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-on-surface">
                      {notif.title}
                    </h3>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
                    )}
                  </div>
                  <p className="text-xs text-secondary mt-1 leading-relaxed">
                    {notif.message}
                  </p>
                  <span className="text-[11px] text-on-surface-variant font-data-mono mt-2">
                    {notif.timestamp}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                <button
                  onClick={() => handleNavigate(notif)}
                  className="px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-container transition-colors shadow-xs inline-flex items-center gap-1"
                >
                  <span>Resolve / View</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
