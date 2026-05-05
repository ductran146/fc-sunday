/* ═══════════════════════════════════════════════
   FC 2026 — app.js  (shared logic, all pages)
   ═══════════════════════════════════════════════ */

/* ─── CONSTANTS ─────────────────────────────── */
const MONTHS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
const MONTH_NAMES = Array.from({length:12},(_,i)=>`Tháng ${i+1}`);
const FEE  = 200000;
const FINE = 50000;
const BASE_YEAR = 2026; // năm đầu tiên của hệ thống
const CATS = ['Sân bóng','Thiết bị','Tiệc / Liên hoan','Y tế','Phần thưởng','Khác'];
const CAT_COLORS = {'Sân bóng':'#00a887','Thiết bị':'#0e9fe9','Tiệc / Liên hoan':'#d97706','Y tế':'#dc2626','Phần thưởng':'#0d5447','Khác':'#6b7280'};
const CAT_CHIPS  = {'Sân bóng':'chip-p','Thiết bị':'chip-i','Tiệc / Liên hoan':'chip-w','Y tế':'chip-r','Phần thưởng':'chip-g','Khác':'chip-n'};

/* ─── YEAR FILTER (dùng chung toàn app) ──────── */
let _year = new Date().getFullYear();

/* Trả về danh sách năm có dữ liệu (union matches + thuThang + chiTieu) */
function availableYears() {
  const set = new Set([BASE_YEAR]);
  (S.matches||[]).forEach(m => {
    if (m.date) set.add(parseInt(m.date.split('-')[0]));
  });
  (S.chiTieu||[]).forEach(c => {
    if (c.date) set.add(parseInt(c.date.split('-')[0]));
  });
  // thuThang dùng key theo năm nếu có, còn mặc định là BASE_YEAR
  set.add(new Date().getFullYear());
  return [...set].sort((a,b)=>a-b);
}

/* thuThang key: "mid_year" cho đa năm, fallback sang "mid" cho data cũ (year=BASE_YEAR) */
function _ttKey(mid, year) { return year === BASE_YEAR ? String(mid) : `${mid}_${year}`; }

/*
  Giá trị ô thu tháng:
    0 = Chưa đóng  → tính nợ
    1 = Đã đóng    → không nợ
    2 = Được miễn  → không tính vào nghĩa vụ, không nợ
*/
function getTT(mid, mi, year) {
  year = year || _year;
  const key = _ttKey(mid, year);
  const arr = S.thuThang[key] || (year===BASE_YEAR ? S.thuThang[String(mid)] : null) || [];
  return arr[mi] || 0;
}
function setTT(mid, mi, v, year) {
  year = year || _year;
  const key = _ttKey(mid, year);
  if (!S.thuThang[key]) S.thuThang[key] = Array(12).fill(0);
  S.thuThang[key][mi] = v;
}
// Số tháng đã đóng (giá trị = 1)
function memberPaidCount(mid, year) {
  year = year || _year;
  const key = _ttKey(mid, year);
  const arr = S.thuThang[key] || (year===BASE_YEAR ? S.thuThang[String(mid)] : null) || [];
  return arr.filter(v => v === 1).length;
}
// Số tháng được miễn (giá trị = 2)
function memberExemptCount(mid, year) {
  year = year || _year;
  const key = _ttKey(mid, year);
  const arr = S.thuThang[key] || (year===BASE_YEAR ? S.thuThang[String(mid)] : null) || [];
  return arr.filter(v => v === 2).length;
}
// Số tháng bắt buộc = 12 - số tháng miễn  (chỉ áp dụng cho member active)
function memberRequiredMonths(mid, year) {
  year = year || _year;
  // Trạng thái không ảnh hưởng — chỉ ô miễn (—) mới trừ nghĩa vụ
  return 12 - memberExemptCount(mid, year);
}

/* Số tháng phải đóng tính từ đầu tháng hiện tại (inclusive)
   VD: hôm nay 30/4 → 4 (T1,T2,T3,T4)
       ngày mai  1/5 → 5 (T1,T2,T3,T4,T5) */
function monthsRequired(year) {
  year = year || _year;
  const now = new Date();
  if (year < now.getFullYear()) return 12; // năm qua → đủ 12
  if (year > now.getFullYear()) return 0;  // năm tương lai → chưa đến
  return now.getMonth() + 1; // getMonth() 0-based: tháng 4 → 3, +1 → 4
}

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
  if (!n && n !== 0) return '0đ';
  const sign = n < 0 ? '-' : '';
  const abs  = Math.abs(n);
  // Luôn hiển thị số đầy đủ với dấu chấm phân cách ngàn
  return sign + abs.toLocaleString('vi-VN') + 'đ';
}
function fmtNum(n) {
  if (!n && n !== 0) return '0';
  const sign = n < 0 ? '-' : '';
  const abs  = Math.abs(n);
  return sign + abs.toLocaleString('vi-VN');
}
function fmtS(n) {
  // Chỉ dùng cho chart axis label — giữ rút gọn để không tràn trục
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

/* ─── DATA HELPERS (year-aware) ──────────────── */
// activeMembers: dùng cho tính tổng thu quỹ tháng — bao gồm cả tạm nghỉ
// Chỉ loại trừ "đã nghỉ" (left)
function activeMembers()    { return S.members.filter(m => m.status !== 'left'); }
function N()                { return S.members.filter(m => m.status === 'active').length; } // KPI hiển thị

// Tổng đã đóng thực tế (value=1), dùng tính tiền
function memberPaidMonths(mid, year)    { return memberPaidCount(mid, year||_year); }
// Alias cho display full 12 ô (backward compat)
function memberPaidMonthsAll(mid, year) { return memberPaidCount(mid, year||_year); }

// Thu tháng: chỉ tính ô = 1 (đã đóng), ô = 2 (miễn) không thu tiền
function thuThangMonthTotal(mi, year) {
  year = year || _year;
  return activeMembers().reduce((s,m) => s + (getTT(m.id,mi,year)===1 ? 1 : 0), 0) * FEE;
}
function thuThangGrand(year) {
  year = year || _year;
  let t=0; for(let i=0;i<12;i++) t+=thuThangMonthTotal(i,year); return t;
}

function matchesInMonth(mi, year) {
  year = year || _year;
  return (S.matches||[]).filter(m => {
    if (m.monthIdx !== mi) return false;
    // Nếu không có date → coi là BASE_YEAR (tương thích data cũ)
    if (!m.date) return year === BASE_YEAR;
    const y = parseInt(m.date.split('-')[0]);
    // Nếu năm trong date không hợp lệ → fallback BASE_YEAR
    if (isNaN(y)) return year === BASE_YEAR;
    return y === year;
  });
}
function matchesInYear(year) {
  year = year || _year;
  return (S.matches||[]).filter(m => {
    if (!m.date) return year === BASE_YEAR;
    const y = parseInt(m.date.split('-')[0]);
    if (isNaN(y)) return year === BASE_YEAR;
    return y === year;
  });
}
// Quỹ bia thu thực tế = chỉ tính người đã nộp (paid: true)
function thuPhatMonth(mi, year) {
  return matchesInMonth(mi, year||_year)
    .reduce((s,m) => s + (m.losers||[]).filter(l=>l.paid).length * FINE, 0);
}
function thuPhatGrand(year) {
  year = year || _year; let t=0;
  for(let i=0;i<12;i++) t+=thuPhatMonth(i,year); return t;
}
// Tổng phải thu (cả chưa nộp) — dùng cho báo cáo nợ
function thuPhatTotalMonth(mi, year) {
  return matchesInMonth(mi, year||_year)
    .reduce((s,m) => s + (m.losers||[]).length * FINE, 0);
}
function thuPhatTotalGrand(year) {
  year = year || _year; let t=0;
  for(let i=0;i<12;i++) t+=thuPhatTotalMonth(i,year); return t;
}
function thuThemMonth(mi, year) {
  return matchesInMonth(mi, year||_year).reduce((s,m)=>s+(m.thuThem||0),0);
}
function thuThemGrand(year) {
  year = year || _year; let t=0;
  for(let i=0;i<12;i++) t+=thuThemMonth(i,year); return t;
}

function chiTieuInYear(year) {
  year = year || _year;
  return (S.chiTieu||[]).filter(c => c.date && parseInt(c.date.split('-')[0]) === year);
}
// Tất cả chi (tổng)
function chiTotal(year) {
  return chiTieuInYear(year||_year).reduce((s,c)=>s+c.amount,0);
}
// Chi theo quỹ: 'thang' | 'bia' | undefined (tất cả)
function chiByFund(fund, year) {
  return chiTieuInYear(year||_year)
    .filter(c => fund ? (c.fund||'thang') === fund : true)
    .reduce((s,c)=>s+c.amount,0);
}
function chiMonth(mi, year) {
  year = year || _year;
  return chiTieuInYear(year).filter(c=>parseInt(c.date.split('-')[1])-1===mi).reduce((s,c)=>s+c.amount,0);
}
function chiMonthByFund(mi, fund, year) {
  year = year || _year;
  return chiTieuInYear(year)
    .filter(c => parseInt(c.date.split('-')[1])-1===mi && (c.fund||'thang')===fund)
    .reduce((s,c)=>s+c.amount,0);
}

// Tổng quỹ tháng = Thu phí − Chi quỹ tháng
function tonQuyThang(year) {
  year = year || _year;
  return thuThangGrand(year) - chiByFund('thang', year);
}
// Tổng quỹ bia = Thu quỹ bia + Thu thêm − Chi quỹ bia
function tonQuyBia(year) {
  year = year || _year;
  return thuPhatGrand(year) + thuThemGrand(year) - chiByFund('bia', year);
}
function totalTon(year) {
  year = year || _year;
  return tonQuyThang(year) + tonQuyBia(year);
}
function tonLuyKe(i, year) {
  year = year || _year;
  let t=0;
  for(let j=0;j<=i;j++) {
    t += thuThangMonthTotal(j,year) + thuPhatMonth(j,year) + thuThemMonth(j,year) - chiMonth(j,year);
  }
  return t;
}

/* ─── MEMBER TOTAL ACROSS ALL YEARS ─────────── */
function memberTotalLoss(mid) {
  return (S.matches||[]).reduce((s,m)=>s+(m.losers||[]).filter(l=>l.memberId===mid).length,0);
}
function memberUnpaid(mid) {
  return (S.matches||[]).reduce((s,m)=>s+(m.losers||[]).filter(l=>l.memberId===mid&&!l.paid).length,0);
}

/* ─── MEMBER DEBT ────────────────────────────── */
function memberDebtFee(mid, year) {
  year = year || _year;
  const req    = Math.max(0, Math.min(monthsRequired(year), 12) - memberExemptCount(mid, year));
  const paid   = memberPaidCount(mid, year);
  return Math.max(0, req - paid) * FEE;
}
function memberDebtFine(mid) {
  return memberUnpaid(mid) * FINE;
}
function memberTotalDebt(mid, year) {
  return memberDebtFee(mid, year||_year) + memberDebtFine(mid);
}

/* ─── PWA INSTALL ────────────────────────────── */
let _deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredPrompt = e;
  // Hiện button Android
  const btn = document.getElementById('btn-install-android');
  if (btn) btn.style.display = 'flex';
});

window.addEventListener('appinstalled', () => {
  _deferredPrompt = null;
  const btn = document.getElementById('btn-install-android');
  if (btn) btn.style.display = 'none';
  showToast('✅ Đã thêm FC Sunday vào màn hình chính!', 'green');
});

function pwaInstall() {
  if (_deferredPrompt) {
    _deferredPrompt.prompt();
    _deferredPrompt.userChoice.then(r => {
      _deferredPrompt = null;
    });
    closeSidebar();
  }
}

function pwaIOSGuide() {
  // Modal hướng dẫn iOS
  let ov = document.getElementById('ov-ios-guide');
  if (!ov) {
    ov = document.createElement('div');
    ov.className = 'ov'; ov.id = 'ov-ios-guide';
    ov.innerHTML = `<div class="modal" style="max-width:360px;text-align:center">
      <div style="font-size:32px;margin-bottom:12px"><img src="logo.jpg" style="width:64px;height:64px;border-radius:16px;object-fit:cover"></div>
      <div style="font-size:17px;font-weight:700;margin-bottom:6px">Thêm vào màn hình iPhone</div>
      <div style="font-size:13px;color:var(--gray-500);margin-bottom:20px;line-height:1.6">Làm theo 3 bước đơn giản để cài FC Sunday như app thật</div>
      <div style="text-align:left;display:flex;flex-direction:column;gap:14px;margin-bottom:24px">
        <div style="display:flex;align-items:flex-start;gap:12px">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--p-600);color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">1</div>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--gray-800)">Bấm nút Chia sẻ</div>
            <div style="font-size:12px;color:var(--gray-500);margin-top:2px">Nút <b>⬆</b> ở thanh dưới Safari</div>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--p-600);color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">2</div>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--gray-800)">Chọn "Thêm vào màn hình chính"</div>
            <div style="font-size:12px;color:var(--gray-500);margin-top:2px">Kéo xuống trong menu Share để tìm</div>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--p-600);color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">3</div>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--gray-800)">Bấm "Thêm"</div>
            <div style="font-size:12px;color:var(--gray-500);margin-top:2px">Icon FC Sunday sẽ xuất hiện trên màn hình</div>
          </div>
        </div>
      </div>
      <button class="btn btn-p btn-full" style="height:44px" onclick="closeOv('ov-ios-guide')">Đã hiểu, đóng lại</button>
    </div>`;
    ov.addEventListener('click', e => { if(e.target===ov) closeOv('ov-ios-guide'); });
    document.body.appendChild(ov);
  }
  openOv('ov-ios-guide');
  closeSidebar();
}

function _initPWA() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  // Nếu đã cài rồi (standalone) thì ẩn cả 2 button
  if (isStandalone) return;
  if (isIOS) {
    const btn = document.getElementById('btn-install-ios');
    if (btn) btn.style.display = 'flex';
  }
  // Android button sẽ được hiện bởi beforeinstallprompt event
}

async function refreshData() {
  const btn   = $el('btn-refresh');
  const label = $el('refresh-label');
  if (btn)   btn.disabled = true;
  if (label) label.textContent = 'Đang tải...';
  const ok = await fetchRemote();
  if (ok) {
    updateDataBadge();
    updateSidebarBadges();
    if (window.renderAll) renderAll();
    showToast('✓  Đã cập nhật dữ liệu mới nhất', 'green');
  } else {
    showToast('⚠ Không thể tải — dùng dữ liệu cũ', 'default');
  }
  if (btn)   btn.disabled = false;
  if (label) label.textContent = 'Cập nhật';
}

/* ─── FIREBASE CONFIG ────────────────────────── */
// Kiểm tra URL database tại: Firebase Console → Realtime Database → Data tab
const FB_DB_URL = 'https://fc-sunday-8f932-default-rtdb.asia-southeast1.firebasedatabase.app/.json';

/* ─── PERSISTENCE ────────────────────────────── */
function saveS() {
  S._meta = { version: '1.0', lastUpdated: new Date().toISOString().split('T')[0], updatedBy: 'admin' };
  localStorage.setItem('fc2026', JSON.stringify(S));
  _dataSrc = 'firebase';
  updateDataBadge();
  saveToFirebase().then(ok => {
    if (!ok) showToast('⚠ Lưu local, chưa lên Firebase', 'default');
  });
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
  // 1. Thử Firebase Realtime Database
  const fbOk = await _fetchFirebase();
  if (fbOk) return true;
  // 2. Fallback: đọc data.json tĩnh từ GitHub Pages
  return _fetchStaticJson();
}

async function _fetchFirebase() {
  try {
    const r = await fetch(`${FB_DB_URL}?t=${Date.now()}`);
    if (!r.ok) return false;
    const d = await r.json();
    if (!d || !Array.isArray(d.members)) return false;
    S = d;
    localStorage.setItem('fc2026', JSON.stringify(S));
    _dataSrc = 'firebase';
    return true;
  } catch(e) { return false; }
}

async function _fetchStaticJson() {
  try {
    const r = await fetch(`./data.json?t=${Date.now()}`);
    if (!r.ok) return false;
    const d = await r.json();
    if (!d || !Array.isArray(d.members)) return false;
    S = d;
    localStorage.setItem('fc2026', JSON.stringify(S));
    _dataSrc = 'static';
    return true;
  } catch(e) { return false; }
}

async function saveToFirebase() {
  try {
    const r = await fetch(FB_DB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(S)
    });
    return r.ok;
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
  const btnOff  = $el('btn-login-off');
  const btnOn   = $el('btn-login-on');
  const toolbar = $el('data-toolbar');
  const btnMore = document.querySelector('.tb-more-btn');
  if (btnOff)  btnOff.style.display  = _auth ? 'none' : 'flex';
  if (btnOn)   btnOn.style.display   = _auth ? 'flex' : 'none';
  if (toolbar) toolbar.style.display = _auth ? 'flex' : 'none';
  // Ẩn button ··· khi chưa login — dùng class để thắng CSS media query
  if (btnMore) {
    if (_auth) btnMore.classList.remove('tb-more-hidden');
    else       btnMore.classList.add('tb-more-hidden');
  }
  // More menu admin items
  const show = _auth ? 'flex' : 'none';
  ['mm-import','mm-export'].forEach(id => {
    const el = $el(id);
    if (el) el.style.display = show;
  });
}

/* ─── MORE MENU (mobile) ─────────────────────── */
function toggleMoreMenu() {
  const menu = $el('more-menu');
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  menu.classList.toggle('open');
  if (!isOpen) {
    // Đóng khi tap ra ngoài — dùng touchend + click cho Safari iOS
    setTimeout(() => {
      document.addEventListener('touchend', _closeMoreOutside, { once: true, passive: true });
      document.addEventListener('click',    _closeMoreOutside, { once: true });
    }, 50);
  }
}
function _closeMoreOutside(e) {
  const wrap = document.querySelector('.tb-more-wrap');
  if (wrap && wrap.contains(e.target)) return;
  closeMoreMenu();
}
function closeMoreMenu() {
  const menu = $el('more-menu');
  if (menu) menu.classList.remove('open');
}
function updateDataBadge() {
  const bdg = $el('data-badge');
  if (!bdg) return;
  if (_dataSrc === 'firebase') {
    bdg.className = 'chip chip-remote';
    bdg.innerHTML = '<span class="chip-dot"></span> Đã đồng bộ';
  } else if (_dataSrc === 'static') {
    bdg.className = 'chip chip-local';
    bdg.innerHTML = '<span class="chip-dot" style="background:#d97706"></span> Offline';
  } else if (_dataSrc === 'local') {
    bdg.className = 'chip chip-local';
    bdg.innerHTML = '<span class="chip-dot" style="background:#d97706"></span> Cache';
  } else {
    bdg.className = 'chip chip-local';
    bdg.innerHTML = '<span class="chip-dot" style="background:#6b7280"></span> Mặc định';
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
  if (u === 'taola' && p === 'conboduc') {
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
  S._meta = { version:'1.0', lastUpdated: new Date().toISOString().split('T')[0], updatedBy:'maylaai' };
  saveS();
  const blob = new Blob([JSON.stringify(S, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'data.json';
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  showToast('✅ Đã xuất data.json', 'green');
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

/* ─── YEAR SELECTOR UI ───────────────────────── */
function buildYearSelector(containerId, onChangeCallback) {
  const el = $el(containerId);
  if (!el) return;
  const years = availableYears();
  if (el.tagName === 'SELECT') {
    el.innerHTML = years.map(y => `<option value="${y}"${y===_year?' selected':''}>${y}</option>`).join('');
  } else {
    el.innerHTML = years.map(y =>
      `<button class="fbtn${y===_year?' active':''}" onclick="_setYear(${y},'${containerId}','${onChangeCallback}')">${y}</button>`
    ).join('');
  }
}
function _setYear(y, containerId, cb) {
  _year = y;
  const el = $el(containerId);
  if (el) {
    if (el.tagName === 'SELECT') {
      el.value = String(y);
    } else {
      el.querySelectorAll('.fbtn').forEach(b => {
        b.classList.toggle('active', parseInt(b.textContent)===y);
      });
    }
  }
  document.querySelectorAll('.sb-year-val').forEach(e => e.textContent = _year);
  if (window[cb]) window[cb]();
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
  const thuThangMonths = Array.from({length:12},(_,i)=>thuThangMonthTotal(i,_year)>0?1:0).reduce((a,b)=>a+b,0);
  $set('sbg-tt', thuThangMonths || 0);
  $set('sbg-tp', matchesInYear(_year).length);
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

/* ─── PULL-TO-REFRESH ────────────────────────── */
function _initPullToRefresh() {
  const CIRC = 69.1; // 2π × r=11

  const indicator = document.createElement('div');
  indicator.id = 'ptr-indicator';
  indicator.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;display:flex;align-items:center;justify-content:center;height:0;overflow:hidden;background:var(--p-800,#00332d);border-bottom:1px solid rgba(255,255,255,.1);transition:height .15s ease;';
  indicator.innerHTML = `
    <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
      <div id="ptr-spinner" style="width:28px;height:28px;">
        <svg width="28" height="28" viewBox="0 0 28 28" style="transform:rotate(-90deg)">
          <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="2.5"/>
          <circle id="ptr-arc" cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,.8)"
            stroke-width="2.5" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"
            stroke-linecap="round"/>
        </svg>
      </div>
      <span id="ptr-check" style="position:absolute;inset:0;display:none;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:rgba(255,255,255,.85);">✓</span>
    </div>`;
  document.body.prepend(indicator);

  let startY = 0, pulling = false;
  const THRESHOLD = 75;

  document.addEventListener('touchstart', e => {
    const scrollEl = document.querySelector('.page') || document.scrollingElement;
    if ((scrollEl?.scrollTop ?? window.scrollY) === 0) { startY = e.touches[0].clientY; pulling = true; }
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0) { pulling = false; indicator.style.height = '0'; return; }
    indicator.style.height = Math.min(dy * 0.45, 52) + 'px';
    const pct = Math.min(dy / THRESHOLD, 1);
    const arc = document.getElementById('ptr-arc');
    if (arc) arc.style.strokeDashoffset = CIRC * (1 - pct);
  }, { passive: true });

  document.addEventListener('touchend', async e => {
    if (!pulling) return;
    pulling = false;
    const dy = e.changedTouches[0].clientY - startY;
    if (dy >= THRESHOLD) {
      const spinner = document.getElementById('ptr-spinner');
      const arc = document.getElementById('ptr-arc');
      const check = document.getElementById('ptr-check');
      if (arc) arc.style.strokeDashoffset = CIRC * 0.25; // ~75% arc so gap is visible while spinning
      if (spinner) spinner.classList.add('ptr-spinning');
      await refreshData();
      if (spinner) spinner.classList.remove('ptr-spinning');
      if (spinner) spinner.style.display = 'none';
      if (check) check.style.display = 'flex';
      await new Promise(r => setTimeout(r, 700));
      if (check) check.style.display = 'none';
      if (spinner) { spinner.style.display = ''; }
      if (arc) arc.style.strokeDashoffset = CIRC;
    }
    indicator.style.height = '0';
  }, { passive: true });
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
  _initPWA();
  _initPullToRefresh();
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
