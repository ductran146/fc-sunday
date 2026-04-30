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
  const mem = S.members.find(m => m.id === mid);
  if (!mem || mem.status !== 'active') return 0; // tạm nghỉ/đã nghỉ → 0
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

/* ─── DATA HELPERS (year-aware) ──────────────── */
function activeMembers()    { return S.members.filter(m => m.status === 'active'); }
function N()                { return activeMembers().length; }

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
    const y = m.date ? parseInt(m.date.split('-')[0]) : BASE_YEAR;
    return y === year;
  });
}
function matchesInYear(year) {
  year = year || _year;
  return (S.matches||[]).filter(m => {
    const y = m.date ? parseInt(m.date.split('-')[0]) : BASE_YEAR;
    return y === year;
  });
}
function thuPhatMonth(mi, year) {
  return matchesInMonth(mi, year||_year).reduce((s,m)=>s+(m.losers||[]).length*FINE,0);
}
function thuPhatGrand(year) {
  year = year || _year; let t=0;
  for(let i=0;i<12;i++) t+=thuPhatMonth(i,year); return t;
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
  const mem = S.members.find(m => m.id === mid);
  // Tạm nghỉ / đã nghỉ → không nợ quỹ tháng
  if (!mem || mem.status !== 'active') return 0;
  // Số tháng bắt buộc = min(monthsRequired, 12) - số tháng miễn
  const req    = monthsRequired(year);                  // tháng tính đến hiện tại (1→12)
  const exempt = memberExemptCount(mid, year);           // số ô = 2
  const must   = Math.max(0, Math.min(req, 12) - exempt); // bắt buộc thực tế
  const paid   = memberPaidCount(mid, year);             // số ô = 1
  return Math.max(0, must - paid) * FEE;
}
function memberDebtFine(mid) {
  return memberUnpaid(mid) * FINE;
}
function memberTotalDebt(mid, year) {
  return memberDebtFee(mid, year||_year) + memberDebtFine(mid);
}

/* ─── REFRESH DATA ───────────────────────────── */
async function refreshData() {
  const btn = $el('btn-refresh');
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
  const ok = await fetchRemote();
  if (ok) {
    updateDataBadge();
    updateSidebarBadges();
    if (window.renderAll) renderAll();
    showToast('✅ Đã tải dữ liệu mới nhất', 'green');
  } else {
    showToast('⚠ Không thể tải — dùng dữ liệu cũ', 'default');
  }
  if (btn) { btn.textContent = '🔄'; btn.disabled = false; }
}

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
    // Ưu tiên Raw URL nếu đã cấu hình GitHub (bypass GitHub Pages cache 60s)
    const cfg = getGHConfig();
    let url;
    if (cfg?.owner && cfg?.repo) {
      const branch   = cfg.branch || 'main';
      const filePath = cfg.filePath || 'data.json';
      // Raw URL không cần deploy lại → available ngay sau khi commit
      url = `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${branch}/${filePath}?t=${Date.now()}`;
    } else {
      url = `./data.json?t=${Date.now()}`;
    }
    const r = await fetch(url);
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
  const btnOff  = $el('btn-login-off');
  const btnOn   = $el('btn-login-on');
  const toolbar = $el('data-toolbar');
  const btnSync = $el('btn-gh-sync');
  const btnCfg  = $el('btn-gh-cfg');
  if (btnOff)  btnOff.style.display  = _auth ? 'none' : 'flex';
  if (btnOn)   btnOn.style.display   = _auth ? 'flex' : 'none';
  if (toolbar) toolbar.style.display = _auth ? 'flex' : 'none';
  if (btnSync) btnSync.style.display = _auth ? 'inline-flex' : 'none';
  if (btnCfg)  btnCfg.style.display  = _auth ? 'inline-flex' : 'none';
  // More menu admin items: chỉ hiện khi login
  const show = _auth ? 'flex' : 'none';
  ['mm-import','mm-export','mm-sync','mm-cfg'].forEach(id => {
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

/* ─── GITHUB SYNC ────────────────────────────── */
// Lưu PAT và repo info vào localStorage (chỉ trên máy admin)
function getGHConfig() {
  try { return JSON.parse(localStorage.getItem('fc_gh') || 'null'); } catch(e) { return null; }
}
function saveGHConfig(cfg) { localStorage.setItem('fc_gh', JSON.stringify(cfg)); }

function openGHSetup() {
  if (!_requireAuth()) return;
  const cfg = getGHConfig() || {};
  const html = `
    <div style="font-size:13px;color:var(--gray-600);margin-bottom:16px;line-height:1.6">
      Nhập thông tin GitHub để đồng bộ <code>data.json</code> trực tiếp từ trình duyệt.<br>
      Token lưu trên máy này, không gửi đi nơi nào khác.
    </div>
    <div class="form-group">
      <label class="form-label">GitHub Personal Access Token</label>
      <input class="form-control" id="gh-token" type="password" value="${esc(cfg.token||'')}" placeholder="ghp_xxxx...">
      <div style="font-size:11px;color:var(--gray-400);margin-top:4px">Settings → Developer settings → Personal access tokens → quyền <b>repo</b></div>
    </div>
    <div class="form-row">
      <div class="form-group" style="margin:0">
        <label class="form-label">Owner (tên tài khoản)</label>
        <input class="form-control" id="gh-owner" value="${esc(cfg.owner||'')}" placeholder="ductm88">
      </div>
      <div class="form-group" style="margin:0">
        <label class="form-label">Repository name</label>
        <input class="form-control" id="gh-repo" value="${esc(cfg.repo||'')}" placeholder="fc2026">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Branch</label>
      <input class="form-control" id="gh-branch" value="${esc(cfg.branch||'main')}" placeholder="main">
    </div>
    <div class="form-group">
      <label class="form-label">Đường dẫn file data trong repo</label>
      <input class="form-control" id="gh-filepath" value="${esc(cfg.filePath||'data.json')}" placeholder="data.json hoặc fc2026/data.json">
      <div style="font-size:11px;color:var(--gray-400);margin-top:4px">Nếu file nằm trong thư mục con thì điền VD: <b>fc2026/data.json</b></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-g" onclick="closeOv('ov-gh-setup')">Hủy</button>
      <button class="btn btn-p" onclick="saveGHSetup()">Lưu cấu hình</button>
    </div>`;
  let ov = $el('ov-gh-setup');
  if (!ov) {
    ov = document.createElement('div');
    ov.className = 'ov'; ov.id = 'ov-gh-setup';
    ov.innerHTML = `<div class="modal"><div class="modal-header"><span class="modal-title">⚙ Cấu hình GitHub Sync</span><button class="modal-close" onclick="closeOv('ov-gh-setup')">×</button></div><div id="gh-setup-body"></div></div>`;
    ov.addEventListener('click', e => { if (e.target===ov) closeOv('ov-gh-setup'); });
    document.body.appendChild(ov);
  }
  $el('gh-setup-body').innerHTML = html;
  openOv('ov-gh-setup');
}
function saveGHSetup() {
  const token    = $el('gh-token')?.value?.trim();
  const owner    = $el('gh-owner')?.value?.trim();
  const repo     = $el('gh-repo')?.value?.trim();
  const branch   = $el('gh-branch')?.value?.trim() || 'main';
  const filePath = ($el('gh-filepath')?.value?.trim() || 'data.json').replace(/^\//, '');
  if (!token||!owner||!repo) { showToast('Vui lòng điền đầy đủ thông tin', 'red'); return; }
  saveGHConfig({ token, owner, repo, branch, filePath });
  closeOv('ov-gh-setup');
  showToast('✓ Đã lưu cấu hình GitHub', 'green');
}

async function syncToGitHub() {
  if (!_requireAuth()) return;
  const cfg = getGHConfig();
  if (!cfg?.token) { openGHSetup(); return; }

  const btn = $el('btn-gh-sync');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang đồng bộ...'; }

  try {
    S._meta = { version:'1.0', lastUpdated: new Date().toISOString().split('T')[0], updatedBy:'maylaai' };
    saveS();

    const content  = btoa(unescape(encodeURIComponent(JSON.stringify(S, null, 2))));
    const filePath = cfg.filePath || 'data.json'; // đường dẫn file trong repo
    const apiUrl   = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${filePath}`;
    const headers  = { 'Authorization': `token ${cfg.token}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' };

    // Bước 1: Lấy SHA hiện tại — bắt buộc để GitHub cho phép update
    let sha = '';
    const getRes = await fetch(`${apiUrl}?ref=${cfg.branch}`, { headers });
    if (getRes.ok) {
      const j = await getRes.json();
      sha = j.sha || '';
    } else if (getRes.status === 404) {
      // File chưa tồn tại → tạo mới, không cần SHA
      sha = '';
    } else {
      const e = await getRes.json();
      throw new Error(`Không lấy được SHA: ${e.message || getRes.status}`);
    }

    // Bước 2: PUT file lên GitHub
    const body = {
      message: `Update data.json — ${new Date().toLocaleString('vi-VN')}`,
      content,
      branch: cfg.branch
    };
    if (sha) body.sha = sha; // bắt buộc nếu file đã tồn tại

    const putRes = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) });
    if (!putRes.ok) {
      const err = await putRes.json();
      // Lỗi SHA conflict → thử lấy lại SHA và retry 1 lần
      if (err.message && err.message.includes('does not match')) {
        showToast('⏳ SHA conflict, đang thử lại...', 'default');
        const retryGet = await fetch(`${apiUrl}?ref=${cfg.branch}&t=${Date.now()}`, { headers });
        if (!retryGet.ok) throw new Error('Không lấy được SHA mới nhất');
        const retryJ = await retryGet.json();
        body.sha = retryJ.sha;
        const retryPut = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) });
        if (!retryPut.ok) {
          const retryErr = await retryPut.json();
          throw new Error(retryErr.message || retryPut.status);
        }
      } else {
        throw new Error(err.message || putRes.status);
      }
    }

    _dataSrc = 'remote';
    updateDataBadge();
    showToast('✅ Đã đồng bộ lên GitHub thành công!', 'green');
  } catch(err) {
    showToast('❌ Lỗi: ' + err.message, 'red');
    console.error('[GitHub Sync]', err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '☁ Đồng bộ GitHub'; }
  }
}

/* ─── YEAR SELECTOR UI ───────────────────────── */
function buildYearSelector(containerId, onChangeCallback) {
  const el = $el(containerId);
  if (!el) return;
  const years = availableYears();
  el.innerHTML = years.map(y =>
    `<button class="fbtn${y===_year?' active':''}" onclick="_setYear(${y},'${containerId}','${onChangeCallback}')">${y}</button>`
  ).join('');
}
function _setYear(y, containerId, cb) {
  _year = y;
  // re-highlight active button
  const el = $el(containerId);
  if (el) el.querySelectorAll('.fbtn').forEach(b => {
    b.classList.toggle('active', parseInt(b.textContent)===y);
  });
  // update sidebar year box
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
