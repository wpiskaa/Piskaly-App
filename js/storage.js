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
      'debts', 'events', 'olahraga', 'subscriptions', 'projects', 'profil', 'read_notifs',
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

  getEvents() {
    let list = this.get(this._k('events'), []);
    if (!Array.isArray(list)) list = [];
    // Bersihkan agenda duplikat/hantu peninggalan auto-input Pisku versi lama
    const cleaned = list.filter(e => {
      const nama = (e.nama || e.title || '').trim().toLowerCase();
      const jam = (e.jamMulai || e.time || '').trim();
      const desc = (e.deskripsi || e.desc || '').toLowerCase();
      if (nama === 'ke clinic') return false;
      if (nama.includes('sport massage') && (jam === '16:00' || desc.includes('recovery') || desc.includes('sore hari'))) return false;
      if (desc.includes('agenda ke klinik') || desc.includes('kunjungan ke klinik')) return false;
      return true;
    });
    if (cleaned.length !== list.length) {
      this.set(this._k('events'), cleaned);
      if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isLoggedIn && FirebaseSync.isLoggedIn()) {
        try { FirebaseSync.saveUserData(); } catch (err) {}
      }
      return cleaned;
    }
    return list;
  },
  setEvents(d) { this.set(this._k('events'), d); },

  getOlahraga() {
    let list = this.get(this._k('olahraga'), null);
    if (!list) {
      list = [
        {
          id: 'sport-1',
          nama: 'Jogging & Lari Santai',
          hari: ['Selasa', 'Kamis', 'Sabtu'],
          jam: '06:00',
          durasi: '30 Menit',
          target: '3 - 5 KM',
          kategori: 'lari',
          lokasi: 'Taman Kampus',
          catatan: 'Pemanasan 5 menit sebelum lari.',
          icon: 'footprints',
          color: '#10b981',
          history: {}
        },
        {
          id: 'sport-2',
          nama: 'Gym & Strength Training',
          hari: ['Senin', 'Rabu', 'Jumat'],
          jam: '16:30',
          durasi: '60 Menit',
          target: 'Upper / Lower Body',
          kategori: 'gym',
          lokasi: 'Fitness Center',
          catatan: 'Fokus form dan progressive overload.',
          icon: 'dumbbell',
          color: '#2563eb',
          history: {}
        }
      ];
      this.set(this._k('olahraga'), list);
    }
    return Array.isArray(list) ? list : [];
  },
  setOlahraga(d) { this.set(this._k('olahraga'), d); },

  getSubscriptions() {
    let list = this.get(this._k('subscriptions'), null);
    if (!list) {
      list = [
        {
          id: 'sub-1',
          nama: 'Spotify Premium',
          biaya: 54990,
          siklus: 'bulanan',
          kategori: 'musik',
          metode: 'GoPay',
          tanggalTagihan: '2026-10-25',
          status: 'aktif',
          catatan: 'Plan Individual bulanan',
          color: '#1db954',
          icon: 'music'
        },
        {
          id: 'sub-2',
          nama: 'Netflix Mobile',
          biaya: 65000,
          siklus: 'bulanan',
          kategori: 'streaming',
          metode: 'DANA',
          tanggalTagihan: '2026-11-02',
          status: 'aktif',
          catatan: 'Paket streaming ponsel',
          color: '#e50914',
          icon: 'film'
        }
      ];
      this.set(this._k('subscriptions'), list);
    }
    return Array.isArray(list) ? list : [];
  },
  setSubscriptions(d) { this.set(this._k('subscriptions'), d); },

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

  // Mood & Energy Tracker Harian
  getMoodHistory() { return this.get(this._k('mood_history'), []); },
  setMoodHistory(d) { this.set(this._k('mood_history'), d); },
  getTodayMood() {
    const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
    const list = this.getMoodHistory();
    return list.find(m => m.date === today) || null;
  },
  setTodayMood(moodKey, label, emoji, energy) {
    const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
    let list = this.getMoodHistory();
    list = list.filter(m => m.date !== today);
    const entry = {
      date: today,
      mood: moodKey,
      label: label || moodKey,
      emoji: emoji || '😊',
      energy: energy || 80,
      timestamp: Date.now()
    };
    list.push(entry);
    this.setMoodHistory(list);
    return entry;
  },

  // Daily Morning Briefing
  getLastBriefingDate() { return this.get(this._k('last_briefing_date'), ''); },
  setLastBriefingDate(dateStr) { this.set(this._k('last_briefing_date'), dateStr); },

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
