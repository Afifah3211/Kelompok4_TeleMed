/**
 * TeleMed - API Client (Frontend -> FastAPI Backend)
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
  updateProfile: (profileData) =>
    apiFetch('/users/profile', {
      method: 'PUT',
      body: profileData,
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
  cleanupTestData: () =>
    apiFetch('/consultations/cleanup-test-data', {
      method: 'POST',
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
  softDelete: (id, reason = 'Koreksi rekam medis oleh dokter') =>
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
// MEDICINES API (Obat Farmasi)
// =========================================
export const medicinesApi = {
  getAll: () => apiFetch('/medicines'),
  update: (id, data) =>
    apiFetch(`/medicines/${id}`, {
      method: 'PUT',
      body: data,
    }),
};

// =========================================
// PRESCRIPTIONS API (Resep Digital)
// =========================================
export const prescriptionsApi = {
  getAll: () => apiFetch('/prescriptions'),
  create: (data) =>
    apiFetch('/prescriptions', {
      method: 'POST',
      body: data,
    }),
  updateStatus: (id, { status, pharmacistNotes, pharmacist_notes }) =>
    apiFetch(`/prescriptions/${id}/status`, {
      method: 'PATCH',
      body: {
        status,
        pharmacist_notes: pharmacist_notes || pharmacistNotes || null,
      },
    }),
};

// =========================================
// FILES API (MinIO CDN - Pertemuan 5)
// =========================================
export const filesApi = {
  /**
   * Upload file ke MinIO via backend.
   * @param {File} file - File object dari input[type=file]
   * @param {function} onProgress - opsional callback progress (tidak dipakai di fetch biasa)
   * @returns {{ key, url, cdn_url, filename, size_bytes, content_type }}
   */
  upload: async (file) => {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${BASE_URL}/files/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        // Jangan set Content-Type — biarkan browser set multipart boundary otomatis
      },
      body: formData,
    });

    if (res.status === 401) {
      clearToken();
      window.dispatchEvent(new CustomEvent('telemed:unauthorized'));
    }

    const data = await res.json();
    if (!res.ok) {
      const error = new Error(data?.detail || `Upload gagal: HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }
    return data;
  },

  /**
   * Dapatkan presigned URL untuk download file.
   * @param {string} key - object key MinIO (misal "dokter/abc123.pdf")
   */
  getPresignedUrl: (key) => apiFetch(`/files/presign/${encodeURIComponent(key)}`),

  /**
   * Daftar semua file di bucket (admin only).
   */
  listFiles: () => apiFetch('/files/list'),

  /**
   * Hapus file (admin only).
   * @param {string} key - object key MinIO
   */
  deleteFile: (key) =>
    apiFetch(`/files/${encodeURIComponent(key)}`, { method: 'DELETE' }),

  /**
   * Helper: buat URL CDN publik dari object key.
   * Menggunakan Nginx proxy /files/ → MinIO (Pertemuan 5).
   */
  cdnUrl: (key) => `/files/${key}`,
};
// Health check
export const healthCheck = () => apiFetch('/health');
