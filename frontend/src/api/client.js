/**
<<<<<<< HEAD
 * Real API Client for AICTE FDR Management Portal.
 * Connects to the FastAPI backend with JWT Bearer authentication,
 * environment-configurable base URL, error unwrapping, and file upload support.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export function getStoredToken() {
  return localStorage.getItem('aicte_access_token');
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem('aicte_access_token', token);
  } else {
    localStorage.removeItem('aicte_access_token');
  }
}

export function clearStoredToken() {
  localStorage.removeItem('aicte_access_token');
  localStorage.removeItem('aicte_current_user');
}

/**
 * Universal authenticated fetch wrapper.
 */
export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const token = getStoredToken();
=======
 * AICTE FDR Management Portal - Central API Client
 * Manages JWT tokens, authenticated requests, session restoration, and error extraction.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const TOKEN_STORAGE_KEY = 'aicte_auth_token';
const USER_STORAGE_KEY = 'aicte_auth_user';

export function getToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setStoredUser(user) {
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

/**
 * Universal fetch wrapper handling Bearer auth, headers, and error normalization.
 */
export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const token = getToken();
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4

  const headers = {
    ...(options.headers || {}),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

<<<<<<< HEAD
  // If body is not FormData, default to application/json
=======
  // If body is NOT FormData, default to application/json
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

<<<<<<< HEAD
  // Handle file download responses
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv') || contentType.includes('application/octet-stream') || contentType.includes('application/pdf')) {
    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }
    return response.blob();
  }

  // Handle JSON and empty responses
  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const errorDetail = data?.detail || data?.message || (typeof data === 'string' ? data : 'API request failed');
    const err = new Error(typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail));
    err.status = response.status;
    err.data = data;
    throw err;
=======
  // Handle Unauthorized (401)
  if (response.status === 401) {
    clearSession();
    window.dispatchEvent(new CustomEvent('aicte:unauthorized'));
  }

  // Attempt to parse JSON response
  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    let errorMsg = 'An unexpected API error occurred';
    if (data && typeof data === 'object') {
      if (typeof data.detail === 'string') {
        errorMsg = data.detail;
      } else if (Array.isArray(data.detail)) {
        errorMsg = data.detail.map((err) => `${err.loc?.join('.') || ''}: ${err.msg}`).join(', ');
      } else if (data.message) {
        errorMsg = data.message;
      }
    } else if (typeof data === 'string' && data.length > 0) {
      errorMsg = data;
    }
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
  }

  return data;
}

<<<<<<< HEAD
// =============================================================================
// API Service Modules
// =============================================================================

export const authApi = {
  login: async ({ username, email, password }) => {
    const res = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
    if (res?.access_token) {
      setStoredToken(res.access_token);
      if (res.user) {
        localStorage.setItem('aicte_current_user', JSON.stringify(res.user));
      }
    }
    return res;
  },

  logout: async () => {
    try {
      await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Ignored during client cleanup
    } finally {
      clearStoredToken();
    }
  },

  getMe: async () => {
    return apiFetch('/api/v1/auth/me');
  },

  getDemoAccounts: async () => {
    return apiFetch('/api/v1/auth/demo-accounts');
  },
};

export const fdrsApi = {
  list: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return apiFetch(`/api/v1/fdrs${qs ? `?${qs}` : ''}`);
  },

  get: async (id) => {
    return apiFetch(`/api/v1/fdrs/${id}`);
  },

  create: async (data) => {
    return apiFetch('/api/v1/fdrs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id, data) => {
    return apiFetch(`/api/v1/fdrs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  submit: async (id, data = {}) => {
    return apiFetch(`/api/v1/fdrs/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  startVerification: async (id) => {
    return apiFetch(`/api/v1/fdrs/${id}/start-verification`, {
      method: 'POST',
    });
  },

  checkDuplicates: async (data) => {
    return apiFetch('/api/v1/fdrs/check-duplicates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getAuditLogs: async (id) => {
    return apiFetch(`/api/v1/fdrs/${id}/audit-logs`);
  },

  getDuplicateCandidates: async (id) => {
    return apiFetch(`/api/v1/fdrs/${id}/duplicate-candidates`);
  },
};

export const workflowApi = {
  getPendingVerifications: async () => {
    return apiFetch('/api/v1/verifications/pending');
  },

  verifyFdr: async (fdrId, data) => {
    return apiFetch(`/api/v1/fdrs/${fdrId}/verify`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  approveFdr: async (fdrId, data) => {
    return apiFetch(`/api/v1/fdrs/${fdrId}/approval`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  listRequests: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return apiFetch(`/api/v1/requests${qs ? `?${qs}` : ''}`);
  },

  getRequest: async (id) => {
    return apiFetch(`/api/v1/requests/${id}`);
  },

  createRenewal: async (fdrId, data) => {
    return apiFetch(`/api/v1/fdrs/${fdrId}/renewals`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  completeRenewal: async (requestId, data) => {
    return apiFetch(`/api/v1/requests/${requestId}/complete-renewal`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createRelease: async (fdrId, data) => {
    return apiFetch(`/api/v1/fdrs/${fdrId}/releases`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  transitionRequest: async (requestId, data) => {
    return apiFetch(`/api/v1/requests/${requestId}/transition`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  verifyRequest: async (requestId, data) => {
    return apiFetch(`/api/v1/requests/${requestId}/verify`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  approveRequest: async (requestId, data) => {
    return apiFetch(`/api/v1/requests/${requestId}/approval`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const documentsApi = {
  listFdrDocuments: async (fdrId) => {
    return apiFetch(`/api/v1/fdrs/${fdrId}/documents`);
  },

  uploadFdrDocument: async (fdrId, formData) => {
    return apiFetch(`/api/v1/fdrs/${fdrId}/documents`, {
=======
export const apiClient = {
  // Authentication
  async login({ username, email, password }) {
    const payload = {};
    if (username) payload.username = username;
    if (email) payload.email = email;
    payload.password = password;

    const data = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (data.access_token) {
      setToken(data.access_token);
      setStoredUser(data.user);
    }
    return data;
  },

  async logout() {
    try {
      await apiFetch('/api/v1/auth/logout', {
        method: 'POST',
      });
    } catch (e) {
      console.warn('Logout API call failed or already revoked:', e.message);
    } finally {
      clearSession();
    }
  },

  async getMe() {
    return await apiFetch('/api/v1/auth/me');
  },

  async getDemoAccounts() {
    return await apiFetch('/api/v1/auth/demo-accounts');
  },

  // FDR Management
  async getFdrs(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, v);
      }
    });
    const qs = query.toString();
    return await apiFetch(`/api/v1/fdrs${qs ? '?' + qs : ''}`);
  },

  async getFdr(fdrId) {
    return await apiFetch(`/api/v1/fdrs/${fdrId}`);
  },

  async createFdr(fdrData) {
    return await apiFetch('/api/v1/fdrs', {
      method: 'POST',
      body: JSON.stringify(fdrData),
    });
  },

  async updateFdr(fdrId, updateData) {
    return await apiFetch(`/api/v1/fdrs/${fdrId}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
  },

  async submitFdr(fdrId, submitData = {}) {
    return await apiFetch(`/api/v1/fdrs/${fdrId}/submit`, {
      method: 'POST',
      body: JSON.stringify(submitData),
    });
  },

  async checkDuplicates(fdrData) {
    return await apiFetch('/api/v1/fdrs/check-duplicates', {
      method: 'POST',
      body: JSON.stringify(fdrData),
    });
  },

  // Document Management
  async uploadDocument(fdrId, file, documentType = 'FDR_RECEIPT') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);

    return await apiFetch(`/api/v1/fdrs/${fdrId}/documents`, {
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
      method: 'POST',
      body: formData,
    });
  },

<<<<<<< HEAD
  listRequestDocuments: async (requestId) => {
    return apiFetch(`/api/v1/requests/${requestId}/documents`);
  },

  uploadRequestDocument: async (requestId, formData) => {
    return apiFetch(`/api/v1/requests/${requestId}/documents`, {
      method: 'POST',
      body: formData,
    });
  },

  getDocument: async (docId) => {
    return apiFetch(`/api/v1/documents/${docId}`);
  },

  downloadDocumentUrl: (docId) => {
    const token = getStoredToken();
    return `${BASE_URL}/api/v1/documents/${docId}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
};

export const dashboardApi = {
  getSummary: async () => {
    return apiFetch('/api/v1/dashboard/summary');
  },

  getMaturity: async () => {
    return apiFetch('/api/v1/dashboard/maturity');
  },

  listAuditLogs: async () => {
    return apiFetch('/api/v1/dashboard/audit-logs');
  },
};

export const notificationsApi = {
  list: async () => {
    return apiFetch('/api/v1/notifications');
  },

  markRead: async (id, isRead = true) => {
    return apiFetch(`/api/v1/notifications/${id}`, {
=======
  async getFdrDocuments(fdrId) {
    return await apiFetch(`/api/v1/fdrs/${fdrId}/documents`);
  },

  // Dashboard & Reports
  async getDashboardSummary() {
    return await apiFetch('/api/v1/dashboard/summary');
  },

  async getAuditLogs(fdrId) {
    if (fdrId) {
      return await apiFetch(`/api/v1/fdrs/${fdrId}/audit-logs`);
    }
    return await apiFetch('/api/v1/audit-logs');
  },

  async getAllAuditLogs(params = {}) {
    const q = new URLSearchParams();
    if (params.limit) q.set('limit', params.limit);
    if (params.action && params.action !== 'all') q.set('action', params.action);
    if (params.role && params.role !== 'all') q.set('role', params.role);
    if (params.target_id) q.set('target_id', params.target_id);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return await apiFetch(`/api/v1/audit-logs${qs}`);
  },

  async downloadAuditLogsCsv(params = {}) {
    const q = new URLSearchParams();
    if (params.action && params.action !== 'all') q.set('action', params.action);
    if (params.role && params.role !== 'all') q.set('role', params.role);
    const qs = q.toString() ? `?${q.toString()}` : '';

    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/v1/audit-logs/export.csv${qs}`, {
      headers,
    });
    if (!res.ok) {
      throw new Error(`CSV Export failed: ${res.statusText}`);
    }
    return await res.blob();
  },

  // Workflow Verification & Approval
  async getPendingVerifications() {
    return await apiFetch('/api/v1/verifications/pending');
  },

  async startVerification(fdrId, remarks = 'Claiming FDR into scrutiny review') {
    return await apiFetch(`/api/v1/fdrs/${fdrId}/start-verification`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  async verifyFdr(fdrId, verifyData) {
    return await apiFetch(`/api/v1/fdrs/${fdrId}/verify`, {
      method: 'POST',
      body: JSON.stringify(verifyData),
    });
  },

  async approveFdr(fdrId, approveData) {
    return await apiFetch(`/api/v1/fdrs/${fdrId}/approval`, {
      method: 'POST',
      body: JSON.stringify(approveData),
    });
  },

  // Workflow Requests & Renewals
  async getRequests(params = {}) {
    const q = new URLSearchParams();
    if (params.request_type && params.request_type !== 'all') q.set('request_type', params.request_type);
    if (params.status && params.status !== 'all') q.set('status', params.status);
    if (params.fdr_id) q.set('fdr_id', params.fdr_id);
    if (params.institution_id) q.set('institution_id', params.institution_id);
    const qs = q.toString() ? '?' + q.toString() : '';
    return await apiFetch('/api/v1/requests' + qs);
  },

  async getRequest(requestId) {
    return await apiFetch('/api/v1/requests/' + requestId);
  },

  async createRenewalRequest(fdrId, data) {
    return await apiFetch('/api/v1/fdrs/' + fdrId + '/renewals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async startRequestVerification(requestId) {
    return await apiFetch('/api/v1/requests/' + requestId + '/start-verification', {
      method: 'POST',
    });
  },

  async verifyWorkflowRequest(requestId, verifyData) {
    return await apiFetch('/api/v1/requests/' + requestId + '/verify', {
      method: 'POST',
      body: JSON.stringify(verifyData),
    });
  },

  async approveWorkflowRequest(requestId, approveData) {
    return await apiFetch('/api/v1/requests/' + requestId + '/approval', {
      method: 'POST',
      body: JSON.stringify(approveData),
    });
  },

  async completeRenewalRequest(requestId, completeData) {
    return await apiFetch('/api/v1/requests/' + requestId + '/complete', {
      method: 'POST',
      body: JSON.stringify(completeData),
    });
  },

  async createReleaseRequest(fdrId, data) {
    return await apiFetch('/api/v1/fdrs/' + fdrId + '/release-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async resubmitWorkflowRequest(requestId, data = {}) {
    return await apiFetch('/api/v1/requests/' + requestId + '/resubmit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async cancelWorkflowRequest(requestId, data) {
    return await apiFetch('/api/v1/requests/' + requestId + '/cancel', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async setReleaseReadiness(requestId, data = {}) {
    return await apiFetch('/api/v1/requests/' + requestId + '/release-confirmation/ready', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async confirmReleaseDisbursement(requestId, data) {
    return await apiFetch('/api/v1/requests/' + requestId + '/release-confirmation', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getDuplicateCandidates(fdrId) {
    return await apiFetch(`/api/v1/fdrs/${fdrId}/duplicate-candidates`);
  },

  async downloadDocumentBlob(docId) {
    const token = getToken();
    const url = `${API_BASE_URL}/api/v1/documents/${docId}/download`;
    const resp = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!resp.ok) {
      throw new Error(`Failed to download document: HTTP ${resp.status}`);
    }
    return await resp.blob();
  },

  // Notifications API
  async getNotifications() {
    return await apiFetch('/api/v1/notifications');
  },

  async updateNotification(id, isRead) {
    return await apiFetch(`/api/v1/notifications/${id}`, {
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
      method: 'PATCH',
      body: JSON.stringify({ is_read: isRead }),
    });
  },
<<<<<<< HEAD
};

export const institutionsApi = {
  list: async () => {
    return apiFetch('/api/v1/institutions');
  },

  get: async (id) => {
    return apiFetch(`/api/v1/institutions/${id}`);
  },
};

export const reportsApi = {
  downloadFdrsCsv: async () => {
    const blob = await apiFetch('/api/v1/reports/fdrs.csv');
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aicte_fdr_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default {
  auth: authApi,
  fdrs: fdrsApi,
  workflow: workflowApi,
  documents: documentsApi,
  dashboard: dashboardApi,
  notifications: notificationsApi,
  institutions: institutionsApi,
  reports: reportsApi,
};
=======

  // Reports CSV Downloads
  async downloadFdrsCsv(params = {}) {
    const q = new URLSearchParams();
    if (params.status && params.status !== 'all') q.set('status', params.status);
    if (params.institution_id) q.set('institution_id', params.institution_id);
    const qs = q.toString() ? `?${q.toString()}` : '';

    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/v1/reports/fdrs.csv${qs}`, { headers });
    if (!res.ok) {
      throw new Error(`FDR Report export failed: HTTP ${res.status}`);
    }
    return await res.blob();
  },

  async downloadRequestsCsv(params = {}) {
    const q = new URLSearchParams();
    if (params.request_type && params.request_type !== 'all') q.set('request_type', params.request_type);
    if (params.status && params.status !== 'all') q.set('status', params.status);
    if (params.institution_id) q.set('institution_id', params.institution_id);
    const qs = q.toString() ? `?${q.toString()}` : '';

    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/v1/reports/requests.csv${qs}`, { headers });
    if (!res.ok) {
      throw new Error(`Requests Report export failed: HTTP ${res.status}`);
    }
    return await res.blob();
  },
};
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
