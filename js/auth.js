// ==========================================
// AUTHENTICATION MODULE (js/auth.js)
// Sistem Multi-Pengguna Berbasis User ID & PIN
// Memisahkan data antar pengguna secara aman & terisolasi
// ==========================================

const AuthService = {
  // Hash PIN sederhana dan aman
  async hashPin(pin) {
    const cleanPin = String(pin || '').trim();
    if (window.crypto && crypto.subtle) {
      try {
        const msgBuffer = new TextEncoder().encode(cleanPin + "_piskaly_salt_2026");
        const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      } catch (e) {
        // Fallback jika crypto.subtle tidak aktif
      }
    }
    let hash = 0;
    const str = cleanPin + "_salt";
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return "h_" + Math.abs(hash).toString(16);
  },

  // Periksa status login saat inisialisasi
  init() {
    this.setupListeners();
    const user = Store.getCurrentUser();
    if (!user || !user.id) {
      // Belum ada user aktif -> Tampilkan modal auth
      this.openAuthModal();
    } else {
      // User aktif ditemukan -> Perbarui tampilan
      this.updateUserUI(user);
      if (typeof FirebaseService !== 'undefined' && FirebaseService.isInitialized) {
        FirebaseService.startDirectSync();
      }
    }
  },

  // Update elemen UI yang menampilkan informasi akun aktif
  updateUserUI(user) {
    if (!user) return;
    const name = user.name || user.id;
    const handle = '@' + user.id;
    const initial = name.charAt(0).toUpperCase();

    // Greeting di Home
    const greetingEl = document.getElementById('greetingName');
    if (greetingEl) greetingEl.textContent = `Hi ${name}!`;

    // Side Drawer info
    const drawerUserName = document.getElementById('drawerUserName');
    if (drawerUserName) drawerUserName.textContent = name;
    const drawerUserUniv = document.getElementById('drawerUserUniv');
    if (drawerUserUniv) drawerUserUniv.textContent = handle;
    const drawerAvatar = document.getElementById('drawerAvatar');
    if (drawerAvatar) drawerAvatar.textContent = initial;

    // Profile page account info
    const authNameEl = document.getElementById('authProfileName');
    if (authNameEl) authNameEl.textContent = name;
    const authIdEl = document.getElementById('authProfileId');
    if (authIdEl) authIdEl.textContent = handle;
    const authAvatarEl = document.getElementById('authProfileAvatar');
    if (authAvatarEl) authAvatarEl.textContent = initial;

    // Header avatar
    const headerAvatar = document.getElementById('headerAvatar');
    if (headerAvatar) headerAvatar.textContent = initial;
  },

  openAuthModal() {
    const modal = document.getElementById('modalAuth');
    const backdrop = document.getElementById('modalBackdrop');
    if (modal) modal.classList.remove('hidden');
    if (backdrop) backdrop.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    this.switchTab('login');

    // Jika belum ada user dan form register dibuka, coba isi nama default dari data profil lama jika ada
    const existingName = Store.getProfil().name;
    const regNameInput = document.getElementById('authRegName');
    if (existingName && regNameInput && !regNameInput.value) {
      regNameInput.value = existingName;
    }

    if (window.lucide) lucide.createIcons({ nodes: [modal] });
  },

  closeAuthModal() {
    // Hanya bisa ditutup jika user sudah login
    if (!Store.getCurrentUser()) {
      showToast('Silakan masuk atau buat ID akun terlebih dahulu', 'warning');
      return;
    }
    const modal = document.getElementById('modalAuth');
    const backdrop = document.getElementById('modalBackdrop');
    if (modal) modal.classList.add('hidden');
    if (backdrop) backdrop.classList.add('hidden');
    document.body.style.overflow = '';
  },

  switchTab(tab) {
    const tabLogin = document.getElementById('authTabLogin');
    const tabRegister = document.getElementById('authTabRegister');
    const formLogin = document.getElementById('authFormLogin');
    const formRegister = document.getElementById('authFormRegister');
    const alertBox = document.getElementById('authAlert');

    if (alertBox) {
      alertBox.textContent = '';
      alertBox.classList.add('hidden');
    }

    if (tab === 'login') {
      if (tabLogin) tabLogin.classList.add('active');
      if (tabRegister) tabRegister.classList.remove('active');
      if (formLogin) formLogin.classList.remove('hidden');
      if (formRegister) formRegister.classList.add('hidden');
      setTimeout(() => {
        const idInput = document.getElementById('authLoginId');
        if (idInput) idInput.focus();
      }, 100);
    } else {
      if (tabLogin) tabLogin.classList.remove('active');
      if (tabRegister) tabRegister.classList.add('active');
      if (formLogin) formLogin.classList.add('hidden');
      if (formRegister) formRegister.classList.remove('hidden');
      setTimeout(() => {
        const nameInput = document.getElementById('authRegName');
        if (nameInput) nameInput.focus();
      }, 100);
    }
  },

  showAlert(msg, type = 'error') {
    const alertBox = document.getElementById('authAlert');
    if (alertBox) {
      alertBox.textContent = msg;
      alertBox.className = `auth-alert ${type}`;
      alertBox.classList.remove('hidden');
    } else {
      showToast(msg, type);
    }
  },

  // Masuk menggunakan ID & PIN
  async login(id, pin) {
    const cleanId = String(id || '').trim().toLowerCase();
    const cleanPin = String(pin || '').trim();

    if (!cleanId) {
      this.showAlert('Masukkan ID Pengguna kamu!');
      return;
    }
    if (!cleanPin) {
      this.showAlert('Masukkan PIN Keamanan kamu!');
      return;
    }

    const hashedPin = await this.hashPin(cleanPin);
    const btn = document.getElementById('authLoginSubmitBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Memeriksa...';
      if (window.lucide) lucide.createIcons();
    }

    try {
      let matchedAccount = null;

      // 1. Cek dari Cloud Firestore jika terhubung
      if (FirebaseService.db) {
        try {
          const doc = await FirebaseService.db.collection('piskaly_users').doc(cleanId).get();
          if (doc.exists) {
            const data = doc.data();
            if (data.pinHash === hashedPin || data.pin === cleanPin) {
              matchedAccount = {
                id: cleanId,
                name: data.name || cleanId,
                cloudData: data.data || data
              };
            } else {
              this.showAlert('PIN yang kamu masukkan salah! Silakan coba lagi.');
              return;
            }
          }
        } catch (cloudErr) {
          console.warn('Cek Cloud error, mencoba data lokal:', cloudErr);
        }
      }

      // 2. Jika belum ditemukan di cloud, cek data lokal browser (offline fallback)
      if (!matchedAccount) {
        const localAccounts = Store.get('mylife_local_accounts', {});
        const localUser = localAccounts[cleanId];
        if (localUser) {
          if (localUser.pinHash === hashedPin || localUser.pin === cleanPin) {
            matchedAccount = {
              id: cleanId,
              name: localUser.name || cleanId,
              cloudData: null
            };
          } else {
            this.showAlert('PIN yang kamu masukkan salah! Silakan coba lagi.');
            return;
          }
        }
      }

      if (!matchedAccount) {
        this.showAlert(`ID Pengguna "@${cleanId}" tidak ditemukan. Silakan buat akun baru di tab sebelah.`);
        return;
      }

      // Berhasil login!
      Store.setCurrentUser({ id: matchedAccount.id, name: matchedAccount.name });
      
      // Simpan di daftar akun lokal browser ini
      const localAccounts = Store.get('mylife_local_accounts', {});
      localAccounts[cleanId] = { id: cleanId, name: matchedAccount.name, pinHash: hashedPin };
      Store.set('mylife_local_accounts', localAccounts);

      // Terapkan cloud data jika ada
      if (matchedAccount.cloudData) {
        FirebaseService.applyCloudDataToLocal(matchedAccount.cloudData);
      }

      this.updateUserUI({ id: matchedAccount.id, name: matchedAccount.name });
      this.closeAuthModal();

      // Mulai sinkronisasi cloud untuk user ini
      if (FirebaseService.db) {
        FirebaseService.startDirectSync();
      }

      // Refresh seluruh tampilan
      if (typeof initApp === 'function') initApp();
      showToast(`👋 Selamat datang kembali, ${matchedAccount.name}!`, 'success', 2500);

    } catch (err) {
      console.error('Login error:', err);
      this.showAlert('Terjadi kesalahan saat masuk: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="log-in"></i> Masuk Sekarang';
        if (window.lucide) lucide.createIcons();
      }
    }
  },

  // Buat ID baru & PIN
  async register(id, pin, confirmPin, name) {
    const cleanId = String(id || '').trim().toLowerCase();
    const cleanPin = String(pin || '').trim();
    const cleanConfirm = String(confirmPin || '').trim();
    const cleanName = String(name || '').trim();

    if (!cleanName || cleanName.length < 2) {
      this.showAlert('Masukkan Nama Lengkap kamu (minimal 2 huruf)!');
      return;
    }
    if (!cleanId || cleanId.length < 3) {
      this.showAlert('ID Pengguna minimal 3 karakter (contoh: piska, budi)!');
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(cleanId)) {
      this.showAlert('ID hanya boleh berisi huruf kecil, angka, dan garis bawah (_), tanpa spasi!');
      return;
    }
    if (!cleanPin || cleanPin.length < 4) {
      this.showAlert('PIN minimal 4 digit angka/karakter!');
      return;
    }
    if (cleanPin !== cleanConfirm) {
      this.showAlert('Konfirmasi PIN tidak cocok dengan PIN yang dibuat!');
      return;
    }

    const hashedPin = await this.hashPin(cleanPin);
    const btn = document.getElementById('authRegisterSubmitBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Membuat Akun...';
      if (window.lucide) lucide.createIcons();
    }

    try {
      // 1. Cek apakah ID sudah dipakai di Firestore
      if (FirebaseService.db) {
        try {
          const doc = await FirebaseService.db.collection('piskaly_users').doc(cleanId).get();
          if (doc.exists) {
            this.showAlert(`ID "@${cleanId}" sudah digunakan orang lain! Silakan pilih ID yang berbeda.`);
            return;
          }
        } catch (cloudErr) {
          console.warn('Cek cloud error:', cloudErr);
        }
      }

      // 2. Cek lokal accounts jika offline
      const localAccounts = Store.get('mylife_local_accounts', {});
      if (localAccounts[cleanId]) {
        this.showAlert(`ID "@${cleanId}" sudah terdaftar di perangkat ini! Silakan Masuk.`);
        return;
      }

      // 3. Migrasi data awal perangkat jika ini pendaftaran pertama di browser ini
      Store.migrateLegacyDataIfAny(cleanId);

      // Simpan akun ke lokal
      localAccounts[cleanId] = { id: cleanId, name: cleanName, pinHash: hashedPin };
      Store.set('mylife_local_accounts', localAccounts);

      // Set user aktif
      Store.setCurrentUser({ id: cleanId, name: cleanName });

      // Pastikan profil tersimpan dengan nama baru
      const currentProfil = Store.getProfil();
      Store.setProfil({ ...currentProfil, name: cleanName });

      // Siapkan payload awal untuk cloud
      const initialPayload = {
        jadwal: Store.getJadwal(),
        tugas: Store.getTugas(),
        catatan: Store.getCatatan(),
        transaksi: Store.getTransaksi(),
        goals: Store.getGoals(),
        budgets: Store.getBudgets(),
        debts: Store.getDebts(),
        events: Store.getEvents(),
        projects: Store.getProjects(),
        profil: Store.getProfil(),
        read_notifs: Store.getReadNotifs(),
        pisku_messages: Store.getAiMessages(),
        pisku_last_time: Store.getAiLastTime()
      };

      // 4. Buat dokumen di Firestore
      if (FirebaseService.db) {
        try {
          await FirebaseService.db.collection('piskaly_users').doc(cleanId).set({
            id: cleanId,
            name: cleanName,
            pinHash: hashedPin,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            data: initialPayload
          });
        } catch (uploadErr) {
          console.warn('Gagal upload awal ke cloud:', uploadErr);
        }
      }

      this.updateUserUI({ id: cleanId, name: cleanName });
      this.closeAuthModal();

      // Mulai sinkronisasi cloud untuk user baru ini
      if (FirebaseService.db) {
        FirebaseService.startDirectSync();
      }

      // Refresh seluruh tampilan
      if (typeof initApp === 'function') initApp();
      showToast(`🎉 Akun @${cleanId} berhasil dibuat! Selamat datang, ${cleanName}!`, 'success', 3000);

    } catch (err) {
      console.error('Register error:', err);
      this.showAlert('Gagal membuat akun: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="user-plus"></i> Buat Akun & Masuk';
        if (window.lucide) lucide.createIcons();
      }
    }
  },

  async logout(askConfirm = true) {
    const user = Store.getCurrentUser();
    const name = user ? (user.name || user.id) : 'akun ini';
    if (askConfirm) {
      if (!confirm(`Yakin ingin keluar dari akun ${name}? Data tersimpan aman dan kamu bisa masuk lagi kapan saja dengan ID dan PIN kamu.`)) {
        return;
      }
    }

    // Unggah perubahan terakhir ke cloud
    if (FirebaseService.db) {
      try {
        await FirebaseService.syncUploadAll(false);
      } catch (e) {}
    }

    // Putuskan realtime listener
    if (FirebaseService.unsubscribeSnapshot) {
      FirebaseService.unsubscribeSnapshot();
      FirebaseService.unsubscribeSnapshot = null;
    }

    // Hapus sesi aktif
    Store.clearCurrentUser();

    // Reset input auth
    const loginIdInput = document.getElementById('authLoginId');
    const loginPinInput = document.getElementById('authLoginPin');
    if (loginIdInput) loginIdInput.value = '';
    if (loginPinInput) loginPinInput.value = '';

    // Buka kembali modal auth
    this.openAuthModal();
    showToast('👋 Kamu telah keluar dari akun.', 'info');
  },

  // Buka modal Ubah PIN
  openChangePinModal() {
    const user = Store.getCurrentUser();
    if (!user) {
      showToast('Silakan masuk ke akun kamu terlebih dahulu', 'warning');
      return;
    }
    const targetEl = document.getElementById('changePinTargetId');
    if (targetEl) targetEl.textContent = '@' + user.id;

    const oldInput = document.getElementById('changePinOld');
    const newInput = document.getElementById('changePinNew');
    const confInput = document.getElementById('changePinConfirm');
    const alertEl = document.getElementById('changePinAlert');

    if (oldInput) oldInput.value = '';
    if (newInput) newInput.value = '';
    if (confInput) confInput.value = '';
    if (alertEl) {
      alertEl.textContent = '';
      alertEl.classList.add('hidden');
    }

    if (typeof openModal === 'function') {
      openModal('modalChangePin');
    } else {
      const modal = document.getElementById('modalChangePin');
      const backdrop = document.getElementById('modalBackdrop');
      if (modal) modal.classList.remove('hidden');
      if (backdrop) backdrop.classList.remove('hidden');
    }
    if (window.lucide) lucide.createIcons();
    setTimeout(() => { if (oldInput) oldInput.focus(); }, 150);
  },

  // Simpan perubahan PIN baru
  async submitChangePin() {
    const user = Store.getCurrentUser();
    if (!user) return;

    const oldPin = document.getElementById('changePinOld') ? document.getElementById('changePinOld').value.trim() : '';
    const newPin = document.getElementById('changePinNew') ? document.getElementById('changePinNew').value.trim() : '';
    const confPin = document.getElementById('changePinConfirm') ? document.getElementById('changePinConfirm').value.trim() : '';
    const alertEl = document.getElementById('changePinAlert');
    const btn = document.getElementById('btnSubmitChangePin');

    const showModalAlert = (msg, type = 'error') => {
      if (alertEl) {
        alertEl.textContent = msg;
        alertEl.className = `auth-alert ${type}`;
        alertEl.classList.remove('hidden');
      } else {
        showToast(msg, type);
      }
    };

    if (!oldPin) {
      showModalAlert('Masukkan PIN lama kamu saat ini!');
      return;
    }
    if (!newPin || newPin.length < 4) {
      showModalAlert('PIN baru minimal 4 digit angka/karakter!');
      return;
    }
    if (newPin !== confPin) {
      showModalAlert('Konfirmasi PIN baru tidak cocok!');
      return;
    }
    if (oldPin === newPin) {
      showModalAlert('PIN baru tidak boleh sama dengan PIN saat ini!');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Memverifikasi...';
      if (window.lucide) lucide.createIcons();
    }

    try {
      const hashedOldPin = await this.hashPin(oldPin);
      const hashedNewPin = await this.hashPin(newPin);

      // Verifikasi PIN lama dari data lokal atau Firestore
      let isValidOld = false;
      const localAccounts = Store.get('mylife_local_accounts', {});
      const userKey = user.id.toLowerCase();
      const localAcc = localAccounts[userKey];
      if (localAcc && (localAcc.pinHash === hashedOldPin || localAcc.pin === oldPin)) {
        isValidOld = true;
      }

      if (!isValidOld && typeof FirebaseService !== 'undefined' && FirebaseService.db) {
        try {
          const doc = await FirebaseService.db.collection('piskaly_users').doc(userKey).get();
          if (doc.exists) {
            const data = doc.data();
            if (data.pinHash === hashedOldPin || data.pin === oldPin) {
              isValidOld = true;
            }
          }
        } catch (e) {
          console.warn('Verifikasi Cloud error:', e);
        }
      }

      if (!isValidOld) {
        showModalAlert('PIN Lama yang kamu masukkan salah! Periksa kembali.');
        return;
      }

      // PIN lama cocok -> Update ke PIN baru
      // 1. Simpan di akun lokal browser
      localAccounts[userKey] = {
        id: userKey,
        name: user.name || userKey,
        pinHash: hashedNewPin
      };
      Store.set('mylife_local_accounts', localAccounts);

      // 2. Simpan di Cloud Firestore jika aktif
      if (typeof FirebaseService !== 'undefined' && FirebaseService.db) {
        try {
          await FirebaseService.db.collection('piskaly_users').doc(userKey).update({
            pinHash: hashedNewPin,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } catch (cloudErr) {
          console.warn('Update PIN di cloud Firestore:', cloudErr);
        }
      }

      if (typeof closeModal === 'function') {
        closeModal('modalChangePin');
      } else {
        const modal = document.getElementById('modalChangePin');
        const backdrop = document.getElementById('modalBackdrop');
        if (modal) modal.classList.add('hidden');
        if (backdrop) backdrop.classList.add('hidden');
      }

      showToast('🔐 PIN Keamanan berhasil diperbarui!', 'success', 3000);
    } catch (err) {
      console.error('Gagal ubah PIN:', err);
      showModalAlert('Terjadi kesalahan: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="check"></i> Simpan PIN Baru';
        if (window.lucide) lucide.createIcons();
      }
    }
  },

  setupListeners() {
    // Tombol tab
    const tabLogin = document.getElementById('authTabLogin');
    if (tabLogin) tabLogin.addEventListener('click', () => this.switchTab('login'));
    const tabRegister = document.getElementById('authTabRegister');
    if (tabRegister) tabRegister.addEventListener('click', () => this.switchTab('register'));

    const handleLogin = (e) => {
      if (e) e.preventDefault();
      const id = document.getElementById('authLoginId') ? document.getElementById('authLoginId').value : '';
      const pin = document.getElementById('authLoginPin') ? document.getElementById('authLoginPin').value : '';
      this.login(id, pin);
    };

    const handleRegister = (e) => {
      if (e) e.preventDefault();
      const name = document.getElementById('authRegName') ? document.getElementById('authRegName').value : '';
      const id = document.getElementById('authRegId') ? document.getElementById('authRegId').value : '';
      const pin = document.getElementById('authRegPin') ? document.getElementById('authRegPin').value : '';
      const confirmPin = document.getElementById('authRegConfirmPin') ? document.getElementById('authRegConfirmPin').value : '';
      this.register(id, pin, confirmPin, name);
    };

    // Submit & Click for Login
    const formLogin = document.getElementById('authFormLogin');
    if (formLogin) formLogin.addEventListener('submit', handleLogin);
    const btnLogin = document.getElementById('authLoginSubmitBtn');
    if (btnLogin) btnLogin.addEventListener('click', handleLogin);

    // Submit & Click for Register
    const formRegister = document.getElementById('authFormRegister');
    if (formRegister) formRegister.addEventListener('submit', handleRegister);
    const btnRegister = document.getElementById('authRegisterSubmitBtn');
    if (btnRegister) btnRegister.addEventListener('click', handleRegister);
  }
};

window.AuthService = AuthService;
