/**
 * Central Role-Based Access Control (RBAC) Configuration
 * Drives route guards, allowed routes, sidebar navigation, and decision authorization.
 */

export const ROLES = {
  INSTITUTION_OFFICER: 'INSTITUTION_OFFICER',
  VERIFICATION_OFFICER: 'VERIFICATION_OFFICER',
  APPROVING_AUTHORITY: 'APPROVING_AUTHORITY',
  AICTE_ADMIN: 'AICTE_ADMIN',
};

// Delegated authority limit for Approving Authority
// TODO: confirm with backend
export const DELEGATED_AMOUNT_LIMIT = 100000000; // ₹10,00,00,000 (10 Cr)

export const ROLE_CONFIG = {
  [ROLES.INSTITUTION_OFFICER]: {
    defaultRoute: 'institution_dashboard',
    label: 'Institution Officer',
    allowedRoutes: [
      'institution_dashboard',
      'my_fdrs',
      'submit_new_fdr',
      'renewals',
      'release_refund_requests',
      'notifications',
      'profile_trust_details',
      'aph_guidelines_templates',
    ],
    primaryNav: [
      { id: 'institution_dashboard', label: 'Dashboard', icon: 'dashboard', badge: null },
      { id: 'my_fdrs', label: 'My FDRs', icon: 'account_balance_wallet', badge: null },
      { id: 'submit_new_fdr', label: 'Submit New FDR', icon: 'add_circle', badge: '+ Add', badgeType: 'primary-add' },
      { id: 'renewals', label: 'Renewals', icon: 'autorenew', badge: '1 Due', badgeType: 'warning' },
      { id: 'release_refund_requests', label: 'Release/Refund Requests', icon: 'currency_exchange', badge: null },
    ],
    secondaryNav: [
      { id: 'notifications', label: 'Notifications', icon: 'notifications', badge: '2', badgeType: 'error' },
      { id: 'profile_trust_details', label: 'Profile & Trust Details', icon: 'verified_user', badge: null },
      { id: 'aph_guidelines_templates', label: 'APH Guidelines & Templates', icon: 'description', badge: null },
    ],
  },

  [ROLES.VERIFICATION_OFFICER]: {
    defaultRoute: 'dashboard',
    label: 'Verification Officer',
    allowedRoutes: [
      'dashboard',
      'registry',
      'verification',
    ],
    primaryNav: [
      { id: 'dashboard', label: 'Scrutiny Desk', icon: 'speed', badge: 'Desk', badgeType: 'info' },
      { id: 'verification', label: 'Verification Queue', icon: 'fact_check', badge: 'Active', badgeType: 'warning' },
      { id: 'registry', label: 'Master Repository', icon: 'folder_shared', badge: null },
    ],
    secondaryNav: [],
  },

  [ROLES.APPROVING_AUTHORITY]: {
    defaultRoute: 'dashboard',
    label: 'Approving Authority',
    allowedRoutes: [
      'dashboard',
      'registry',
      'approval',
    ],
    primaryNav: [
      { id: 'dashboard', label: 'Executive Council', icon: 'corporate_fare', badge: 'Council', badgeType: 'purple' },
      { id: 'approval', label: 'Approval Queue', icon: 'gavel', badge: 'Decide', badgeType: 'purple' },
      { id: 'registry', label: 'Council Registry', icon: 'account_balance', badge: null },
    ],
    secondaryNav: [],
  },

  [ROLES.AICTE_ADMIN]: {
    defaultRoute: 'dashboard',
    label: 'Admin',
    allowedRoutes: [
      'dashboard',
      'registry',
      'verification',
      'approval',
      'maturity_renewals',
      'release_requests',
      'reports',
      'institutions',
      'audit_logs',
      'settings',
      'help_manuals',
    ],
    primaryNav: [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', badge: null },
      { id: 'registry', label: 'FDR Registry', icon: 'account_balance', badge: null },
      { id: 'verification', label: 'Verification', icon: 'verified', badge: null },
      { id: 'approval', label: 'Approval', icon: 'gavel', badge: null },
      { id: 'maturity_renewals', label: 'Maturity & Renewals', icon: 'event_repeat', badge: null },
      { id: 'release_requests', label: 'Release Requests', icon: 'lock_open', badge: null },
      { id: 'reports', label: 'Reports', icon: 'analytics', badge: null },
      { id: 'institutions', label: 'Institutions', icon: 'domain', badge: null },
      { id: 'audit_logs', label: 'Audit Logs', icon: 'policy', badge: null },
    ],
    secondaryNav: [
      { id: 'settings', label: 'Settings', icon: 'settings', badge: null },
      { id: 'help_manuals', label: 'Help & Manuals', icon: 'help_outline', badge: null },
    ],
  },
};

/**
 * Checks if a route is allowed for a given role
 */
export function isRouteAllowed(role, route) {
  if (!role || !route) return false;
  const config = ROLE_CONFIG[role];
  if (!config) return false;
  return config.allowedRoutes.includes(route);
}

/**
 * Gets default landing route for a given role
 */
export function getDefaultRoute(role) {
  return ROLE_CONFIG[role]?.defaultRoute || 'dashboard';
}

/**
 * Gets allowed navigation items for a given role
 */
export function getRoleNavItems(role) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG[ROLES.AICTE_ADMIN];
  return {
    primaryNav: config.primaryNav || [],
    secondaryNav: config.secondaryNav || [],
  };
}

/**
 * Single place for decision authorization.
 * Admin sees the Verification and Approval pages, but decision buttons
 * (Mark reviewed, Return, Approve, Reject) are hidden for Admin.
 */
export function canAct(role) {
  return role !== ROLES.AICTE_ADMIN;
}
