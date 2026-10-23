import React, { createContext, useContext, useState, useEffect } from 'react';

export const ROLES = {
  AICTE_ADMIN: 'aicte_admin',
  INSTITUTION_OFFICER: 'institution_officer',
  VERIFICATION_OFFICER: 'verification_officer',
  APPROVING_AUTHORITY: 'approving_authority',
};

export const DEMO_USERS = {
  [ROLES.AICTE_ADMIN]: {
    id: 'usr_admin_01',
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
    id: 'usr_inst_01',
    name: 'Dr. Anand Deshmukh',
    title: 'Secretary / Trustee',
    institution: "St. Xavier's Engineering College, Pune",
    sponsoringTrust: "St. Xavier's Technical Education Society",
    pid: '1-10928374',
    region: 'WRO Mumbai/Pune',
    accreditation: 'Grade A Regulatory',
    role: ROLES.INSTITUTION_OFFICER,
    roleLabel: 'Institution Officer',
    roleBadge: 'PID: 1-10928374',
    avatar: null, // Will render initials or person icon
    permissions: ['view_own_fdrs', 'submit_fdr', 'resubmit_correction', 'request_renewal', 'request_release', 'download_templates'],
    defaultRoute: 'institution_dashboard'
  },
  [ROLES.VERIFICATION_OFFICER]: {
    id: 'usr_verif_01',
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
    id: 'usr_appr_01',
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
  }
};

const RoleContext = createContext();

export function RoleProvider({ children }) {
  const [currentRole, setCurrentRole] = useState(() => {
    return localStorage.getItem('aicte_current_role') || ROLES.AICTE_ADMIN;
  });

  const [activeRoute, setActiveRoute] = useState(() => {
    const savedRoute = localStorage.getItem('aicte_active_route');
    if (savedRoute) return savedRoute;
    return DEMO_USERS[currentRole]?.defaultRoute || 'dashboard';
  });

  const [fiscalYear, setFiscalYear] = useState('2024 - 2025');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [selectedFdrRef, setSelectedFdrRef] = useState('FDR-PNB-883921');

  useEffect(() => {
    localStorage.setItem('aicte_current_role', currentRole);
  }, [currentRole]);

  useEffect(() => {
    localStorage.setItem('aicte_active_route', activeRoute);
  }, [activeRoute]);

  const switchRole = (newRole) => {
    if (!DEMO_USERS[newRole]) return;
    setCurrentRole(newRole);
    const newRoute = DEMO_USERS[newRole].defaultRoute;
    setActiveRoute(newRoute);
    setIsRoleModalOpen(false);
    setIsMobileSidebarOpen(false);
  };

  const navigateTo = (route, fdrRef = null) => {
    setActiveRoute(route);
    if (fdrRef) {
      setSelectedFdrRef(fdrRef);
    }
    setIsMobileSidebarOpen(false);
  };

  const currentUser = DEMO_USERS[currentRole];

  return (
    <RoleContext.Provider
      value={{
        currentRole,
        currentUser,
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
        setSelectedFdrRef
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
