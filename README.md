# Piskaly - Personal Manager Web App

Aplikasi manajemen kehidupan pribadi modern (PWA) berbasis Web dengan tema Royal Navy Fintech. Dilengkapi fitur Jadwal Kuliah, Tugas / Assignments, Catatan Pribadi, Manajemen Keuangan, Kalender Agenda, AI Assistant (Gemini), serta integrasi database Cloud Firebase (Firestore & Authentication).

## 🚀 Fitur Utama

- **Dashboard Beranda**: Greeting dinamis, pencarian instan, Ongoing Projects card, ringkasan jadwal hari ini, deadline tugas terdekat, dan statistik ringkas.
- **Jadwal Kuliah**: Pengaturan hari, jam, ruangan, dosen, SKS, dan warna kartu.
- **Manajemen Tugas**: Filter status (Semua / Belum Selesai / Selesai), deadline countdown, dan badge prioritas dinamis (*Tinggi, Sedang, Rendah*).
- **Catatan Pribadi**: Kartu catatan tema terang/gelap dengan strip aksen warna-warni dan pencarian instan.
- **Keuangan (Fintech ATM Card)**: Kartu saldo horizontal *landscape* modern bergaya Apple Card / Revolut, grafik pengeluaran bulanan/mingguan, rincian per kategori, dan riwayat transaksi.
- **Kalender Agenda**: Tampilan kalender interaktif untuk menandai kegiatan harian.
- **AI Assistant**: Terintegrasi dengan Google Gemini API untuk membantu konsultasi tugas, jadwal, dan perencanaan hidup.
- **Cloud Database (Firebase)**:
  - Real-time two-way synchronization via Cloud Firestore.
  - Login dengan Akun Google dan Email & Password.
  - Offline-first persistence (tetap berjalan tanpa internet dan auto-sync saat online).
- **Responsif Penuh**:
  - Dioptimalkan khusus untuk **iPhone 13** (Safe Area notch & home indicator, bebas auto-zoom Safari).
  - Dioptimalkan untuk **iPad** (Layout tablet fleksibel 680px, dialog pop-up mengambang elegan).

## 🛠️ Teknologi

- HTML5, CSS3 (Vanilla Modern CSS, Glassmorphism, CSS Variables)
- Vanilla JavaScript (ES6+)
- Progressive Web App (PWA) dengan Service Worker & Web App Manifest
- Firebase SDK v10 (Authentication & Cloud Firestore)
- Lucide Icons & Chart.js

## 📦 Deploy ke GitHub Pages

1. Masuk ke repository GitHub: `https://github.com/wpiskaa/Piskaly-App`
2. Buka menu **Settings** > **Pages**.
3. Di bagian **Build and deployment** > **Source**, pilih **Deploy from a branch**.
4. Pilih branch `main` dan folder `/ (root)`, lalu klik **Save**.
5. Tunggu sekitar 1 menit, web app Anda akan aktif di URL GitHub Pages Anda.
