/* ═══════════════════════════════════════════════
   layout.js — shared HTML shell builder
   ═══════════════════════════════════════════════ */

function buildShell(pageKey, pageTitle, pageContent) {
  const navItems = [
    { key:'dashboard', icon:'📊', label:'Tổng quan',        href:'index.html',      badgeId:'sbg-da' },
    { key:'thu-thang', icon:'💰', label:'Thu hàng tháng',   href:'thu-thang.html',  badgeId:'sbg-tt' },
    { key:'thu-phat',  icon:'🟥', label:'Thu phạt đội thua',href:'thu-phat.html',   badgeId:'sbg-tp' },
    { key:'chi-tieu',  icon:'📋', label:'Chi tiêu',         href:'chi-tieu.html',   badgeId:'sbg-ct' },
    { key:'thanh-vien',icon:'👥', label:'Thành viên',       href:'thanh-vien.html', badgeId:'sbg-tv' },
  ];
  const navHTML = navItems.map(item => `
    <a class="sb-item${item.key===pageKey?' active':''}" href="${item.href}">
      <span class="sb-icon">${item.icon}</span>
      <span class="sb-label">${item.label}</span>
      <span class="sb-badge" id="${item.badgeId}">—</span>
    </a>`).join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pageTitle} — FC 2026</title>
<link rel="stylesheet" href="style.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
</head>
<body>
<div class="sb-overlay" onclick="closeSidebar()"></div>
<div class="layout">

  <!-- SIDEBAR -->
  <aside class="sidebar">
    <div class="sb-brand">
      <div class="sb-logo">⚽</div>
      <div class="sb-brand-text">
        <div class="sb-brand-name">FC Dashboard</div>
        <div class="sb-brand-sub">Quỹ Đội Bóng 2026</div>
      </div>
    </div>
    <nav class="sb-nav">
      <div class="sb-section-label">Menu</div>
      ${navHTML}
    </nav>
    <div class="sb-footer">
      <div class="sb-year-box">
        <span class="sb-year-label">Năm tài chính</span>
        <span class="sb-year-val">2026</span>
      </div>
    </div>
  </aside>

  <!-- CONTENT -->
  <div class="content">
    <!-- TOPBAR -->
    <div class="topbar">
      <button class="tb-menu-btn" onclick="toggleSidebar()">☰</button>
      <span class="tb-title">${pageTitle}</span>
      <div class="tb-chips">
        <span class="chip chip-meta"><span class="chip-dot" style="background:var(--p-600)"></span> <span id="chip-members">25</span> thành viên</span>
        <span class="chip chip-meta">200k/tháng · 50k/thua</span>
        <span class="chip" id="data-badge"></span>
      </div>
      <div class="tb-actions">
        <div id="data-toolbar" style="display:none;gap:8px;align-items:center;display:none">
          <button class="btn btn-po btn-sm" onclick="importJSON()">⬆ Nhập JSON</button>
          <button class="btn btn-p btn-sm" onclick="exportJSON()">⬇ Xuất JSON</button>
          <input type="file" id="import-file" accept=".json" style="display:none" onchange="handleImport(event)">
        </div>
        <button class="btn-login-off" id="btn-login-off" onclick="openLoginModal()">👤 Đăng nhập</button>
        <button class="btn-login-on"  id="btn-login-on"  onclick="logout()" style="display:none">✓ ductm88</button>
      </div>
    </div>

    <!-- PAGE -->
    <div class="page" id="main-page">
      ${pageContent}
    </div>
  </div>
</div>

<!-- LOGIN MODAL -->
<div class="ov" id="ov-login">
  <div class="modal login-modal">
    <button class="modal-close" style="position:absolute;top:16px;right:16px" onclick="closeLoginModal()">×</button>
    <div class="login-icon">⚽</div>
    <div class="login-title">Đăng nhập</div>
    <div class="login-sub">Nhập thông tin để chỉnh sửa dữ liệu</div>
    <div class="login-error" id="login-error">⚠ Sai tên đăng nhập hoặc mật khẩu</div>
    <div class="form-group">
      <label class="form-label">Tên đăng nhập</label>
      <input class="form-control" id="login-user" placeholder="ductm88" autocomplete="username">
    </div>
    <div class="form-group">
      <label class="form-label">Mật khẩu</label>
      <div class="pw-wrap">
        <input class="form-control" id="login-pass" type="password" placeholder="••••••••" autocomplete="current-password">
        <button class="pw-toggle" type="button">👁</button>
      </div>
    </div>
    <div class="remember-row">
      <input type="checkbox" id="login-remember">
      <label for="login-remember">Lưu trạng thái đăng nhập</label>
    </div>
    <button class="btn btn-p btn-full" style="height:40px" onclick="submitLogin()">Đăng nhập</button>
  </div>
</div>

<div id="toast"></div>
<script src="app.js"></script>`;
}
