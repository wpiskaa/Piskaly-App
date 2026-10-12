// ===========================
// STORAGE MODULE
// ===========================
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

  // Specific getters/setters
  getJadwal() { return this.get('mylife_jadwal', []); },
  setJadwal(d) { this.set('mylife_jadwal', d); },

  getTugas() { return this.get('mylife_tugas', []); },
  setTugas(d) { this.set('mylife_tugas', d); },

  getCatatan() { return this.get('mylife_catatan', []); },
  setCatatan(d) { this.set('mylife_catatan', d); },

  getTransaksi() {
    const list = this.get('mylife_transaksi', []);
    if (Array.isArray(list) && list.some(t => t.keterangan === 'Uang Saku' || t.jumlah === 2000000 || t.jumlah === 150000)) {
      this.set('mylife_transaksi', []);
      return [];
    }
    return list;
  },
  setTransaksi(d) { this.set('mylife_transaksi', d); },

  // Manajemen keuangan lanjutan: target tabungan, anggaran, hutang/piutang
  getGoals() { return this.get('mylife_goals', []); },
  setGoals(d) { this.set('mylife_goals', d); },

  getBudgets() {
    const list = this.get('mylife_budgets', []);
    if (Array.isArray(list) && list.some(b => b.kategori === 'Makan' && b.limit === 500000)) {
      this.set('mylife_budgets', []);
      return [];
    }
    return list;
  },
  setBudgets(d) { this.set('mylife_budgets', d); },

  getDebts() {
    const list = this.get('mylife_debts', []);
    if (Array.isArray(list) && list.some(d => d.nama === 'Andi' || d.nama === 'Budi')) {
      this.set('mylife_debts', []);
      return [];
    }
    return list;
  },
  setDebts(d) { this.set('mylife_debts', d); },

  getEvents() { return this.get('mylife_events', []); },
  setEvents(d) { this.set('mylife_events', d); },

  getProjects() {
    const list = this.get('mylife_projects', []);
    if (Array.isArray(list) && list.some(p => p.id === 'p1' || p.title === 'Mobile App')) {
      this.set('mylife_projects', []);
      return [];
    }
    return list;
  },
  setProjects(d) { this.set('mylife_projects', d); },

  getProfil() {
    return this.get('mylife_profil', {
      name: '', univ: '', jurusan: '', semester: '',
      apiKey: '', darkMode: false, notif: true
    });
  },
  setProfil(d) { this.set('mylife_profil', d); },

  getApiKey() {
    const p = this.getProfil();
    return p.apiKey || '';
  },

  clearAll() {
    const keys = ['mylife_jadwal','mylife_tugas','mylife_catatan','mylife_transaksi','mylife_goals','mylife_budgets','mylife_debts','mylife_events','mylife_projects','mylife_profil','mylife_seeded'];
    keys.forEach(k => localStorage.removeItem(k));
  },

  initSeedData() {
    // Pastikan tidak ada data dummy pada transaksi, tabungan, anggaran, hutang, proyek
    if (!localStorage.getItem('mylife_clean_v6')) {
      this.setTransaksi([]);
      this.setGoals([]);
      this.setBudgets([]);
      this.setDebts([]);
      this.setProjects([]);
      this.set('mylife_clean_v6', true);
    }
  }
};

// Initialize clean state
Store.initSeedData();
