import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRole, ROLES } from '../context/RoleContext';
import { apiClient } from '../api/client';

export default function NotificationsPage() {
  const { setActiveRoute, setSelectedFdrRef, currentRole } = useRole();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'deficiency'
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient.getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError(err.message || 'Unable to load compliance notifications from server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  const actionRequiredCount = useMemo(() => {
    return notifications.filter((n) => {
      const type = (n.notification_type || '').toUpperCase();
      return type === 'ACTION_REQUIRED' || type === 'WARNING';
    }).length;
  }, [notifications]);

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === 'unread') return !n.is_read;
      if (filter === 'deficiency') {
        const type = (n.notification_type || '').toUpperCase();
        return type === 'ACTION_REQUIRED' || type === 'WARNING';
      }
      return true;
    });
  }, [notifications, filter]);

  const handleToggleRead = async (notif) => {
    const newStatus = !notif.is_read;
    try {
      // Optimistic local update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: newStatus } : n))
      );
      await apiClient.updateNotification(notif.id, newStatus);
    } catch (err) {
      console.error('Failed to toggle notification status:', err);
      // Revert on error
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: notif.is_read } : n))
      );
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;

    try {
      setIsUpdating(true);
      // Optimistically mark all read
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      await Promise.all(unread.map((n) => apiClient.updateNotification(n.id, true)));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      // Reload actual state from backend
      fetchNotifications();
    } finally {
      setIsUpdating(false);
    }
  };

  const handleNavigate = async (notif) => {
    // If unread, mark read in backend
    if (!notif.is_read) {
      handleToggleRead(notif);
    }

    // Extract any FDR reference in title or message (e.g. FDR-SBI-123456)
    const textToScan = `${notif.title} ${notif.message}`;
    const fdrMatch = textToScan.match(/FDR-[A-Z0-9-]+/i);
    if (fdrMatch && setSelectedFdrRef) {
      setSelectedFdrRef(fdrMatch[0].toUpperCase());
    }

    // Route based on role and notification content
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
      // AICTE Admin
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
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'Recent';
    try {
      const d = new Date(ts);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return ts;
    }
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
              {unreadCount} Unread
            </span>
          </div>
          <p className="text-xs text-secondary mt-1">
            Authoritative alerts regarding WRO scrutiny deficiencies, maturity horizons, and Council release orders.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={fetchNotifications}
            disabled={isLoading}
            className="rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface hover:bg-surface-container-low font-label-md text-xs px-3.5 py-2 shadow-xs inline-flex items-center gap-1.5 transition-colors font-semibold disabled:opacity-50"
            title="Refresh notifications from server"
          >
            <span className={`material-symbols-outlined text-[17px] ${isLoading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Refresh</span>
          </button>
          <button
            onClick={handleMarkAllRead}
            disabled={isUpdating || unreadCount === 0}
            className="rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface hover:bg-surface-container-low font-label-md text-xs px-3.5 py-2 shadow-xs inline-flex items-center gap-1.5 transition-colors font-semibold disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[17px]">done_all</span>
            <span>{isUpdating ? 'Updating...' : 'Mark All as Read'}</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-700 text-[18px]">error</span>
            <span>{error}</span>
          </div>
          <button
            onClick={fetchNotifications}
            className="font-bold underline hover:text-rose-950"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-surface-container-lowest p-3 rounded-2xl border border-surface-container flex-wrap">
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
          Unread Only ({unreadCount})
        </button>
        <button
          onClick={() => setFilter('deficiency')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            filter === 'deficiency' ? 'bg-primary text-white shadow-xs' : 'text-secondary hover:text-on-surface'
          }`}
        >
          Scrutiny & Actions ({actionRequiredCount})
        </button>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl border border-surface-container bg-surface-container-lowest animate-pulse flex items-center gap-4"
            >
              <div className="w-10 h-10 bg-surface-container-high rounded-xl"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-surface-container-high rounded w-1/3"></div>
                <div className="h-3 bg-surface-container rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filtered.length === 0 && (
        <div className="p-12 text-center bg-surface-container-lowest rounded-2xl border border-surface-container flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[32px]">notifications_off</span>
          </div>
          <h3 className="font-bold text-sm text-on-surface">No Compliance Notifications Found</h3>
          <p className="text-xs text-secondary max-w-md">
            {filter === 'unread'
              ? 'You have caught up with all active notices and scrutiny actions.'
              : filter === 'deficiency'
              ? 'No scrutiny deficiencies or critical action alerts are currently active.'
              : 'There are currently no statutory notifications in your dispatch queue.'}
          </p>
        </div>
      )}

      {/* Notifications List */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((notif) => {
            const type = (notif.notification_type || '').toUpperCase();
            const isError = type === 'ACTION_REQUIRED' || type === 'ERROR';
            const isWarning = type === 'WARNING';
            const isRead = !!notif.is_read;

            return (
              <div
                key={notif.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isRead
                    ? 'bg-surface-container-lowest border-surface-container'
                    : 'bg-surface-container-low border-primary/30 shadow-xs'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isError
                        ? 'bg-rose-100 text-rose-800'
                        : isWarning
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-teal-100 text-teal-800'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[22px]">
                      {isError ? 'report' : isWarning ? 'warning' : 'info'}
                    </span>
                  </div>

                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-on-surface">
                        {notif.title}
                      </h3>
                      {!isRead && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" title="Unread"></span>
                      )}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        isError
                          ? 'bg-rose-100 text-rose-800'
                          : isWarning
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-teal-100 text-teal-800'
                      }`}>
                        {notif.notification_type || 'INFO'}
                      </span>
                    </div>
                    <p className="text-xs text-secondary mt-1 leading-relaxed whitespace-pre-line">
                      {notif.message}
                    </p>
                    <span className="text-[11px] text-on-surface-variant font-data-mono mt-2">
                      {formatTimestamp(notif.created_at)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <button
                    onClick={() => handleToggleRead(notif)}
                    className="px-3 py-1.5 rounded-xl border border-surface-container bg-surface-container-lowest text-on-surface text-xs font-semibold hover:bg-surface-container transition-colors"
                    title={isRead ? 'Mark as Unread' : 'Mark as Read'}
                  >
                    {isRead ? 'Mark Unread' : 'Mark Read'}
                  </button>
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
      )}
    </div>
  );
}
