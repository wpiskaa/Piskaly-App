// ===========================
// KALKULATOR.JS - ALAT HITUNG KEUANGAN
// ===========================

let simMode = 'duration';

// ---- Simulasi menabung ----
function runSavingsSim() {
  const target = parseRupiahInput(document.getElementById('simTarget').value);
  const saved = parseRupiahInput(document.getElementById('simSaved').value);
  const out = document.getElementById('simResult');
  const need = target - saved;

  if (target <= 0) { showToast('Isi target dana dulu!', 'error'); return; }
  if (need <= 0) {
    out.innerHTML = '<div class="calc-res-big">🎉 Target sudah tercapai!</div>';
    out.classList.remove('hidden');
    return;
  }

  if (simMode === 'duration') {
    const months = parseFloat(document.getElementById('simMonths').value);
    if (!months || months <= 0) { showToast('Isi jangka waktu (bulan)!', 'error'); return; }
    const end = new Date(); end.setMonth(end.getMonth() + Math.round(months));
    out.innerHTML = `
      <div class="calc-res-label">Kekurangan dana</div>
      <div class="calc-res-big">${finRp(need)}</div>
      <div class="calc-res-grid">
        <div><span>Per Bulan</span><b>${finRp(need / months)}</b></div>
        <div><span>Per Minggu</span><b>${finRp(need / (months * 4.345))}</b></div>
        <div><span>Per Hari</span><b>${finRp(need / (months * 30.44))}</b></div>
      </div>
      <p class="calc-res-note">Tercapai sekitar ${formatDate(end.toISOString())}</p>`;
  } else {
    const rate = parseRupiahInput(document.getElementById('simRate').value);
    if (!rate || rate <= 0) { showToast('Isi nominal nabung!', 'error'); return; }
    const period = document.getElementById('simRatePeriod').value;
    const daysPer = period === 'day' ? 1 : period === 'week' ? 7 : 30.44;
    const unit = period === 'day' ? 'hari' : period === 'week' ? 'minggu' : 'bulan';
    const times = Math.ceil(need / rate);
    const totalDays = Math.ceil(times * daysPer);
    const end = new Date(); end.setDate(end.getDate() + totalDays);
    const m = Math.floor(totalDays / 30.44);
    const d = Math.round(totalDays - m * 30.44);
    out.innerHTML = `
      <div class="calc-res-label">Kamu butuh menabung</div>
      <div class="calc-res-big">${times} ${unit}</div>
      <div class="calc-res-grid two">
        <div><span>Kurang</span><b>${finRp(need)}</b></div>
        <div><span>Lama</span><b>${m > 0 ? m + ' bln ' : ''}${d} hr</b></div>
      </div>
      <p class="calc-res-note">Tercapai sekitar ${formatDate(end.toISOString())}</p>`;
  }
  out.classList.remove('hidden');
}

// ---- Split bill ----
function runSplitBill() {
  const total = parseRupiahInput(document.getElementById('splitTotal').value);
  const people = Math.max(1, parseInt(document.getElementById('splitPeople').value) || 1);
  const tax = parseFloat(document.getElementById('splitTax').value) || 0;
  const out = document.getElementById('splitResult');
  if (total <= 0) { showToast('Isi total tagihan!', 'error'); return; }

  const taxAmt = total * tax / 100;
  const grand = total + taxAmt;
  out.innerHTML = `
    <div class="calc-res-label">Per orang bayar</div>
    <div class="calc-res-big">${finRp(Math.ceil(grand / people))}</div>
    <div class="calc-res-grid two">
      <div><span>Pajak/Service</span><b>${finRp(taxAmt)}</b></div>
      <div><span>Total Akhir</span><b>${finRp(grand)}</b></div>
    </div>`;
  out.classList.remove('hidden');
}

// ---- Kalkulator cepat ----
const QC_KEYS = ['C', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '000', '.', '='];
const QC_OPS = { '÷': '/', '×': '*', '−': '-', '+': '+' };
let qcExpr = '';
let qcDone = false;

function qcEvaluate(expr) {
  const cleaned = expr.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
  if (!cleaned || !/^[0-9+\-*/().\s]+$/.test(cleaned)) return null;
  try {
    const v = Function('"use strict"; return (' + cleaned + ')')();
    return Number.isFinite(v) ? Math.round(v * 1e8) / 1e8 : null;
  } catch { return null; }
}

function qcFormat(expr) {
  return expr.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
}

function qcPress(key) {
  const exprEl = document.getElementById('qcExpr');
  const dispEl = document.getElementById('qcDisplay');

  if (key === 'C') { qcExpr = ''; qcDone = false; }
  else if (key === '⌫') { qcExpr = qcExpr.slice(0, -1); qcDone = false; }
  else if (key === '=') {
    const r = qcEvaluate(qcExpr);
    if (r === null) { showToast('Perhitungan tidak valid', 'error'); return; }
    exprEl.textContent = qcFormat(qcExpr) + ' =';
    qcExpr = String(r);
    qcDone = true;
    dispEl.textContent = r.toLocaleString('id-ID', { maximumFractionDigits: 8 });
    return;
  } else if (QC_OPS[key]) {
    if (!qcExpr && key !== '−') return;
    // ganti operator terakhir jika user menekan dua operator berturut-turut
    if (/[+\-*/]$/.test(qcExpr)) qcExpr = qcExpr.slice(0, -1);
    qcExpr += QC_OPS[key];
    qcDone = false;
  } else {
    // angka, titik, persen
    if (qcDone && key !== '%') { qcExpr = ''; }
    qcDone = false;
    qcExpr += key;
  }

  exprEl.innerHTML = qcExpr ? qcFormat(qcExpr) : '&nbsp;';
  const live = qcEvaluate(qcExpr);
  dispEl.textContent = live !== null && /[+\-*/%]/.test(qcExpr)
    ? live.toLocaleString('id-ID', { maximumFractionDigits: 8 })
    : (qcExpr ? qcFormat(qcExpr.split(/[+\-*/]/).pop() || qcExpr) : '0');
}

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('qcGrid');
  if (grid) {
    grid.innerHTML = QC_KEYS.map(k => {
      const cls = k === '=' ? 'eq' : (QC_OPS[k] ? 'op' : (k === 'C' || k === '⌫' || k === '%') ? 'fn' : '');
      return `<button type="button" class="qc-key ${cls}" data-key="${k}">${k}</button>`;
    }).join('');
    grid.querySelectorAll('.qc-key').forEach(b => b.addEventListener('click', () => qcPress(b.dataset.key)));
  }

  document.querySelectorAll('.calc-seg-btn').forEach(b => {
    b.addEventListener('click', () => {
      simMode = b.dataset.simmode;
      document.querySelectorAll('.calc-seg-btn').forEach(x => x.classList.toggle('active', x === b));
      document.getElementById('simDurationWrap').classList.toggle('hidden', simMode !== 'duration');
      document.getElementById('simRateWrap').classList.toggle('hidden', simMode !== 'rate');
      document.getElementById('simResult').classList.add('hidden');
    });
  });

  ['simTarget', 'simSaved', 'simRate', 'splitTotal'].forEach(id => {
    const el = document.getElementById(id);
    if (el && typeof attachRupiahFormatter === 'function') attachRupiahFormatter(el);
  });
});
