const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  let data = null

  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    const error = new Error(
      (data && data.message) || `Request failed (${res.status})`
    )

    error.status = res.status
    error.data = data
    throw error
  }

  return data
}

export const api = {
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  me: (token) =>
    request('/auth/me', {
      token,
    }),

  listDoctors: (token, status = 'all') =>
    request(`/doctors?status=${status}`, {
      token,
    }),

  getDoctor: (token, id) =>
    request(`/doctors/${id}`, {
      token,
    }),

  fetchDoctorProfile: async (email) => {
    if (!email) return null;
    const cleanEmail = encodeURIComponent(email.trim().toLowerCase());
    const urls = [
      `/doctor-api/api/internal/doctors/profile?email=${cleanEmail}`,
      `http://localhost:8080/api/internal/doctors/profile?email=${cleanEmail}`,
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: {
            'X-Internal-Secret': 'change-this-shared-secret',
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (data) return data;
        }
      } catch (e) {
        // try next endpoint
      }
    }
    return null;
  },

  approveDoctor: (token, id) =>
    request(`/doctors/${id}/approve`, {
      method: 'POST',
      token,
    }),

  rejectDoctor: (token, id, reason) =>
    request(`/doctors/${id}/reject`, {
      method: 'POST',
      token,
      body: { reason },
    }),

  verifyDoctor: (token, id, item) =>
    request(`/doctors/${id}/verify`, {
      method: 'POST',
      token,
      body: { item },
    }),

  createDoctor: (token, doctor) =>
    request('/doctors', {
      method: 'POST',
      token,
      body: doctor,
    }),

  listNotifications: (token) =>
    request('/notifications', {
      token,
    }),

  markNotificationRead: (token, id) =>
    request(`/notifications/${id}/read`, {
      method: 'POST',
      token,
    }),

  markAllNotificationsRead: (token) =>
    request('/notifications/read-all', {
      method: 'POST',
      token,
    }),

}

export default api