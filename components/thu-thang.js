window._fundPanels ??= {};
window._fundPanels['thu-thang'] = function(signal) {
  const MONTHS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
  const FEE = 200000, BASE_YEAR = 2026;
  let _year = Math.max(BASE_YEAR, new Date().getFullYear()), _S = null, _lastSavedS = null, _hasMonthlyChanges = false;
  const curMonth = new Date().getMonth(); // 0-based
  const curYear  = new Date().getFullYear();

  function fmt(n) { return new Intl.NumberFormat('vi-VN').format(n); }
  function cloneState(obj) { return JSON.parse(JSON.stringify(obj || {})); }

  function getKey(memberId) {
    return _year === BASE_YEAR ? String(memberId) : `${memberId}_${_year}`;
  }

  function renderTable(S) {
    _S = S;
    const members = (S.members || [])
      .filter(m => m.status !== 'left')
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'vi', { sensitivity: 'base' }));
    const isAdmin = window._isLoggedIn?.();

    // Build month headers
    const head = document.getElementById('thu-thang-head');
    head.innerHTML = `<th class="sticky-col stt-col">STT</th><th class="sticky-col name-col">Thành viên</th>` +
      MONTHS.map((m,i) => `<th class="month-col">${m}</th>`).join('') +
      `<th>Tổng nợ</th>`;

    // Build rows
    let totalDaThu = 0, totalConNo = 0, totalObligated = 0;
    const rows = members.map((m, index) => {
      const key = getKey(m.id);
      const arr = S.thuThang?.[key] || Array(12).fill(0);
      let memberDaThu = 0, memberNo = 0;

      const cells = arr.map((v, mi) => {
        const isFuture = _year > curYear || (_year === curYear && mi > curMonth);
        let cls = '', label = '', nextV = 0;
        if (v === 1) {
          cls = 'cell-paid-btn';
          label = '✓';
          memberDaThu += FEE;
        } else if (v === 2) {
          cls = 'cell-exempt-btn';
          label = '—';
        } else {
          cls = 'cell-unpaid-btn';
          label = '✗';
          // Tháng tương lai vẫn cho chọn trước nhưng không tính vào còn thiếu
          if (!isFuture) memberNo += FEE;
        }
        if (isFuture) cls += ' cell-future-btn';

        // Cycle: 0→1→2→0
        nextV = v === 0 ? 1 : v === 1 ? 2 : 0;

        const clickAttr = isAdmin
          ? `onclick="toggleCell(${m.id},${mi},${nextV})" style="cursor:pointer"`
          : '';
        const title = `${MONTHS[mi]}${isFuture ? ' · tháng tương lai' : ''}`;
        return `<td class="month-col"><button class="cell-btn ${cls}" ${clickAttr} title="${title}" data-mid="${m.id}" data-mi="${mi}">${label}</button></td>`;
      }).join('');

      // Cộng thêm nợ các năm trước chưa trả (nợ cộng dồn)
      const prevNo = window._fcFinance.owedMonths(S, m.id, _year).filter(o => o.year < _year).length * FEE;
      memberNo += prevNo;
      totalDaThu += memberDaThu;
      totalConNo += memberNo;
      if (m.status === 'active') totalObligated += arr.filter(v => v !== 2 && !arr[12]).length * FEE; // simplified

      const noColor = memberNo > 0 ? 'color:var(--color-accent-light)' : 'color:var(--color-success)';
      return `<tr>
        <td class="sticky-col stt-col stt-cell">${index + 1}</td>
        <td class="sticky-col name-col member-name-cell"><span>${m.name}</span></td>
        ${cells}
        <td style="${noColor};font-weight:700">${memberNo > 0 ? fmt(memberNo) : '✓'}${prevNo > 0 ? `<div style="font-size:11px;font-weight:600;opacity:.8;white-space:nowrap">gồm ${fmt(prevNo)} năm trước</div>` : ''}</td>
      </tr>`;
    }).join('');

    // Summary row — chỉ hiện tổng thu cuối, các tháng để trống
    const emptyMonths = MONTHS.map(() => `<td></td>`).join('');

    document.getElementById('thu-thang-tbody').innerHTML = rows +
      `<tr class="summary-row">
        <td class="sticky-col stt-col"></td>
        <td class="sticky-col name-col" style="font-weight:800">Tổng thu</td>
        ${emptyMonths}
        <td style="font-weight:800;color:var(--color-primary)">${fmt(totalDaThu)}</td>
      </tr>`;

    // KPI
    document.getElementById('kpi-da-thu').textContent    = fmt(totalDaThu);
    document.getElementById('kpi-con-thieu').textContent = fmt(totalConNo);
  }

  function setMonthlyPending(hasChanges) {
    _hasMonthlyChanges = !!hasChanges;
    const bar = document.getElementById('thu-thang-save-bar');
    if (bar) bar.hidden = !_hasMonthlyChanges;
  }

  function showThuThangToast(message) {
    const oldToast = document.querySelector('.thu-thang-toast');
    if (oldToast) oldToast.remove();
    const toast = document.createElement('div');
    toast.className = 'thu-thang-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 180);
    }, 2200);
  }

  window.toggleCell = function(memberId, monthIdx, newVal) {
    if (!window._isLoggedIn?.()) return;
    const key = getKey(memberId);
    const arr = (_S.thuThang?.[key] || Array(12).fill(0)).slice();
    arr[monthIdx] = newVal;
    if (!_S.thuThang) _S.thuThang = {};
    _S.thuThang[key] = arr;
    setMonthlyPending(true);
    renderTable(_S);
  };

  // Dòng tiêu đề cột dính: bảng cuộn ngang trong .table-wrap nên thead gốc không dính
  // theo trang được. Dùng bản sao thead trong khung dính (.tt-sticky), đặt đè đúng chỗ
  // thead gốc, cùng độ rộng từng cột và cuộn ngang cùng bảng.
  (function initStickyHead() {
    const src = document.getElementById('thu-thang-table');
    const wrap = src?.parentElement, head = document.getElementById('tt-head');
    if (!src || !wrap || !head) return;
    const clone = head.querySelector('table');
    const page = document.getElementById('page-content');
    // Tiêu đề cột cuộn ngang theo bảng bằng CSS scroll-driven animation (trình duyệt tự
    // dịch trong lúc vẽ — không trễ khi vuốt mạnh trên iPhone). Trình duyệt chưa hỗ trợ
    // thì dùng JS gán scrollLeft theo sự kiện cuộn.
    const cssSync = !!(window.CSS?.supports?.('timeline-scope', '--tt-x') && CSS.supports('animation-timeline', '--tt-x'));
    page.classList.toggle('tt-css-sync', cssSync);
    let raf = 0;
    function sync() {
      raf = 0;
      if (!src.tHead) return;
      const c = src.tHead.cloneNode(true);
      c.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      const ths = src.tHead.querySelectorAll('th'), cths = c.querySelectorAll('th');
      ths.forEach((th, i) => { const w = th.getBoundingClientRect().width + 'px'; Object.assign(cths[i].style, { width: w, minWidth: w, maxWidth: w }); });
      clone.replaceChildren(c);
      clone.style.width = src.getBoundingClientRect().width + 'px';
      // kéo bảng lên để thead gốc nằm ngay dưới bản sao (bù cả viền trên 1px)
      wrap.style.marginTop = -(src.tHead.getBoundingClientRect().height + 1) + 'px';
      // cột tên dính ngay sau cột STT: lấy độ rộng thật (cả phần lẻ pixel) để không hở khe
      const stt = src.tHead.querySelector('th.stt-col');
      if (stt) page.style.setProperty('--tt-stt-w', stt.getBoundingClientRect().width + 'px');
      page.style.setProperty('--tt-max', Math.max(0, wrap.scrollWidth - wrap.clientWidth) + 'px');
      autoScroll();
      if (!cssSync) head.scrollLeft = wrap.scrollLeft;
      markScrolled();
    }
    // Mặc định cuộn để tháng gần nhất (tháng hiện tại; năm cũ là T12) nằm ở mép phải.
    // Chỉ làm một lần mỗi năm được chọn, không giật lại khi bảng vẽ lại sau khi bấm ô.
    let autoYear = null;
    function autoScroll() {
      if (autoYear === _year) return;
      const months = src.tHead.querySelectorAll('th.month-col');
      if (months.length < 12 || src.tBodies[0]?.rows.length < 2) return;   // chưa có dữ liệu
      const mi = _year < curYear ? 11 : _year > curYear ? 0 : curMonth;
      const th = months[mi];
      wrap.scrollLeft = Math.max(0, th.offsetLeft + th.offsetWidth - wrap.clientWidth);
      autoYear = _year;
    }
    // Đường kẻ dọc sau cột tên chỉ hiện khi bảng đã cuộn ngang
    function markScrolled() {
      const on = wrap.scrollLeft > 0;
      wrap.classList.toggle('is-scrolled-x', on); head.classList.toggle('is-scrolled-x', on);
    }
    const schedule = () => { if (!signal.aborted && !raf) raf = requestAnimationFrame(sync); };
    const mutation = new MutationObserver(schedule);
    mutation.observe(src, { childList: true, subtree: true, characterData: true });
    const resize = 'ResizeObserver' in window ? new ResizeObserver(schedule) : null;
    resize?.observe(src);
    signal.addEventListener('abort', () => {
      mutation.disconnect();
      resize?.disconnect();
      cancelAnimationFrame(raf);
    }, { once: true });
    window.addEventListener('resize', schedule, { signal });
    document.fonts?.ready.then(schedule);
    // Cuộn ngang MỘT chiều: chỉ bảng điều khiển tiêu đề (tiêu đề overflow:hidden, không tự cuộn).
    // Đồng bộ hai chiều làm sự kiện cuộn trễ của tiêu đề kéo ngược bảng → đứt quán tính, giật.
    wrap.addEventListener('scroll', () => { if (!cssSync) head.scrollLeft = wrap.scrollLeft; markScrolled(); }, { passive: true });
    // Lăn chuột / kéo ngang trên dòng tiêu đề → chuyển sang cuộn bảng
    head.addEventListener('wheel', e => {
      const dx = e.deltaX || (e.shiftKey ? e.deltaY : 0);
      if (!dx) return;
      e.preventDefault(); wrap.scrollLeft += dx;
    }, { passive: false });
    let tx = null, tl = 0;
    head.addEventListener('touchstart', e => { tx = e.touches[0].clientX; tl = wrap.scrollLeft; }, { passive: true });
    head.addEventListener('touchmove', e => { if (tx !== null) wrap.scrollLeft = tl - (e.touches[0].clientX - tx); }, { passive: true });
    head.addEventListener('touchend', () => { tx = null; }, { passive: true });
    schedule();
  })();

  // Đánh dấu khung tìm kiếm đang dính (bật dải nền che khe với thanh tab)
  (function initStuckFlag() {
    const el = document.getElementById('tt-sticky');
    if (!el) return;
    let raf = 0, stickTop = 0;
    const readTop = () => { stickTop = parseFloat(getComputedStyle(el).top) || 0; };   // chỉ đọc lại khi đổi cỡ màn hình
    const check = () => { raf = 0; el.classList.toggle('is-stuck', el.getBoundingClientRect().top <= stickTop + 0.5); };
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(check); }, { passive: true, signal });
    const resizeFlag = () => { readTop(); check(); };
    window.addEventListener('resize', resizeFlag, { signal });
    const resize = 'ResizeObserver' in window ? new ResizeObserver(resizeFlag) : null;
    resize?.observe(document.documentElement);
    signal.addEventListener('abort', () => {
      resize?.disconnect();
      cancelAnimationFrame(raf);
    }, { once: true });
    readTop();
    check();
  })();

  window.filterThuThangTable = function(query) {
    const q = query.trim().toLowerCase();
    const rows = document.querySelectorAll('#thu-thang-table tbody tr');
    rows.forEach(row => {
      const name = row.querySelector('.name-col')?.textContent?.toLowerCase() || '';
      row.style.display = (!q || name.includes(q)) ? '' : 'none';
    });
  };

  window.cancelMonthlyChanges = function() {
    if (!_hasMonthlyChanges || !_lastSavedS) return;
    _S = cloneState(_lastSavedS);
    setMonthlyPending(false);
    renderTable(_S);
  };

  window.saveMonthlyChanges = async function() {
    if (!_hasMonthlyChanges || !_S) return;
    if (!window._isLoggedIn?.()) return;
    const btn = document.getElementById('thu-thang-save-btn');
    if (btn) {
      btn.disabled = true;
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = 'Đang lưu';
    }
    try {
      await window._saveS?.(_S);
      if (signal.aborted) return;
      _lastSavedS = cloneState(_S);
      setMonthlyPending(false);
      showThuThangToast('Đã cập nhật thu tháng');
    } catch (err) {
      console.error(err);
      if (!signal.aborted) showThuThangToast('Không lưu được thay đổi');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalText || 'Lưu';
      }
    }
  };

  function updateYearUI() {
    const sel = document.getElementById('year-select');
    if (sel) {
      const curY = new Date().getFullYear();
      const minY = BASE_YEAR;
      const maxY = Math.max(curY, BASE_YEAR); // tới năm hiện tại, không +1
      sel.innerHTML = '';
      for (let y = maxY; y >= minY; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === _year) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.disabled = sel.options.length <= 1; // chỉ một năm thì không mở danh sách
    }
    window._currentYear = _year;
  }

  window.onComponentsReady = function () {
    updateYearUI();
    document.getElementById('year-select')?.addEventListener('change', (e) => {
      _year = parseInt(e.target.value, 10) || BASE_YEAR;
      updateYearUI();
      if (_S) {
        if (_hasMonthlyChanges && _lastSavedS) _S = cloneState(_lastSavedS);
        setMonthlyPending(false);
        renderTable(_S);
      }
    });
  };

  window._onDataReady = function(S) {
    _lastSavedS = cloneState(S);
    setMonthlyPending(false);
    renderTable(cloneState(S));
  };
  window._onAuthChange = function() { if(_S) renderTable(_S); };
};
