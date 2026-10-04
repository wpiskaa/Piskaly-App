// ===========================
// KALENDER.JS - CALENDAR
// ===========================

let calendarDate = new Date();
let selectedCalDate = null;
let selectedEventColor = '#2563eb';
let editingEventId = null;

const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function renderKalender() {
  renderCalendarGrid();
}

function renderCalendarGrid() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const today = new Date();
  const events = Store.getEvents();

  // Month title
  document.getElementById('calMonthTitle').textContent = `${MONTHS_ID[month]} ${year}`;

  // Grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  let html = '';
  let dayCount = 0;
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    let day, cls = 'cal-day', dateStr;
    if (i < firstDay) {
      // Prev month
      day = daysInPrevMonth - firstDay + i + 1;
      cls += ' other-month';
      const d = new Date(year, month - 1, day);
      dateStr = d.toISOString().slice(0, 10);
    } else if (dayCount < daysInMonth) {
      dayCount++;
      day = dayCount;
      dateStr = new Date(year, month, day).toISOString().slice(0, 10);
      if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
        cls += ' today';
        if (!selectedCalDate) selectedCalDate = dateStr;
      }
      if (selectedCalDate === dateStr) cls += ' selected';
    } else {
      day = i - firstDay - daysInMonth + 1;
      cls += ' other-month';
      const d = new Date(year, month + 1, day);
      dateStr = d.toISOString().slice(0, 10);
    }

    // Check events
    const hasEvent = events.some(e => e.tanggal === dateStr);
    if (hasEvent) cls += ' has-event';

    html += `<div class="${cls}" data-date="${dateStr}" onclick="selectCalDay('${dateStr}')">${day}</div>`;
  }

  document.getElementById('calGrid').innerHTML = html;

  // Render selected day events
  if (selectedCalDate) {
    renderSelectedDayEvents(selectedCalDate);
  }
}

function selectCalDay(dateStr) {
  selectedCalDate = dateStr;
  // Update selected state
  document.querySelectorAll('.cal-day').forEach(el => {
    el.classList.toggle('selected', el.dataset.date === dateStr && !el.classList.contains('today'));
  });
  renderSelectedDayEvents(dateStr);
}

function renderSelectedDayEvents(dateStr) {
  const events = Store.getEvents().filter(e => e.tanggal === dateStr);
  const date = new Date(dateStr + 'T12:00:00');
  const dateFormatted = date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('selectedDayTitle').textContent = dateFormatted;

  const container = document.getElementById('selectedDayEvents');
  if (!events.length) {
    container.innerHTML = `<div class="empty-state-small"><i data-lucide="calendar"></i><p>Tidak ada kegiatan</p></div>`;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  events.sort((a, b) => (a.jamMulai || '').localeCompare(b.jamMulai || ''));
  container.innerHTML = events.map(e => `
    <div class="event-card" style="border-left-color:${e.color||'#2563eb'}">
      <div class="event-dot" style="background:${e.color||'#2563eb'}"></div>
      <div class="event-info">
        <div class="event-name">${e.nama}</div>
        <div class="event-meta">
          ${e.jamMulai ? `🕐 ${e.jamMulai}${e.jamSelesai ? ' - ' + e.jamSelesai : ''}` : ''}
          ${e.lokasi ? ` 📍 ${e.lokasi}` : ''}
        </div>
        ${e.deskripsi ? `<div class="event-meta" style="margin-top:4px">${e.deskripsi}</div>` : ''}
      </div>
      <div class="event-actions">
        <button class="action-btn edit" onclick="editEvent('${e.id}')">Edit</button>
        <button class="action-btn delete" onclick="deleteEvent('${e.id}')">Hapus</button>
      </div>
    </div>
  `).join('');
}

function editEvent(id) {
  const e = Store.getEvents().find(e => e.id === id);
  if (!e) return;
  editingEventId = id;
  document.getElementById('modalEventTitle').textContent = 'Edit Event';
  document.getElementById('eventNama').value = e.nama;
  document.getElementById('eventTanggal').value = e.tanggal;
  document.getElementById('eventJamMulai').value = e.jamMulai || '';
  document.getElementById('eventJamSelesai').value = e.jamSelesai || '';
  document.getElementById('eventLokasi').value = e.lokasi || '';
  document.getElementById('eventDeskripsi').value = e.deskripsi || '';
  selectedEventColor = e.color || '#2563eb';
  updateColorPicker('eventColorPicker', selectedEventColor);
  openModal('modalEvent');
}

function deleteEvent(id) {
  if (!confirm('Hapus event ini?')) return;
  Store.setEvents(Store.getEvents().filter(e => e.id !== id));
  renderCalendarGrid();
  if (typeof renderHome === 'function') renderHome();
  showToast('🗑️ Event dihapus', 'error');
}

function saveEvent() {
  const nama = document.getElementById('eventNama').value.trim();
  const tanggal = document.getElementById('eventTanggal').value;
  if (!nama || !tanggal) { showToast('Nama dan tanggal wajib diisi!', 'error'); return; }

  const data = {
    id: editingEventId || uid(),
    nama,
    tanggal,
    jamMulai: document.getElementById('eventJamMulai').value,
    jamSelesai: document.getElementById('eventJamSelesai').value,
    lokasi: document.getElementById('eventLokasi').value.trim(),
    deskripsi: document.getElementById('eventDeskripsi').value.trim(),
    color: selectedEventColor,
    createdAt: editingEventId ? undefined : new Date().toISOString()
  };

  let events = Store.getEvents();
  if (editingEventId) {
    events = events.map(e => e.id === editingEventId ? { ...e, ...data } : e);
  } else {
    events.push(data);
  }
  Store.setEvents(events);

  // Navigate calendar to event month
  const evDate = new Date(tanggal + 'T12:00:00');
  calendarDate = new Date(evDate.getFullYear(), evDate.getMonth(), 1);

  closeModal('modalEvent');
  resetEventForm();
  renderCalendarGrid();
  selectCalDay(tanggal);
  if (typeof renderHome === 'function') renderHome();
  showToast(editingEventId ? '✅ Event diperbarui!' : '✅ Event ditambahkan!', 'success');
  editingEventId = null;
}

function resetEventForm() {
  ['eventNama','eventTanggal','eventJamMulai','eventJamSelesai','eventLokasi','eventDeskripsi'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('modalEventTitle').textContent = 'Tambah Event';
  selectedEventColor = '#2563eb';
  updateColorPicker('eventColorPicker', selectedEventColor);
  editingEventId = null;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('calPrev').addEventListener('click', () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
    renderCalendarGrid();
  });

  document.getElementById('calNext').addEventListener('click', () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
    renderCalendarGrid();
  });

  document.getElementById('addEventBtn').addEventListener('click', () => {
    editingEventId = null;
    resetEventForm();
    if (selectedCalDate) document.getElementById('eventTanggal').value = selectedCalDate;
    openModal('modalEvent');
  });

  document.getElementById('addEventOnDay').addEventListener('click', () => {
    editingEventId = null;
    resetEventForm();
    if (selectedCalDate) document.getElementById('eventTanggal').value = selectedCalDate;
    openModal('modalEvent');
  });

  document.getElementById('saveEventBtn').addEventListener('click', saveEvent);

  document.querySelectorAll('#eventColorPicker .color-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedEventColor = btn.dataset.color;
      updateColorPicker('eventColorPicker', selectedEventColor);
    });
  });
});
