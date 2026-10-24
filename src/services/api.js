/**
 * MediSync - API Client (Frontend → Backend)
 * Menghubungkan React frontend ke Express REST API backend
 * Sesuai PRD Kelompok 4 TeleMed
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper: fetch dengan error handling
async function apiFetch(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  };
  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }
  try {
    const res = await fetch(url, config);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  } catch (err) {
    throw err;
  }
}

// =========================================
// USERS API
// =========================================
export const usersApi = {
  getAll: (params = {}) => apiFetch(`/users?${new URLSearchParams(params)}`),
  getDoctors: () => apiFetch('/users/doctors'),
  getById: (id) => apiFetch(`/users/${id}`),
  login: (email, password) => apiFetch('/users/login', { method: 'POST', body: { email, password } }),
  create: (userData) => apiFetch('/users', { method: 'POST', body: userData }),
  update: (id, data) => apiFetch(`/users/${id}`, { method: 'PUT', body: data }),
  toggleStatus: (id) => apiFetch(`/users/${id}/toggle-status`, { method: 'PATCH' })
};

// =========================================
// APPOINTMENTS API
// =========================================
export const appointmentsApi = {
  getAll: (params = {}) => apiFetch(`/appointments?${new URLSearchParams(params)}`),
  getById: (id) => apiFetch(`/appointments/${id}`),
  create: (data) => apiFetch('/appointments', { method: 'POST', body: data }),
  updateStatus: (id, status) => apiFetch(`/appointments/${id}/status`, { method: 'PATCH', body: { status } }),
  update: (id, data) => apiFetch(`/appointments/${id}`, { method: 'PUT', body: data }),
  cancel: (id) => apiFetch(`/appointments/${id}`, { method: 'DELETE' })
};

// =========================================
// EMR API (dengan Soft Delete sesuai PRD)
// =========================================
export const emrsApi = {
  getAll: (params = {}) => apiFetch(`/emrs?${new URLSearchParams(params)}`),
  getDeleted: (params = {}) => apiFetch(`/emrs/deleted?${new URLSearchParams(params)}`),
  getById: (id) => apiFetch(`/emrs/${id}`),
  create: (data) => apiFetch('/emrs', { method: 'POST', body: data }),
  update: (id, data) => apiFetch(`/emrs/${id}`, { method: 'PUT', body: data }),
  softDelete: (id, deletedBy, reason) =>
    apiFetch(`/emrs/${id}`, { method: 'DELETE', body: { deletedBy, reason } }),
  restore: (id) => apiFetch(`/emrs/${id}/restore`, { method: 'PATCH' })
};

// =========================================
// AUDIT LOGS API
// =========================================
export const auditLogsApi = {
  getAll: (params = {}) => apiFetch(`/audit-logs?${new URLSearchParams(params)}`),
  create: (logData) => apiFetch('/audit-logs', { method: 'POST', body: logData }),
  exportCsv: (params = {}) => {
    const url = `${BASE_URL}/audit-logs/export/csv?${new URLSearchParams(params)}`;
    window.open(url, '_blank');
  }
};

// =========================================
// BACKUP API (Aturan 3-2-1 sesuai PRD)
// =========================================
export const backupApi = {
  getConfig: () => apiFetch('/backup'),
  trigger: (triggeredBy, userId) =>
    apiFetch('/backup/trigger', { method: 'POST', body: { triggeredBy, userId } }),
  downloadSnapshot: () => {
    const url = `${BASE_URL}/backup/snapshot`;
    window.open(url, '_blank');
  }
};

// Health check
export const healthCheck = () => apiFetch('/health');
