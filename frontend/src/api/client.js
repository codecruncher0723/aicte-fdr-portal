/**
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

  const headers = {
    ...(options.headers || {}),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If body is not FormData, default to application/json
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

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
  }

  return data;
}

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
      method: 'POST',
      body: formData,
    });
  },

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
      method: 'PATCH',
      body: JSON.stringify({ is_read: isRead }),
    });
  },
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
