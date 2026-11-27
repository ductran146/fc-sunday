/**
 * FC Sunday V2 — app.js
 * Data layer: Firebase Auth (Email/Password) + Realtime Database
 * localStorage cache key: 'fc2026'
 */

(function () {
  'use strict';

  // ── Firebase Config ────────────────────────────────────────
  // Replace with your actual config from Firebase Console
  const FIREBASE_CONFIG = {
    apiKey:            "AIzaSyBi2JPD56s_vrUkEj-BovpnFWlz9MBNwj8",
    authDomain:        "fc-sunday-8f932.firebaseapp.com",
    databaseURL:       "https://fc-sunday-8f932-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId:         "fc-sunday-8f932",
    storageBucket:     "fc-sunday-8f932.firebasestorage.app",
    messagingSenderId: "801708335980",
    appId:             "1:801708335980:web:7d60e25e440d414c674949",
  };

  const CACHE_KEY = 'fc2026';

  // ── State ─────────────────────────────────────────────────
  let _app, _auth, _db;
  let _S = null;           // current data object
  let _user = null;        // firebase user
  let _dataSrc = 'none';

  // ── Init Firebase ──────────────────────────────────────────
  function initFirebase() {
    if (!window.firebase) return;
    try {
      _app  = firebase.initializeApp(FIREBASE_CONFIG);
      _auth = firebase.auth();
      _db   = firebase.database();
    } catch (e) {
      console.warn('[FC Sunday] Firebase init failed:', e.message);
    }
  }

  // ── Default data structure ─────────────────────────────────
  function mkInit() {
    return {
      _meta:     { version: '2.0', lastUpdated: new Date().toISOString().slice(0,10), updatedBy: '' },
      members:   [],
      nextMid:   1,
      thuThang:  {},
      matches:   [],
      nextMaid:  1,
      chiTieu:   [],
      nextCid:   1,
      settings:  { openingBalances: { thang: 0, bia: 0 } },
    };
  }

  // ── Hiện ngay bản lưu trong máy ────────────────────────────
  // Trang hiện dữ liệu lần trước ngay lập tức, không chờ mạng.
  // Firebase trả về sau sẽ cập nhật lại nếu có thay đổi.
  let _remoteLoaded = false;      // đã đọc xong Firebase lần đầu chưa
  let _cacheWasStale = false;     // bản trong máy khác bản Firebase
  let _remotePromise = null;      // promise của lần đọc Firebase đầu tiên

  function showCached() {
    if (_S) return true;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return false;
      _S = JSON.parse(cached);
      _dataSrc = 'local';
      notifyDataReady();
      updateSyncBadge('local');
      return true;
    } catch (e) {
      return false;
    }
  }

  // ── Load data ──────────────────────────────────────────────
  async function loadData() {
    const shownJSON = _S ? JSON.stringify(_S) : null;

    // 1. Firebase
    if (_db) {
      try {
        const snap = await _db.ref('/').once('value');
        const data = snap.val();
        if (data) {
          const json = JSON.stringify(data);
          _remoteLoaded = true;
          _dataSrc = 'firebase';
          localStorage.setItem(CACHE_KEY, json);
          if (json !== shownJSON) {
            if (shownJSON) _cacheWasStale = true;
            _S = data;
            notifyDataReady();
          }
          updateSyncBadge('firebase');
          return;
        }
      } catch (e) {
        console.warn('[FC Sunday] Firebase read failed:', e.message);
      }
    }

    // 2. data.json tĩnh (bản backup hằng tuần) — chỉ dùng khi
    //    chưa có gì để hiện, hoặc khi nó mới hơn bản trong máy
    try {
      const res = await fetch(`./data.json?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const shownDate = _S?._meta?.lastUpdated || '';
        const staticDate = data?._meta?.lastUpdated || '';
        if (!_S || staticDate > shownDate) {
          _S = data;
          _dataSrc = 'static';
          localStorage.setItem(CACHE_KEY, JSON.stringify(_S));
          notifyDataReady();
        }
        updateSyncBadge('offline');
        return;
      }
    } catch (e) {
      // ignore
    }

    // 3. Đang hiện bản trong máy thì giữ nguyên
    if (_S) {
      updateSyncBadge('local');
      return;
    }

    // 4. Default empty
    _S = mkInit();
    _dataSrc = 'none';
    notifyDataReady();
    updateSyncBadge('local');
  }

  // ── Save data ──────────────────────────────────────────────
  async function saveData(S) {
    // Trang đang cho sửa theo trạng thái đăng nhập lưu trong máy: chờ Firebase
    // xác nhận rồi mới ghi. Phiên đã hết thì không ghi, tải lại dữ liệu thật.
    if (!_authResolved) {
      await Promise.race([_authPromise, new Promise(r => setTimeout(r, 10000))]);
    }
    if (!_user) {
      alert('Phiên đăng nhập đã hết hạn nên thay đổi chưa được lưu. Vui lòng đăng nhập lại.');
      refreshData();
      return;
    }

    // Chặn ghi đè: nếu người dùng sửa trên bản trong máy trước khi
    // Firebase kịp trả về, mà bản Firebase lại mới hơn, thì không ghi
    // (ghi sẽ xoá thay đổi của người khác). Trang đã được vẽ lại bằng
    // dữ liệu mới, người dùng thao tác lại.
    if (_db && _user && !_remoteLoaded && _remotePromise) {
      await Promise.race([_remotePromise, new Promise(r => setTimeout(r, 8000))]);
      if (_cacheWasStale) {
        _cacheWasStale = false;
        alert('Dữ liệu vừa được cập nhật từ máy chủ nên thay đổi của bạn chưa được lưu. Vui lòng thao tác lại.');
        return;
      }
    }

    // Firebase trả thuThang dạng mảng (vị trí = mã thành viên). Dữ liệu các năm sau lưu
    // bằng khoá chữ "id_năm" — gắn vào mảng thì JSON/Firebase bỏ mất khi lưu.
    // Có khoá chữ thì chuyển sang object (giữ nguyên mọi khoá) trước khi lưu.
    window._fcFinance?.normalizeThuThang(S);
    if (!S._meta) S._meta = {};
    S._meta.lastUpdated = new Date().toISOString().slice(0,10);
    S._meta.updatedBy   = _user?.email || 'admin';
    _S = S;

    // Save to localStorage immediately
    localStorage.setItem(CACHE_KEY, JSON.stringify(_S));
    updateSyncBadge('local');

    // Save to Firebase
    if (_db && _user) {
      try {
        await _db.ref('/').set(_S);
        updateSyncBadge('firebase');
      } catch (e) {
        console.warn('[FC Sunday] Firebase write failed:', e.message);
        updateSyncBadge('local');
      }
    }
  }

  // ── Auth ───────────────────────────────────────────────────
  async function login(email, password) {
    // Chờ Firebase sẵn sàng tối đa 3 giây
    if (!_auth) {
      await new Promise((resolve, reject) => {
        let waited = 0;
        const t = setInterval(() => {
          waited += 100;
          if (_auth) { clearInterval(t); resolve(); }
          else if (waited >= 3000) { clearInterval(t); reject(new Error('Không kết nối được Firebase. Vui lòng thử lại.')); }
        }, 100);
      });
    }
    await _auth.signInWithEmailAndPassword(email, password);
  }

  async function logout() {
    try { localStorage.setItem('fc_auth_state', '0'); } catch(e) {}
    if (_auth) await _auth.signOut();
  }

  // Firebase cần 1–5 giây (gọi máy chủ Google kiểm tra lại phiên) mới báo
  // trạng thái đăng nhập. Trong lúc chờ, dùng trạng thái lần trước lưu trong
  // máy để trang hiện ngay; saveData sẽ chờ xác nhận thật trước khi ghi.
  let _authResolved = false;
  let _resolveAuth;
  const _authPromise = new Promise(r => { _resolveAuth = r; });

  function isLoggedIn() {
    if (_authResolved) return !!_user;
    try { return localStorage.getItem('fc_auth_state') === '1'; } catch (e) { return false; }
  }

  // ── Notify page ────────────────────────────────────────────
  function notifyDataReady() {
    if (_S && window._onDataReady) window._onDataReady(_S);
  }

  function notifyAuthChange() {
    if (window._onAuthChange) window._onAuthChange(_user);
  }

  function updateSyncBadge(status) {
    window.updateSyncBadge?.(status);
  }

  // ── Refresh ────────────────────────────────────────────────
  async function refreshData() {
    return loadData();
  }

  // ── Expose to window sớm (trước khi Firebase boot) ────────
  window._login     = login;
  window._logout    = logout;
  window._isLoggedIn = isLoggedIn;
  window._getS      = () => _S;
  window._saveS     = saveData;
  window._refreshData = refreshData;
  window._currentYear = new Date().getFullYear();

  // ── Bootstrap ──────────────────────────────────────────────
  function boot() {
    initFirebase();

    // Listen for auth state
    if (_auth) {
      _auth.onAuthStateChanged((user) => {
        _user = user;
        _authResolved = true;
        _resolveAuth();
        window.updateAuthUI?.(!!user);
        notifyAuthChange();
      });
    } else {
      // Không khởi tạo được Firebase → coi như chưa đăng nhập
      _authResolved = true;
      _resolveAuth();
      notifyAuthChange();
    }

    // Load data
    _remotePromise = loadData();
  }

  // ── Tải Firebase SDK sau khi trang đã hiện ─────────────────
  // SDK nặng (~300KB). Trước đây nạp bằng <script defer> trong <head> nên trang phải
  // chờ tải + chạy xong SDK mới vẽ được. Giờ vẽ bản cache trước, SDK nạp song song.
  const FIREBASE_SDK = ['app', 'auth', 'database'].map(n => `https://www.gstatic.com/firebasejs/10.12.0/firebase-${n}-compat.js`);
  function loadFirebaseSdk() {
    if (window.firebase?.database) return Promise.resolve();
    return Promise.all(FIREBASE_SDK.map(src => new Promise(resolve => {
      const el = document.createElement('script');
      el.src = src; el.async = false;           // giữ đúng thứ tự app → auth → database
      el.onload = el.onerror = resolve;
      document.head.appendChild(el);
    })));
  }

  // Gọi ở cuối app.js, sau khi mọi phần dùng chung (_fcFinance…) đã khai báo,
  // để lần vẽ đầu từ cache không bị lỗi ngầm.
  window.__fcStart = function () {
    delete window.__fcStart;
    showCached();                 // hiện bản lưu trong máy ngay
    loadFirebaseSdk().then(boot); // rồi mới kết nối Firebase
  };

})();

// ── Money Input Helper ─────────────────────────────────────
// Dùng chung cho tất cả input số tiền trong dự án
(function() {
  'use strict';

  function formatMoney(raw) {
    // Bỏ mọi ký tự không phải số và dấu trừ đầu
    const isNeg = raw.startsWith('-');
    const digits = raw.replace(/[^\d]/g, '');
    if (!digits) return isNeg ? '-' : '';
    // Format với dấu chấm mỗi 3 chữ số
    const formatted = parseInt(digits, 10).toLocaleString('vi-VN');
    return (isNeg ? '-' : '') + formatted;
  }

  function parseMoney(formatted) {
    if (!formatted) return NaN;
    // Bỏ dấu chấm, giữ dấu trừ
    return parseFloat(formatted.replace(/\./g, '').replace(/,/g, '')) || 0;
  }

  function attachMoneyInput(el) {
    if (!el || el.dataset.moneyInput) return;
    el.dataset.moneyInput = '1';
    el.addEventListener('input', function() {
      const pos = this.selectionStart;
      const oldLen = this.value.length;
      this.value = formatMoney(this.value);
      // Giữ cursor position
      const diff = this.value.length - oldLen;
      this.setSelectionRange(pos + diff, pos + diff);
    });
    el.addEventListener('blur', function() {
      this.value = formatMoney(this.value);
    });
  }

  // Expose globally
  window._moneyInput = { attach: attachMoneyInput, parse: parseMoney, format: formatMoney };

  // Auto-attach khi DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-money]').forEach(attachMoneyInput);
  });
})();


// ── Theme (Light / Dark) ───────────────────────────────────
(function initTheme() {
  const STORAGE_KEY = 'fc-sunday-theme';
  const root = document.documentElement;

  function getTheme() {
    return localStorage.getItem(STORAGE_KEY) || 'dark';
  }

  function applyTheme(theme) {
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
    }
    // Update icon nếu button đã mount
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) {
      icon.setAttribute('icon', theme === 'light' ? 'solar:moon-linear' : 'solar:sun-linear');
    }
    // Update meta theme-color
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.content = theme === 'light' ? '#F2F1EE' : '#0C0C0F';
    }
  }

  function toggleTheme() {
    const current = getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  // Áp dụng ngay khi load (trước khi render)
  applyTheme(getTheme());

  window._toggleTheme = toggleTheme;
  window._getTheme = getTheme;
})();

// ── SW Update: báo có bản mới, người dùng tự bấm tải lại ──
// Không tự reload: SW lấy HTML/CSS/JS từ mạng trước nên lần chuyển
// trang sau đã là bản mới. Lần cài SW đầu tiên thì không báo gì.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type === 'SW_UPDATED' && hadController && !document.getElementById('_sw_toast')) {
      const toast = document.createElement('button');
      toast.id = '_sw_toast';
      toast.type = 'button';
      toast.onclick = () => {
        localStorage.setItem('fc-sunday-sw-reloading', '1'); // popup nhắc quỹ không hiện lại sau reload
        window.location.reload();
      };
      toast.style.cssText = [
        'position:fixed;bottom:90px;left:50%;transform:translateX(-50%)',
        'background:var(--bg-elevated)',
        'border:1px solid var(--bg-stroke)',
        'border-radius:var(--radius-lg)',
        'padding:10px 20px',
        'font-size:13px;font-weight:600',
        'color:var(--text-primary)',
        'z-index:9999',
        'box-shadow:0 4px 20px rgba(0,0,0,.4)',
        'white-space:nowrap',
        'cursor:pointer;font-family:inherit',
      ].join(';');
      toast.textContent = '✨ Có phiên bản mới · Bấm để tải lại';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 10000);
    }
  });
}

// ── Pull-to-refresh ────────────────────────────────────────
(function initPullToRefresh() {
  const THRESHOLD = 80;
  let startY = 0, currentY = 0, pulling = false, triggered = false;

  const indicator = document.createElement('div');
  indicator.id = 'ptr-indicator';
  indicator.innerHTML = `<div class="ptr-inner"><svg class="ptr-spinner" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="28.27" stroke-dashoffset="28.27"/></svg></div>`;
  document.body.prepend(indicator);

  function getScrollTop() {
    // Kiểm tra cả window lẫn .main-content
    const el = document.querySelector('.main-content');
    return Math.max(window.scrollY || 0, window.pageYOffset || 0, el ? el.scrollTop : 0, document.documentElement.scrollTop || 0);
  }

  function isAtTop() {
    return getScrollTop() <= 2;
  }

  function updateIndicator(dy) {
    const ratio = Math.min(dy / THRESHOLD, 1);
    const translateY = Math.min(dy * 0.5, 56) - 48;
    const circle = indicator.querySelector('circle');
    if (circle) {
      circle.style.strokeDashoffset = 28.27 * (1 - ratio);
      circle.style.transform = `rotate(${ratio * 720}deg)`;
      circle.style.transformOrigin = '12px 12px';
    }
    indicator.style.transform = `translateX(-50%) translateY(${translateY}px)`;
    indicator.style.opacity = Math.min(ratio * 1.5, 1);
    if (ratio >= 1) indicator.classList.add('ptr-triggered');
    else indicator.classList.remove('ptr-triggered');
  }

  function reset() {
    triggered = false;
    pulling = false;
    indicator.classList.remove('ptr-loading', 'ptr-triggered');
    indicator.style.transform = 'translateX(-50%) translateY(-48px)';
    indicator.style.opacity = '0';
  }

  function trigger() {
    triggered = true;
    indicator.classList.add('ptr-loading');
    const circle = indicator.querySelector('circle');
    if (circle) circle.style.strokeDashoffset = '8';
    Promise.resolve(window._refreshData?.()).finally(() => {
      setTimeout(reset, 600);
    });
  }

  // Non-passive touchstart để có thể prevent default
  document.addEventListener('touchstart', e => {
    if (!isAtTop()) return;
    if (document.querySelector('.modal-backdrop[style*="flex"], .sheet-backdrop[style*="flex"]')) return;
    if (triggered) return;
    startY = e.touches[0].clientY;
    currentY = startY;
    pulling = false;
    triggered = false;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (triggered) return;
    currentY = e.touches[0].clientY;
    const dy = currentY - startY;

    if (dy > 5 && isAtTop() && !pulling) {
      pulling = true;
    }

    if (!pulling) return;
    if (dy <= 0) { pulling = false; reset(); return; }

    updateIndicator(dy);
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!pulling || triggered) return;
    if (indicator.classList.contains('ptr-triggered')) {
      trigger();
    } else {
      reset();
    }
    pulling = false;
  });

  document.addEventListener('touchcancel', () => {
    if (!triggered) reset();
    pulling = false;
  });
})();


// ── Scroll Lock: khoá scroll khi có sheet/modal hiện ────────
(function initScrollLock() {
  let _scrollY = 0;
  let _lockCount = 0; // counter để handle nhiều modal chồng nhau

  function lock() {
    _lockCount++;
    if (_lockCount > 1) return; // đã lock rồi
    _scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${_scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflowY = 'scroll';
  }

  function unlock() {
    if (_lockCount <= 0) return;
    _lockCount--;
    if (_lockCount > 0) return; // còn modal khác đang mở
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.overflowY = '';
    window.scrollTo(0, _scrollY);
  }

  // Expose để các trang gọi trực tiếp — CÁCH DUY NHẤT để lock
  window._lockScroll   = lock;
  window._unlockScroll = unlock;

  // Observer chỉ xử lý sheet-backdrop/modal-backdrop có style.display toggle
  // (không dùng check() nữa để tránh conflict với direct lock/unlock)
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'style') {
        const el = m.target;
        if (!el.classList?.contains('sheet-backdrop') && !el.classList?.contains('modal-backdrop')) continue;
        const d = el.style.display;
        const isOpen = d && d !== 'none';
        const wasOpen = m.oldValue && m.oldValue.includes('display') && !m.oldValue.includes('none');
        if (isOpen && !wasOpen) lock();
        if (!isOpen && wasOpen) unlock();
      }
    }
  });

  function startObserving() {
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
      attributeOldValue: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserving);
  } else {
    startObserving();
  }
})();

// ── Nhắc đóng quỹ tháng ───────────────────────────────────
(function initFundReminder() {
  // Tính thứ 5 cuối cùng và thứ 6 đầu tiên của tháng hiện tại
  function getLastThursday(year, month) {
    // month: 0-based
    const lastDay = new Date(year, month + 1, 0); // ngày cuối tháng
    const d = lastDay.getDay(); // 0=CN, 4=T5
    const offset = (d >= 4) ? (d - 4) : (d + 3);
    return new Date(year, month, lastDay.getDate() - offset);
  }

  function getFirstFriday(year, month) {
    // Thứ 6 đầu tiên của tháng TIẾP THEO
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear  = month === 11 ? year + 1 : year;
    const first = new Date(nextYear, nextMonth, 1);
    const d = first.getDay(); // 0=CN, 5=T6
    const offset = (d <= 5) ? (5 - d) : (7 - d + 5);
    return new Date(nextYear, nextMonth, 1 + offset);
  }

  function shouldShow() {
    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth();

    const thu5  = getLastThursday(year, month);
    const fri1  = getFirstFriday(year, month);

    // Cửa sổ: từ 00:00 thứ 5 cuối đến hết 23:59 thứ 6 đầu tháng sau
    const start = new Date(thu5.getFullYear(), thu5.getMonth(), thu5.getDate(), 0, 0, 0);
    const end   = new Date(fri1.getFullYear(), fri1.getMonth(), fri1.getDate(), 23, 59, 59);

    return now >= start && now <= end;
  }

  function getPhase() {
    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth();
    // Ngày 1 của tháng tiếp theo
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear  = month === 11 ? year + 1 : year;
    const firstOfNext = new Date(nextYear, nextMonth, 1, 0, 0, 0);
    // Trước ngày 1 tháng sau → "sắp đến", từ ngày 1 trở đi → "đã đến"
    return now < firstOfNext ? 'soon' : 'due';
  }

  function getStorageKey() {
    const now = new Date();
    // Key theo ngày — chỉ hiện 1 lần/ngày
    return `fc-sunday-fund-reminder-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  }

  function dismiss() {
    localStorage.setItem(getStorageKey(), '1');
    const el = document.getElementById('_fund_reminder');
    if (el) el.remove();
    window._unlockScroll?.();
  }

  function show() {
    if (document.getElementById('_fund_reminder')) return;
    window._lockScroll?.();

    const phase = getPhase();
    const icon  = phase === 'soon' ? '💰' : '🚨';
    const title = phase === 'soon' ? 'Sắp đến kỳ đóng quỹ!' : 'Đã đến kỳ đóng quỹ!';
    const desc  = phase === 'soon'
      ? 'Sắp đến tháng đóng quỹ rồi anh em ơi! Chuẩn bị đạn dược 💵 để đóng quỹ dần. Ai chưa đóng thì liên hệ Cường Buồn 📲 để không bị réo tên trước toàn đội! 😅'
      : 'Đã đến kỳ đóng quỹ rồi anh em! Mang đạn dược 💵 đóng cho Cường Buồn ngay. Đạn dược chưa đủ thì nhớ note lại 📝 để Cường biết mà chờ! 🙏';

    const el = document.createElement('div');
    el.id = '_fund_reminder';
    el.style.cssText = [
      'position:fixed;inset:0;z-index:9999',
      'display:flex;align-items:center;justify-content:center',
      'background:rgba(0,0,0,.55)',
      'backdrop-filter:blur(4px)',
      '-webkit-backdrop-filter:blur(4px)',
      'padding:20px',
    ].join(';');

    el.innerHTML = `
      <div style="
        background:var(--bg-surface);
        border:1px solid var(--bg-border);
        border-radius:var(--radius-xl);
        padding:28px 24px 20px;
        max-width:340px;
        width:100%;
        text-align:center;
        box-shadow:0 16px 48px rgba(0,0,0,.45);
        animation:_reminderPop .25s cubic-bezier(.34,1.56,.64,1) both;
      ">
        <div style="font-size:44px;margin-bottom:12px;line-height:1">${icon}</div>
        <div style="font-size:17px;font-weight:800;color:var(--text-primary);margin-bottom:8px">${title}</div>
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin-bottom:24px">${desc}</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <a href="share.html" onclick="dismiss()" style="
            display:flex;align-items:center;justify-content:center;gap:8px;
            height:44px;border-radius:var(--radius-lg);
            background:linear-gradient(135deg,#FFC02E,#F5891F);
            color:#1A1206;font-weight:700;font-size:14px;
            text-decoration:none;font-family:var(--font-sans);
          ">
            Xem công nợ
          </a>
          <button onclick="dismiss()" style="
            height:40px;border-radius:var(--radius-lg);
            border:1px solid var(--bg-stroke);
            background:transparent;
            color:var(--text-secondary);font-weight:600;font-size:13px;
            cursor:pointer;font-family:var(--font-sans);
          ">Đã biết, bỏ qua</button>
        </div>
      </div>
      <style>
        @keyframes _reminderPop {
          from { opacity:0; transform:scale(.85); }
          to   { opacity:1; transform:scale(1); }
        }
      </style>
    `;

    document.body.appendChild(el);
    // Bấm ngoài để đóng
    el.addEventListener('click', e => { if (e.target === el) dismiss(); });
    window.dismiss = dismiss;
  }

  // Chạy sau khi DOM sẵn sàng
  function init() {
    if (!shouldShow()) return;
    if (localStorage.getItem(getStorageKey())) return; // đã hiện hôm nay rồi
    // Vừa reload do SW update → không hiện popup
    if (localStorage.getItem('fc-sunday-sw-reloading')) {
      localStorage.removeItem('fc-sunday-sw-reloading');
      return;
    }
    if (window._isLoggedIn?.()) return; // đã login → không hiện
    // Chờ auth resolve trước
    setTimeout(() => {
      if (window._isLoggedIn?.()) return;
      show();
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// ── Input Clear Button ─────────────────────────────────────
(function initInputClear() {
  const SKIP_TYPES = ['checkbox','radio','file','submit','button','reset','hidden','range','color'];

  function addClearBtn(input) {
    if (input.dataset.clearInited) return;
    input.dataset.clearInited = '1';

    // Tạo wrapper bao quanh input
    const wrap = document.createElement('div');
    wrap.className = '_input-clear-wrap';
    wrap.style.cssText = 'position:relative;display:block;width:100%';
    // Giữ nguyên display nếu input là inline
    if (getComputedStyle(input).display === 'inline') {
      wrap.style.display = 'inline-block';
    }

    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = '_input-clear-btn';
    btn.setAttribute('tabindex', '-1');
    btn.setAttribute('aria-label', 'Xóa');
    btn.innerHTML = '<iconify-icon icon="solar:close-circle-bold" style="font-size:18px;display:block"></iconify-icon>';
    btn.style.cssText = [
      'position:absolute',
      'right:8px',
      'top:0',
      'bottom:0',
      'margin:auto',
      'width:28px',
      'height:28px',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'padding:0',
      'border:none',
      'background:transparent',
      'cursor:pointer',
      'color:var(--text-muted)',
      'z-index:5',
      'border-radius:50%',
      'flex-shrink:0',
    ].join(';');
    wrap.appendChild(btn);

    // Padding phải để không bị chữ đè lên icon
    const origPR = getComputedStyle(input).paddingRight;
    const basePR = parseFloat(origPR) || 12;

    function updateBtn() {
      const hasVal = input.value.length > 0;
      const isFocused = document.activeElement === input;
      if (hasVal && isFocused) {
        btn.style.display = 'flex';
        input.style.paddingRight = `${basePR + 32}px`;
      } else {
        btn.style.display = 'none';
        input.style.paddingRight = `${basePR}px`;
      }
    }

    input.addEventListener('focus', updateBtn);
    input.addEventListener('input', updateBtn);
    input.addEventListener('blur', () => {
      // Delay để click btn kịp xử lý trước khi ẩn
      setTimeout(updateBtn, 150);
    });

    btn.addEventListener('mousedown', e => e.preventDefault()); // prevent blur
    btn.addEventListener('click', () => {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.focus();
      updateBtn();
    });

    updateBtn();
  }

  function initAll() {
    document.querySelectorAll('input, textarea').forEach(el => {
      if (SKIP_TYPES.includes(el.type)) return;
      if (el.readOnly || el.disabled) return;
      if (el.closest('._input-clear-btn')) return;
      addClearBtn(el);
    });
  }

  // Chạy sau DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Re-run sau components ready (để catch input trong modals/sheets)
  const orig = window.onComponentsReady;
  const origAdded = window._clearBtnHooked;
  if (!origAdded) {
    window._clearBtnHooked = true;
    const _origReady = window.onComponentsReady;
    window.onComponentsReady = function(...args) {
      if (_origReady) _origReady.apply(this, args);
      setTimeout(initAll, 100);
    };
  }

  // MutationObserver để catch input được thêm động (modal, sheet)
  const obs = new MutationObserver(() => initAll());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      obs.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    obs.observe(document.body, { childList: true, subtree: true });
  }
})();

// ── Tài chính & nợ dùng chung (Cài đặt, Thành viên, Tổng quan, Quỹ bia, share) ──
// Năm gốc 2026: số dư đầu kỳ nhập tay ở Cài đặt (tồn quỹ ban đầu).
// Các năm sau: số dư đầu kỳ = tồn quỹ cuối năm liền trước (tự cuốn chiếu).
// Nợ cộng dồn: nợ năm đang xem + nợ các năm trước chưa trả.
window._fcFinance = (function () {
  'use strict';
  const BASE_YEAR = 2026, FEE = 200000, FINE = 50000;

  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const isOpeningEntry = c => { const t = norm([c.cat, c.note, c.title, c.desc].filter(Boolean).join(' ')); return t.includes('tien dau ky') || t.includes('so du dau ky') || t.includes('dau ky'); };
  const fundOf = c => (!c.fund || c.fund === 'bong') ? 'thang' : c.fund;
  const monthKey = (id, y) => y === BASE_YEAR ? String(id) : `${id}_${y}`;
  const matchYear = m => m.year || BASE_YEAR;
  const winnerIds = m => { const raw = m?.winners; const list = Array.isArray(raw) ? raw : Object.values(raw || {}); return list.map(w => Number(typeof w === 'object' ? w.memberId : w)).filter(Number.isFinite); };
  // Firebase có thể trả mảng dưới dạng object → luôn quy về mảng
  const arr = v => Array.isArray(v) ? v : Object.values(v || {});
  const yearMatches = (S, y) => arr(S.matches).filter(m => m && matchYear(m) === y);

  function legacyOpening(S, fund) {
    return arr(S.chiTieu).reduce((s, c) => (c && fundOf(c) === fund && isOpeningEntry(c)) ? s + Math.abs(Number(c.amount || 0)) : s, 0);
  }
  // Số dư đầu kỳ (tồn quỹ ban đầu) do người quản lý nhập ở Cài đặt — chỉ áp cho năm gốc
  function baseOpening(S, fund) {
    const explicit = S?.settings?.openingBalances?.[fund];
    const has = explicit !== undefined && explicit !== null && explicit !== '';
    const v = Number(explicit) || 0;
    if (has && v !== 0) return v;
    const legacy = legacyOpening(S, fund);
    return legacy !== 0 ? legacy : v;
  }
  function opening(S, fund, year) {
    if (year > BASE_YEAR) { const p = totals(S, year - 1); return fund === 'bia' ? p.tonBia : p.tonThang; }
    return baseOpening(S, fund);
  }
  // Thu/chi/tồn quỹ của MỘT năm (giống computeFundTotals ở trang Tổng quan)
  function totals(S, year) {
    const chi = arr(S.chiTieu).filter(c => c && String(c.date?.substring(0, 4)) === String(year) && !isOpeningEntry(c));
    const openingThang = opening(S, 'thang', year), openingBia = opening(S, 'bia', year);
    let thuThang = 0;
    arr(S.members).forEach(m => m && arr(S.thuThang?.[monthKey(m.id, year)]).forEach(v => { if (v === 1) thuThang += FEE; }));
    let thuBia = 0;
    yearMatches(S, year).forEach(m => { arr(m.losers).forEach(l => { if (l.paid) thuBia += FINE; }); thuBia += (m.thuThem || 0); });
    const sum = (arr, f) => arr.reduce((s, c) => s + f(c), 0);
    const incThang = sum(chi.filter(c => fundOf(c) === 'thang' && Number(c.amount) < 0), c => Math.abs(Number(c.amount)));
    const incBia = sum(chi.filter(c => c.fund === 'bia' && Number(c.amount) < 0), c => Math.abs(Number(c.amount)));
    const chiThang = sum(chi.filter(c => fundOf(c) === 'thang' && Number(c.amount) > 0), c => Number(c.amount));
    const chiBia = sum(chi.filter(c => c.fund === 'bia' && Number(c.amount) > 0), c => Number(c.amount));
    const thuThangDisplay = openingThang + thuThang + incThang, thuBiaDisplay = openingBia + thuBia + incBia;
    return { openingThang, openingBia, thuThangDisplay, thuBiaDisplay, chiThang, chiBia, tonThang: thuThangDisplay - chiThang, tonBia: thuBiaDisplay - chiBia };
  }

  // Tháng cuối cùng đã đến hạn của một năm (-1 = chưa có tháng nào)
  function lastDueMonth(y) { const now = new Date(), cy = now.getFullYear(); return y < cy ? 11 : y === cy ? now.getMonth() : -1; }
  // Các tháng còn nợ quỹ tháng của một người, từ năm gốc tới năm `upto`.
  // Năm trước không có dữ liệu của người đó (chưa vào đội) thì bỏ qua; riêng năm đang xem
  // không có dữ liệu thì coi như chưa đóng tháng nào (giống cách tính cũ).
  function owedMonths(S, id, upto) {
    const out = [];
    for (let y = BASE_YEAR; y <= upto; y++) {
      const raw = S.thuThang?.[monthKey(id, y)];
      if (!raw && y < upto) continue;
      const a = arr(raw);
      for (let mi = 0; mi <= lastDueMonth(y); mi++) if ((a[mi] || 0) === 0) out.push({ year: y, mi });
    }
    return out;
  }
  // Các trận còn nợ quỹ bia của một người, từ năm gốc tới năm `upto`
  function owedMatches(S, id, upto) {
    return arr(S.matches).filter(m => m && matchYear(m) <= upto && arr(m.losers).some(l => l.memberId == id && !l.paid));
  }
  function memberDebt(S, id, upto) {
    const months = owedMonths(S, id, upto), matches = owedMatches(S, id, upto);
    return { months, matches, noThang: months.length * FEE, noBia: matches.length * FINE, total: months.length * FEE + matches.length * FINE };
  }
  // thuThang dạng mảng mà có khoá chữ ("id_năm") → chuyển sang object để không mất khi lưu
  function normalizeThuThang(S) {
    if (Array.isArray(S.thuThang) && Object.keys(S.thuThang).some(k => !/^\d+$/.test(k))) {
      const o = {};
      Object.keys(S.thuThang).forEach(k => { if (S.thuThang[k] != null) o[k] = S.thuThang[k]; });
      S.thuThang = o;
    }
    return S;
  }
  const monthLabel = (o, viewYear) => `T${o.mi + 1}${o.year !== viewYear ? '/' + o.year : ''}`;

  return { BASE_YEAR, FEE, FINE, arr, monthKey, matchYear, winnerIds, yearMatches, baseOpening, opening, totals, lastDueMonth, owedMonths, owedMatches, memberDebt, monthLabel, normalizeThuThang };
})();

// Khởi động: hiện dữ liệu cache rồi kết nối Firebase (xem __fcStart ở trên)
window.__fcStart?.();
