/**
 * FC Sunday V2 — Components Loader
 * Loads HTML fragment components into [data-component] placeholders.
 * Must be included with defer at end of <body>.
 */

(function () {
  'use strict';

  // ── PWA detection ──────────────────────────────────────────
  const isPWA = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  // ── Component map ─────────────────────────────────────────
  const COMPONENTS_PATH = 'components/';

  // ── Inject HTML into placeholder ──────────────────────────
  async function loadComponent(el) {
    const name = el.getAttribute('data-component');
    if (!name) return;
    try {
      const res = await fetch(`${COMPONENTS_PATH}${name}.html?v=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      el.insertAdjacentHTML('afterend', html);
      el.remove();
    } catch (e) {
      console.warn(`[FC Sunday] Component "${name}" failed to load:`, e.message);
    }
  }

  // ── Update active nav item ─────────────────────────────────
  function updateActiveNav(activeKey) {
    if (!activeKey) return;
    // Sidebar nav
    document.querySelectorAll('.sidebar-nav-item[data-nav]').forEach(item => {
      item.classList.toggle('active', item.dataset.nav === activeKey);
    });
    // Bottom nav
    document.querySelectorAll('.bottom-nav-item[data-nav]').forEach(item => {
      item.classList.toggle('active', item.dataset.nav === activeKey);
    });
  }

  // ── Update topbar title ────────────────────────────────────
  function updateTopbarTitle(title) {
    const el = document.getElementById('topbar-title');
    if (el && title) el.textContent = title;
  }

  // ── Sync badge ─────────────────────────────────────────────
  window.updateSyncBadge = function (status) {
    const badge = document.getElementById('sync-badge');
    const text  = document.getElementById('sync-text');
    if (!badge) return;
    const map = {
      firebase: { cls: 'firebase', icon: 'solar:cloud-check-linear', label: 'Đã đồng bộ' },
      local:    { cls: 'local',    icon: 'solar:cloud-upload-linear', label: 'Cache' },
      offline:  { cls: 'offline',  icon: 'solar:cloud-cross-linear',  label: 'Offline' },
      default:  { cls: '',         icon: 'solar:cloud-linear',         label: 'Mặc định' },
    };
    const s = map[status] || map['default'];
    badge.className = `sync-badge ${s.cls}`;
    badge.querySelector('iconify-icon')?.setAttribute('icon', s.icon);
    if (text) text.textContent = s.label;
  };

  // ── Update nav badges ──────────────────────────────────────
  window.updateNavBadges = function ({ thuThang, thuPhat, chiTieu, thanhVien }) {
    // Sidebar
    setSidebarBadge('badge-thu-thang', thuThang);
    setSidebarBadge('badge-thu-phat',  thuPhat);
    setSidebarBadge('badge-chi-tieu',  chiTieu);
    setSidebarBadge('badge-thanh-vien', thanhVien);
    // Bottom nav
    setBottomBadge('bnav-badge-thu-thang', thuThang);
    setBottomBadge('bnav-badge-thu-phat',  thuPhat);
    setBottomBadge('bnav-badge-chi-tieu',  chiTieu);
    setBottomBadge('bnav-badge-thanh-vien', thanhVien);
  };

  function setSidebarBadge(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val !== undefined ? val : '—';
  }
  function setBottomBadge(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    if (val && val > 0) { el.textContent = val; el.style.display = 'flex'; }
    else { el.style.display = 'none'; }
  }

  // ── Update auth UI ─────────────────────────────────────────
  const AUTH_CACHE_KEY = 'fc_auth_state';

  window.updateAuthUI = function (isLoggedIn) {
    // Lưu trạng thái vào localStorage để dùng lần sau
    try { localStorage.setItem(AUTH_CACHE_KEY, isLoggedIn ? '1' : '0'); } catch(e) {}

    const btnLogin   = document.getElementById('btn-login');
    const btnSetting = document.getElementById('btn-setting');
    const btnAvatar  = document.getElementById('btn-avatar');
    const authEls    = document.querySelectorAll('.auth-only');

    if (btnLogin)   btnLogin.style.display   = isLoggedIn ? 'none' : 'flex';
    if (btnSetting) btnSetting.style.display = 'inline-flex'; // luôn hiện
    if (btnAvatar)  btnAvatar.style.display  = isLoggedIn ? 'inline-flex' : 'none';
    authEls.forEach(el => {
      if (el.id !== 'btn-setting' && el.id !== 'btn-avatar') {
        el.style.display = isLoggedIn ? '' : 'none';
      }
    });
  };

  // Áp dụng trạng thái cached ngay khi components load xong (trước Firebase confirm)
  function applyAuthCache() {
    try {
      const cached = localStorage.getItem(AUTH_CACHE_KEY);
      if (cached !== null) window.updateAuthUI(cached === '1');
    } catch(e) {}
  }

  // ── Install prompt (Android) ───────────────────────────────
  let _deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    if (!isPWA()) {
      const btn = document.getElementById('btn-install-android');
      const sec = document.getElementById('sidebar-install');
      const headerBtn = document.getElementById('btn-pwa-install');
      if (btn) { btn.style.display = 'flex'; }
      if (sec) { sec.style.display = 'block'; }
      if (headerBtn) { headerBtn.style.display = 'inline-flex'; }
    }
  });
  window.addEventListener('appinstalled', () => {
    const headerBtn = document.getElementById('btn-pwa-install');
    if (headerBtn) headerBtn.style.display = 'none';
    _deferredPrompt = null;
  });

  // ── Header PWA button click ────────────────────────────────
  function initPWAHeaderBtn() {
    const btn = document.getElementById('btn-pwa-install');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (_deferredPrompt) {
        _deferredPrompt.prompt();
        const { outcome } = await _deferredPrompt.userChoice;
        if (outcome === 'accepted') btn.style.display = 'none';
        _deferredPrompt = null;
      } else {
        // iOS: show tooltip guide
        _showIOSInstallGuide(btn);
      }
    });
  }
  function _showIOSInstallGuide(anchorBtn) {
    const existing = document.getElementById('_pwa_ios_guide');
    if (existing) { existing.remove(); return; }
    const el = document.createElement('div');
    el.id = '_pwa_ios_guide';
    el.style.cssText = 'position:fixed;top:60px;right:12px;width:min(280px,calc(100vw - 24px));background:var(--bg-elevated);border:1px solid var(--bg-stroke);border-radius:var(--radius-lg);padding:14px 16px;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,.5);font-family:var(--font-sans)';
    el.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><div style="font-size:13px;font-weight:700;color:var(--text-primary)">Cài ứng dụng</div><button id="_pwa_ios_close" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:18px;line-height:1;padding:0">&times;</button></div><div style="font-size:12px;color:var(--text-secondary);line-height:1.7">Bấm <span style="background:var(--bg-stroke);border-radius:4px;padding:1px 5px">&#9650; Chia s&#7867;</span> r&#7891;i ch&#7885;n <strong style="color:var(--text-primary)">Th&#234;m v&#224;o m&#224;n h&#236;nh ch&#237;nh</strong></div><div style="position:absolute;top:-7px;right:18px;width:12px;height:12px;background:var(--bg-elevated);border-left:1px solid var(--bg-stroke);border-top:1px solid var(--bg-stroke);transform:rotate(45deg)"></div>';
    document.body.appendChild(el);
    document.getElementById('_pwa_ios_close').addEventListener('click', () => el.remove());
    setTimeout(() => el?.remove(), 8000);
  }

  // ── iOS install hint ───────────────────────────────────────
  function showIOSHint() {
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isMobile = window.innerWidth < 768;
    if (isIOS && isMobile && !isPWA()) {
      const hint = document.getElementById('ios-install-hint');
      const sec  = document.getElementById('sidebar-install');
      const headerBtn = document.getElementById('btn-pwa-install');
      if (hint) { hint.style.display = 'block'; }
      if (sec)  { sec.style.display = 'block'; }
      if (headerBtn) { headerBtn.style.display = 'inline-flex'; }
    }
  }

  // ── Theme toggle button ──────────────────────────────────────
  function initThemeBtn() {
    const btn = document.getElementById('btn-theme-toggle');
    const icon = document.getElementById('theme-toggle-icon');
    if (!btn) return;

    // Sync icon với theme hiện tại
    function syncIcon() {
      const isDark = !document.documentElement.hasAttribute('data-theme');
      if (icon) icon.setAttribute('icon', isDark ? 'solar:sun-linear' : 'solar:moon-linear');
      btn.title = isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
    }
    syncIcon();

    btn.addEventListener('click', () => {
      window._toggleTheme?.();
      syncIcon();
    });
  }

  // ── Login modal logic ──────────────────────────────────────
  function initLoginModal() {
    const modal     = document.getElementById('login-modal');
    const btnLogin  = document.getElementById('btn-login');
    const btnAvatar = document.getElementById('btn-avatar');
    const btnCancel = document.getElementById('btn-login-cancel');
    const btnSubmit = document.getElementById('btn-login-submit');
    const errBox    = document.getElementById('login-error');
    const errMsg    = document.getElementById('login-error-msg');

    if (!modal) return;

    function openModal() {
      modal.style.display = 'flex';
      document.getElementById('login-email')?.focus();
      if (errBox) errBox.style.display = 'none';
    }
    function closeModal() { modal.style.display = 'none'; }

    btnLogin?.addEventListener('click', openModal);
    btnCancel?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // Avatar → logout
    btnAvatar?.addEventListener('click', async () => {
      const orig = btnAvatar.textContent;
      btnAvatar.textContent = '…';
      btnAvatar.disabled = true;
      try {
        await window._logout?.();
      } finally {
        btnAvatar.textContent = orig;
        btnAvatar.disabled = false;
      }
    });

    btnSubmit?.addEventListener('click', async () => {
      const email = document.getElementById('login-email')?.value?.trim();
      const pass  = document.getElementById('login-password')?.value;
      if (!email || !pass) {
        if (errBox) { errBox.style.display = 'block'; errMsg.textContent = 'Vui lòng nhập đủ thông tin.'; }
        return;
      }
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<iconify-icon icon="solar:spinner-linear" style="font-size:18px"></iconify-icon>Đang xử lý…';
      try {
        await window._login?.(email, pass);
        closeModal();
      } catch (err) {
        if (errBox) { errBox.style.display = 'block'; errMsg.textContent = err.message || 'Email hoặc mật khẩu không đúng.'; }
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<iconify-icon icon="solar:lock-unlocked-linear" style="font-size:18px"></iconify-icon>Đăng nhập';
      }
    });

    document.getElementById('login-password')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btnSubmit?.click();
    });
  }

  // ── Refresh button ─────────────────────────────────────────
  function initRefreshBtn() {
    const btn = document.getElementById('btn-refresh');
    if (!btn) return;
    btn.addEventListener('click', () => {
      btn.querySelector('iconify-icon')?.classList.add('spin');
      window._refreshData?.().finally(() => {
        btn.querySelector('iconify-icon')?.classList.remove('spin');
      });
    });
  }

  // ── Install button ─────────────────────────────────────────
  function initInstallBtn() {
    const btn = document.getElementById('btn-install-android');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (!_deferredPrompt) return;
      _deferredPrompt.prompt();
      const { outcome } = await _deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        btn.style.display = 'none';
      }
      _deferredPrompt = null;
    });
  }

  // ── Sidebar year ────────────────────────────────────────────
  function updateSidebarYear() {
    const el = document.getElementById('sidebar-year');
    if (el) el.textContent = window._currentYear || new Date().getFullYear();
  }

  // ── Main init ──────────────────────────────────────────────
  async function init() {
    // Find all component placeholders
    const placeholders = document.querySelectorAll('[data-component]');
    const activeKey  = placeholders[0]?.closest('[data-active]')?.dataset.active
                    || document.querySelector('[data-active]')?.dataset.active
                    || null;

    // Get active nav key from body data attr
    const bodyActive = document.body.dataset.active || activeKey;

    // Load all components in parallel
    await Promise.all(Array.from(placeholders).map(loadComponent));

    // Hiện app ngay sau khi HTML components đã inject vào DOM
    document.body.classList.add('components-ready');

    // After injection — initialize behaviors
    // Không đổi title header — luôn hiện "FC Sunday"

    updateActiveNav(bodyActive);
    updateSidebarYear();
    applyAuthCache(); // Áp dụng cached auth state ngay — không chờ Firebase
    showIOSHint();
    initPWAHeaderBtn();
    initThemeBtn();
    initLoginModal();
    initInstallBtn();

    // Hide install section in PWA mode
    if (isPWA()) {
      document.querySelectorAll('.install-section').forEach(el => el.style.display = 'none');
    }

    // Notify page that components are ready
    window.onComponentsReady?.();
  }

  // Run on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
