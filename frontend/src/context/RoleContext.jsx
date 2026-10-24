import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
<<<<<<< HEAD
import { authApi, getStoredToken, setStoredToken, clearStoredToken } from '../api/client';
=======
import { apiClient, getToken, clearSession, getStoredUser, setStoredUser } from '../api/client';
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4

export const ROLES = {
  AICTE_ADMIN: 'AICTE_ADMIN',
  INSTITUTION_OFFICER: 'INSTITUTION_OFFICER',
  VERIFICATION_OFFICER: 'VERIFICATION_OFFICER',
  APPROVING_AUTHORITY: 'APPROVING_AUTHORITY',
<<<<<<< HEAD
};

// Known development demo account credentials matching backend app.auth.DEMO_ACCOUNTS_METADATA
export const DEMO_CREDENTIALS = {
  [ROLES.AICTE_ADMIN]: {
    username: 'admin_sridhar',
    password: 'AdminDemo@2026',
    role: ROLES.AICTE_ADMIN,
  },
  [ROLES.INSTITUTION_OFFICER]: {
    username: 'officer_deshmukh',
    password: 'OfficerDemo@2026',
    role: ROLES.INSTITUTION_OFFICER,
  },
  [ROLES.VERIFICATION_OFFICER]: {
    username: 'verif_malhotra',
    password: 'VerifDemo@2026',
    role: ROLES.VERIFICATION_OFFICER,
  },
  [ROLES.APPROVING_AUTHORITY]: {
    username: 'approver_kumar',
    password: 'ApproverDemo@2026',
    role: ROLES.APPROVING_AUTHORITY,
  },
};

export const DEMO_USERS = {
  [ROLES.AICTE_ADMIN]: {
    id: 1,
    name: 'Dr. R. K. Sridhar',
    title: 'Joint Director - Finance',
    department: 'Central Regulatory Financial Custody Division',
    location: 'HQ New Delhi',
    role: ROLES.AICTE_ADMIN,
    roleLabel: 'AICTE Admin',
    roleBadge: 'Central Custody',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD49Ee014TJZpJttORQWistOVB6lubjmnDMn_xvFa8_xPM4RiFEyxSKdOcaEZlJSluR9KCPZwXcveZZm74hRto6KhDaL8YbZhy-3USrjhWrDgnPQXTvYQNfOKSyuYxtmuUZ7XKx8epxxZNPNeKe5ZKye7sHumpJ10HVlkbs8FVKx4tsO7qoCnuKphSUbqebuxDxCavyYpohj3MLO1lutVm_Rpx6pjworYupfmkyR2QsM1eHnUTgFdtj2A',
    permissions: ['view_all_fdrs', 'export_registry', 'issue_notices', 'manage_institutions', 'view_audit_trail'],
    defaultRoute: 'dashboard'
  },
  [ROLES.INSTITUTION_OFFICER]: {
    id: 2,
    name: 'Dr. Anand Deshmukh',
    title: 'Secretary / Trustee',
    institution: "St. Xavier's Engineering College, Pune",
    sponsoringTrust: "St. Xavier's Technical Education Society",
    pid: '1-10928374',
    institutionId: 1,
    region: 'WRO Mumbai/Pune',
    accreditation: 'Grade A Regulatory',
    role: ROLES.INSTITUTION_OFFICER,
    roleLabel: 'Institution Officer',
    roleBadge: 'PID: 1-10928374',
    avatar: null,
    permissions: ['view_own_fdrs', 'submit_fdr', 'resubmit_correction', 'request_renewal', 'request_release', 'download_templates'],
    defaultRoute: 'institution_dashboard'
  },
  [ROLES.VERIFICATION_OFFICER]: {
    id: 4,
    name: 'Shri V. K. Malhotra',
    title: 'Regional Scrutiny Officer',
    department: 'AICTE Western Regional Office (WRO)',
    location: 'Pune / Mumbai',
    role: ROLES.VERIFICATION_OFFICER,
    roleLabel: 'Verification Officer',
    roleBadge: 'WRO Scrutiny Desk',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD49Ee014TJZpJttORQWistOVB6lubjmnDMn_xvFa8_xPM4RiFEyxSKdOcaEZlJSluR9KCPZwXcveZZm74hRto6KhDaL8YbZhy-3USrjhWrDgnPQXTvYQNfOKSyuYxtmuUZ7XKx8epxxZNPNeKe5ZKye7sHumpJ10HVlkbs8FVKx4tsO7qoCnuKphSUbqebuxDxCavyYpohj3MLO1lutVm_Rpx6pjworYupfmkyR2QsM1eHnUTgFdtj2A',
    permissions: ['verify_instruments', 'flag_discrepancies', 'cross_audit_telemetry', 'add_statutory_remarks', 'recommend_endorsement'],
    defaultRoute: 'verification_audit'
  },
  [ROLES.APPROVING_AUTHORITY]: {
    id: 5,
    name: 'Prof. Rajive Kumar',
    title: 'Member Secretary / Approving Authority',
    department: 'AICTE Statutory Executive Council',
    location: 'HQ New Delhi',
    role: ROLES.APPROVING_AUTHORITY,
    roleLabel: 'Approving Authority',
    roleBadge: 'Statutory Council',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD49Ee014TJZpJttORQWistOVB6lubjmnDMn_xvFa8_xPM4RiFEyxSKdOcaEZlJSluR9KCPZwXcveZZm74hRto6KhDaL8YbZhy-3USrjhWrDgnPQXTvYQNfOKSyuYxtmuUZ7XKx8epxxZNPNeKe5ZKye7sHumpJ10HVlkbs8FVKx4tsO7qoCnuKphSUbqebuxDxCavyYpohj3MLO1lutVm_Rpx6pjworYupfmkyR2QsM1eHnUTgFdtj2A',
    permissions: ['approve_fdr', 'reject_fdr', 'apply_dsc_signature', 'authorize_release', 'invoke_lien'],
    defaultRoute: 'verification_audit'
=======
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
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
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
<<<<<<< HEAD
  // Normalize saved role
  const [currentRole, setCurrentRole] = useState(() => {
    const saved = (localStorage.getItem('aicte_current_role') || '').toUpperCase();
    return ROLES[saved] || ROLES.AICTE_ADMIN;
=======
  const [currentUser, setCurrentUser] = useState(() => {
    const cached = getStoredUser();
    return cached ? mapUserFromBackend(cached) : null;
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken());
  const [isLoading, setIsLoading] = useState(true);

  const currentRole = currentUser?.role || ROLES.AICTE_ADMIN;

  const [activeRoute, setActiveRoute] = useState(() => {
    const savedRoute = localStorage.getItem('aicte_active_route');
    if (savedRoute) return savedRoute;
    return currentUser?.defaultRoute || 'dashboard';
  });

  const [currentUser, setCurrentUser] = useState(() => {
    return DEMO_USERS[currentRole] || DEMO_USERS[ROLES.AICTE_ADMIN];
  });

  const [demoAccounts, setDemoAccounts] = useState([]);
  const [authError, setAuthError] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  const [fiscalYear, setFiscalYear] = useState('2024 - 2025');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [selectedFdrRef, setSelectedFdrRef] = useState(null);

<<<<<<< HEAD
  // Authenticate against backend
  const authenticateRole = useCallback(async (roleKey) => {
    const creds = DEMO_CREDENTIALS[roleKey];
    if (!creds) return;
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      // Login via POST /api/v1/auth/login
      const loginRes = await authApi.login({
        username: creds.username,
        password: creds.password,
      });

      // Fetch verified profile from GET /api/v1/auth/me
      const profile = await authApi.getMe();
      const baseDemo = DEMO_USERS[profile.role] || DEMO_USERS[roleKey] || {};

      const combinedUser = {
        ...baseDemo,
        id: profile.user_id,
        name: profile.name || baseDemo.name,
        role: profile.role,
        roleLabel: baseDemo.roleLabel || profile.role,
        roleBadge: profile.institution_id ? `PID: 1-10928374` : baseDemo.roleBadge,
        institutionId: profile.institution_id,
        institutionName: profile.institution_name || baseDemo.institution,
        email: profile.email,
        username: profile.username,
      };

      setCurrentRole(profile.role);
      setCurrentUser(combinedUser);
      localStorage.setItem('aicte_current_role', profile.role);
    } catch (err) {
      console.warn('Backend authentication failed, falling back to local simulation:', err);
      setAuthError(err.message);
      // Fallback to static persona definition
      const fallback = DEMO_USERS[roleKey] || DEMO_USERS[ROLES.AICTE_ADMIN];
      setCurrentRole(roleKey);
      setCurrentUser(fallback);
      localStorage.setItem('aicte_current_role', roleKey);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  // Initial authentication on mount
  useEffect(() => {
    authenticateRole(currentRole);

    // Fetch demo accounts list from backend
    authApi.getDemoAccounts()
      .then(res => {
        if (Array.isArray(res)) setDemoAccounts(res);
      })
      .catch(() => {});
  }, []);

=======
  // Restore authenticated session on mount
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
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

<<<<<<< HEAD
  const switchRole = async (newRole) => {
    const normalized = newRole.toUpperCase();
    if (!DEMO_USERS[normalized] && !ROLES[normalized]) return;
    const targetRole = ROLES[normalized] || normalized;

    await authenticateRole(targetRole);

    const newRoute = DEMO_USERS[targetRole]?.defaultRoute || 'dashboard';
    setActiveRoute(newRoute);
    setIsRoleModalOpen(false);
    setIsMobileSidebarOpen(false);
  };
=======
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
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4

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
<<<<<<< HEAD
  };
=======
  }, []);
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4

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
<<<<<<< HEAD
        demoAccounts,
        authError,
        isLoadingAuth,
        authenticateRole,
=======
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
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
