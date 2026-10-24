import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient, getToken, clearSession, getStoredUser, setStoredUser } from '../api/client';

export const ROLES = {
  AICTE_ADMIN: 'AICTE_ADMIN',
  INSTITUTION_OFFICER: 'INSTITUTION_OFFICER',
  VERIFICATION_OFFICER: 'VERIFICATION_OFFICER',
  APPROVING_AUTHORITY: 'APPROVING_AUTHORITY',
};

export function mapUserFromBackend(bUser) {
  if (!bUser) return null;
  const role = (bUser.role || '').toUpperCase();

  let roleLabel = 'AICTE Official';
  let roleBadge = 'Central Custody';
  let defaultRoute = 'dashboard';
  let title = 'Authorized Officer';
  let department = 'AICTE Statutory Portal';
  let location = 'HQ New Delhi';

  if (role === ROLES.AICTE_ADMIN) {
    roleLabel = 'AICTE Admin';
    roleBadge = 'Central Custody';
    defaultRoute = 'dashboard';
    title = 'Joint Director - Finance';
    department = 'Central Regulatory Financial Custody Division';
  } else if (role === ROLES.INSTITUTION_OFFICER) {
    roleLabel = 'Institution Officer';
    roleBadge = bUser.institution_name ? bUser.institution_name.split(' ')[0] : `Inst ${bUser.institution_id || ''}`;
    defaultRoute = 'institution_dashboard';
    title = 'Secretary / Trustee / Principal';
    department = bUser.institution_name || 'Technical Institution';
    location = 'Affiliated Institute';
  } else if (role === ROLES.VERIFICATION_OFFICER) {
    roleLabel = 'Verification Officer';
    roleBadge = 'WRO Scrutiny Desk';
    defaultRoute = 'verification_audit';
    title = 'Regional Scrutiny Officer';
    department = 'AICTE Western Regional Office (WRO)';
    location = 'Pune / Mumbai';
  } else if (role === ROLES.APPROVING_AUTHORITY) {
    roleLabel = 'Approving Authority';
    roleBadge = 'Statutory Council';
    defaultRoute = 'verification_audit';
    title = 'Member Secretary / Approving Authority';
    department = 'AICTE Statutory Executive Council';
    location = 'HQ New Delhi';
  }

  // Derive college AICTE PID based on institution_id
  let pid = '1-10928374';
  if (bUser.institution_id === 2) {
    pid = '1-28374619';
  } else if (bUser.institution_id) {
    pid = `1-${String(bUser.institution_id).padStart(8, '0')}`;
  }

  return {
    id: bUser.user_id || bUser.id,
    userId: bUser.user_id || bUser.id,
    username: bUser.username,
    email: bUser.email,
    name: bUser.name,
    role: role,
    roleLabel,
    roleBadge,
    defaultRoute,
    title,
    department,
    location,
    institution: bUser.institution_name,
    institutionId: bUser.institution_id,
    institutionName: bUser.institution_name,
    pid: pid,
    aictePid: pid,
    permissions: [
      role === ROLES.AICTE_ADMIN && 'view_all_fdrs',
      role === ROLES.INSTITUTION_OFFICER && 'view_own_fdrs',
      role === ROLES.VERIFICATION_OFFICER && 'verify_instruments',
      role === ROLES.APPROVING_AUTHORITY && 'approve_fdr',
    ].filter(Boolean),
  };
}

const RoleContext = createContext();

export function RoleProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const cached = getStoredUser();
    return cached ? mapUserFromBackend(cached) : null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken());
  const [isLoading, setIsLoading] = useState(true);

  const currentRole = currentUser?.role || ROLES.AICTE_ADMIN;

  const [activeRoute, setActiveRoute] = useState(() => {
    const savedRoute = localStorage.getItem('aicte_active_route');
    if (savedRoute) return savedRoute;
    return currentUser?.defaultRoute || 'dashboard';
  });

  const [fiscalYear, setFiscalYear] = useState('2024 - 2025');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [selectedFdrRef, setSelectedFdrRef] = useState(null);

  // Restore authenticated session on mount
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const token = getToken();
      if (!token) {
        if (isMounted) {
          setIsAuthenticated(false);
          setCurrentUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const userProfile = await apiClient.getMe();
        if (isMounted) {
          const mapped = mapUserFromBackend(userProfile);
          setCurrentUser(mapped);
          setIsAuthenticated(true);
          setStoredUser(userProfile);
        }
      } catch (err) {
        console.warn('Session restoration failed:', err.message);
        if (isMounted) {
          clearSession();
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    // Listen for unauthorized events dispatched by API client
    const handleUnauthorized = () => {
      clearSession();
      setIsAuthenticated(false);
      setCurrentUser(null);
    };

    window.addEventListener('aicte:unauthorized', handleUnauthorized);

    return () => {
      isMounted = false;
      window.removeEventListener('aicte:unauthorized', handleUnauthorized);
    };
  }, []);

  // Save active route to localStorage
  useEffect(() => {
    if (activeRoute) {
      localStorage.setItem('aicte_active_route', activeRoute);
    }
  }, [activeRoute]);

  const login = useCallback(async (credentials) => {
    const response = await apiClient.login(credentials);
    const mapped = mapUserFromBackend(response.user);
    setCurrentUser(mapped);
    setIsAuthenticated(true);
    const targetRoute = mapped.defaultRoute;
    setActiveRoute(targetRoute);
    localStorage.setItem('aicte_active_route', targetRoute);
    return mapped;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } catch (e) {
      console.warn('Logout error ignored:', e.message);
    } finally {
      clearSession();
      setIsAuthenticated(false);
      setCurrentUser(null);
      localStorage.removeItem('aicte_active_route');
      setActiveRoute('dashboard');
    }
  }, []);

  const navigateTo = useCallback((route, fdrRef = null) => {
    setActiveRoute(route);
    if (fdrRef) {
      setSelectedFdrRef(fdrRef);
    }
    setIsMobileSidebarOpen(false);
  }, []);

  return (
    <RoleContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        currentRole,
        currentUser,
        login,
        logout,
        activeRoute,
        setActiveRoute: navigateTo,
        fiscalYear,
        setFiscalYear,
        searchQuery,
        setSearchQuery,
        isRoleModalOpen,
        setIsRoleModalOpen,
        isMobileSidebarOpen,
        setIsMobileSidebarOpen,
        isNotificationOpen,
        setIsNotificationOpen,
        selectedFdrRef,
        setSelectedFdrRef,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
