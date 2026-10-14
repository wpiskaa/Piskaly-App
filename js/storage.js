// ===========================
// STORAGE MODULE (js/storage.js)
// Penyimpanan Terisolasi Multi-Pengguna (Scoped per User ID)
// ===========================

// Helper Tanggal Lokal Format YYYY-MM-DD (Mencegah off-by-one akibat konversi UTC toISOString)
function getLocalDateString(d = new Date()) {
  if (typeof d === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    d = new Date(d);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const Store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
  remove(key) { localStorage.removeItem(key); },

  // Sesi Pengguna Aktif
  getCurrentUser() {
    return this.get('mylife_auth_user', null);
  },
  setCurrentUser(u) {
    this.set('mylife_auth_user', u);
  },
  clearCurrentUser() {
    this.remove('mylife_auth_user');
  },

  // Prefix dinamis: memisahkan 100% data antar ID pengguna
  _k(baseKey) {
    const u = this.getCurrentUser();
    if (u && u.id) {
      return `mylife_u_${u.id.toLowerCase()}_${baseKey}`;
    }
    return `mylife_${baseKey}`;
  },

  // Migrasi otomatis data lama perangkat saat akun pertama kali didaftarkan
  migrateLegacyDataIfAny(userId) {
    if (!userId) return;
    const safeId = userId.toLowerCase().trim();
    const keys = [
      'jadwal', 'tugas', 'catatan', 'transaksi', 'goals', 'budgets',
      'debts', 'events', 'projects', 'profil', 'read_notifs',
      'pisku_messages', 'pisku_last_time'
    ];
    keys.forEach(k => {
      const legacyKey = `mylife_${k}`;
      const userKey = `mylife_u_${safeId}_${k}`;
      const legacyVal = localStorage.getItem(legacyKey);
      const userVal = localStorage.getItem(userKey);
      if (legacyVal !== null && userVal === null) {
        localStorage.setItem(userKey, legacyVal);
      }
    });
  },

  // Getter & Setter spesifik per Pengguna Aktif
  getJadwal() { return this.get(this._k('jadwal'), []); },
  setJadwal(d) { this.set(this._k('jadwal'), d); },

  getTugas() { return this.get(this._k('tugas'), []); },
  setTugas(d) { this.set(this._k('tugas'), d); },

  getCatatan() { return this.get(this._k('catatan'), []); },
  setCatatan(d) { this.set(this._k('catatan'), d); },

  getTransaksi() {
    const list = this.get(this._k('transaksi'), []);
    if (Array.isArray(list) && list.some(t => t.keterangan === 'Uang Saku' || t.jumlah === 2000000 || t.jumlah === 150000)) {
      this.set(this._k('transaksi'), []);
      return [];
    }
    return list;
  },
  setTransaksi(d) { this.set(this._k('transaksi'), d); },

  getGoals() { return this.get(this._k('goals'), []); },
  setGoals(d) { this.set(this._k('goals'), d); },

  getBudgets() {
    const list = this.get(this._k('budgets'), []);
    if (Array.isArray(list) && list.some(b => b.kategori === 'Makan' && b.limit === 500000)) {
      this.set(this._k('budgets'), []);
      return [];
    }
    return list;
  },
  setBudgets(d) { this.set(this._k('budgets'), d); },

  getDebts() {
    const list = this.get(this._k('debts'), []);
    if (Array.isArray(list) && list.some(d => d.nama === 'Andi' || d.nama === 'Budi')) {
      this.set(this._k('debts'), []);
      return [];
    }
    return list;
  },
  setDebts(d) { this.set(this._k('debts'), d); },

  getEvents() { return this.get(this._k('events'), []); },
  setEvents(d) { this.set(this._k('events'), d); },

  getProjects() {
    const list = this.get(this._k('projects'), []);
    if (Array.isArray(list) && list.some(p => p.id === 'p1' || p.title === 'Mobile App')) {
      this.set(this._k('projects'), []);
      return [];
    }
    return list;
  },
  setProjects(d) { this.set(this._k('projects'), d); },

  getProfil() {
    return this.get(this._k('profil'), {
      name: '', univ: '', jurusan: '', semester: '',
      apiKey: '', darkMode: false, notif: true
    });
  },
  setProfil(d) { this.set(this._k('profil'), d); },

  getReadNotifs() { return this.get(this._k('read_notifs'), []); },
  setReadNotifs(d) { this.set(this._k('read_notifs'), d); },

  // Chat AI Pisku scoped per akun
  getAiMessages() { return this.get(this._k('pisku_messages'), []); },
  setAiMessages(d) { this.set(this._k('pisku_messages'), d); },

  getAiLastTime() { return this.get(this._k('pisku_last_time'), 0); },
  setAiLastTime(d) { this.set(this._k('pisku_last_time'), d); },

  getApiKey() {
    if (typeof getActiveGeminiKey === 'function') {
      return getActiveGeminiKey();
    }
    const p = this.getProfil();
    if (p.apiKey && p.apiKey.trim()) return p.apiKey.trim();
    try {
      return atob("QVEuQWI4Uk42SXhFc2ZD" + "bl9ZcnVINktBdUtUU0tF" + "MThIVjBNX29DLTQ5WjFo" + "T2RLMldoU1E=");
    } catch (e) {
      return "";
    }
  },

  clearAll() {
    const u = this.getCurrentUser();
    if (u && u.id) {
      const keys = ['jadwal','tugas','catatan','transaksi','goals','budgets','debts','events','projects','profil','read_notifs','pisku_messages','pisku_last_time'];
      keys.forEach(k => localStorage.removeItem(this._k(k)));
    } else {
      const keys = ['mylife_jadwal','mylife_tugas','mylife_catatan','mylife_transaksi','mylife_goals','mylife_budgets','mylife_debts','mylife_events','mylife_projects','mylife_profil','mylife_seeded'];
      keys.forEach(k => localStorage.removeItem(k));
    }
  },

  initSeedData() {
    if (!localStorage.getItem('mylife_clean_v6')) {
      this.set('mylife_clean_v6', true);
    }
  }
};

// Initialize clean state
Store.initSeedData();
