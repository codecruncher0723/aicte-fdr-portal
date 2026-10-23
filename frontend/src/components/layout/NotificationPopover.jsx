import React from 'react';
import { useRole } from '../../context/RoleContext';

export default function NotificationPopover({ isOpen, onClose }) {
  const { setActiveRoute, currentRole } = useRole();

  if (!isOpen) return null;

  const notifications = [
    {
      id: 'notif_1',
      title: 'WRO Scrutiny Note: FDR-PNB-883921',
      description: 'Regional scrutiny officer requested updated joint custody mandate descriptor. Deadline: 15 Nov 2024.',
      time: '12m ago',
      type: 'urgent',
      targetRoute: currentRole === 'institution_officer' ? 'institution_dashboard' : 'verification_audit',
      targetRef: 'FDR-PNB-883921'
    },
    {
      id: 'notif_2',
      title: 'PFMS Lien Confirmed: FDR-BOB-910283',
      description: 'Bank of Baroda FC Road branch acknowledged tripartite non-encashment lien.',
      time: '1h ago',
      type: 'success',
      targetRoute: 'registry',
      targetRef: 'FDR-BOB-910283'
    },
    {
      id: 'notif_3',
      title: 'Maturity Alert: FDR-SBI-440192',
      description: '₹75 Lakhs deposit enters 120-day pre-maturity window. Rollover notice prepared.',
      time: '3h ago',
      type: 'warning',
      targetRoute: 'dashboard',
      targetRef: 'FDR-SBI-440192'
    },
    {
      id: 'notif_4',
      title: 'Digital DSC Co-signature Complete',
      description: 'Member Secretary AICTE endorsed Form L-1 for St. Xavier’s Engineering College.',
      time: 'Yesterday',
      type: 'info',
      targetRoute: 'verification_audit',
      targetRef: 'FDR-PNB-883921'
    }
  ];

  return (
    <>
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose} 
        aria-hidden="true" 
      />
      <div className="absolute right-0 top-12 w-96 max-w-[calc(100vw-2rem)] bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-space-md bg-surface-container-low border-b border-surface-container flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">notifications_active</span>
            <span className="font-headline-sm text-sm font-bold text-on-surface">Compliance Notifications</span>
          </div>
          <span className="font-label-sm text-[11px] bg-error-container text-on-error-container px-2 py-0.5 rounded-full font-bold">
            {notifications.length} Active
          </span>
        </div>

        <div className="max-h-[380px] overflow-y-auto divide-y divide-surface-container-low">
          {notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                setActiveRoute(item.targetRoute, item.targetRef);
                onClose();
              }}
              className="p-3.5 hover:bg-surface-container-low transition-colors cursor-pointer flex items-start gap-3"
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  item.type === 'urgent'
                    ? 'bg-error-container text-on-error-container'
                    : item.type === 'warning'
                    ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                    : item.type === 'success'
                    ? 'bg-primary-fixed text-on-primary-fixed'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {item.type === 'urgent'
                    ? 'emergency'
                    : item.type === 'warning'
                    ? 'schedule'
                    : item.type === 'success'
                    ? 'verified'
                    : 'info'}
                </span>
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-label-md text-xs font-bold text-on-surface truncate">
                    {item.title}
                  </span>
                  <span className="font-data-mono text-[10px] text-secondary shrink-0">
                    {item.time}
                  </span>
                </div>
                <p className="font-body-sm text-[11px] text-secondary mt-0.5 leading-snug line-clamp-2">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-2.5 bg-surface-container-low border-t border-surface-container flex items-center justify-between text-xs">
          <button
            onClick={() => {
              setActiveRoute(currentRole === 'institution_officer' ? 'institution_dashboard' : 'dashboard');
              onClose();
            }}
            className="font-label-sm text-primary hover:underline font-semibold"
          >
            Mark all read
          </button>
          <button
            onClick={onClose}
            className="font-label-sm text-secondary hover:text-on-surface"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
