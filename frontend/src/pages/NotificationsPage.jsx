<<<<<<< HEAD
import React, { useState, useEffect, useCallback } from 'react';
import { useRole } from '../context/RoleContext';
import { notificationsApi } from '../api/client';
=======
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRole, ROLES } from '../context/RoleContext';
import { apiClient } from '../api/client';
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4

export default function NotificationsPage() {
  const { setActiveRoute, setSelectedFdrRef, currentRole } = useRole();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
<<<<<<< HEAD
  const [filter, setFilter] = useState('all');

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await notificationsApi.list();
      if (Array.isArray(data) && data.length > 0) {
        const mapped = data.map(n => {
          let targetRoute = 'dashboard';
          if (n.title.toLowerCase().includes('scrutiny') || n.title.toLowerCase().includes('deficiency') || n.title.toLowerCase().includes('verification')) {
            targetRoute = 'verification_audit';
          } else if (n.title.toLowerCase().includes('maturity') || n.title.toLowerCase().includes('rollover')) {
            targetRoute = 'maturity_renewals';
          } else if (n.title.toLowerCase().includes('release')) {
            targetRoute = 'release_requests';
          }

          // Extract FDR number pattern like FDR-XXX-XXXXXX
          const match = (n.title + ' ' + n.message).match(/FDR-[A-Z0-9-]+/i);
          const fdrNum = match ? match[0].toUpperCase() : null;

          return {
            id: n.id,
            title: n.title,
            message: n.message,
            type: n.notification_type === 'ALERT' ? 'error' : (n.notification_type === 'WARNING' ? 'warning' : 'info'),
            timestamp: n.created_at ? new Date(n.created_at).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Recent',
            read: Boolean(n.is_read),
            targetRoute,
            fdrNumber: fdrNum,
          };
        });
        setNotifications(mapped);
      } else {
        // Fallback default fixture if no backend notifications yet
        setNotifications([
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
          }
        ]);
      }
    } catch (err) {
      console.warn('Could not fetch notifications from backend, using fixture:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [currentRole, fetchNotifications]);

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'deficiency') return n.type === 'error' || n.type === 'warning';
    return true;
  });

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    for (const notif of notifications) {
      if (!notif.read && typeof notif.id === 'number') {
        try {
          await notificationsApi.markRead(notif.id, true);
        } catch {}
      }
    }
  };

  const handleNavigate = async (notif) => {
    if (typeof notif.id === 'number' && !notif.read) {
      try {
        await notificationsApi.markRead(notif.id, true);
      } catch {}
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    }
    if (notif.fdrNumber) setSelectedFdrRef(notif.fdrNumber);
    setActiveRoute(notif.targetRoute);
=======
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
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
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
<<<<<<< HEAD
          <h1 className="font-headline-lg text-xl sm:text-2xl text-on-surface font-bold mt-1">
            Official Notices & Compliance Alerts
          </h1>
          <p className="text-xs text-secondary mt-1 max-w-2xl">
            Real-time feed of scrutiny objections, maturity horizons, council releases, and tripartite Finacle reconciliation telemetry.
=======
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
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchNotifications}
            className="px-3.5 py-2 rounded-xl border border-surface-container hover:bg-surface-container text-xs font-semibold text-secondary hover:text-on-surface transition-colors flex items-center gap-1.5"
            title="Refresh notifications"
          >
            <span className={`material-symbols-outlined text-[16px] ${isLoading ? 'animate-spin' : ''}`}>sync</span>
            <span>Refresh</span>
          </button>
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
<<<<<<< HEAD
            className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">done_all</span>
            <span>Mark All as Read</span>
=======
            disabled={isUpdating || unreadCount === 0}
            className="rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface hover:bg-surface-container-low font-label-md text-xs px-3.5 py-2 shadow-xs inline-flex items-center gap-1.5 transition-colors font-semibold disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[17px]">done_all</span>
            <span>{isUpdating ? 'Updating...' : 'Mark All as Read'}</span>
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
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
<<<<<<< HEAD
      <div className="flex items-center gap-2 border-b border-surface-container pb-2">
=======
      <div className="flex items-center gap-2 bg-surface-container-lowest p-3 rounded-2xl border border-surface-container flex-wrap">
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === 'all'
              ? 'bg-primary text-on-primary'
              : 'text-secondary hover:text-on-surface hover:bg-surface-container-low'
          }`}
        >
          All Alerts ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === 'unread'
              ? 'bg-primary text-on-primary'
              : 'text-secondary hover:text-on-surface hover:bg-surface-container-low'
          }`}
        >
<<<<<<< HEAD
          Unread ({notifications.filter(n => !n.read).length})
=======
          Unread Only ({unreadCount})
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
        </button>
        <button
          onClick={() => setFilter('deficiency')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === 'deficiency'
              ? 'bg-primary text-on-primary'
              : 'text-secondary hover:text-on-surface hover:bg-surface-container-low'
          }`}
        >
<<<<<<< HEAD
          Deficiencies & Warnings ({notifications.filter(n => n.type === 'error' || n.type === 'warning').length})
        </button>
      </div>

      {/* Notifications List */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="p-12 text-center bg-surface-container-lowest rounded-2xl border border-surface-container">
            <span className="material-symbols-outlined text-[48px] text-outline-variant mb-2">notifications_off</span>
            <h3 className="text-sm font-bold text-on-surface">No alerts in this view</h3>
            <p className="text-xs text-secondary mt-1">All regulatory obligations and scrutiny items are clear.</p>
          </div>
        ) : (
          filtered.map(item => (
            <div
              key={item.id}
              onClick={() => handleNavigate(item)}
              className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start justify-between gap-4 ${
                !item.read
                  ? 'bg-surface-container-lowest border-primary/30 shadow-xs ring-1 ring-primary/20'
                  : 'bg-surface-container-lowest/60 border-surface-container hover:bg-surface-container-lowest'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    item.type === 'error'
                      ? 'bg-rose-100 text-rose-700'
                      : item.type === 'warning'
                      ? 'bg-amber-100 text-amber-800'
                      : item.type === 'success'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-teal-100 text-teal-800'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {item.type === 'error' ? 'report_problem' : item.type === 'warning' ? 'schedule' : item.type === 'success' ? 'check_circle' : 'info'}
                  </span>
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-on-surface">{item.title}</h3>
                    {!item.read && (
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-primary text-on-primary">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-secondary mt-1 leading-relaxed max-w-3xl">
                    {item.message}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-secondary">
                    <span>{item.timestamp}</span>
                    {item.fdrNumber && (
                      <span className="font-data-mono font-medium text-primary">
                        Ref: {item.fdrNumber}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="self-end sm:self-center shrink-0">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-xl border border-surface-container hover:bg-surface-container text-xs font-semibold text-primary transition-colors flex items-center gap-1"
                >
                  <span>Action</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
=======
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
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
    </div>
  );
}
