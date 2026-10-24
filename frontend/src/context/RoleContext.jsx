import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient, getToken, clearSession, getStoredUser, setStoredUser } from '../api/client';
import { ROLES, isRouteAllowed, getDefaultRoute } from '../config/roleAccess';

export { ROLES };

export const ROLE_PERSONAS = {
  [ROLES.INSTITUTION_OFFICER]: {
    user_id: 2,
    username: 'officer_deshmukh',
    email: 'officer.deshmukh@stxaviers.edu.in',
    name: 'Dr. Anand Deshmukh',
    role: ROLES.INSTITUTION_OFFICER,
    institution_id: 1,
    institution_name: "St. Xavier's Engineering College",
  },
  [ROLES.VERIFICATION_OFFICER]: {
    user_id: 4,
    username: 'verif_malhotra',
    email: 'malhotra.vk@aicte-india.org',
    name: 'Shri V. K. Malhotra',
    role: ROLES.VERIFICATION_OFFICER,
  },
  [ROLES.APPROVING_AUTHORITY]: {
    user_id: 5,
    username: 'approver_kumar',
    email: 'ms.kumar@aicte-india.org',
    name: 'Prof. Rajive Kumar',
    role: ROLES.APPROVING_AUTHORITY,
  },
  [ROLES.AICTE_ADMIN]: {
    user_id: 1,
    username: 'admin_sridhar',
    email: 'sridhar.rk@aicte-india.org',
    name: 'Dr. R. K. Sridhar',
    role: ROLES.AICTE_ADMIN,
  },
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
    roleLabel = 'Admin';
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
    defaultRoute = 'dashboard';
    title = 'Regional Scrutiny Officer';
    department = 'AICTE Western Regional Office (WRO)';
    location = 'Pune / Mumbai';
  } else if (role === ROLES.APPROVING_AUTHORITY) {
    roleLabel = 'Approving Authority';
    roleBadge = 'Statutory Council';
    defaultRoute = 'dashboard';
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
    return cached ? mapUserFromBackend(cached) : mapUserFromBackend(ROLE_PERSONAS[ROLES.AICTE_ADMIN]);
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken() || true);
  const [isLoading, setIsLoading] = useState(false);

  const currentRole = currentUser?.role || ROLES.AICTE_ADMIN;

  const [activeRoute, setActiveRoute] = useState(() => {
    const savedRoute = localStorage.getItem('aicte_active_route');
    if (savedRoute && isRouteAllowed(currentRole, savedRoute)) return savedRoute;
    return getDefaultRoute(currentRole);
  });

  const [fiscalYear, setFiscalYear] = useState('2024 - 2025');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [selectedFdrRef, setSelectedFdrRef] = useState(null);

  // Restore authenticated session on mount if token exists
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const token = getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const userProfile = await apiClient.getMe();
        if (isMounted && userProfile) {
          const mapped = mapUserFromBackend(userProfile);
          setCurrentUser(mapped);
          setIsAuthenticated(true);
          setStoredUser(userProfile);
        }
      } catch (err) {
        console.warn('Session restoration failed:', err.message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

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

  // Route guard: if current role is not allowed to view activeRoute, redirect to default
  useEffect(() => {
    if (currentRole && !isRouteAllowed(currentRole, activeRoute)) {
      const fallback = getDefaultRoute(currentRole);
      setActiveRoute(fallback);
    }
  }, [currentRole, activeRoute]);

  const login = useCallback(async (credentials) => {
    const response = await apiClient.login(credentials);
    const mapped = mapUserFromBackend(response.user);
    setCurrentUser(mapped);
    setIsAuthenticated(true);
    const targetRoute = getDefaultRoute(mapped.role);
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

  // Central role switch handler: updates user, sets default route, persists
  const switchRole = useCallback((newRole) => {
    const persona = ROLE_PERSONAS[newRole];
    if (persona) {
      const mapped = mapUserFromBackend(persona);
      setCurrentUser(mapped);
      setStoredUser(persona);
      const defRoute = getDefaultRoute(newRole);
      setActiveRoute(defRoute);
      localStorage.setItem('aicte_active_route', defRoute);
    }
    setIsRoleModalOpen(false);
  }, []);

  const navigateTo = useCallback((route, fdrRef = null) => {
    if (!isRouteAllowed(currentRole, route)) {
      const fallback = getDefaultRoute(currentRole);
      setActiveRoute(fallback);
      return;
    }
    setActiveRoute(route);
    if (fdrRef) {
      setSelectedFdrRef(fdrRef);
    }
    setIsMobileSidebarOpen(false);
  }, [currentRole]);

  return (
    <RoleContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        currentRole,
        currentUser,
        login,
        logout,
        switchRole,
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
