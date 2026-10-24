/* ============================================
   HYDROMATE v2.0 - Smart Water Tracker
   ============================================ */

// ============ STATE MANAGEMENT ============
const defaultState = {
    target: 2000, current: 0, history: [], weeklyHistory: {},
    alarmInterval: 60, alarmActive: false, alarmStart: '07:00', alarmEnd: '22:00',
    weight: 55, height: 160, activityLevel: 1.2, lastDate: new Date().toDateString(),
    streak: 0, bestStreak: 0, totalDays: 0, totalWater: 0, xp: 0, level: 1,
    unlockedBadges: [], selectedDrinkType: 'water', drinkFactor: 1.0, theme: 'light', tipsRead: 0,
    notifications: []
};

let state = { ...defaultState };
let currentTipIndex = 0;

// ============ FIREBASE CONFIGURATION ============
// Ganti dengan config yang kamu copy dari Firebase Console tadi
const firebaseConfig = {
    apiKey: "AIzaSyBoQdEjzI6GsqUkY_Sf9ZzqFiFsYbPRfI4",
    authDomain: "hydromate-ce.firebaseapp.com",
    projectId: "hydromate-ce",
    storageBucket: "hydromate-ce.firebasestorage.app",
    messagingSenderId: "39514812360",
    appId: "1:39514812360:web:eca7e41f5b11858bdfdafd"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null; // Menyimpan data user yang sedang login

// ============ APP FLOW CONTROLLER ============
let currentOnboardSlide = 0;
let authMode = 'login';

function initAppFlow() {
    const hasOnboarded = localStorage.getItem('hm_onboarded') === 'true';
    const isLoggedIn = localStorage.getItem('hm_logged_in') === 'true';

    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        splash.classList.add('hidden');
        
        setTimeout(() => {
            splash.style.display = 'none';
            if (!hasOnboarded) document.getElementById('onboarding-screen').style.display = 'flex';
            else if (!isLoggedIn) document.getElementById('auth-screen').style.display = 'flex';
            else enterMainApp();
        }, 500);
    }, 2500);
}

function nextOnboarding() {
    currentOnboardSlide++;
    if (currentOnboardSlide >= 3) finishOnboarding();
    else updateOnboardingUI();
}

function skipOnboarding() { finishOnboarding(); }

function updateOnboardingUI() {
    document.querySelectorAll('.onboarding-slide').forEach((slide, index) => slide.classList.toggle('active', index === currentOnboardSlide));
    document.querySelectorAll('.dot').forEach((dot, index) => dot.classList.toggle('active', index === currentOnboardSlide));
    document.getElementById('btnNextOnboard').textContent = currentOnboardSlide === 2 ? 'Mulai Masuk' : 'Lanjut';
}

function finishOnboarding() {
    localStorage.setItem('hm_onboarded', 'true');
    document.getElementById('onboarding-screen').classList.add('hidden');
    setTimeout(() => {
        document.getElementById('onboarding-screen').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'flex';
    }, 500);
}

function switchAuthTab(mode) {
    authMode = mode;
    document.getElementById('tabLogin').classList.toggle('active', mode === 'login');
    document.getElementById('tabRegister').classList.toggle('active', mode === 'register');
    document.getElementById('nameGroup').style.display = mode === 'register' ? 'block' : 'none';
    document.getElementById('authTitle').textContent = mode === 'login' ? 'Selamat Datang! 👋' : 'Buat Akun Baru 🚀';
    document.getElementById('authSubtitle').textContent = mode === 'login' ? 'Masuk untuk melanjutkan perjalanan hidrasimu.' : 'Bergabunglah untuk hidup lebih sehat.';
    document.getElementById('btnAuthSubmit').textContent = mode === 'login' ? 'Masuk' : 'Daftar';
}


function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('inputEmail').value;
    const password = document.getElementById('inputPassword').value;
    const name = document.getElementById('inputName').value || 'User';
    const isRegister = authMode === 'register';

    showToast(isRegister ? 'Mendaftar...' : 'Masuk...', 'warning');

    if (isRegister) {
        // DAFTAR AKUN BARU
        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                userCredential.user.updateProfile({ displayName: name });
                currentUser = userCredential.user;
                
                // Reset state ke default untuk user baru
                state = { ...defaultState };
                
                // Simpan ke LocalStorage DAN Firestore
                saveData();
                
                // Simpan data awal ke Firestore
                db.collection('users').doc(currentUser.uid).set({
                    name: name,
                    email: email,
                    stateData: state,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                finishLogin(name);
            })
            .catch((error) => {
                console.error(error);
                showToast('Gagal daftar: ' + error.message, 'error');
            });
    } else {
        // LOGIN AKUN LAMA
        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                currentUser = userCredential.user;
                const displayName = currentUser.displayName || 'User';
                
                // Reset state ke default dulu
                state = { ...defaultState };

                // Ambil data dari Cloud Firestore
                db.collection('users').doc(currentUser.uid).get().then((doc) => {
                    if (doc.exists && doc.data().stateData) {
                        // Jika ada data di cloud, gunakan data tersebut
                        state = { ...defaultState, ...doc.data().stateData };
                    }
                    
                    // Simpan state ke LocalStorage (baik kosong atau dari cloud)
                    saveData();
                    
                    finishLogin(displayName);
                }).catch(err => {
                    console.error("Gagal ambil data:", err);
                    // Tetap simpan state default ke LocalStorage
                    saveData();
                    finishLogin(displayName);
                });
            })
            .catch((error) => {
                console.error(error);
                showToast('Email/Password salah!', 'error');
            });
    }
}

// Fungsi pembantu untuk masuk ke aplikasi setelah login sukses
function finishLogin(name) {
    localStorage.setItem('hm_logged_in', 'true');
    localStorage.setItem('hm_user_name', name);
    document.getElementById('auth-screen').classList.add('hidden');
    setTimeout(enterMainApp, 500);
}


function enterMainApp() {
    const mainApp = document.getElementById('main-app');
    mainApp.style.display = 'block';
    
    // Ambil nama dari localStorage
    const userName = localStorage.getItem('hm_user_name') || 'Celsea';
    
    // Update semua tampilan nama
    document.getElementById('userNameDisplay').textContent = userName;
    document.getElementById('profileNameDisplay').textContent = userName;
    document.getElementById('headerAvatar').textContent = userName.charAt(0).toUpperCase();
    document.getElementById('profileAvatarLarge').textContent = userName.charAt(0).toUpperCase();

    // PANGGIL INISIALISASI (TAPI JANGAN loadData lagi karena sudah di-handle di handleAuth)
    loadData();
    applyTheme();
    checkDailyReset();
    updateAllUI();
    renderWeeklyChart();
    renderMonthlyGrid();
    renderAchievements();
    renderTips();
    updateProfileStats();
    updateNotifBadge();
    
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('id-ID', options);
}

// ============ FITUR RESET HARI INI ============
function resetTodayProgress() {
    if (confirm('Yakin ingin mereset progress minum hari ini?\n\nRiwayat minum hari ini akan dihapus, namun total liter, level, dan streak kamu tetap aman.')) {
        const today = new Date().toDateString();
        
        // Hapus data hari ini dari grafik mingguan agar tidak error
        if (state.weeklyHistory[today]) {
            delete state.weeklyHistory[today];
        }
        
        // Reset intake dan history hari ini
        state.current = 0;
        state.history = [];
        
        // Simpan dan update tampilan
        saveData();
        updateAllUI();
        renderTodayTimeline(); 
        
        showToast('Progress hari ini berhasil direset', 'warning');
    }
}

function logout() {
    if(confirm('Yakin ingin keluar dari akun?')) {
        auth.signOut().then(() => {
            currentUser = null;
            localStorage.removeItem('hm_logged_in');
            location.reload();
        });
    }
}


// ============ DATA & ACHIEVEMENTS ============
const achievements = [
    { id: 'first_drink', name: 'Tegukan Pertama', desc: 'Minum air pertama', icon: '💧', requirement: 1, type: 'drinks' },
    { id: 'ten_drinks', name: 'Rajin Minum', desc: '10 kali minum', icon: '', requirement: 10, type: 'drinks' },
    { id: 'fifty_drinks', name: 'Sangat Rajin', desc: '50 kali minum', icon: '🏆', requirement: 50, type: 'drinks' },
    { id: 'target_once', name: 'Target Tercapai', desc: 'Capai target 1x', icon: '🎯', requirement: 1, type: 'targets' },
    { id: 'target_seven', name: 'Minggu Sempurna', desc: 'Capai target 7 hari', icon: '', requirement: 7, type: 'targets' },
    { id: 'streak_3', name: 'Konsisten', desc: 'Streak 3 hari', icon: '🔥', requirement: 3, type: 'streak' },
    { id: 'streak_7', name: 'Satu Minggu', desc: 'Streak 7 hari', icon: '', requirement: 7, type: 'streak' },
    { id: 'streak_30', name: 'Sebulan Penuh', desc: 'Streak 30 hari', icon: '', requirement: 30, type: 'streak' },
    { id: 'liter_10', name: '10 Liter Club', desc: 'Total 10 liter', icon: '💎', requirement: 10, type: 'total_liters' },
    { id: 'liter_50', name: '50 Liter Club', desc: 'Total 50 liter', icon: '', requirement: 50, type: 'total_liters' },
    { id: 'liter_100', name: '100 Liter Legend', desc: 'Total 100 liter', icon: '🎖️', requirement: 100, type: 'total_liters' },
    { id: 'early_bird', name: 'Early Bird', desc: 'Minum sebelum 7 pagi', icon: '🌅', requirement: 1, type: 'early' }
];

const tips = [
    { title: 'Minum air setelah bangun tidur', content: 'Tubuhmu dehidrasi setelah 7-8 jam tidur. Minum 1-2 gelas air putih di pagi hari membantu mengaktifkan metabolisme dan membuang racun.' },
    { title: 'Bawa botol air kemana-mana', content: 'Selalu bawa botol air saat bepergian. Dengan begitu, kamu akan teringat untuk minum secara rutin sepanjang hari.' },
    { title: 'Minum sebelum makan', content: 'Minum segelas air 30 menit sebelum makan membantu pencernaan dan membuat kamu merasa lebih kenyang, baik untuk manajemen berat badan.' },
    { title: 'Atur pengingat di HP', content: 'Gunakan aplikasi seperti HydroMate untuk mengatur pengingat minum air setiap 1-2 jam sekali agar tidak lupa.' },
    { title: 'Tambahkan rasa alami', content: 'Jika bosan dengan air putih, tambahkan irisan lemon, mentimun, atau daun mint untuk rasa yang lebih segar tanpa kalori tambahan.' },
    { title: 'Minum lebih banyak saat olahraga', content: 'Saat berolahraga, tubuh kehilangan banyak cairan melalui keringat. Minum 200-300ml setiap 15-20 menit selama berolahraga.' },
    { title: 'Perhatikan warna urine', content: 'Urine yang berwarna kuning pucat menandakan hidrasi yang baik. Jika terlalu kuning atau gelap, kamu perlu minum lebih banyak air.' },
    { title: 'Makan makanan berair', content: 'Buah seperti semangka, stroberi, dan mentimun mengandung lebih dari 90% air dan bisa membantu memenuhi kebutuhan hidrasi.' },
    { title: 'Minum air hangat di pagi hari', content: 'Air hangat di pagi hari dapat membantu melancarkan pencernaan, meningkatkan sirkulasi darah, dan memberikan rasa nyaman.' },
    { title: 'Hindari minum terlalu banyak sekaligus', content: 'Lebih baik minum sedikit-sedikit tapi sering daripada minum banyak sekaligus. Tubuh lebih efektif menyerap air dalam jumlah kecil.' }
];

// ============ INITIALIZATION ============
function onDeviceReady() {
    loadData();
    applyTheme();
    checkDailyReset();
    updateAllUI();
    renderWeeklyChart();
    renderMonthlyGrid();
    renderAchievements();
    renderTips();
    updateProfileStats();
    
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('id-ID', options);
}

document.addEventListener('deviceready', initAppFlow, false);
if (!window.cordova) window.addEventListener('load', initAppFlow);

// ============ NAVIGATION ============
function navigateTo(pageName) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageName).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navBtn = document.querySelector(`.nav-item[data-page="${pageName}"]`);
    if (navBtn) navBtn.classList.add('active');
    if (pageName === 'stats') { renderWeeklyChart(); renderMonthlyGrid(); }
    if (pageName === 'achievements') renderAchievements();
    if (pageName === 'profile') updateProfileStats();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============ FUNGSI CEPAT KE PENGATURAN ALARM ============
function openAlarmSettings() {
    // 1. Pindah ke halaman Profil
    navigateTo('profile');
    
    // 2. Tunggu sebentar agar halaman profil selesai dimuat, lalu scroll ke bagian alarm
    setTimeout(() => {
        // Cari bagian "Target & Pengingat"
        const alarmSection = document.querySelector('#page-profile .settings-section:nth-child(3)'); 
        
        if (alarmSection) {
            alarmSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Opsional: Beri efek kedip (highlight) agar user tahu harus lihat ke mana
            alarmSection.style.transition = 'background 0.3s';
            alarmSection.style.background = 'var(--primary-50)';
            alarmSection.style.borderRadius = '16px';
            
            setTimeout(() => {
                alarmSection.style.background = 'transparent';
            }, 1500);
        }
    }, 400);
}

// ============ TOGGLE ALARM DARI HOME (TANPA PINDAH HALAMAN) ============
function toggleAlarmFromHome() {
    // Balik status alarm
    state.alarmActive = !state.alarmActive;
    
    // Sinkronkan toggle di profil
    const profileToggle = document.getElementById('alarmToggle');
    if (profileToggle) profileToggle.checked = state.alarmActive;
    
    // Sinkronkan toggle di banner (jika ada)
    const homeToggle = document.getElementById('homeAlarmToggle');
    if (homeToggle) homeToggle.checked = state.alarmActive;
    
    // Jalankan atau batalkan alarm
    if (state.alarmActive) {
        scheduleAlarm();
        document.getElementById('alarmDesc').textContent = `Aktif setiap ${state.alarmInterval} menit`;
        showToast(`Pengingat aktif! Setiap ${state.alarmInterval} menit ⏰`, 'success');
    } else {
        cancelAlarm();
        document.getElementById('alarmDesc').textContent = 'Belum diatur';
        showToast('Pengingat dimatikan', 'warning');
    }
    
    // Update tampilan tombol
    updateHomeAlarmButton();
    updateHomeReminderUI();
    saveData();
}

// Fungsi untuk update warna tombol jam
function updateHomeAlarmButton() {
    const btn = document.getElementById('homeAlarmBtn');
    const icon = document.getElementById('homeAlarmIcon');
    
    if (!btn || !icon) return;
    
    if (state.alarmActive) {
        // AKTIF: Gradient Oranye/Hijau
        btn.style.background = 'linear-gradient(135deg, #10B981 0%, #059669 100%)';
        btn.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
        icon.className = 'fas fa-clock';
    } else {
        // MATI: Abu-abu
        btn.style.background = 'linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%)';
        btn.style.boxShadow = '0 2px 6px rgba(148, 163, 184, 0.3)';
        icon.className = 'fas fa-clock';
    }
}

// ============ GREETING & UI ============
function updateGreeting() {
    const hour = new Date().getHours();
    let greeting, emoji;
    if (hour >= 4 && hour < 11) { greeting = 'Selamat Pagi'; emoji = '☀️'; }
    else if (hour >= 11 && hour < 15) { greeting = 'Selamat Siang'; emoji = '🌤️'; }
    else if (hour >= 15 && hour < 18) { greeting = 'Selamat Sore'; emoji = '🌥️'; }
    else { greeting = 'Selamat Malam'; emoji = ''; }
    document.getElementById('greetingSub').textContent = greeting;
    document.getElementById('greetingEmoji').textContent = emoji;
}

function updateAllUI() {
    updateGreeting();
    updateBottleVisual();
    updateStatsDisplay();
    renderTodayTimeline();
    updateProfileStats();
    updateHomeReminderUI();
    updateHomeAlarmButton();
}

function updateBottleVisual() {
    const percent = Math.min((state.current / state.target) * 100, 100);
    
    // UKURAN BOTOL BARU
    const bottleHeight = 265; // Tinggi area air di botol baru
    const waterHeight = (percent / 100) * bottleHeight;
    const waterY = 305 - waterHeight; // 305 adalah dasar botol baru
    
    document.getElementById('waterBody').setAttribute('y', waterY);
    document.getElementById('progressPercent').textContent = Math.round(percent);
}

function updateStatsDisplay() {
    document.getElementById('consumedDisplay').textContent = state.current;
    document.getElementById('targetDisplay').textContent = state.target;
    document.getElementById('remainingDisplay').textContent = Math.max(state.target - state.current, 0);
    document.getElementById('streakDisplay').textContent = state.streak;
    document.getElementById('glassesCount').textContent = Math.floor(state.current / 200);
    const lastDrink = state.history[state.history.length - 1];
    document.getElementById('lastDrinkTime').textContent = lastDrink ? lastDrink.timeDisplay : '--:--';
}

// ============ WATER TRACKING ============
function addWaterAmount(amount) {
    const effectiveAmount = Math.round(amount * state.drinkFactor);
    state.current += effectiveAmount;
    const now = new Date();
    state.history.push({ amount: effectiveAmount, originalAmount: amount, type: state.selectedDrinkType, time: now.toISOString(), timeDisplay: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) });
    const today = new Date().toDateString();
    if (!state.weeklyHistory[today]) state.weeklyHistory[today] = 0;
    state.weeklyHistory[today] += effectiveAmount;
     pushNotification(
        'Minum Tercatat', 
        `Kamu baru saja minum ${effectiveAmount}ml ${getDrinkTypeName()}.`, 
        'fa-glass-water'
    );
    checkAchievements(); addXP(10); saveData(); updateAllUI(); renderTodayTimeline(); closeQuickAdd();
    showToast(`+${effectiveAmount}ml ${getDrinkTypeName()} ditambahkan!`, 'success'); triggerHaptic();
    if (state.current >= state.target && (state.current - effectiveAmount) < state.target) {
        setTimeout(() => { showToast('🎉 Target harian tercapai!', 'success'); launchConfetti(); addXP(50); }, 500);
    }
}



function addCustomAmount() {
    const input = document.getElementById('customAmount');
    const amount = parseInt(input.value);
    if (amount > 0 && amount <= 2000) { addWaterAmount(amount); input.value = ''; }
    else showToast('Masukkan jumlah 1-2000 ml', 'warning');
}

function selectDrinkType(type, factor) {
    state.selectedDrinkType = type;
    state.drinkFactor = factor;
    
    // Update hanya di Bottom Sheet (type-option)
    document.querySelectorAll('.type-option').forEach(o => o.classList.remove('active'));
    const sheetOption = document.querySelector(`.type-option[data-type="${type}"]`);
    if (sheetOption) sheetOption.classList.add('active');
    
    // Update di Home (drink-card) - hanya jika masih ada
    const homeCard = document.querySelector(`.drink-card[data-type="${type}"]`);
    if (homeCard) {
        document.querySelectorAll('.drink-card').forEach(c => c.classList.remove('active'));
        homeCard.classList.add('active');
    }
}

function getDrinkTypeName(type = state.selectedDrinkType) { const names = { water: 'Air', tea: 'Teh', coffee: 'Kopi', juice: 'Jus' }; return names[type] || 'Air'; }
function getDrinkIcon(type) { const icons = { water: 'fa-droplet', tea: 'fa-mug-hot', coffee: 'fa-coffee', juice: 'fa-wine-glass' }; return icons[type] || 'fa-droplet'; }
function getDrinkColor(type) { const colors = { water: 'linear-gradient(135deg, #0EA5E9, #0284C7)', tea: 'linear-gradient(135deg, #F59E0B, #D97706)', coffee: 'linear-gradient(135deg, #78350F, #451A03)', juice: 'linear-gradient(135deg, #EC4899, #BE185D)' }; return colors[type] || colors.water; }

function renderTodayTimeline() {
    const container = document.getElementById('todayTimeline');
    if (state.history.length === 0) { container.innerHTML = `<div class="empty-timeline"><i class="fas fa-glass-empty"></i><p>Belum ada aktivitas minum hari ini</p><button class="btn-primary-small" onclick="openQuickAdd()">Mulai Tambah</button></div>`; return; }
    container.innerHTML = state.history.slice().reverse().map(item => `<div class="timeline-item"><div class="timeline-icon" style="background: ${getDrinkColor(item.type)}"><i class="fas ${getDrinkIcon(item.type)}"></i></div><div class="timeline-info"><div class="timeline-amount">${item.amount} ml</div><div class="timeline-time">${item.timeDisplay}</div></div><div class="timeline-type">${getDrinkTypeName(item.type)}</div></div>`).join('');
}

// ============ CHARTS ============
function renderWeeklyChart() {
    const container = document.getElementById('weeklyChart');
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const today = new Date(); const weekData = []; let total = 0; let bestDay = { day: '-', amount: 0 }; let goalDays = 0;
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today); date.setDate(today.getDate() - i); const dateStr = date.toDateString();
        const amount = state.weeklyHistory[dateStr] || 0; weekData.push({ day: days[date.getDay()], amount: amount, isToday: i === 0 });
        total += amount; if (amount > bestDay.amount) bestDay = { day: days[date.getDay()], amount }; if (amount >= state.target) goalDays++;
    }
    const maxAmount = Math.max(...weekData.map(d => d.amount), state.target); const average = Math.round(total / 7);
    container.innerHTML = weekData.map(d => { const height = (d.amount / maxAmount) * 140; return `<div class="chart-bar-wrapper"><div class="chart-bar ${d.isToday ? 'today' : ''}" style="height: ${Math.max(height, 4)}px"></div><div class="chart-bar-label">${d.day}</div></div>`; }).join('');
    document.getElementById('weekAverage').textContent = average + ' ml'; document.getElementById('weekTotal').textContent = (total / 1000).toFixed(1) + ' L';
    document.getElementById('bestDay').textContent = bestDay.day; document.getElementById('dailyAverage').textContent = average + ' ml'; document.getElementById('goalDays').textContent = goalDays + '/7 hari';
}

function renderMonthlyGrid() {
    const container = document.getElementById('monthlyGrid');
    const today = new Date(); const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(); const currentDay = today.getDate();
    let html = '';
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(today.getFullYear(), today.getMonth(), i); const dateStr = date.toDateString();
        const amount = state.weeklyHistory[dateStr] || 0; const percent = Math.min((amount / state.target) * 100, 100); const isToday = i === currentDay;
        let fillClass = ''; if (percent >= 100) fillClass = 'filled-100'; else if (percent >= 75) fillClass = 'filled-75'; else if (percent >= 50) fillClass = 'filled-50'; else if (percent >= 25) fillClass = 'filled-25';
        html += `<div class="month-day ${fillClass} ${isToday ? 'today' : ''}">${i}</div>`;
    }
    container.innerHTML = html;
}

// ============ ACHIEVEMENTS & TIPS ============
function renderAchievements() {
    const container = document.getElementById('achievementsGrid'); let unlockedCount = 0;
    container.innerHTML = achievements.map(a => { const unlocked = state.unlockedBadges.includes(a.id); if (unlocked) unlockedCount++; return `<div class="achievement-card ${unlocked ? 'unlocked' : 'locked'}">${unlocked ? '<div class="achievement-check"><i class="fas fa-check"></i></div>' : ''}<div class="achievement-icon">${a.icon}</div><div class="achievement-name">${a.name}</div><div class="achievement-desc">${a.desc}</div></div>`; }).join('');
    document.getElementById('badgeCount').textContent = `${unlockedCount}/${achievements.length}`; updateLevelDisplay();
}

function checkAchievements() {
    const totalDrinks = state.history.length; const totalTargets = Object.values(state.weeklyHistory).filter(a => a >= state.target).length; const totalLiters = state.totalWater / 1000;
    achievements.forEach(a => {
        if (state.unlockedBadges.includes(a.id)) return; let unlocked = false;
        if (a.type === 'drinks' && totalDrinks >= a.requirement) unlocked = true;
        if (a.type === 'targets' && totalTargets >= a.requirement) unlocked = true;
        if (a.type === 'streak' && state.streak >= a.requirement) unlocked = true;
        if (a.type === 'total_liters' && totalLiters >= a.requirement) unlocked = true;
        if (a.type === 'early') { const lastDrink = state.history[state.history.length - 1]; if (lastDrink && new Date(lastDrink.time).getHours() < 7) unlocked = true; }
        if (unlocked) { state.unlockedBadges.push(a.id); pushNotification('Badge Baru!', `Selamat, kamu mendapatkan badge ${a.name}.`, 'fa-trophy');
     setTimeout(() => { showToast(`🏆 Badge baru: ${a.name}!`, 'success'); addXP(25); }, 1000); }
    });
}

function updateLevelDisplay() {
    const levels = ['Pemula 💧', 'Reguler 🥛', 'Rajin ', 'Expert 🏆', 'Master ', 'Legend 🌟'];
    const levelNum = state.level; const levelName = levels[Math.min(levelNum - 1, levels.length - 1)];
    const xpInLevel = state.xp % 100; const percent = (xpInLevel / 100) * 100;
    document.getElementById('userLevel').textContent = levelName; document.getElementById('userLevelNum').textContent = levelNum;
    document.getElementById('currentXP').textContent = xpInLevel; document.getElementById('nextLevelXP').textContent = 100; document.getElementById('xpFill').style.width = percent + '%';
}

function addXP(amount) { state.xp += amount; const newLevel = Math.floor(state.xp / 100) + 1; if (newLevel > state.level) { state.level = newLevel; setTimeout(() => { showToast(`️ Level up! Level ${newLevel}`, 'success'); launchConfetti(); }, 500); } }

function renderTips() {
    document.getElementById('tipsList').innerHTML = tips.map((tip, i) => `<div class="tip-card"><div class="tip-number">${i + 1}</div><div class="tip-content"><h4>${tip.title}</h4><p>${tip.content}</p></div></div>`).join('');
    showDailyTip();
}

function showDailyTip() { const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000); currentTipIndex = dayOfYear % tips.length; const tip = tips[currentTipIndex]; document.getElementById('tipTitle').textContent = tip.title; document.getElementById('tipContent').textContent = tip.content; }
function nextTip() { currentTipIndex = (currentTipIndex + 1) % tips.length; const tip = tips[currentTipIndex]; document.getElementById('tipTitle').textContent = tip.title; document.getElementById('tipContent').textContent = tip.content; }

// ============ PROFILE & SETTINGS ============

function updateProfileStats() {
    // Update tampilan statistik profil
    const daysEl = document.getElementById('profileTotalDays');
    const waterEl = document.getElementById('profileTotalWater');
    const streakEl = document.getElementById('profileBestStreak');
    
    if (daysEl) daysEl.textContent = state.totalDays || 0;
    if (waterEl) waterEl.textContent = ((state.totalWater || 0) / 1000).toFixed(1);
    if (streakEl) streakEl.textContent = state.bestStreak || 0;
    
    // Update juga avatar dan nama profil
    const userName = localStorage.getItem('hm_user_name') || 'User';
    const nameEl = document.getElementById('profileNameDisplay');
    const avatarEl = document.getElementById('profileAvatarLarge');
    
    if (nameEl) nameEl.textContent = userName;
    if (avatarEl) avatarEl.textContent = userName.charAt(0).toUpperCase();
}

function updateBodyStats() {
    state.weight = parseInt(document.getElementById('weightInput').value) || 55;
    state.height = parseInt(document.getElementById('heightInput').value) || 160;
    state.activityLevel = parseFloat(document.getElementById('activityLevel').value) || 1.2;
    
    // Hitung target otomatis
    const autoTarget = Math.round(state.weight * 30 * state.activityLevel);
    
    // Update deskripsi
    document.getElementById('autoTargetDesc').textContent = `Otomatis: ${autoTarget} ml`;
    
    // ✅ PENTING: Update state.target dengan nilai otomatis
    state.target = autoTarget;
    
    // Update input manual target agar sinkron
    document.getElementById('manualTarget').value = autoTarget;
    
    saveData();
    updateAllUI(); // Refresh dashboard
    showToast(`Target otomatis diperbarui: ${autoTarget} ml`, 'success');
}

function updateTarget() {
    const newTarget = parseInt(document.getElementById('manualTarget').value);
    
    if (newTarget && newTarget > 0) {
        state.target = newTarget;
        saveData();
        updateAllUI();
        showToast(`Target diperbarui menjadi ${newTarget} ml`, 'success');
    } else {
        showToast('Masukkan target yang valid', 'warning');
    }
}

// ============ ALARM ============

// ============ FUNGSI PENGINGAT CEPAT (DARI BERANDA) ============
function toggleAlarmQuick() {
    // Balik status alarm
    state.alarmActive = !state.alarmActive;
    
    // Sinkronkan dengan toggle di menu Profil
    const profileToggle = document.getElementById('alarmToggle');
    if (profileToggle) profileToggle.checked = state.alarmActive;
    
    // Sinkronkan dengan toggle di Beranda
    const homeToggle = document.getElementById('homeAlarmToggle');
    if (homeToggle) homeToggle.checked = state.alarmActive;

    // Jalankan logika alarm
    if (state.alarmActive) {
        scheduleAlarm();
        document.getElementById('alarmDesc').textContent = `Aktif setiap ${state.alarmInterval} menit`;
        showToast('Pengingat diaktifkan ⏰', 'success');
    } else {
        cancelAlarm();
        document.getElementById('alarmDesc').textContent = 'Belum diatur';
        showToast('Pengingat dimatikan', 'warning');
    }
    
    updateHomeReminderUI();
    saveData();
}

// Fungsi untuk update tampilan di Beranda
function updateHomeReminderUI() {
    const card = document.querySelector('.reminder-status-card');
    const title = document.getElementById('homeReminderTitle');
    const desc = document.getElementById('homeReminderDesc');
    const icon = document.getElementById('homeReminderIcon');
    const homeToggle = document.getElementById('homeAlarmToggle');
    const profileToggle = document.getElementById('alarmToggle');

    // Sinkronkan checkbox
    if (homeToggle) homeToggle.checked = state.alarmActive;
    if (profileToggle) profileToggle.checked = state.alarmActive;

    if (state.alarmActive) {
        if (card) card.classList.add('active');
        if (title) title.textContent = 'Pengingat Aktif';
        if (desc) desc.textContent = `Setiap ${state.alarmInterval} menit`;
        if (icon) icon.className = 'fas fa-bell';
    } else {
        if (card) card.classList.remove('active');
        if (title) title.textContent = 'Pengingat Mati';
        if (desc) desc.textContent = 'Klik untuk mengaktifkan';
        if (icon) icon.className = 'fas fa-bell-slash';
    }
}

function toggleAlarm() {
    state.alarmActive = document.getElementById('alarmToggle').checked;
    document.getElementById('alarmScheduleRow').style.display = state.alarmActive ? 'flex' : 'none';
    document.getElementById('alarmTimeRow').style.display = state.alarmActive ? 'flex' : 'none';
    
    // Sembunyikan custom interval saat alarm dimatikan
    if (!state.alarmActive) {
        document.getElementById('customIntervalRow').style.display = 'none';
    }
    
    if (state.alarmActive) { 
        scheduleAlarm(); 
        document.getElementById('alarmDesc').textContent = `Aktif setiap ${state.alarmInterval} menit`; 
        showToast('Pengingat diaktifkan ⏰', 'success'); 
    } else { 
        cancelAlarm(); 
        document.getElementById('alarmDesc').textContent = 'Belum diatur'; 
        showToast('Pengingat dimatikan'); 
    }
    saveData();
}

function updateAlarmInterval() {
    const selectValue = document.getElementById('intervalSelect').value;
    
    if (selectValue === 'custom') {
        // Tampilkan input custom
        document.getElementById('customIntervalRow').style.display = 'flex';
        // Gunakan nilai dari input custom
        const customValue = parseInt(document.getElementById('customIntervalInput').value) || 60;
        state.alarmInterval = customValue;
    } else {
        // Sembunyikan input custom
        document.getElementById('customIntervalRow').style.display = 'none';
        state.alarmInterval = parseInt(selectValue);
    }
    
    document.getElementById('alarmDesc').textContent = `Aktif setiap ${state.alarmInterval} menit`;
    saveData();
    if (state.alarmActive) scheduleAlarm();
}

// Fungsi baru untuk handle input custom
function updateCustomInterval() {
    let customValue = parseInt(document.getElementById('customIntervalInput').value);
    
    // Validasi: minimal 1 menit, maksimal 180 menit (3 jam)
    if (customValue < 1) {
        customValue = 1;
        document.getElementById('customIntervalInput').value = 1;
        showToast('Interval minimal 1 menit', 'warning');
    } else if (customValue > 180) {
        customValue = 180;
        document.getElementById('customIntervalInput').value = 180;
        showToast('Interval maksimal 3 jam (180 menit)', 'warning');
    }
    
    state.alarmInterval = customValue;
    document.getElementById('alarmDesc').textContent = `Aktif setiap ${state.alarmInterval} menit`;
    saveData();
    if (state.alarmActive) scheduleAlarm();
}
function updateAlarmSchedule() { state.alarmStart = document.getElementById('alarmStart').value; state.alarmEnd = document.getElementById('alarmEnd').value; saveData(); if (state.alarmActive) scheduleAlarm(); }

function scheduleAlarm() {
    if (!window.cordova || !cordova.plugins || !cordova.plugins.notification) return;
    
    cordova.plugins.notification.local.cancelAll(function() {
        const now = new Date();
        const [startH, startM] = state.alarmStart.split(':').map(Number);
        const [endH, endM] = state.alarmEnd.split(':').map(Number);
        
        const startTime = new Date(now);
        startTime.setHours(startH, startM, 0, 0);
        
        const endTime = new Date(now);
        endTime.setHours(endH, endM, 0, 0);
        
        let scheduleTime = new Date(startTime);
        let id = 1;

        // PERBAIKAN LOGIKA DI SINI:
        // 1. Jika waktu sekarang ADA DI ANTARA jam mulai dan jam selesai
        if (now >= startTime && now <= endTime) {
            // Jadwalkan notifikasi pertama 15 detik dari SEKARANG 
            scheduleTime = new Date(now.getTime() + 15000); 
        } 
        // 2. Jika waktu sekarang SUDAH LEWAT jam selesai (misal jam 23:00)
        else if (now > endTime) {
            // Jadwalkan untuk BESOK PAGI
            scheduleTime.setDate(scheduleTime.getDate() + 1);
        }
        // 3. Jika waktu sekarang BELUM jam mulai (misal jam 05:00 pagi)

        // Loop untuk membuat beberapa notifikasi ke depan
        let count = 0;
        const maxNotifications = 10; // Buat 10 notifikasi ke depan
        
        while (count < maxNotifications) {
            cordova.plugins.notification.local.schedule({
                id: id,
                title: 'Waktunya Minum Air! ',
                text: 'Jaga hidrasi tubuhmu!',
                trigger: { at: scheduleTime },
                foreground: true,
                vibrate: true,
                sound: 'default'
            });
            
            // Tambah interval untuk notifikasi berikutnya
            scheduleTime = new Date(scheduleTime.getTime() + state.alarmInterval * 60000);
            id++;
            count++;
        }
        
        console.log('✅ Jadwal notifikasi berhasil diperbarui. Notifikasi pertama: ' + scheduleTime.toLocaleTimeString());
    });
}

function cancelAlarm() { if (window.cordova && cordova.plugins && cordova.plugins.notification) cordova.plugins.notification.local.cancelAll(); }

// ============ DAILY RESET ============
function checkDailyReset() {
    const today = new Date().toDateString();
    if (state.lastDate !== today) {
        if (state.current >= state.target) { state.streak++; if (state.streak > state.bestStreak) state.bestStreak = state.streak; } else state.streak = 0;
        state.totalDays++; state.totalWater += state.current; state.current = 0; state.history = []; state.lastDate = today; saveData(); updateAllUI();
    }
}

// ============ BOTTOM SHEET & UTILS ============
function openQuickAdd() { document.getElementById('quickAddSheet').classList.add('active'); triggerHaptic(); }
function closeQuickAdd() { document.getElementById('quickAddSheet').classList.remove('active'); }
document.addEventListener('click', function(e) { if (e.target.id === 'quickAddSheet') closeQuickAdd(); });

function toggleTheme() { state.theme = state.theme === 'light' ? 'dark' : 'light'; applyTheme(); saveData(); }
function applyTheme() { document.documentElement.setAttribute('data-theme', state.theme); document.getElementById('themeIcon').className = state.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun'; }

function showToast(message, type = '') { const container = document.getElementById('toastContainer'); const toast = document.createElement('div'); toast.className = 'toast ' + type; toast.innerHTML = `<span>${message}</span>`; container.appendChild(toast); setTimeout(() => toast.remove(), 3000); }
function triggerHaptic() { if (navigator.vibrate) navigator.vibrate(30); if (window.cordova && cordova.plugins && cordova.plugins.vibration) cordova.plugins.vibration.vibrate(30); }
// ============ POP-UP NOTIFIKASI ============
// ============ NOTIFIKASI BADGE ============
function updateNotifBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    
    // Hitung notifikasi yang belum dibaca
    const unreadCount = state.notifications ? 
        state.notifications.filter(n => !n.read).length : 0;
    
    if (unreadCount > 0) {
        badge.style.display = 'flex';
        badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
    } else {
        badge.style.display = 'none';
    }
}

function pushNotification(title, desc, icon = 'fa-bell') {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    
    if (!state.notifications) state.notifications = [];
    
    state.notifications.unshift({ 
        title: title, 
        desc: desc, 
        icon: icon, 
        time: timeStr, 
        read: false 
    });
    
    // Batasi hanya 20 notifikasi terakhir
    if (state.notifications.length > 20) state.notifications.pop();
    
    saveData();
    updateNotifBadge();
}

function openNotifications() {
    const modal = document.getElementById('notif-modal');
    const backdrop = document.getElementById('notif-backdrop');
    const list = document.getElementById('notif-list');
    const badge = document.getElementById('notifBadge');
    const bellBtn = document.querySelector('.notification-btn');
    
    // Sembunyikan badge merah saat dibuka
    if(badge) badge.style.display = 'none';

    // Hitung posisi tombol lonceng untuk menempatkan pop-up di bawahnya
    if (bellBtn) {
        const rect = bellBtn.getBoundingClientRect();
        const topPosition = rect.bottom + 10;
        const rightPosition = window.innerWidth - rect.right;
        
        modal.style.top = topPosition + 'px';
        modal.style.right = rightPosition + 'px';
    }

    // ✅ GANTI: Baca dari state.notifications (data real-time)
    const notifications = state.notifications || [];

    // Render notifikasi
    if (notifications.length > 0) {
        list.innerHTML = notifications.map(n => `
            <div class="notif-item">
                <div class="notif-icon"><i class="fas ${n.icon}"></i></div>
                <div class="notif-content">
                    <div class="notif-title">${n.title}</div>
                    <div class="notif-desc">${n.desc}</div>
                    <div class="notif-time">${n.time}</div>
                </div>
            </div>
        `).join('');
        
        // Tandai semua notifikasi sebagai sudah dibaca
        notifications.forEach(n => n.read = true);
        saveData();
    } else {
        list.innerHTML = '<div class="empty-notif"><i class="far fa-bell-slash" style="font-size:32px; margin-bottom:10px; display:block; opacity:0.4;"></i>Belum ada notifikasi. Yuk minum air!</div>';
    }

    // Tampilkan pop-up dan backdrop
    modal.classList.add('active');
    backdrop.classList.add('active');
}

// ============ PANDUAN APLIKASI ============
function openGuide() {
    document.getElementById('guide-backdrop').classList.add('active');
    document.getElementById('guide-modal').classList.add('active');
    triggerHaptic();
}

function closeGuide() {
    document.getElementById('guide-backdrop').classList.remove('active');
    document.getElementById('guide-modal').classList.remove('active');
}

function closeNotifications() {
    const modal = document.getElementById('notif-modal');
    const backdrop = document.getElementById('notif-backdrop');
    
    modal.classList.remove('active');
    backdrop.classList.remove('active');
}


function shareProgress() { const percent = Math.round((state.current / state.target) * 100); const text = `Hari ini saya sudah minum ${state.current}ml dari target ${state.target}ml (${percent}%)! 💧 #HydroMate`; if (navigator.share) navigator.share({ title: 'Progress Minum Air', text: text }); else { navigator.clipboard.writeText(text); showToast('Progress disalin ke clipboard', 'success'); } }
function exportData() { const dataStr = JSON.stringify(state, null, 2); const blob = new Blob([dataStr], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `hydromate-backup-${new Date().toISOString().split('T')[0]}.json`; a.click(); showToast('Data berhasil diexport', 'success'); }

function launchConfetti() {
    const canvas = document.getElementById('confettiCanvas'); const ctx = canvas.getContext('2d'); canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const particles = []; const colors = ['#0D9488', '#5EEAD4', '#F59E0B', '#EC4899', '#0EA5E9', '#10B981'];
    for (let i = 0; i < 100; i++) particles.push({ x: canvas.width / 2, y: canvas.height / 2, vx: (Math.random() - 0.5) * 15, vy: (Math.random() - 0.5) * 15 - 5, size: Math.random() * 8 + 4, color: colors[Math.floor(Math.random() * colors.length)], rotation: Math.random() * 360, rotationSpeed: (Math.random() - 0.5) * 10 });
    let frame = 0; function animate() { ctx.clearRect(0, 0, canvas.width, canvas.height); particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.rotation += p.rotationSpeed; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation * Math.PI / 180); ctx.fillStyle = p.color; ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size); ctx.restore(); }); frame++; if (frame < 120) requestAnimationFrame(animate); else ctx.clearRect(0, 0, canvas.width, canvas.height); } animate();
}


// ============ STORAGE ============
function saveData() {
    // 1. Selalu simpan ke LocalStorage (agar cepat & bisa offline)
    try {
        localStorage.setItem('hydroMate_v2', JSON.stringify(state));
    } catch(e) {
        console.error('Gagal simpan ke LocalStorage:', e);
    }
    
    // 2. Jika user login, backup ke Firebase Firestore
    if (currentUser) {
        db.collection('users').doc(currentUser.uid).set({
            name: currentUser.displayName || 'User',
            email: currentUser.email,
            stateData: state,
            lastSync: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }) // merge: true agar tidak menimpa field lain
        .then(() => {
            console.log('✅ Data berhasil disinkronkan ke Cloud');
        })
        .catch(err => {
            console.error('❌ Gagal sync ke cloud:', err);
            // Jika offline, data tetap aman di LocalStorage
        });
    }
}

function loadData() {
    const saved = localStorage.getItem('hydroMate_v2');
    if (saved) { 
        try { 
            state = { ...defaultState, ...JSON.parse(saved) }; 
        } catch(e) { 
            console.error('Error loading data', e); 
        } 
    }
    
    document.getElementById('weightInput').value = state.weight;
    document.getElementById('heightInput').value = state.height;
    document.getElementById('activityLevel').value = state.activityLevel;
    
    // ✅ Hitung target otomatis dari data tubuh
    const autoTarget = Math.round(state.weight * 30 * state.activityLevel);
    document.getElementById('autoTargetDesc').textContent = `Otomatis: ${autoTarget} ml`;
    
    // Jika user belum pernah set target manual, gunakan autoTarget
    if (state.target === 2000 && state.weight !== 55) {
        // Artinya user sudah ubah berat badan tapi target masih default
        state.target = autoTarget;
    }
    
    document.getElementById('manualTarget').value = state.target;
    document.getElementById('alarmToggle').checked = state.alarmActive;
    
    const intervalSelect = document.getElementById('intervalSelect');
    const intervalOptions = ['1','15', '30', '45', '60', '90', '120'];
    
    if (intervalOptions.includes(state.alarmInterval.toString())) {
        intervalSelect.value = state.alarmInterval.toString();
        document.getElementById('customIntervalRow').style.display = 'none';
    } else {
        intervalSelect.value = 'custom';
        document.getElementById('customIntervalInput').value = state.alarmInterval;
        document.getElementById('customIntervalRow').style.display = 'flex';
    }
    
    document.getElementById('intervalSelect').value = intervalSelect.value;
    document.getElementById('alarmStart').value = state.alarmStart;
    document.getElementById('alarmEnd').value = state.alarmEnd;
    
    if (state.alarmActive) { 
        document.getElementById('alarmScheduleRow').style.display = 'flex';
        document.getElementById('alarmTimeRow').style.display = 'flex';
        document.getElementById('alarmDesc').textContent = `Aktif setiap ${state.alarmInterval} menit`;
        
        if (!intervalOptions.includes(state.alarmInterval.toString())) {
            document.getElementById('customIntervalRow').style.display = 'flex';
        }
    }
}

/* ============================================
   PERBAIKAN LOGIKA BOTTOM SHEET & KLIK
   ============================================ */

// Fungsi untuk menutup bottom sheet jika yang diklik adalah area gelap di luar sheet
document.addEventListener('click', function(event) {
    const sheet = document.getElementById('quickAddSheet');
    if (sheet && sheet.classList.contains('active')) {
        // Jika yang diklik adalah overlay (bukan isi sheet), maka tutup
        if (event.target === sheet) {
            closeQuickAdd();
        }
    }
});


// Debugging: Cek apakah ada error di console (Bisa dihapus nanti)
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('Error: ' + msg + '\nURL: ' + url + '\nLine: ' + lineNo);
    return false;
};