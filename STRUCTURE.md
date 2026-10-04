# 🏛️ Struktur Arsitektur Kode Piskaly (MyLife)

Aplikasi web PWA Piskaly dibangun dengan arsitektur **modular, bersih, dan terstruktur** untuk kemudahan pemeliharaan (*maintainability*), performa tinggi, dan kompatibilitas penuh dengan **GitHub Pages** serta **Safari iOS (iPhone 13 & iPad)**.

---

## 📁 Direktori & File Overview

```text
Piskaly/
├── 📄 index.html              # Shell aplikasi utama (SPA) dengan struktur semantik
├── 📄 manifest.json           # Konfigurasi PWA (nama aplikasi, icon, theme color)
├── 📄 sw.js                   # Service Worker (offline-first & instant cache invalidation)
├── 📄 STRUCTURE.md            # Dokumentasi arsitektur proyek
├── 📄 README.md               # Ringkasan fitur dan panduan instalasi
│
├── 📂 css/                    # Modular Stylesheets (Per-fitur & Komponen)
│   ├── 🎨 base.css            # Variabel warna (:root / dark-mode), reset, tipografi, splash
│   ├── 🎨 layout.css          # Kontainer aplikasi, iOS safe areas, header atas
│   ├── 🎨 navigation.css      # Bottom navigation dock, FAB tengah, dock animations
│   ├── 🎨 drawer.css          # Side drawer menu lengkap (slide-over panel)
│   ├── 🎨 components.css      # Komponen modal pop-up, form inputs, switch, dialogs
│   ├── 🎨 home.css            # Beranda, ongoing projects card, greeting, schedule banner
│   ├── 🎨 jadwal.css          # Jadwal kuliah, tab hari, kartu matkul, mode "All Day"
│   ├── 🎨 tugas.css           # Manajemen tugas, indikator deadline, filter status
│   ├── 🎨 catatan.css         # Grid catatan, kartu catatan warna-warni, pin note
│   ├── 🎨 keuangan.css        # Dompet fintech, pemasukan/pengeluaran, Chart.js report
│   ├── 🎨 kalender.css        # Grid kalender interaktif, agenda countdown harian
│   ├── 🎨 ai.css              # Aiden AI chatbot, message bubbles, suggested prompt chips
│   ├── 🎨 profil.css          # Profil pengguna, Firebase Cloud Sync card, backup data
│   ├── 🎨 notifikasi.css      # Pusat notifikasi (filter tab, kartu notif, unread dot)
│   ├── 🎨 utilities.css       # Toast pop-up, haptic feedback, responsive iPad/desktop
│   └── 🎨 style.css           # Master manifest stylesheet (@import orchestrator)
│
├── 📂 js/                     # Modular JavaScript (Separation of Concerns)
│   ├── ⚡ firebase-config.js   # Konfigurasi & inisialisasi Firebase Cloud
│   ├── ⚡ firebase-service.js  # Sinkronisasi cloud dua arah otomatis (Silent Sync)
│   ├── ⚡ storage.js          # Abstraksi localStorage & model data (CRUD)
│   ├── ⚡ app.js              # Routing SPA, audio pop synthesizer, modal & drawer controller
│   ├── ⚡ notifikasi.js       # Generator notifikasi pintar (deadline, jadwal, kalender)
│   ├── ⚡ jadwal.js           # Logika jadwal kuliah & all-day view
│   ├── ⚡ tugas.js            # Logika tugas, filter status & countdown deadline
│   ├── ⚡ catatan.js          # Logika pembuatan, edit, dan penghapusan catatan
│   ├── ⚡ keuangan.js         # Logika kas masuk/keluar & integrasi grafik Chart.js
│   ├── ⚡ kalender.js         # Logika kalender bulanan, event, dan kalkulasi H- agenda
│   └── ⚡ ai.js               # Integrasi AI Assistant (Gemini API & fallback offline)
│
└── 📂 icons/                  # Aset icon PWA (beragam resolusi untuk Android & iOS)
    ├── icon-192x192.png
    ├── icon-512x512.png
    └── apple-touch-icon.png
```

---

## 🔔 Sistem Notifikasi Terpadu (`#page-notifikasi`)

1. **Akses Notifikasi**:
   - Ikon lonceng di header atas (`#notifBtn`) membuka halaman pemberitahuan lengkap.
   - Menu *Pemberitahuan* di dalam Side Drawer (`#sideDrawer`).
2. **Kompilasi Otomatis**:
   - **Tugas**: Mendeteksi deadline hari ini (H-0), besok (H-1), dan 2-3 hari mendatang.
   - **Kuliah**: Mengingatkan jadwal perkuliahan yang aktif pada hari ini.
   - **Kalender**: Mengingatkan agenda mendatang dengan hitungan mundur (H- hari).
   - **Cloud Sync**: Memberikan status sinkronisasi Firebase.
3. **Fitur Halaman**:
   - Filter tab: *Semua*, *Belum Dibaca*, *Kuliah & Agenda*, *Tugas*.
   - Tombol *Tandai Semua Sudah Dibaca* (`markAllNotificationsAsRead()`).
   - Tombol *Bersihkan Riwayat Notifikasi* (`clearAllNotifications()`).
   - Klik kartu notifikasi langsung mengarahkan user ke halaman terkait secara instan.

---

## 🚀 Keunggulan Arsitektur Ini
- **Terstruktur & Tidak Menumpuk**: Setiap fitur memiliki file CSS dan JS tersendiri sehingga sangat rapi dan mudah dicari saat ingin mengubah fitur tertentu.
- **GitHub Pages Ready**: Menggunakan struktur statis tanpa compiler yang rumit, sehingga saat di-push ke GitHub langsung jalan di GitHub Pages.
- **Offline-First PWA**: Terdaftar di Service Worker `sw.js` dengan sistem *Network-First* dan fallback *Cache-First*.
