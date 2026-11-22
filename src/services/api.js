/**
 * MediSync - API Client (Frontend -> FastAPI Backend)
 * Menghubungkan React frontend ke FastAPI REST API backend dengan JWT Bearer Auth.
 * Token disimpan di sessionStorage (bukan localStorage).
 * Tidak ada data medis/pengguna di storage browser.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'telemed_token';

// Helper token di sessionStorage
export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (token) => sessionStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

/**
 * Format error dari respons FastAPI (bisa string atau list validasi Pydantic)
 */
function parseFastApiError(data, status) {
  if (!data) return `HTTP Error ${status}`;
  if (typeof data.detail === 'string') {
    return data.detail;
  }
  if (Array.isArray(data.detail)) {
    // Array error validasi Pydantic
    return data.detail
      .map((err) => {
        const field = err.loc && err.loc.length > 0 ? err.loc[err.loc.length - 1] : '';
        return field ? `${field}: ${err.msg}` : err.msg;
      })
      .join(', ');
  }
  if (data.message) return data.message;
  if (data.error) return data.error;
  return `HTTP Error ${status}`;
}

/**
 * Wrapper apiFetch dengan JWT token otomatis, error parsing, dan 401 handling.
 */
export async function apiFetch(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const token = getToken();

  const headers = {
    Accept: 'application/json',
    ...options.headers,
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, config);

    // Otomatis tangani 401 Unauthorized
    if (res.status === 401) {
      clearToken();
      window.dispatchEvent(new CustomEvent('telemed:unauthorized'));
    }

    // Jika response 204 No Content
    if (res.status === 204) {
      return null;
    }

    // Periksa Content-Type
    const contentType = res.headers.get('content-type') || '';
    let data = null;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    if (!res.ok) {
      const errorMessage = parseFastApiError(data, res.status);
      const error = new Error(errorMessage);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    throw err;
  }
}

// =========================================
// AUTH API
// =========================================
export const authApi = {
  getMe: () => apiFetch('/auth/me'),
  login: (credentials) =>
    apiFetch('/auth/login', {
      method: 'POST',
      body: credentials,
    }),
  register: (patientData) =>
    apiFetch('/auth/register', {
      method: 'POST',
      body: patientData,
    }),
  changePassword: (passwords) =>
    apiFetch('/auth/change-password', {
      method: 'POST',
      body: passwords,
    }),
  forgotPassword: (data) =>
    apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: data,
    }),
};

// =========================================
// USERS API
// =========================================
export const usersApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/users${query ? `?${query}` : ''}`);
  },
  getDoctors: () => apiFetch('/users/doctors'),
  getPatients: () => apiFetch('/users/patients'),
  createDoctor: (doctorData) =>
    apiFetch('/users/doctor', {
      method: 'POST',
      body: doctorData,
    }),
  createPatient: (patientData) =>
    apiFetch('/users/patient', {
      method: 'POST',
      body: patientData,
    }),
  updateProfile: (id, profileData) =>
    apiFetch(`/users/${id}`, {
      method: 'PUT',
      body: profileData,
    }),
  uploadProfilePhoto: (id, image) => {
    const body = new FormData();
    body.append('image', image);
    return apiFetch(`/users/${id}/profile-photo`, {
      method: 'POST',
      body,
    });
  },
  delete: (id, reason) =>
    apiFetch(`/users/${id}`, {
      method: 'DELETE',
      body: { reason },
    }),
  toggleStatus: (id) =>
    apiFetch(`/users/${id}/toggle-status`, {
      method: 'PATCH',
    }),
};

// =========================================
// CONSULTATIONS API (Jadwal / Telekonsultasi)
// =========================================
export const consultationsApi = {
  getAll: (params = {}) => {
    const cleanParams = {};
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        cleanParams[key] = params[key];
      }
    });
    const query = new URLSearchParams(cleanParams).toString();
    return apiFetch(`/consultations${query ? `?${query}` : ''}`);
  },
  getById: (id) => apiFetch(`/consultations/${id}`),
  create: (data) =>
    apiFetch('/consultations', {
      method: 'POST',
      body: data,
    }),
  updateStatus: (id, status) =>
    apiFetch(`/consultations/${id}/status`, {
      method: 'PATCH',
      body: { status },
    }),
  delete: (id, reason) =>
    apiFetch(`/consultations/${id}`, {
      method: 'DELETE',
      body: { reason },
    }),
};

export const adminRecoveryApi = {
  getDeleted: () => apiFetch('/admin/recovery'),
  restore: (entity, id) =>
    apiFetch(`/admin/recovery/${entity}/${id}`, {
      method: 'PATCH',
    }),
};

// =========================================
// MEDICAL RECORDS (EMR) API
// =========================================
export const medicalRecordsApi = {
  getAll: (params = {}) => {
    const cleanParams = {};
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        cleanParams[key] = params[key];
      }
    });
    const query = new URLSearchParams(cleanParams).toString();
    return apiFetch(`/medical-records${query ? `?${query}` : ''}`);
  },
  getDeleted: () => apiFetch('/medical-records/deleted'),
  getById: (id) => apiFetch(`/medical-records/${id}`),
  create: (data) =>
    apiFetch('/medical-records', {
      method: 'POST',
      body: data,
    }),
  update: (id, data) =>
    apiFetch(`/medical-records/${id}`, {
      method: 'PUT',
      body: data,
    }),
  delete: (id, reason = 'Dihapus oleh dokter pemeriksa') =>
    apiFetch(`/medical-records/${id}`, {
      method: 'DELETE',
      body: { reason },
    }),
  restore: (id) =>
    apiFetch(`/medical-records/${id}/restore`, {
      method: 'PATCH',
    }),
};

// =========================================
// AUDIT LOGS API
// =========================================
export const auditLogsApi = {
  getAll: (params = {}) => {
    const cleanParams = {};
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        cleanParams[key] = params[key];
      }
    });
    const query = new URLSearchParams(cleanParams).toString();
    return apiFetch(`/audit-logs${query ? `?${query}` : ''}`);
  },
  exportCsv: async (params = {}) => {
    const token = getToken();
    const cleanParams = {};
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        cleanParams[key] = params[key];
      }
    });
    const query = new URLSearchParams(cleanParams).toString();
    const url = `${BASE_URL}/audit-logs/export/csv${query ? `?${query}` : ''}`;

    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      let errText = `HTTP Error ${res.status}`;
      try {
        const errJson = await res.json();
        errText = parseFastApiError(errJson, res.status);
      } catch (_) {}
      throw new Error(errText);
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
    return true;
  },
};

// =========================================
// BACKUP & DRP API
// =========================================
export const backupApi = {
  getOverview: () => apiFetch('/backup'),
  trigger: () =>
    apiFetch('/backup/trigger', {
      method: 'POST',
    }),
};

export const drpApi = {
  getStatus: () => apiFetch('/drp/status'),
};

// =========================================
// PRESCRIPTIONS API
// =========================================
export const prescriptionsApi = {
  getAll: () => apiFetch('/prescriptions'),
};

// =========================================
// CONSULTATION CHAT (PostgreSQL messages + MinIO image attachment via CDN)
// =========================================
export const chatApi = {
  getMessages: (consultationId) =>
    apiFetch(`/chat/consultations/${consultationId}/messages`),
  sendMessage: (consultationId, message, image) => {
    const formData = new FormData();
    formData.append('message', message || '');
    if (image) formData.append('image', image);
    return apiFetch(`/chat/consultations/${consultationId}/messages`, {
      method: 'POST',
      body: formData,
    });
  },
};

// =========================================
// VIDEO CALL SIGNALING (WebRTC SDP/ICE)
// =========================================
export const videoApi = {
  joinSession: (consultationId) =>
    apiFetch(`/video/consultations/${consultationId}/join`, {
      method: 'POST',
    }),
  getSignals: (consultationId, sessionId, afterId = 0) => {
    const query = new URLSearchParams({
      session_id: sessionId,
      after_id: String(afterId),
    }).toString();
    return apiFetch(`/video/consultations/${consultationId}/signals?${query}`);
  },
  sendSignal: (consultationId, sessionId, signalType, payload = {}) =>
    apiFetch(`/video/consultations/${consultationId}/signals`, {
      method: 'POST',
      body: {
        session_id: sessionId,
        signal_type: signalType,
        payload,
      },
    }),
};
// Health check
export const healthCheck = () => apiFetch('/health');
