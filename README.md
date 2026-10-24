# 💧 HydroMate - Smart Water Tracker

**HydroMate** adalah aplikasi pelacak asupan air harian berbasis Android yang dirancang untuk membantu pengguna menjaga hidrasi tubuh secara konsisten. Aplikasi ini dilengkapi dengan sistem pengingat pintar, target otomatis berbasis data tubuh, dan gamifikasi untuk membuat kebiasaan minum air menjadi lebih menyenangkan.

![Version](https://img.shields.io/badge/version-2.0.0-blue) ![Platform](https://img.shields.io/badge/platform-Android-green) ![License](https://img.shields.io/badge/license-MIT-yellow)

---

## ✨ Fitur Utama

### 🔐 Autentikasi & Cloud Database
- Login dan Register menggunakan **Firebase Authentication**.
- Data pengguna tersimpan aman di **Firebase Cloud Firestore**, sehingga progress tidak hilang meskipun aplikasi dihapus atau berpindah perangkat.

###  Pengingat Minum Pintar (Native Notification)
- Notifikasi *native* Android menggunakan `cordova-plugin-local-notification`.
- Interval pengingat dapat dikustomisasi (1 menit hingga custom).
- Pengingat hanya aktif pada jam yang ditentukan (misal: 07:00 - 22:00) agar tidak mengganggu waktu tidur.

### 🎯 Target Hidrasi Otomatis
- Menghitung target minum harian secara otomatis berdasarkan **Berat Badan** dan **Level Aktivitas** pengguna.
- User juga dapat mengatur target manual sesuai keinginan.

###  Interactive Onboarding Tour
- Panduan interaktif otomatis yang muncul saat pertama kali login.
- Menyorot fitur-fitur utama aplikasi (tombol tambah air, pengingat, notifikasi) agar user baru tidak bingung.

### 🏆 Gamifikasi & Statistik
- Sistem Level dan XP untuk memotivasi pengguna.
- Koleksi Badge pencapaian (Streak, Total Liter, Early Bird).
- Grafik statistik mingguan dan kalender bulanan.

###  UI/UX Modern
- Desain *Glassmorphism* dan *Floating Bottom Navigation*.
- Mendukung **Dark Mode** dan **Light Mode**.
- Visualisasi botol air SVG yang terisi secara *real-time*.

---

## 🛠️ Teknologi yang Digunakan

- **Frontend:** HTML5, CSS3, JavaScript (ES6)
- **Framework:** Apache Cordova (Android)
- **Backend & Database:** Firebase (Authentication & Firestore)
- **Plugins:** `cordova-plugin-local-notification`
- **Icons:** Font Awesome 6

---

##  Cara Menjalankan Proyek

### Prasyarat
- Node.js & NPM terinstal
- Apache Cordova CLI (`npm install -g cordova`)
- Android Studio & Android SDK (untuk build APK)

### Langkah Instalasi
1. Clone repository ini:
   ```bash
   git clone https://github.com/p2-celsiana/hydromate.git
