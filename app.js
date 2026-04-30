/* ═══════════════════════════════════════════════
   FC 2026 — app.js  (shared logic, all pages)
   ═══════════════════════════════════════════════ */

/* ─── CONSTANTS ─────────────────────────────── */
const MONTHS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
const MONTH_NAMES = Array.from({length:12},(_,i)=>`Tháng ${i+1}`);
const FEE = 200000;
const FINE = 50000;
const CATS = ['Sân bóng','Thiết bị','Tiệc / Liên hoan','Y tế','Phần thưởng','Khác'];
const CAT_COLORS = {'Sân bóng':'#00a887','Thiết bị':'#0e9fe9','Tiệc / Liên hoan':'#d97706','Y tế':'#dc2626','Phần thưởng':'#0d5447','Khác':'#6b7280'};
const CAT_CHIPS  = {'Sân bóng':'chip-p','Thiết bị':'chip-i','Tiệc / Liên hoan':'chip-w','Y tế':'chip-r','Phần thưởng':'chip-g','Khác':'chip-n'};
const DEFAULT_MEMBERS = [
  'Trường Captain','Đức Trần','Bình Phương','Tặng','Chương Bao',
  'Hiếu Đồng Kỵ','Chiến','Chất','Minh','Quyền','Luân','Hội',
  'Trường Xề','Luân','Hướng 88','Tấn','Hướng - Bạn Phúc','Lý',
  'Duy','Cường Buồn','Long VNPT','Nam','Thái','Phúc','Hoàng'
];

/* ─── STATE ──────────────────────────────────── */
let S = null;
let _auth = false;
let _dataSrc = 'none'; // 'remote' | 'local' | 'none'

function mkInit() {
  return {
    members: DEFAULT_MEMBERS.map((name, i) => ({
      id: i + 1, name, phone: '', status: 'active', note: ''
    })),
    nextMid: 26,
    thuThang: {},
    matches: [],
    nextMaid: 1,
    chiTieu: [],
    nextCid: 1,
    _meta: { version: '1.0', lastUpdated: '', updatedBy: '' }
  };
}

/* ─── HELPERS ────────────────────────────────── */
function fmt(n) {
  if (!n) return '0đ';
  const sign = n < 0 ? '-' : '';
  const abs  = Math.abs(n);
  if (abs >= 1000000) {
    const v = abs / 1000000;
    return sign + (Number.isInteger(v) ? v : v.toFixed(1)).toString().replace('.',',') + ' tr đ';
  }
  if (abs >= 1000) return sign + Math.round(abs/1000) + 'k đ';
  return sign + abs.toLocaleString('vi') + 'đ';
}
function fmtNum(n) {
  // Format số thuần (không convert sang text): dùng cho số dư lớn
  if (!n && n !== 0) return '0';
  const sign = n < 0 ? '-' : '';
  const abs  = Math.abs(n);
  return sign + abs.toLocaleString('vi-VN');
}
function fmtS(n) {
  if (!n) return '0';
  const sign = n < 0 ? '-' : '';
  const abs  = Math.abs(n);
  if (abs >= 1000000) return sign + (abs/1000000).toFixed(1).replace('.0','') + 'tr';
  if (abs >= 1000) return sign + Math.round(abs/1000) + 'k';
  return sign + abs.toString();
}
function fmtDate(s) {
  if (!s) return '';
  const [y,m,d] = s.split('-');
  return `${d}/${m}/${y}`;
}
function $set(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function $el(id) { return document.getElementById(id); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ─── DATA HELPERS ───────────────────────────── */
function activeMembers()    { return S.members.filter(m => m.status === 'active'); }
function N()                { return activeMembers().length; }
function getTT(mid, mi)     { return (S.thuThang[mid] || [])[mi] || 0; }
function setTT(mid, mi, v)  { if (!S.thuThang[mid]) S.thuThang[mid] = Array(12).fill(0); S.thuThang[mid][mi] = v; }
function memberPaidMonths(mid) { return (S.thuThang[mid] || []).reduce((s,v)=>s+v,0); }
function thuThangMonthTotal(mi) { return activeMembers().reduce((s,m)=>s+getTT(m.id,mi),0) * FEE; }
function thuThangGrand()    { let t=0; for(let i=0;i<12;i++) t+=thuThangMonthTotal(i); return t; }
function matchesInMonth(mi) { return S.matches.filter(m=>m.monthIdx===mi); }
function thuPhatMonth(mi)   { return matchesInMonth(mi).reduce((s,m)=>s+(m.losers||[]).length*FINE,0); }
function thuPhatGrand()     { let t=0; for(let i=0;i<12;i++) t+=thuPhatMonth(i); return t; }
// thuThem: thu thêm từ khách mời mỗi trận (cộng vào quỹ)
function thuThemMonth(mi)   { return matchesInMonth(mi).reduce((s,m)=>s+(m.thuThem||0),0); }
function thuThemGrand()     { let t=0; for(let i=0;i<12;i++) t+=thuThemMonth(i); return t; }
// chiTotal: cho phép âm (âm = tiền đầu kỳ / ủng hộ thêm, được cộng vào quỹ)
function chiTotal()         { return S.chiTieu.reduce((s,c)=>s+c.amount,0); }
function chiMonth(mi)       { return S.chiTieu.filter(c=>c.date&&parseInt(c.date.split('-')[1])-1===mi).reduce((s,c)=>s+c.amount,0); }
function totalTon()         { return thuThangGrand()+thuPhatGrand()+thuThemGrand()-chiTotal(); }
function tonLuyKe(i)        { let t=0; for(let j=0;j<=i;j++) t+=thuThangMonthTotal(j)+thuPhatMonth(j)+thuThemMonth(j)-chiMonth(j); return t; }
function memberTotalLoss(mid) { return S.matches.reduce((s,m)=>s+(m.losers||[]).filter(l=>l.memberId===mid).length,0); }
function memberUnpaid(mid)  { return S.matches.reduce((s,m)=>s+(m.losers||[]).filter(l=>l.memberId===mid&&!l.paid).length,0); }

/* ─── PERSISTENCE ────────────────────────────── */
function saveS() {
  localStorage.setItem('fc2026', JSON.stringify(S));
  _dataSrc = 'local';
  updateDataBadge();
}
function loadS() {
  try {
    const raw = localStorage.getItem('fc2026');
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.members) || d.members.length === 0) return false;
    S = d;
    _dataSrc = 'local';
    return true;
  } catch(e) { return false; }
}
async function fetchRemote() {
  try {
    const r = await fetch('./data.json?t=' + Date.now());
    if (!r.ok) return false;
    const d = await r.json();
    if (!d || !Array.isArray(d.members)) return false;
    S = d;
    localStorage.setItem('fc2026', JSON.stringify(S));
    _dataSrc = 'remote';
    return true;
  } catch(e) { return false; }
}

/* ─── AUTH ───────────────────────────────────── */
function checkAuth() {
  _auth = !!(localStorage.getItem('fc_auth') || sessionStorage.getItem('fc_auth'));
  updateAuthUI();
}
function _requireAuth() {
  if (_auth) return true;
  openLoginModal();
  return false;
}
function updateAuthUI() {
  const btnOff = $el('btn-login-off');
  const btnOn  = $el('btn-login-on');
  const toolbar = $el('data-toolbar');
  if (btnOff) btnOff.style.display = _auth ? 'none' : 'flex';
  if (btnOn)  btnOn.style.display  = _auth ? 'flex' : 'none';
  if (toolbar) toolbar.style.display = _auth ? 'flex' : 'none';
}
function updateDataBadge() {
  const bdg = $el('data-badge');
  if (!bdg) return;
  if (_dataSrc === 'remote') {
    bdg.className = 'chip chip-remote';
    bdg.innerHTML = '<span class="chip-dot"></span> Dữ liệu từ GitHub';
  } else {
    bdg.className = 'chip chip-local';
    bdg.innerHTML = '<span class="chip-dot" style="background:#d97706"></span> Chưa đồng bộ GitHub';
  }
}
function logout() {
  localStorage.removeItem('fc_auth');
  sessionStorage.removeItem('fc_auth');
  _auth = false;
  updateAuthUI();
  showToast('Đã đăng xuất', 'default');
}
function openLoginModal() {
  const ov = $el('ov-login');
  if (ov) { ov.classList.add('show'); $el('login-user')?.focus(); }
}
function closeLoginModal() {
  const ov = $el('ov-login');
  if (ov) ov.classList.remove('show');
}
function submitLogin() {
  const u = ($el('login-user')?.value || '').trim().toLowerCase();
  const p = ($el('login-pass')?.value || '').trim();
  const err = $el('login-error');
  if (u === 'ductm88' && p === '66nhantho') {
    const rem = $el('login-remember')?.checked;
    if (rem) localStorage.setItem('fc_auth','1');
    else     sessionStorage.setItem('fc_auth','1');
    _auth = true;
    updateAuthUI();
    closeLoginModal();
    showToast('✓ Đăng nhập thành công!', 'green');
    if (err) err.classList.remove('show');
    if (window._onLoginSuccess) window._onLoginSuccess();
  } else {
    if (err) err.classList.add('show');
    $el('login-pass')?.focus();
  }
}

/* ─── EXPORT / IMPORT ────────────────────────── */
function exportJSON() {
  S._meta = { version:'1.0', lastUpdated: new Date().toISOString().split('T')[0], updatedBy:'ductm88' };
  saveS();
  const blob = new Blob([JSON.stringify(S, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'data.json';
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  showToast('✅ Đã xuất data.json — upload lên GitHub', 'green');
}
function importJSON() {
  const fi = $el('import-file');
  if (fi) { fi.value = ''; fi.click(); }
}
function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const d = JSON.parse(ev.target.result);
      if (!d || !Array.isArray(d.members) || d.members.length === 0) { showToast('❌ File không hợp lệ', 'red'); return; }
      S = d; saveS(); renderAll();
      showToast('✅ Đã nhập ' + file.name, 'green');
    } catch(ex) { showToast('❌ Không đọc được file JSON', 'red'); }
    e.target.value = '';
  };
  reader.readAsText(file);
}

/* ─── TOAST ──────────────────────────────────── */
let _toastTimer;
function showToast(msg, type='default') {
  let toast = $el('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  const colors = { green:'#065f46', red:'#7f1d1d', default:'#1f2937' };
  toast.style.background = colors[type] || colors.default;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>toast.classList.remove('show'), 3000);
}

/* ─── OVERLAY HELPERS ────────────────────────── */
function openOv(id) { const el=$el(id); if(el) el.classList.add('show'); }
function closeOv(id) { const el=$el(id); if(el) el.classList.remove('show'); }

/* ─── SIDEBAR MOBILE ─────────────────────────── */
function toggleSidebar() {
  const sb = document.querySelector('.sidebar');
  const ov = document.querySelector('.sb-overlay');
  if (!sb) return;
  sb.classList.toggle('open');
  if (ov) ov.classList.toggle('show');
}
function closeSidebar() {
  const sb = document.querySelector('.sidebar');
  const ov = document.querySelector('.sb-overlay');
  if (sb) sb.classList.remove('open');
  if (ov) ov.classList.remove('show');
}

/* ─── SIDEBAR BADGES ─────────────────────────── */
function updateSidebarBadges() {
  const thuThangMonths = Array.from({length:12},(_,i)=>thuThangMonthTotal(i)>0?1:0).reduce((a,b)=>a+b,0);
  $set('sbg-tt', thuThangMonths || 0);
  $set('sbg-tp', S.matches.length);
  $set('sbg-ct', S.chiTieu.length);
  $set('sbg-tv', N());
}

/* ─── CHART DEFAULTS ─────────────────────────── */
function chartDefaults() {
  return {
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + fmtS(ctx.raw) } } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11, family: 'Pretendard' } } },
      y: { grid: { color: 'rgba(17,24,39,.05)' }, ticks: { font: { size: 11, family: 'Pretendard' }, callback: v => fmtS(v) } }
    },
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 400 }
  };
}

/* ─── GLOBAL INIT ────────────────────────────── */
async function initApp() {
  const ok = await fetchRemote();
  if (!ok) {
    if (!loadS()) { S = mkInit(); _dataSrc = 'none'; }
  }
  checkAuth();
  updateDataBadge();
  updateSidebarBadges();
  renderAll();
}

/* ─── LOGIN MODAL WIRING (shared) ────────────── */
function wireLoginModal() {
  const ov = $el('ov-login');
  if (!ov) return;
  ov.addEventListener('click', e => { if (e.target === ov) closeLoginModal(); });
  $el('login-user')?.addEventListener('keydown', e => { if (e.key==='Enter') submitLogin(); });
  $el('login-pass')?.addEventListener('keydown', e => { if (e.key==='Enter') submitLogin(); });
  document.addEventListener('keydown', e => { if (e.key==='Escape') closeLoginModal(); });
  const pwToggle = document.querySelector('.pw-toggle');
  if (pwToggle) {
    pwToggle.addEventListener('click', () => {
      const inp = $el('login-pass');
      if (!inp) return;
      inp.type = inp.type === 'password' ? 'text' : 'password';
      pwToggle.textContent = inp.type === 'password' ? '👁' : '🙈';
    });
  }
}
