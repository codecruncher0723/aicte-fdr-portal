import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRole, ROLES } from '../../context/RoleContext';
import { apiClient } from '../../api/client';

export default function NotificationPopover({ isOpen, onClose }) {
  const { setActiveRoute, setSelectedFdrRef, currentRole } = useRole();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient.getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load notifications in popover:', err);
      setError('Unable to load notices');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleItemClick = async (item) => {
    // Optimistically mark as read
    if (!item.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      try {
        await apiClient.updateNotification(item.id, true);
      } catch (err) {
        console.error('Failed to mark notification read:', err);
      }
    }

    const textToScan = `${item.title} ${item.message}`;
    const fdrMatch = textToScan.match(/FDR-[A-Z0-9-]+/i);
    if (fdrMatch && setSelectedFdrRef) {
      setSelectedFdrRef(fdrMatch[0].toUpperCase());
    }

    const lower = textToScan.toLowerCase();
    if (currentRole === ROLES.INSTITUTION_OFFICER) {
      if (lower.includes('renewal') || lower.includes('maturity')) {
        setActiveRoute('maturity_renewals');
      } else if (lower.includes('release') || lower.includes('refund')) {
        setActiveRoute('release_requests');
      } else {
        setActiveRoute('institution_dashboard');
      }
    } else if (currentRole === ROLES.VERIFICATION_OFFICER) {
      setActiveRoute('verification_audit');
    } else if (currentRole === ROLES.APPROVING_AUTHORITY) {
      setActiveRoute('approver_workspace');
    } else {
      if (lower.includes('renewal') || lower.includes('maturity')) {
        setActiveRoute('maturity_renewals');
      } else if (lower.includes('release') || lower.includes('refund')) {
        setActiveRoute('release_requests');
      } else if (lower.includes('verification') || lower.includes('scrutiny')) {
        setActiveRoute('verification_audit');
      } else {
        setActiveRoute('registry');
      }
    }

    onClose();
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await Promise.all(unread.map((n) => apiClient.updateNotification(n.id, true)));
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
      fetchNotifications();
    }
  };

  const formatRelativeTime = (ts) => {
    if (!ts) return 'Recent';
    try {
      const now = new Date();
      const date = new Date(ts);
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } catch {
      return 'Recent';
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose} 
        aria-hidden="true" 
      />
      <div className="absolute right-0 top-12 w-96 max-w-[calc(100vw-2rem)] bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-3.5 bg-surface-container-low border-b border-surface-container flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">notifications_active</span>
            <span className="font-headline-sm text-sm font-bold text-on-surface">Compliance Notifications</span>
          </div>
          <span className="font-label-sm text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
            {unreadCount} Unread
          </span>
        </div>

        {isLoading && (
          <div className="p-8 flex flex-col items-center justify-center gap-2 text-secondary text-xs">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span>Fetching live notices...</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-900 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={fetchNotifications} className="font-bold underline">Retry</button>
          </div>
        )}

        {!isLoading && notifications.length === 0 && (
          <div className="p-8 text-center text-secondary text-xs flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-[28px] text-on-surface-variant">check_circle</span>
            <span className="font-medium">No statutory notices in queue.</span>
          </div>
        )}

        {!isLoading && notifications.length > 0 && (
          <div className="max-h-[380px] overflow-y-auto divide-y divide-surface-container-low">
            {notifications.map((item) => {
              const type = (item.notification_type || '').toUpperCase();
              const isAction = type === 'ACTION_REQUIRED' || type === 'ERROR';
              const isWarning = type === 'WARNING';
              const isRead = !!item.is_read;

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 ${
                    isRead ? 'hover:bg-surface-container-low' : 'bg-primary/5 hover:bg-primary/10'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isAction
                        ? 'bg-error-container text-on-error-container'
                        : isWarning
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-teal-100 text-teal-800'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isAction
                        ? 'emergency'
                        : isWarning
                        ? 'schedule'
                        : 'info'}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 truncate">
                        {!isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"></span>
                        )}
                        <span className="font-label-md text-xs font-bold text-on-surface truncate">
                          {item.title}
                        </span>
                      </div>
                      <span className="font-data-mono text-[10px] text-secondary shrink-0">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>
                    <p className="font-body-sm text-[11px] text-secondary mt-0.5 leading-snug line-clamp-2">
                      {item.message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="p-2.5 bg-surface-container-low border-t border-surface-container flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              className="font-label-sm text-primary hover:underline font-semibold disabled:opacity-40"
            >
              Mark all read
            </button>
            <button
              onClick={() => {
                setActiveRoute('notifications');
                onClose();
              }}
              className="font-label-sm text-secondary hover:text-on-surface font-semibold"
            >
              View all
            </button>
          </div>
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
