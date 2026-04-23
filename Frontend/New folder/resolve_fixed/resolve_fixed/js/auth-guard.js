// ============================================================
// CampusResolve - API-backed Auth Guard & Data Storage
// ============================================================

const CR = {
  API_BASE: (window.CR_API_BASE || localStorage.getItem('cr_api_base') || window.location.origin || 'http://127.0.0.1:5000').replace(/\/$/, ''),

  KEYS: {
    CURRENT: 'cr_current',
    TOKEN: 'cr_token',
    COMPLAINTS: 'cr_complaints',
    USERS: 'cr_users_cache',
    NOTIFICATIONS: 'cr_notifications',
  },

  genId(prefix) {
    prefix = prefix || 'CR';
    return prefix + '-' + String(Math.floor(Math.random() * 9000) + 1000);
  },

  now() {
    return new Date().toISOString();
  },

  setApiBase(url) {
    CR.API_BASE = String(url || '').replace(/\/$/, '');
    localStorage.setItem('cr_api_base', CR.API_BASE);
  },

  getToken() {
    return localStorage.getItem(CR.KEYS.TOKEN) || '';
  },

  setToken(token) {
    if (token) localStorage.setItem(CR.KEYS.TOKEN, token);
    else localStorage.removeItem(CR.KEYS.TOKEN);
  },

  setSession(user) {
    localStorage.setItem(CR.KEYS.CURRENT, JSON.stringify(user));
  },

  getSession() {
    return JSON.parse(localStorage.getItem(CR.KEYS.CURRENT) || 'null');
  },

  clearSession() {
    localStorage.removeItem(CR.KEYS.CURRENT);
    localStorage.removeItem(CR.KEYS.TOKEN);
  },

  isLoggedIn() {
    return !!CR.getToken() && !!CR.getSession();
  },

  saveComplaints(items) {
    localStorage.setItem(CR.KEYS.COMPLAINTS, JSON.stringify(items || []));
  },

  getComplaints() {
    return JSON.parse(localStorage.getItem(CR.KEYS.COMPLAINTS) || '[]');
  },

  saveUsers(users) {
    localStorage.setItem(CR.KEYS.USERS, JSON.stringify(users || []));
  },

  getUsers() {
    return JSON.parse(localStorage.getItem(CR.KEYS.USERS) || '[]');
  },

  cacheUser(user) {
    if (!user) return;
    const users = CR.getUsers().filter(function(existing) {
      return String(existing.id) !== String(user.id);
    });
    users.unshift(user);
    CR.saveUsers(users.slice(0, 20));
  },

  findUserByEmail(email) {
    email = String(email || '').toLowerCase();
    return CR.getUsers().find(function(user) {
      return String(user.email || '').toLowerCase() === email;
    });
  },

  async api(path, options) {
    options = options || {};
    const headers = Object.assign({}, options.headers || {});
    const token = CR.getToken();
    if (options.auth !== false && token) {
      headers.Authorization = 'Bearer ' + token;
    }

    let body;
    if (options.body instanceof FormData) {
      body = options.body;
    } else if (options.body !== undefined) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      body = JSON.stringify(options.body);
    }

    const response = await fetch(CR.API_BASE + path, {
      method: options.method || 'GET',
      headers: headers,
      body: body,
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch (err) {
      payload = {};
    }

    if (!response.ok) {
      return { ok: false, error: payload.error || payload.message || 'Request failed.', status: response.status };
    }

    if (Array.isArray(payload)) {
      return { ok: true, status: response.status, data: payload };
    }

    return Object.assign({ ok: true, status: response.status }, payload);
  },

  hydrateAuth(authPayload) {
    if (!authPayload || !authPayload.user) return { ok: false, error: 'Invalid server response.' };
    CR.setToken(authPayload.access_token || '');
    CR.setSession(authPayload.user);
    CR.cacheUser(authPayload.user);
    return { ok: true, user: authPayload.user };
  },

  async refreshSession() {
    if (!CR.getToken()) return { ok: false, error: 'Not logged in.' };
    const result = await CR.api('/auth/me');
    if (!result.ok) {
      if (result.status === 401) CR.clearSession();
      return result;
    }
    CR.setSession(result.user);
    CR.cacheUser(result.user);
    return { ok: true, user: result.user };
  },

  async registerStudent(opts) {
    const result = await CR.api('/auth/register', {
      method: 'POST',
      auth: false,
      body: {
        email: opts.email,
        password: opts.password,
        collegeId: opts.collegeId,
        role: 'student',
      },
    });
    if (!result.ok) return result;
    return CR.hydrateAuth(result);
  },

  async loginUser(opts) {
    const result = await CR.api('/auth/login', {
      method: 'POST',
      auth: false,
      body: {
        email: opts.email,
        password: opts.password,
      },
    });
    if (!result.ok) return result;
    return CR.hydrateAuth(result);
  },

  async lookupUserByEmail(email) {
    const result = await CR.api('/auth/lookup', {
      method: 'POST',
      auth: false,
      body: { email: email },
    });
    if (result.ok && result.user) CR.cacheUser(result.user);
    return result;
  },

  async updateProfile(profileData) {
    const result = await CR.api('/auth/profile', {
      method: 'PUT',
      body: profileData,
    });
    if (!result.ok) return result;
    return CR.hydrateAuth(result);
  },

  async resetPassword(opts) {
    return await CR.api('/auth/reset-password', {
      method: 'POST',
      auth: false,
      body: {
        email: opts.email,
        newPassword: opts.newPassword,
      },
    });
  },

  async refreshComplaints() {
    const result = await CR.api('/feed/', { auth: false });
    if (!result.ok) return result;
    const complaints = Array.isArray(result.data) ? result.data : [];
    CR.saveComplaints(complaints);
    return { ok: true, complaints: complaints };
  },

  async addComplaint(opts) {
    const body = new FormData();
    body.append('title', opts.title);
    body.append('description', opts.description);
    body.append('category', opts.category);
    body.append('department', opts.department);
    body.append('anonymous', String(!!opts.anonymous));
    if (opts.evidence) {
      body.append('evidence', opts.evidence);
    }

    const result = await CR.api('/complaints/create', {
      method: 'POST',
      body: body,
    });
    if (!result.ok) return result;

    const complaints = CR.getComplaints();
    complaints.unshift(result.complaint);
    CR.saveComplaints(complaints);
    return { ok: true, complaint: result.complaint };
  },

  async deleteComplaint(complaintId) {
    const result = await CR.api('/complaints/' + encodeURIComponent(complaintId), {
      method: 'DELETE',
    });
    if (!result.ok) return result;

    const complaints = CR.getComplaints().filter(function(complaint) {
      return String(complaint.id) !== String(complaintId);
    });
    CR.saveComplaints(complaints);
    return { ok: true, deletedId: String(complaintId) };
  },

  getStaffList() {
    return CR.getUsers().filter(function(user) {
      return ['staff', 'admin', 'dept_admin', 'super_admin'].includes(user.role);
    });
  },

  async fetchAdminUsers() {
    const result = await CR.api('/admin/users');
    if (!result.ok) return result;
    const users = Array.isArray(result.data) ? result.data : [];
    CR.saveUsers(users);
    return { ok: true, users: users };
  },

  async updateUserRole(userId, role) {
    const result = await CR.api('/admin/users/' + encodeURIComponent(userId) + '/role', {
      method: 'POST',
      body: { role: role },
    });
    if (!result.ok) return result;

    const users = CR.getUsers().map(function(user) {
      return String(user.id) === String(userId) ? result.user : user;
    });
    CR.saveUsers(users);

    const session = CR.getSession();
    if (session && String(session.id) === String(userId)) {
      CR.setSession(result.user);
    }

    return { ok: true, user: result.user };
  },

  async updateComplaintStatus(complaintId, status) {
    const body = new FormData();
    body.append('status', status);
    if (arguments.length > 2 && arguments[2]) {
      body.append('resolutionImage', arguments[2]);
    }

    const result = await CR.api('/admin/update-status/' + encodeURIComponent(complaintId), {
      method: 'POST',
      body: body,
    });
    if (!result.ok) return result;

    const complaints = CR.getComplaints().map(function(complaint) {
      return String(complaint.id) === String(complaintId) ? result.complaint : complaint;
    });
    CR.saveComplaints(complaints);
    return { ok: true, complaint: result.complaint };
  },

  saveNotifications(items) {
    localStorage.setItem(CR.KEYS.NOTIFICATIONS, JSON.stringify(items || []));
  },

  getNotifications() {
    return JSON.parse(localStorage.getItem(CR.KEYS.NOTIFICATIONS) || '[]');
  },

  async fetchNotifications() {
    const result = await CR.api('/auth/notifications');
    if (!result.ok) return result;
    CR.saveNotifications(result.notifications || []);
    return { ok: true, notifications: result.notifications || [], unreadCount: result.unreadCount || 0 };
  },

  async markNotificationsRead() {
    const result = await CR.api('/auth/notifications/read-all', { method: 'POST', body: {} });
    if (!result.ok) return result;
    const notifications = CR.getNotifications().map(function(item) {
      return Object.assign({}, item, { isRead: true });
    });
    CR.saveNotifications(notifications);
    return { ok: true };
  },

  async fetchPublicStats() {
    return await CR.api('/auth/public-stats', { auth: false });
  },

  async voteComplaint(complaintId, value) {
    const result = await CR.api('/complaints/' + encodeURIComponent(complaintId) + '/vote', {
      method: 'POST',
      body: { value: value },
    });
    if (!result.ok) return result;
    const complaints = CR.getComplaints().map(function(complaint) {
      return String(complaint.id) === String(complaintId) ? result.complaint : complaint;
    });
    CR.saveComplaints(complaints);
    return { ok: true, complaint: result.complaint };
  },

  async fetchComments(complaintId) {
    const result = await CR.api('/complaints/' + encodeURIComponent(complaintId) + '/comments');
    if (!result.ok) return result;
    if (result.complaint) {
      const complaints = CR.getComplaints().map(function(complaint) {
        return String(complaint.id) === String(complaintId) ? result.complaint : complaint;
      });
      CR.saveComplaints(complaints);
    }
    return {
      ok: true,
      comments: result.comments || result.complaint?.commentItems || [],
      complaint: result.complaint,
    };
  },

  async addComment(complaintId, text) {
    const result = await CR.api('/complaints/' + encodeURIComponent(complaintId) + '/comments', {
      method: 'POST',
      body: { text: text },
    });
    if (!result.ok) return result;
    const complaints = CR.getComplaints().map(function(complaint) {
      return String(complaint.id) === String(complaintId) ? result.complaint : complaint;
    });
    CR.saveComplaints(complaints);
    return {
      ok: true,
      comment: result.comment,
      complaint: result.complaint,
    };
  },

  getRealAuthor(complaint) {
    return complaint.authorName || 'Anonymous';
  },

  seedAdminIfNeeded() {
    return;
  },

  async assignComplaint(complaintId, staffId) {
    const result = await CR.api('/admin/assign/' + encodeURIComponent(complaintId), {
      method: 'POST',
      body: { staffId: staffId },
    });
    if (!result.ok) return result;

    const complaints = CR.getComplaints().map(function(complaint) {
      return String(complaint.id) === String(complaintId) ? result.complaint : complaint;
    });
    CR.saveComplaints(complaints);
    return { ok: true, complaint: result.complaint };
  },

  async addInternalNote(complaintId, text) {
    const result = await CR.api('/admin/notes/' + encodeURIComponent(complaintId), {
      method: 'POST',
      body: { text: text },
    });
    if (!result.ok) return result;

    const complaints = CR.getComplaints().map(function(complaint) {
      return String(complaint.id) === String(complaintId) ? result.complaint : complaint;
    });
    CR.saveComplaints(complaints);
    return { ok: true, note: result.note, complaint: result.complaint };
  },

  requireLogin() {
    if (!CR.isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  requireProfile() {
    if (!CR.requireLogin()) return false;
    const user = CR.getSession();
    if (!user || !user.profileDone) {
      window.location.href = 'profile-setup.html';
      return false;
    }
    return true;
  },

  requireAdmin() {
    if (!CR.requireLogin()) return false;
    const user = CR.getSession();
    if (!user || !['admin', 'super_admin', 'dept_admin'].includes(user.role)) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  },

  redirectIfLoggedIn() {
    if (!CR.isLoggedIn()) return null;
    return CR.getSession();
  },

  logout() {
    CR.clearSession();
    window.location.href = 'login.html';
  },
};
