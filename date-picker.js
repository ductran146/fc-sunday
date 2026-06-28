/**
 * FC Sunday V2 — Custom Date Picker
 * Tái sử dụng trên tất cả các trang
 * 
 * Usage:
 *   DatePicker.init('button-id', 'hidden-input-id', 'display-span-id', optionalDateStr);
 *   DatePicker.getValue('hidden-input-id'); // returns 'YYYY-MM-DD'
 */

window.DatePicker = (function () {
  'use strict';

  const MONTHS_VN = [
    'Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
    'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'
  ];
  const DOW = ['CN','T2','T3','T4','T5','T6','T7'];

  let _year, _month, _selected, _targetHiddenId, _targetDisplayId;

  function formatVN(dateStr) {
    if (!dateStr) return 'Chọn ngày';
    const [y, m, d] = dateStr.split('-');
    return `${parseInt(d)} ${MONTHS_VN[parseInt(m) - 1]}, ${y}`;
  }

  function setValue(dateStr) {
    const hidden  = document.getElementById(_targetHiddenId);
    const display = document.getElementById(_targetDisplayId);
    if (hidden)  hidden.value = dateStr;
    if (display) {
      display.textContent = formatVN(dateStr);
      display.style.color = dateStr ? 'var(--text-primary)' : 'var(--text-muted)';
    }
  }

  function render() {
    const label = document.getElementById('_dp_label');
    if (label) label.textContent = `${MONTHS_VN[_month]}, ${_year}`;

    const grid = document.getElementById('_dp_days');
    if (!grid) return;

    const firstDow   = new Date(_year, _month, 1).getDay();
    const daysInMon  = new Date(_year, _month + 1, 0).getDate();
    const today      = new Date();
    const todayStr   = today.toISOString().slice(0, 10);
    let html = '';

    // Empty cells
    for (let i = 0; i < firstDow; i++) html += '<div></div>';

    for (let d = 1; d <= daysInMon; d++) {
      const ds = `${_year}-${String(_month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isSel   = ds === _selected;
      const isToday = ds === todayStr;

      let bg    = 'transparent';
      let color = 'var(--text-primary)';
      let fw    = '500';

      if (isSel)   { bg = 'var(--color-primary)'; color = '#1a1206'; fw = '800'; }
      else if (isToday) { bg = 'rgba(255,192,46,.15)'; color = 'var(--color-primary)'; fw = '700'; }

      html += `<button type="button" data-ds="${ds}"
        style="padding:9px 0;text-align:center;font-size:13px;font-weight:${fw};
               border:none;cursor:pointer;border-radius:var(--radius-md);
               background:${bg};color:${color};font-family:var(--font-sans);
               transition:opacity .1s"
        onmouseover="this.style.opacity='.75'"
        onmouseout="this.style.opacity='1'"
        onclick="DatePicker._pick('${ds}')">${d}</button>`;
    }
    grid.innerHTML = html;
  }

  function ensureModal() {
    if (document.getElementById('_dp_modal')) return;
    const el = document.createElement('div');
    el.className = 'modal-backdrop';
    el.id = '_dp_modal';
    el.style.display = 'none';
    el.innerHTML = `
      <div class="modal fade-in" style="max-width:340px;padding:20px">
        <!-- Month nav -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <button class="btn btn-icon btn-ghost" onclick="DatePicker._prevMonth()">
            <iconify-icon icon="solar:arrow-left-linear" style="font-size:18px"></iconify-icon>
          </button>
          <div style="font-size:15px;font-weight:700" id="_dp_label"></div>
          <button class="btn btn-icon btn-ghost" onclick="DatePicker._nextMonth()">
            <iconify-icon icon="solar:arrow-right-linear" style="font-size:18px"></iconify-icon>
          </button>
        </div>
        <!-- Weekdays -->
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px">
          ${DOW.map(d=>`<div style="text-align:center;font-size:11px;font-weight:700;color:var(--text-muted);padding:4px">${d}</div>`).join('')}
        </div>
        <!-- Days -->
        <div id="_dp_days" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px"></div>
        <!-- Footer -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px">
          <button class="btn btn-ghost btn-sm" onclick="DatePicker._today()">Hôm nay</button>
          <button class="btn btn-ghost btn-sm" onclick="DatePicker.close()">Đóng</button>
        </div>
      </div>`;
    el.addEventListener('click', e => { if (e.target === el) DatePicker.close(); });
    document.body.appendChild(el);
  }

  return {
    init(btnId, hiddenId, displayId, defaultDate) {
      ensureModal();
      _targetHiddenId  = hiddenId;
      _targetDisplayId = displayId;
      const date = defaultDate || new Date().toISOString().slice(0, 10);
      setValue(date);
    },

    open(hiddenId, displayId) {
      ensureModal();
      _targetHiddenId  = hiddenId;
      _targetDisplayId = displayId;
      const cur = document.getElementById(hiddenId)?.value;
      const ref = cur ? new Date(cur + 'T00:00:00') : new Date();
      _year     = ref.getFullYear();
      _month    = ref.getMonth();
      _selected = cur || '';
      render();
      document.getElementById('_dp_modal').style.display = 'flex';
    },

    close() {
      const m = document.getElementById('_dp_modal');
      if (m) m.style.display = 'none';
    },

    _pick(ds) {
      _selected = ds;
      setValue(ds);
      this.close();
    },

    _prevMonth() {
      _month--; if (_month < 0) { _month = 11; _year--; } render();
    },

    _nextMonth() {
      _month++; if (_month > 11) { _month = 0; _year++; } render();
    },

    _today() {
      const t = new Date();
      _year = t.getFullYear(); _month = t.getMonth(); _selected = t.toISOString().slice(0,10);
      render();
    },

    getValue(hiddenId) {
      return document.getElementById(hiddenId)?.value || '';
    },

    formatVN,
    setValue(hiddenId, displayId, dateStr) {
      _targetHiddenId  = hiddenId;
      _targetDisplayId = displayId;
      setValue(dateStr);
    }
  };
})();
