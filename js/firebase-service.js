// ==========================================
// FIREBASE DIRECT SYNC SERVICE (js/firebase-service.js)
// Sinkronisasi Langsung Otomatis Tanpa Perlu Login
// ==========================================

const FirebaseService = {
  app: null,
  db: null,
  isInitialized: false,
  unsubscribeSnapshot: null,
  syncTimeout: null,
  isSyncingFromCloud: false,

  // Inisialisasi Firebase & Cloud Firestore langsung
  init() {
    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK belum termuat.');
      return false;
    }

    const config = getActiveFirebaseConfig();
    if (!config || !config.apiKey || !config.projectId) {
      console.log('Firebase config belum diisi. Berjalan lokal.');
      this.updateUIStatus('unconfigured');
      return false;
    }

    try {
      if (!firebase.apps.length) {
        this.app = firebase.initializeApp(config);
      } else {
        this.app = firebase.app();
      }

      this.db = firebase.firestore();

      // Aktifkan offline persistence agar PWA tetap cepat dan bekerja tanpa internet
      this.db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('Firestore multi-tab persistence active');
        }
      });

      this.isInitialized = true;
      console.log('⚡ Firebase Direct Sync aktif di project:', config.projectId);
      this.updateUIStatus('connected');

      // Mulai sinkronisasi otomatis langsung (2-way live sync)
      this.startDirectSync();
      return true;
    } catch (err) {
      console.error('Inisialisasi Firebase error:', err);
      this.updateUIStatus('error');
      return false;
    }
  },

  // Sinkronisasi dua arah instan tanpa login
  async startDirectSync() {
    if (!this.db) return;

    const docRef = this.db.collection('piskaly_app').doc('main_data');

    try {
      // 1. Ambil data awal dari cloud jika ada
      const doc = await docRef.get();
      if (doc.exists) {
        const cloudData = doc.data();
        this.applyCloudDataToLocal(cloudData);
        console.log('☁️ Data cloud berhasil dimuat otomatis');
      } else {
        // Jika di cloud masih kosong, simpan data lokal saat ini ke cloud
        await this.syncUploadAll();
        console.log('☁️ Data awal berhasil disimpan ke cloud');
      }

      // 2. Pasang realtime listener (live sync ke semua perangkat)
      if (this.unsubscribeSnapshot) this.unsubscribeSnapshot();

      this.unsubscribeSnapshot = docRef.onSnapshot((snapshot) => {
        // Abaikan jika perubahan berasal dari ketikan lokal sendiri yang sedang dikirim
        if (snapshot.metadata.hasPendingWrites) return;

        if (snapshot.exists) {
          const data = snapshot.data();
          this.applyCloudDataToLocal(data);
          this.updateUIStatus('connected');
        }
      }, (err) => {
        console.warn('Realtime listener notice:', err.message);
      });

    } catch (err) {
      console.error('Error saat sinkronisasi langsung:', err);
      // Jika aturan Firebase membutuhkan permission, beri notifikasi ramah
      if (err.code === 'permission-denied') {
        showToast('⚠️ Izin Firestore belum diizinkan. Pastikan Rules diatur: allow read, write: if true;', 'warning');
      }
    }
  },

  // Terapkan data dari cloud ke Store aplikasi lokal
  applyCloudDataToLocal(data) {
    if (!data) return;
    this.isSyncingFromCloud = true;

    try {
      if (Array.isArray(data.jadwal)) Store.setJadwal(data.jadwal);
      if (Array.isArray(data.tugas)) Store.setTugas(data.tugas);
      if (Array.isArray(data.catatan)) Store.setCatatan(data.catatan);
      if (Array.isArray(data.transaksi)) Store.setTransaksi(data.transaksi);
      if (Array.isArray(data.projects)) Store.setProjects(data.projects);
      if (data.profil && typeof data.profil === 'object') {
        const p = Store.getProfil();
        Store.setProfil({ ...p, ...data.profil });
      }

      // Refresh seluruh tampilan yang sedang aktif
      if (typeof renderHome === 'function') renderHome();
      if (typeof renderJadwal === 'function') renderJadwal();
      if (typeof renderTugas === 'function') renderTugas();
      if (typeof renderCatatan === 'function') renderCatatan();
      if (typeof renderKeuangan === 'function') renderKeuangan();
      if (typeof renderKalender === 'function') renderKalender();
      if (typeof updateStats === 'function') updateStats();
    } finally {
      setTimeout(() => {
        this.isSyncingFromCloud = false;
      }, 500);
    }
  },

  // Unggah semua data lokal ke Cloud Firestore
  async syncUploadAll() {
    if (!this.isInitialized || this.isSyncingFromCloud) return;

    const payload = {
      jadwal: Store.getJadwal(),
      tugas: Store.getTugas(),
      catatan: Store.getCatatan(),
      transaksi: Store.getTransaksi(),
      projects: Store.getProjects(),
      profil: Store.getProfil(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      const docRef = this.db.collection('piskaly_app').doc('main_data');
      await docRef.set(payload, { merge: true });
      console.log('⚡ Data langsung tersimpan di Cloud Firestore');
    } catch (err) {
      console.error('Gagal upload ke Firestore:', err);
    }
  },

  // Auto-sync debounced (otomatis dipanggil saat ada penambahan/edit data)
  queueSync() {
    if (!this.isInitialized || this.isSyncingFromCloud) return;
    clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      this.syncUploadAll();
    }, 1000);
  },

  // Bersihkan semua data agar mulai kosong total
  async clearAllDummyData() {
    if (!confirm('Kosongkan semua data agar siap diisi data pribadi Anda sendiri?')) {
      return;
    }

    Store.setJadwal([]);
    Store.setTugas([]);
    Store.setCatatan([]);
    Store.setTransaksi([]);
    Store.setProjects([]);

    if (typeof renderHome === 'function') renderHome();
    if (typeof renderJadwal === 'function') renderJadwal();
    if (typeof renderTugas === 'function') renderTugas();
    if (typeof renderCatatan === 'function') renderCatatan();
    if (typeof renderKeuangan === 'function') renderKeuangan();
    if (typeof renderKalender === 'function') renderKalender();
    if (typeof updateStats === 'function') updateStats();

    await this.syncUploadAll();
    showToast('✨ Semua data telah bersih! Siap diisi data Anda.', 'success');
  },

  // Perbarui indikator status di halaman Profil
  updateUIStatus(status) {
    const cardStatus = document.getElementById('firebaseStatusBadge');
    const userLabel = document.getElementById('firebaseUserLabel');

    if (!cardStatus) return;

    if (status === 'connected' || this.isInitialized) {
      cardStatus.className = 'fb-badge connected';
      cardStatus.innerHTML = '<span class="fb-dot green"></span> Sinkron Otomatis (Live)';
      if (userLabel) {
        userLabel.textContent = 'Tersambung langsung ke Cloud Firestore. Setiap perubahan otomatis tersimpan & sinkron ke iPhone, iPad, dan Laptop Anda.';
      }
    } else {
      cardStatus.className = 'fb-badge ready';
      cardStatus.innerHTML = '<span class="fb-dot yellow"></span> Mode Lokal';
      if (userLabel) {
        userLabel.textContent = 'Berjalan dalam mode lokal.';
      }
    }
  }
};

// Hook otomatis ke Store: setiap ada penambahan atau pengubahan data, langsung simpan ke Cloud!
document.addEventListener('DOMContentLoaded', () => {
  const originalSetJadwal = Store.setJadwal.bind(Store);
  Store.setJadwal = function(d) { originalSetJadwal(d); FirebaseService.queueSync(); };

  const originalSetTugas = Store.setTugas.bind(Store);
  Store.setTugas = function(d) { originalSetTugas(d); FirebaseService.queueSync(); };

  const originalSetCatatan = Store.setCatatan.bind(Store);
  Store.setCatatan = function(d) { originalSetCatatan(d); FirebaseService.queueSync(); };

  const originalSetTransaksi = Store.setTransaksi.bind(Store);
  Store.setTransaksi = function(d) { originalSetTransaksi(d); FirebaseService.queueSync(); };

  const originalSetProjects = Store.setProjects.bind(Store);
  Store.setProjects = function(d) { originalSetProjects(d); FirebaseService.queueSync(); };

  const originalSetProfil = Store.setProfil.bind(Store);
  Store.setProfil = function(d) { originalSetProfil(d); FirebaseService.queueSync(); };

  // Mulai sinkronisasi langsung seketika
  setTimeout(() => {
    FirebaseService.init();
  }, 100);
});

// UI Modal Helper untuk pengaturan jika ingin ganti project ID
function openFirebaseConfigModal() {
  const current = getActiveFirebaseConfig();
  document.getElementById('fbApiKey').value = current.apiKey || '';
  document.getElementById('fbAuthDomain').value = current.authDomain || '';
  document.getElementById('fbProjectId').value = current.projectId || '';
  document.getElementById('fbStorageBucket').value = current.storageBucket || '';
  document.getElementById('fbMessagingSenderId').value = current.messagingSenderId || '';
  document.getElementById('fbAppId').value = current.appId || '';
  document.getElementById('fbPasteRaw').value = '';
  openModal('modalFirebaseConfig');
}

function parseFirebaseConfigPaste() {
  const raw = document.getElementById('fbPasteRaw').value.trim();
  if (!raw) {
    showToast('Teks paste masih kosong!', 'error');
    return;
  }

  try {
    const extract = (prop) => {
      const match = raw.match(new RegExp(`${prop}\\s*:\\s*["']([^"']+)["']`, 'i'));
      return match ? match[1] : '';
    };

    const apiKey = extract('apiKey');
    const authDomain = extract('authDomain');
    const projectId = extract('projectId');
    const storageBucket = extract('storageBucket');
    const messagingSenderId = extract('messagingSenderId');
    const appId = extract('appId');

    if (apiKey) document.getElementById('fbApiKey').value = apiKey;
    if (authDomain) document.getElementById('fbAuthDomain').value = authDomain;
    if (projectId) document.getElementById('fbProjectId').value = projectId;
    if (storageBucket) document.getElementById('fbStorageBucket').value = storageBucket;
    if (messagingSenderId) document.getElementById('fbMessagingSenderId').value = messagingSenderId;
    if (appId) document.getElementById('fbAppId').value = appId;

    if (apiKey && projectId) {
      showToast('✅ Berhasil membaca konfigurasi Firebase!', 'success');
    }
  } catch (err) {
    showToast('Gagal memproses teks paste: ' + err.message, 'error');
  }
}

function saveFirebaseConfigFromModal() {
  const apiKey = document.getElementById('fbApiKey').value.trim();
  const projectId = document.getElementById('fbProjectId').value.trim();

  if (!apiKey || !projectId) {
    showToast('API Key dan Project ID wajib diisi!', 'error');
    return;
  }

  const configObj = {
    apiKey,
    authDomain: document.getElementById('fbAuthDomain').value.trim(),
    projectId,
    storageBucket: document.getElementById('fbStorageBucket').value.trim(),
    messagingSenderId: document.getElementById('fbMessagingSenderId').value.trim(),
    appId: document.getElementById('fbAppId').value.trim()
  };

  saveFirebaseConfigToStorage(configObj);
  closeModal('modalFirebaseConfig');
  showToast('✅ Konfigurasi tersimpan! Mengaktifkan sinkronisasi...', 'success');

  setTimeout(() => {
    FirebaseService.init();
  }, 300);
}
