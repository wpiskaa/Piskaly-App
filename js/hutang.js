// ===========================
// HUTANG.JS - HUTANG & PIUTANG
// ===========================

let debtFilter = 'all';
let editingDebtType = 'hutang';
let payingDebtId = null;

function debtPaid(d) { return (d.payments || []).reduce((s, p) => s + p.jumlah, 0); }
function debtRemaining(d) { return Math.max(d.jumlah - debtPaid(d), 0); }

function renderDebts() {
  const list = document.getElementById('debtList');
  if (!list) return;
  const debts = Store.getDebts();

  const owe = debts.filter(d => d.tipe === 'hutang').reduce((s, d) => s + debtRemaining(d), 0);
  const lent = debts.filter(d => d.tipe === 'piutang').reduce((s, d) => s + debtRemaining(d), 0);
  document.getElementById('debtStatOwe').textContent = formatRupiahFull(owe);
  document.getElementById('debtStatLent').textContent = formatRupiahFull(lent);

  let items = debts.filter(d => debtFilter === 'all' || d.tipe === debtFilter);
  items = items.slice().sort((a, b) => {
    const ad = debtRemaining(a) <= 0, bd = debtRemaining(b) <= 0;
    if (ad !== bd) return ad ? 1 : -1;
    return (a.jatuhTempo || '9999').localeCompare(b.jatuhTempo || '9999');
  });

  if (!items.length) {
    list.innerHTML = `
      <div class="fin-empty">
        <div class="fin-empty-icon">🤝</div>
        <h4>Tidak ada catatan</h4>
        <p>Catat hutang atau uang yang kamu pinjamkan supaya tidak lupa menagih maupun membayar.</p>
        <button class="btn-primary" onclick="openDebtModal()">Catat Sekarang</button>
      </div>`;
    return;
  }

  list.innerHTML = items.map(d => {
    const paid = debtPaid(d);
    const sisa = debtRemaining(d);
    const lunas = sisa <= 0;
    const pct = d.jumlah > 0 ? Math.min(100, (paid / d.jumlah) * 100) : 0;
    const isOwe = d.tipe === 'hutang';
    const days = d.jatuhTempo ? finDaysUntil(d.jatuhTempo) : null;

    let dueBadge = '';
    if (lunas) dueBadge = '<span class="debt-due ok">Lunas ✓</span>';
    else if (days !== null) {
      const label = days < 0 ? `Terlambat ${-days} hari` : days === 0 ? 'Jatuh tempo hari ini' : `H-${days}`;
      const cls = days < 0 ? 'late' : days <= 3 ? 'soon' : 'ok';
      dueBadge = `<span class="debt-due ${cls}">${label}</span>`;
    }

    return `
      <div class="debt-card ${lunas ? 'paid' : ''}">
        <div class="debt-top">
          <div class="debt-avatar ${d.tipe}">${finEsc((d.nama || '?').charAt(0).toUpperCase())}</div>
          <div class="debt-info">
            <div class="debt-name">${finEsc(d.nama)} ${dueBadge}</div>
            <div class="debt-sub">${isOwe ? 'Saya berhutang' : 'Dia berhutang ke saya'}${d.catatan ? ' • ' + finEsc(d.catatan) : ''}</div>
          </div>
          <div class="debt-amount ${d.tipe}">${finRp(lunas ? d.jumlah : sisa)}</div>
        </div>
        <div class="debt-bar"><div class="debt-bar-fill ${d.tipe}" style="width:${pct.toFixed(1)}%"></div></div>
        <div class="debt-bottom">
          <span class="debt-progress-text">${finRp(paid)} dari ${finRp(d.jumlah)} ${isOwe ? 'dibayar' : 'diterima'}</span>
          <span class="debt-actions">
            ${lunas ? '' : `<button class="debt-btn" onclick="openDebtPay('${d.id}')">${isOwe ? 'Bayar' : 'Terima'}</button>`}
            <button class="debt-btn danger icon" onclick="deleteDebt('${d.id}')" aria-label="Hapus"><i data-lucide="trash-2"></i></button>
          </span>
        </div>
      </div>`;
  }).join('');
  lucide.createIcons({ nodes: [list] });
}

function setDebtType(type) {
  editingDebtType = type;
  document.querySelectorAll('.debt-type-btn').forEach(b => b.classList.toggle('active', b.dataset.debttype === type));
  document.getElementById('debtNamaLabel').textContent =
    type === 'hutang' ? 'Berhutang ke siapa? *' : 'Siapa yang meminjam? *';
  document.getElementById('modalDebtTitle').textContent = type === 'hutang' ? 'Catat Hutang' : 'Catat Piutang';
}

function openDebtModal() {
  document.getElementById('debtNama').value = '';
  document.getElementById('debtJumlah').value = '';
  document.getElementById('debtJatuhTempo').value = '';
  document.getElementById('debtCatatan').value = '';
  setDebtType(debtFilter === 'piutang' ? 'piutang' : 'hutang');
  openModal('modalDebt');
}

function saveDebt() {
  const nama = document.getElementById('debtNama').value.trim();
  const jumlah = parseRupiahInput(document.getElementById('debtJumlah').value);
  if (!nama) { showToast('Nama tidak boleh kosong!', 'error'); return; }
  if (!jumlah || jumlah <= 0) { showToast('Jumlah tidak valid!', 'error'); return; }

  const debts = Store.getDebts();
  debts.push({
    id: uid(),
    tipe: editingDebtType,
    nama,
    jumlah,
    jatuhTempo: document.getElementById('debtJatuhTempo').value,
    catatan: document.getElementById('debtCatatan').value.trim(),
    payments: [],
    createdAt: new Date().toISOString()
  });
  Store.setDebts(debts);
  closeModal('modalDebt');
  showToast('🤝 Catatan tersimpan!', 'success');
  renderKeuangan();
}

function openDebtPay(id) {
  const d = Store.getDebts().find(x => x.id === id);
  if (!d) return;
  payingDebtId = id;
  const isOwe = d.tipe === 'hutang';
  document.getElementById('modalDebtPayTitle').textContent = isOwe ? 'Bayar Hutang' : 'Terima Pembayaran';
  document.getElementById('debtPayInfo').innerHTML =
    `<b>${finEsc(d.nama)}</b><span>Sisa ${finRp(debtRemaining(d))} dari ${finRp(d.jumlah)}</span>`;
  document.getElementById('debtPayJumlah').value = formatRupiahDisplay(debtRemaining(d));
  document.getElementById('debtPayRecord').checked = true;
  openModal('modalDebtPay');
}

function saveDebtPay() {
  const jumlah = parseRupiahInput(document.getElementById('debtPayJumlah').value);
  const debts = Store.getDebts();
  const d = debts.find(x => x.id === payingDebtId);
  if (!d) return;
  if (!jumlah || jumlah <= 0) { showToast('Jumlah tidak valid!', 'error'); return; }
  if (jumlah > debtRemaining(d)) { showToast('Melebihi sisa tagihan!', 'error'); return; }

  d.payments = d.payments || [];
  d.payments.push({ id: uid(), jumlah, tanggal: finToday() });
  Store.setDebts(debts);

  if (document.getElementById('debtPayRecord').checked) {
    const isOwe = d.tipe === 'hutang';
    const trans = Store.getTransaksi();
    trans.push({
      id: uid(),
      type: isOwe ? 'expense' : 'income',
      jumlah,
      keterangan: isOwe ? `Bayar hutang ke ${d.nama}` : `Terima piutang dari ${d.nama}`,
      kategori: 'Lainnya',
      tanggal: finToday(),
      createdAt: new Date().toISOString()
    });
    Store.setTransaksi(trans);
  }

  closeModal('modalDebtPay');
  showToast(debtRemaining(d) <= 0 ? '🎉 Lunas!' : '✅ Pembayaran dicatat', 'success');
  renderKeuangan();
}

function deleteDebt(id) {
  if (!confirm('Hapus catatan ini?')) return;
  Store.setDebts(Store.getDebts().filter(d => d.id !== id));
  showToast('🗑️ Catatan dihapus', 'info');
  renderKeuangan();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('saveDebtBtn').addEventListener('click', saveDebt);
  document.getElementById('saveDebtPayBtn').addEventListener('click', saveDebtPay);
  document.querySelectorAll('.debt-type-btn').forEach(b => {
    b.addEventListener('click', () => setDebtType(b.dataset.debttype));
  });
  document.querySelectorAll('.debt-tab').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.debt-tab').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      debtFilter = b.dataset.debtfilter;
      renderDebts();
    });
  });

  attachRupiahFormatter(document.getElementById('debtJumlah'));
  attachRupiahFormatter(document.getElementById('debtPayJumlah'));

  const fullBtn = document.getElementById('debtPayFullBtn');
  if (fullBtn) {
    fullBtn.addEventListener('click', () => {
      if (payingDebtId) {
        const d = Store.getDebts().find(x => x.id === payingDebtId);
        if (d) {
          const input = document.getElementById('debtPayJumlah');
          input.value = formatRupiahDisplay(debtRemaining(d));
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    });
  }
});
