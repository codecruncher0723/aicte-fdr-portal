/**
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

  const headers = {
    ...(options.headers || {}),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If body is NOT FormData, default to application/json
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

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
  }

  return data;
}

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
      method: 'POST',
      body: formData,
    });
  },

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
      method: 'PATCH',
      body: JSON.stringify({ is_read: isRead }),
    });
  },

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
