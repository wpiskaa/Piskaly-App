/**
 * PISKALY FUN & ENGAGING FEATURES
 * 1. Pisku Morning Briefing & Voice Greeting (Asisten Hidup ala Jarvis)
 * 2. Mood & Energy Tracker Harian + Weekly Recap (Jurnal Emosi Cepat & Flexing)
 * 3. Piskaly Wrapped (Spotify-style Interactive Story Recap)
 */

(function () {
  'use strict';

  // State variables for voice & wrapped
  let currentUtterance = null;
  let isSpeaking = false;
  let wrappedCurrentSlide = 0;
  const WRAPPED_TOTAL_SLIDES = 5;
  let wrappedTimer = null;

  /* ===================================================
     1. PISKU MORNING BRIEFING & VOICE GREETING
     =================================================== */

  /**
   * Check if today's briefing should be shown automatically on first visit of the day
   */
  window.checkDailyBriefing = function () {
    try {
      const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
      const lastDate = Store.getLastBriefingDate();
      
      // If user hasn't seen the briefing today, show after a short pleasant delay
      if (lastDate !== today) {
        setTimeout(() => {
          // Double check app is active and user is logged in
          const user = Store.getCurrentUser ? Store.getCurrentUser() : null;
          if (user || !localStorage.getItem('mylife_users')) {
            openMorningBriefing(false);
          }
        }, 1200);
      }
    } catch (e) {
      console.warn('checkDailyBriefing error:', e);
    }
  };

  /**
   * Build smart briefing data based on calendar, schedule, tasks & finances
   */
  function generateBriefingSummary() {
    const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
    const profil = Store.getProfil() || {};
    const userName = (profil.nama || 'Piska').split(' ')[0];

    // Day name in Indonesian
    const dateObj = new Date();
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const dayName = dayNames[dateObj.getDay()];
    const dateFormatted = `${dayName}, ${dateObj.getDate()} ${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

    // 1. Jadwal Kuliah Hari Ini
    const allJadwal = Store.getJadwal() || [];
    const todayJadwal = allJadwal.filter(j => j.hari && j.hari.toLowerCase() === dayName.toLowerCase());

    // 2. Agenda Hari Ini
    const allEvents = Store.getEvents() || [];
    const todayEvents = allEvents.filter(ev => {
      if (!ev.tanggal) return false;
      return ev.tanggal === today;
    });

    // 3. Tugas Deadline Terdekat / Pending
    const allTugas = Store.getTugas() || [];
    const pendingTugas = allTugas.filter(t => t.status !== 'done');
    const urgentTugas = pendingTugas.filter(t => {
      if (!t.deadline) return false;
      const diff = new Date(t.deadline) - dateObj;
      return diff >= 0 && diff <= 3 * 24 * 60 * 60 * 1000; // <= 3 hari
    });

    // 4. Saldo / Tabungan
    const trans = Store.getTransaksi() || [];
    let saldo = 0;
    trans.forEach(t => {
      const amt = Number(t.nominal) || 0;
      if (t.tipe === 'masuk') saldo += amt;
      else if (t.tipe === 'keluar') saldo -= amt;
    });

    // Greeting time based on hour
    const hour = dateObj.getHours();
    let timeGreeting = 'Selamat pagi';
    let greetingEmoji = '☀️';
    if (hour >= 11 && hour < 15) {
      timeGreeting = 'Selamat siang';
      greetingEmoji = '🌤️';
    } else if (hour >= 15 && hour < 18) {
      timeGreeting = 'Selamat sore';
      greetingEmoji = '🌇';
    } else if (hour >= 18 || hour < 4) {
      timeGreeting = 'Selamat malam';
      greetingEmoji = '🌙';
    }

    // Build spoken text (natural Indonesian)
    let spokenScript = `${timeGreeting}, ${userName}! Pisku siap mendampingi harimu di ${dayName}. `;

    if (todayJadwal.length > 0) {
      spokenScript += `Hari ini kamu ada ${todayJadwal.length} jadwal kuliah, termasuk ${todayJadwal[0].matkul || 'mata kuliah utama'}. `;
    } else {
      spokenScript += `Hari ini jadwal kuliahmu libur, waktu yang tepat untuk produktif atau istirahat sejenak. `;
    }

    if (todayEvents.length > 0) {
      spokenScript += `Tercatat ada ${todayEvents.length} agenda kegiatan penting yang menantimu. `;
    }

    if (urgentTugas.length > 0) {
      spokenScript += `Perhatian, ada ${urgentTugas.length} tugas yang mendekati batas waktu. `;
    } else if (pendingTugas.length > 0) {
      spokenScript += `Ada ${pendingTugas.length} tugas aktif yang bisa kamu cicil perlahan. `;
    } else {
      spokenScript += `Hebat, semua tugasmu sudah beres tercatat! `;
    }

    spokenScript += `Jaga semangat dan energi positifmu ya!`;

    return {
      userName,
      timeGreeting,
      greetingEmoji,
      dateFormatted,
      dayName,
      jadwalCount: todayJadwal.length,
      todayJadwal,
      eventCount: todayEvents.length,
      todayEvents,
      urgentTugasCount: urgentTugas.length,
      pendingTugasCount: pendingTugas.length,
      saldoFormatted: 'Rp ' + Math.max(0, saldo).toLocaleString('id-ID'),
      spokenScript
    };
  }

  /**
   * Open the Morning Briefing Modal
   */
  window.openMorningBriefing = function (force = true) {
    const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
    Store.setLastBriefingDate(today);

    const summary = generateBriefingSummary();
    const modal = document.getElementById('modalMorningBriefing');
    if (!modal) return;

    // Populate UI elements
    const greetingEl = document.getElementById('briefingGreeting');
    const dateEl = document.getElementById('briefingDate');
    const scriptEl = document.getElementById('briefingSpeechText');
    const kuliahStatEl = document.getElementById('briefingKuliahCount');
    const agendaStatEl = document.getElementById('briefingAgendaCount');
    const tugasStatEl = document.getElementById('briefingTugasCount');
    const tugasLabelEl = document.getElementById('briefingTugasLabel');

    if (greetingEl) greetingEl.textContent = `${summary.timeGreeting}, ${summary.userName}! ${summary.greetingEmoji}`;
    if (dateEl) dateEl.textContent = summary.dateFormatted;
    if (scriptEl) scriptEl.textContent = `"${summary.spokenScript}"`;
    if (kuliahStatEl) kuliahStatEl.textContent = summary.jadwalCount;
    if (agendaStatEl) agendaStatEl.textContent = summary.eventCount;
    if (tugasStatEl) {
      tugasStatEl.textContent = (summary.urgentTugasCount > 0 ? summary.urgentTugasCount : summary.pendingTugasCount);
    }
    if (tugasLabelEl) {
      tugasLabelEl.textContent = summary.urgentTugasCount > 0 ? 'Mendesak' : 'Tugas';
    }

    // Reset voice button state
    stopBriefingVoice();
    const voiceBtn = document.getElementById('briefingVoiceBtn');
    const wavesEl = document.getElementById('briefingWaves');
    if (voiceBtn) {
      voiceBtn.innerHTML = '<i data-lucide="volume-2"></i> <span>Dengarkan Suara</span>';
    }
    if (wavesEl) wavesEl.classList.remove('speaking');

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  };

  /**
   * Close the Morning Briefing Modal
   */
  window.closeMorningBriefing = function () {
    stopBriefingVoice();
    const modal = document.getElementById('modalMorningBriefing');
    if (modal) modal.classList.add('hidden');
  };

  /**
   * Toggle Voice Greeting (Text-to-Speech)
   */
  window.toggleBriefingVoice = function () {
    if (isSpeaking) {
      stopBriefingVoice();
    } else {
      const summary = generateBriefingSummary();
      playBriefingVoice(summary.spokenScript);
    }
  };

  function playBriefingVoice(text) {
    if (!('speechSynthesis' in window)) {
      if (typeof showToast === 'function') {
        showToast('Browser kamu belum mendukung audio suara langsung');
      }
      return;
    }

    window.speechSynthesis.cancel();

    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.lang = 'id-ID';
    currentUtterance.rate = 1.0;
    currentUtterance.pitch = 1.05;

    // Pick Indonesian voice if found
    const voices = window.speechSynthesis.getVoices();
    const indonesianVoice = voices.find(v => v.lang.startsWith('id') || v.name.toLowerCase().includes('indonesia'));
    if (indonesianVoice) {
      currentUtterance.voice = indonesianVoice;
    }

    const voiceBtn = document.getElementById('briefingVoiceBtn');
    const wavesEl = document.getElementById('briefingWaves');

    currentUtterance.onstart = function () {
      isSpeaking = true;
      if (voiceBtn) {
        voiceBtn.innerHTML = '<i data-lucide="square"></i> <span>Hentikan</span>';
        if (window.lucide) window.lucide.createIcons();
      }
      if (wavesEl) wavesEl.classList.add('speaking');
    };

    currentUtterance.onend = function () {
      stopBriefingVoice();
    };

    currentUtterance.onerror = function (err) {
      console.warn('Speech error:', err);
      stopBriefingVoice();
    };

    window.speechSynthesis.speak(currentUtterance);
  }

  function stopBriefingVoice() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isSpeaking = false;
    currentUtterance = null;
    const voiceBtn = document.getElementById('briefingVoiceBtn');
    const wavesEl = document.getElementById('briefingWaves');
    if (voiceBtn) {
      voiceBtn.innerHTML = '<i data-lucide="volume-2"></i> <span>Dengarkan Suara</span>';
      if (window.lucide) window.lucide.createIcons();
    }
    if (wavesEl) wavesEl.classList.remove('speaking');
  }


  /* ===================================================
     2. MOOD & ENERGY TRACKER HARIAN + WEEKLY RECAP
     =================================================== */

  const MOOD_OPTIONS = [
    { key: 'produktif', emoji: '🔥', label: 'Produktif', energy: 95, cheer: 'Luar biasa! Mode fokus menyala penuh, sikat semua target hari ini!' },
    { key: 'santai', emoji: '😊', label: 'Santai', energy: 80, cheer: 'Pikiran tenang, mood senang! Nikmati harimu dengan flow yang asik.' },
    { key: 'biasa', emoji: '😐', label: 'Biasa', energy: 60, cheer: 'Hari yang stabil. Tetap jaga ritme dan minum air putih yang cukup ya!' },
    { key: 'lelah', emoji: '😫', label: 'Lelah', energy: 35, cheer: 'Kamu sudah berjuang keras. Jangan lupa istirahat sejenak untuk recharge!' },
    { key: 'mager', emoji: '😴', label: 'Mager', energy: 20, cheer: 'Wajar banget ada hari santai. Ambil napas, chill, dan jangan memaksakan diri.' }
  ];

  /**
   * Render Mood Tracker Card on Home Page
   */
  window.renderHomeMoodTracker = function () {
    const container = document.getElementById('homeMoodWidget');
    if (!container) return;

    const todayMood = Store.getTodayMood();

    let buttonsHtml = MOOD_OPTIONS.map(opt => {
      const isActive = todayMood && todayMood.mood === opt.key;
      return `
        <button class="mood-item-btn ${isActive ? 'active' : ''}" 
                onclick="selectTodayMood('${opt.key}')" 
                title="${opt.label} (${opt.energy}% Energi)">
          <span class="mood-emoji">${opt.emoji}</span>
          <span class="mood-lbl">${opt.label}</span>
        </button>
      `;
    }).join('');

    let feedbackText = todayMood 
      ? `Tercatat: ${todayMood.emoji} ${todayMood.label} (${todayMood.energy}% Energi)`
      : `Bagaimana suasana hati & energimu hari ini? Tentukan dalam 1 tap!`;

    // Find custom cheer if selected
    if (todayMood) {
      const matched = MOOD_OPTIONS.find(m => m.key === todayMood.mood);
      if (matched) feedbackText = matched.cheer;
    }

    container.innerHTML = `
      <div class="home-mood-card">
        <div class="home-mood-header">
          <div class="home-mood-title">
            <i data-lucide="sparkles" style="color:#f59e0b; width:16px; height:16px;"></i>
            <span>Mood & Energi Hari Ini</span>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="home-recap-pill-btn" onclick="openMorningBriefing(true)" title="Dengarkan Suara & Briefing Pisku">
              <i data-lucide="sun" style="width:12px; height:12px;"></i>
              <span>Briefing</span>
            </button>
            <button class="home-recap-pill-btn" onclick="openWeeklyRecap()" title="Rangkuman 7 Hari Terakhir">
              <i data-lucide="bar-chart-2" style="width:12px; height:12px;"></i>
              <span>Recap</span>
            </button>
          </div>
        </div>
        <div class="mood-selector-row">
          ${buttonsHtml}
        </div>
        <div class="mood-feedback-toast" id="moodFeedbackMsg">${feedbackText}</div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  };

  /**
   * Select a mood for today
   */
  window.selectTodayMood = function (key) {
    const option = MOOD_OPTIONS.find(m => m.key === key);
    if (!option) return;

    Store.setTodayMood(option.key, option.label, option.emoji, option.energy);
    renderHomeMoodTracker();

    if (typeof showToast === 'function') {
      showToast(`${option.emoji} Mood hari ini disimpan: ${option.label}!`);
    }
  };

  /**
   * Open Weekly Story Recap Modal
   */
  window.openWeeklyRecap = function () {
    const modal = document.getElementById('modalWeeklyRecap');
    if (!modal) return;

    const profil = Store.getProfil() || {};
    const userName = (profil.nama || 'Piska').split(' ')[0];

    // Compute weekly data (last 7 days)
    const history = Store.getMoodHistory() || [];
    const last7DaysMoods = history.slice(-7);

    // Dominant Mood
    let moodCount = {};
    let totalEnergy = 0;
    last7DaysMoods.forEach(m => {
      moodCount[m.mood] = (moodCount[m.mood] || 0) + 1;
      totalEnergy += (m.energy || 70);
    });

    let dominantMoodKey = 'produktif';
    let maxC = 0;
    for (let k in moodCount) {
      if (moodCount[k] > maxC) {
        maxC = moodCount[k];
        dominantMoodKey = k;
      }
    }
    const domOpt = MOOD_OPTIONS.find(m => m.key === dominantMoodKey) || MOOD_OPTIONS[0];
    const avgEnergy = last7DaysMoods.length > 0 ? Math.round(totalEnergy / last7DaysMoods.length) : 85;

    // Tasks completed in the past 7 days
    const allTugas = Store.getTugas() || [];
    const doneTugas = allTugas.filter(t => t.status === 'done').length;

    // Events attended
    const allEvents = Store.getEvents() || [];

    // Fun Weekly Persona
    let personaTitle = 'Pejuang Hebat 🛡️';
    let quote = 'Setiap langkah kecil yang kamu ambil minggu ini adalah bukti komitmenmu untuk masa depan yang gemilang.';

    if (avgEnergy >= 80) {
      personaTitle = 'The Productivity Dynamo 🔥';
      quote = 'Energi dan semangatmu minggu ini menyala tinggi! Kamu membabat target tanpa ragu.';
    } else if (dominantMoodKey === 'santai') {
      personaTitle = 'Zen Master of Living 🌿';
      quote = 'Keseimbangan hidupmu luar biasa! Tetap produktif tanpa mengorbankan ketenangan pikiran.';
    } else if (dominantMoodKey === 'lelah' || dominantMoodKey === 'mager') {
      personaTitle = 'The Resilient Fighter ⚡';
      quote = 'Meskipun lelah melanda, kamu tetap bertahan dan melangkah maju. Jangan lupa self-reward!';
    }

    // Populate modal
    const headlineEl = document.getElementById('recapHeadline');
    const moodBadgeEl = document.getElementById('recapMoodBadge');
    const energyValEl = document.getElementById('recapEnergyVal');
    const tugasDoneEl = document.getElementById('recapTugasDone');
    const agendaDoneEl = document.getElementById('recapAgendaDone');
    const quoteEl = document.getElementById('recapQuoteText');

    if (headlineEl) headlineEl.textContent = `Minggu Luar Biasa, ${userName}!`;
    if (moodBadgeEl) moodBadgeEl.innerHTML = `${domOpt.emoji} ${domOpt.label}`;
    if (energyValEl) energyValEl.textContent = `${avgEnergy}% Rata-rata`;
    if (tugasDoneEl) tugasDoneEl.textContent = doneTugas;
    if (agendaDoneEl) agendaDoneEl.textContent = allEvents.length;
    if (quoteEl) quoteEl.textContent = `"${quote}"`;

    // Store flexing text for copying
    window._lastWeeklyRecapFlexText = `🌟 RECAP MINGGUANKU DI PISKALY 🌟\n` +
      `👤 ${userName} (${personaTitle})\n` +
      `🔥 Vibe Dominan: ${domOpt.emoji} ${domOpt.label}\n` +
      `⚡ Rata-rata Energi: ${avgEnergy}%\n` +
      `✅ Tugas Tuntas: ${doneTugas} tugas\n` +
      `📅 Agenda Tercatat: ${allEvents.length} agenda\n` +
      `💬 "${quote}"\n\n` +
      `Di-track dengan rapi via Piskaly App 🚀`;

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  };

  window.closeWeeklyRecap = function () {
    const modal = document.getElementById('modalWeeklyRecap');
    if (modal) modal.classList.add('hidden');
  };

  /**
   * Share / Copy Weekly Recap for Flexing on WhatsApp / IG
   */
  window.shareWeeklyRecap = function () {
    const text = window._lastWeeklyRecapFlexText || 'Recap Mingguan Piskaly App!';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        if (typeof showToast === 'function') {
          showToast('✨ Teks recap berhasil disalin! Siap untuk di-paste/flexing!');
        }
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  };

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (typeof showToast === 'function') showToast('✨ Teks recap berhasil disalin!');
    } catch (e) {
      prompt('Salin teks rangkuman mingguan ini:', text);
    }
    document.body.removeChild(ta);
  }


  /* ===================================================
     3. PISKALY WRAPPED (SPOTIFY-STYLE STORY RECORDER)
     =================================================== */

  window.openPiskalyWrapped = function () {
    const modal = document.getElementById('modalPiskalyWrapped');
    if (!modal) return;

    wrappedCurrentSlide = 0;
    renderWrappedSlide(0);
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();

    startWrappedTimer();
  };

  window.closePiskalyWrapped = function () {
    clearTimeout(wrappedTimer);
    const modal = document.getElementById('modalPiskalyWrapped');
    if (modal) modal.classList.add('hidden');
  };

  window.nextWrappedSlide = function () {
    if (wrappedCurrentSlide < WRAPPED_TOTAL_SLIDES - 1) {
      wrappedCurrentSlide++;
      renderWrappedSlide(wrappedCurrentSlide);
      startWrappedTimer();
    } else {
      closePiskalyWrapped();
    }
  };

  window.prevWrappedSlide = function () {
    if (wrappedCurrentSlide > 0) {
      wrappedCurrentSlide--;
      renderWrappedSlide(wrappedCurrentSlide);
      startWrappedTimer();
    }
  };

  function startWrappedTimer() {
    clearTimeout(wrappedTimer);
    // Auto-advance after 6.5s per slide
    wrappedTimer = setTimeout(() => {
      if (wrappedCurrentSlide < WRAPPED_TOTAL_SLIDES - 1) {
        nextWrappedSlide();
      }
    }, 6500);
  }

  function renderWrappedSlide(index) {
    const profil = Store.getProfil() || {};
    const userName = (profil.nama || 'Piska').split(' ')[0];

    // Stats calculation
    const allTugas = Store.getTugas() || [];
    const doneTugas = allTugas.filter(t => t.status === 'done');
    const totalTugas = allTugas.length;
    const completionRate = totalTugas > 0 ? Math.round((doneTugas.length / totalTugas) * 100) : 100;

    const allEvents = Store.getEvents() || [];
    const allJadwal = Store.getJadwal() || [];

    const trans = Store.getTransaksi() || [];
    let totalMasuk = 0;
    let totalKeluar = 0;
    trans.forEach(t => {
      const n = Number(t.nominal) || 0;
      if (t.tipe === 'masuk') totalMasuk += n;
      else if (t.tipe === 'keluar') totalKeluar += n;
    });

    const moods = Store.getMoodHistory() || [];
    const productiveDays = moods.filter(m => m.mood === 'produktif' || m.mood === 'santai').length;

    // Archetype assignment
    let archetype = {
      title: 'Master of Balance',
      icon: '🏆',
      desc: 'Kamu mampu menyeimbangkan tugas kuliah, agenda harian, dan keuangan dengan sangat tenang dan teratur.'
    };

    if (doneTugas.length >= 5) {
      archetype = {
        title: 'The Deadline Conqueror ⚡',
        icon: '⚔️',
        desc: 'Tak ada deadline tugas yang luput dari terkamanmu. Kamu membabat habis semua tanggung jawab tepat waktu!'
      };
    } else if (totalMasuk > totalKeluar && totalMasuk > 1000000) {
      archetype = {
        title: 'Smart Money Strategist 💎',
        icon: '💰',
        desc: 'Keuanganmu sangat rapi dan terkontrol. Aliran tabungan dan pengeluaran tercatat dengan presisi tinggi.'
      };
    } else if (productiveDays >= 4) {
      archetype = {
        title: 'Energy Dynamo 🔥',
        icon: '🚀',
        desc: 'Energi positifmu menular ke setiap hari! Kamu selalu aktif memanfaatkan waktu untuk berproses.'
      };
    }

    // Update progress bars
    const progressBars = document.querySelectorAll('.wrapped-progress-bar');
    progressBars.forEach((bar, idx) => {
      const fill = bar.querySelector('.wrapped-progress-fill');
      if (idx < index) {
        bar.classList.add('done');
        if (fill) fill.style.width = '100%';
      } else if (idx === index) {
        bar.classList.remove('done');
        if (fill) {
          fill.style.width = '0%';
          setTimeout(() => { fill.style.width = '100%'; }, 50);
        }
      } else {
        bar.classList.remove('done');
        if (fill) fill.style.width = '0%';
      }
    });

    const slideContent = document.getElementById('wrappedSlideBody');
    if (!slideContent) return;

    if (index === 0) {
      // SLIDE 1: Welcome & Cover
      slideContent.innerHTML = `
        <div class="wrapped-glow-orb"></div>
        <div class="wrapped-kicker">PISKALY WRAPPED</div>
        <h1 class="wrapped-big-title">Cerita Perjalananmu, ${userName}</h1>
        <p style="font-size:14px; color:rgba(255,255,255,0.8); line-height:1.6; max-width:320px; margin:0 auto 24px;">
          Setiap jadwal, tugas, dan langkah kecil yang kamu catat telah membentuk perjalanan berharga. Mari kita putar kembali highlights terbaikmu!
        </p>
        <div style="font-size:52px; margin:16px 0;">✨🎧✨</div>
      `;
    } else if (index === 1) {
      // SLIDE 2: Tugas & Produktivitas
      slideContent.innerHTML = `
        <div class="wrapped-glow-orb" style="background:radial-gradient(circle, rgba(16,185,129,0.35), transparent 70%);"></div>
        <div class="wrapped-kicker">PRODUKTIVITAS & KULIAH</div>
        <h2 class="wrapped-big-title">Target Tuntas</h2>
        <div class="wrapped-stat-hero">${doneTugas.length}</div>
        <div class="wrapped-stat-hero-sub">Tugas berhasil diselesaikan (${completionRate}% Tuntas)</div>
        <p style="font-size:13.5px; color:rgba(255,255,255,0.75); line-height:1.5;">
          Dari total ${totalTugas} tugas yang masuk ke sistem, kamu membuktikan tekad dan ketangguhanmu dalam belajar!
        </p>
      `;
    } else if (index === 2) {
      // SLIDE 3: Agenda & Kegiatan
      slideContent.innerHTML = `
        <div class="wrapped-glow-orb" style="background:radial-gradient(circle, rgba(245,158,11,0.35), transparent 70%);"></div>
        <div class="wrapped-kicker">AGENDA & KALENDER</div>
        <h2 class="wrapped-big-title">Momen Penting</h2>
        <div class="wrapped-stat-hero">${allEvents.length + allJadwal.length}</div>
        <div class="wrapped-stat-hero-sub">Sesi Kuliah & Agenda Kegiatan</div>
        <p style="font-size:13.5px; color:rgba(255,255,255,0.75); line-height:1.5;">
          Waktu tidak pernah terbuang sia-sia karena kamu mengaturnya dengan penuh kesadaran dan disiplin.
        </p>
      `;
    } else if (index === 3) {
      // SLIDE 4: Finansial & Pengelolaan
      slideContent.innerHTML = `
        <div class="wrapped-glow-orb" style="background:radial-gradient(circle, rgba(59,130,246,0.35), transparent 70%);"></div>
        <div class="wrapped-kicker">FINANSIAL & KEUANGAN</div>
        <h2 class="wrapped-big-title">Uang Terkelola</h2>
        <div class="wrapped-stat-hero" style="font-size:38px;">Rp ${(totalMasuk + totalKeluar).toLocaleString('id-ID')}</div>
        <div class="wrapped-stat-hero-sub">Total perputaran dana yang kamu pantau</div>
        <div style="background:rgba(255,255,255,0.08); border-radius:14px; padding:12px; margin-top:16px; font-size:12.5px; display:flex; justify-content:space-around;">
          <div><span style="color:#4ade80;">Pemasukan:</span><br><strong>Rp ${totalMasuk.toLocaleString('id-ID')}</strong></div>
          <div style="border-left:1px solid rgba(255,255,255,0.15);"></div>
          <div><span style="color:#f87171;">Pengeluaran:</span><br><strong>Rp ${totalKeluar.toLocaleString('id-ID')}</strong></div>
        </div>
      `;
    } else if (index === 4) {
      // SLIDE 5: Archetype Persona & Flexing Final
      slideContent.innerHTML = `
        <div class="wrapped-glow-orb" style="background:radial-gradient(circle, rgba(236,72,153,0.4), transparent 70%);"></div>
        <div class="wrapped-kicker">ARCHETYPE KAMU TAHUN INI</div>
        <div class="wrapped-persona-card">
          <div class="wrapped-persona-icon">${archetype.icon}</div>
          <h3 class="wrapped-persona-title">${archetype.title}</h3>
          <p class="wrapped-persona-desc">${archetype.desc}</p>
        </div>
        <p style="font-size:12px; color:rgba(255,255,255,0.7); margin-top:10px;">
          Terima kasih sudah melangkah sejauh ini bersama Piskaly. Siap untuk level berikutnya? 🚀
        </p>
      `;
    }
  }

})();
