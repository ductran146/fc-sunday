window._fundPanels ??= {};
window._fundPanels['thu-phat'] = function(signal) {
  const MONTHS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
  const MONTHS_FULL = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                       'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
  const FINE = 50000, BASE_YEAR = 2026;
  let _year = Math.max(BASE_YEAR, new Date().getFullYear()), _S = null; // mặc định năm hiện tại (không nhỏ hơn năm gốc)
  const _openMonths = new Set([new Date().getMonth()]);
  let _editMatchId = null;

  function fmt(n) { return new Intl.NumberFormat('vi-VN').format(n); }
  // Dạng gọn cho chip tóm tắt tháng: 450000 → "450K"
  function chipK(n) { return fmtK(n).replace(/\s+/g, ''); }
  function fmtK(n) { return n === 0 ? '0' : (n / 1000).toLocaleString('vi-VN', {maximumFractionDigits: 0}) + ' K'; }
  function fmtDate(d) { if(!d) return '—'; const p=d.split('-'); return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:d; }
  function getYearMatches(S) {
    return (S.matches||[]).filter(m=>_year===BASE_YEAR?(!m.year||m.year===BASE_YEAR):m.year===_year);
  }
  function getWinnerIds(match) {
    const raw = match?.winners;
    const list = Array.isArray(raw) ? raw : Object.values(raw || {});
    return list.map(w => Number(typeof w === 'object' ? w.memberId : w)).filter(Number.isFinite);
  }
  // ── Chia đội ─────────────────────────────────────────────
  // _team: memberId → 'w' (thắng) | 'l' (thua, chưa đóng) | 'lp' (thua, đã đóng)
  let _team = new Map();
  let _activeTeam = 'w';
  window.setActiveTeam = function(t) {
    _activeTeam = t;
    document.querySelectorAll('.team-board .team').forEach(el => {
      const on = el.dataset.team === t;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-pressed', String(on));
    });
    const nm = document.getElementById('team-active-name');
    if (nm) nm.textContent = t === 'w' ? 'đội thắng' : 'đội thua';
  };
  window.teamAdd = function(id, ev) { ev?.stopPropagation(); _team.set(id, _activeTeam === 'w' ? 'w' : 'l'); renderTeamBoard(); };
  window.teamRemove = function(id, ev) { ev?.stopPropagation(); _team.delete(id); renderTeamBoard(); };
  window.teamTogglePaid = function(id, ev) { ev?.stopPropagation(); const v = _team.get(id); if (v === 'l' || v === 'lp') _team.set(id, v === 'l' ? 'lp' : 'l'); renderTeamBoard(); };
  function renderTeamBoard() {
    const members = (_S?.members || []).filter(m => m.status !== 'left');
    // Người đá nhiều xếp đầu danh sách "Chưa xếp đội"
    const plays = {};
    (_S?.matches || []).forEach(m => {
      (m.losers || []).forEach(l => { plays[l.memberId] = (plays[l.memberId] || 0) + 1; });
      getWinnerIds(m).forEach(id => { plays[id] = (plays[id] || 0) + 1; });
    });
    const byId = id => members.find(m => Number(m.id) === id);
    const W = [], L = [];
    _team.forEach((v, id) => { const m = byId(id); if (!m) return; (v === 'w' ? W : L).push([m, v]); });
    const chip = (m, v) => v === 'w'
      ? `<span class="team-chip team-chip--w"><button class="team-chip__name" onclick="teamRemove(${m.id}, event)">${m.name}</button><button class="team-chip__x" aria-label="Bỏ ${m.name}" onclick="teamRemove(${m.id}, event)">×</button></span>`
      : `<span class="team-chip team-chip--${v}"><button class="team-chip__name" title="${v === 'lp' ? 'Đã đóng' : 'Chưa đóng'} – chạm để đổi" onclick="teamTogglePaid(${m.id}, event)">${v === 'lp' ? '✓' : '✕'} ${m.name}</button><button class="team-chip__x" aria-label="Bỏ ${m.name}" onclick="teamRemove(${m.id}, event)">×</button></span>`;
    const empty = '<span class="team__empty">Chưa có ai</span>';
    document.getElementById('team-list-w').innerHTML = W.map(([m, v]) => chip(m, v)).join('') || empty;
    document.getElementById('team-list-l').innerHTML = L.map(([m, v]) => chip(m, v)).join('') || empty;
    document.getElementById('team-count-w').textContent = W.length;
    document.getElementById('team-count-l').textContent = L.length;
    const pool = members.filter(m => !_team.has(Number(m.id))).sort((a, b) => (plays[b.id] || 0) - (plays[a.id] || 0));
    document.getElementById('team-pool').innerHTML = pool.map(m => `<button type="button" class="team-pool__chip" onclick="teamAdd(${m.id}, event)">${m.name}</button>`).join('')
      || '<span class="team-pool__empty">Đã xếp hết thành viên</span>';
  }

  // ── Match modal ──────────────────────────────────────────
  window.closeMatchModal = function() {
    document.getElementById('match-modal').style.display='none'; _editMatchId=null;
  };
  document.getElementById('match-modal')?.addEventListener('click', e=>{
    if(e.target===document.getElementById('match-modal')) window.closeMatchModal();
  });

  function openMatchModal(targetMi, editId) {
    if(!window._isLoggedIn?.()) return;
    _editMatchId = editId ?? null;
    _team = new Map();
    setActiveTeam('w');
    const isEdit = _editMatchId !== null;
    document.getElementById('match-modal-title').textContent = isEdit ? 'Sửa trận đấu' : `Thêm trận — ${MONTHS_FULL[targetMi]}`;
    if(isEdit) {
      const match=(_S?.matches||[]).find(m=>m.id==_editMatchId);
      if(match) {
        getWinnerIds(match).forEach(id => _team.set(Number(id), 'w'));
        (match.losers||[]).forEach(l => _team.set(Number(l.memberId), l.paid ? 'lp' : 'l'));
        document.getElementById('match-date').value=match.date||'';
        window.DatePicker?.setValue('match-date','match-date-display', match.date||'');
        document.getElementById('match-thu-them').value=match.thuThem||'';
        document.getElementById('match-ghi-chu').value=match.ghiChuThem||'';
      }
    } else {
      const today=new Date(),y=_year,mo=targetMi;
      const def=new Date(y,mo,mo===today.getMonth()&&y===today.getFullYear()?today.getDate():1);
      const defStr = `${def.getFullYear()}-${String(def.getMonth()+1).padStart(2,'0')}-${String(def.getDate()).padStart(2,'0')}`;
      window.DatePicker?.setValue('match-date','match-date-display', defStr);
      document.getElementById('match-thu-them').value='';
      document.getElementById('match-ghi-chu').value='';
    }
    renderTeamBoard();
    document.getElementById('match-modal').style.display='flex';
    const sh=document.querySelector('#match-modal .sheet'); if(sh) sh.scrollTop=0;
  }
  window.openAddMatch  = function(mi)      { openMatchModal(mi, null); };
  window.openEditMatch = function(matchId) {
    const m=(_S?.matches||[]).find(m=>m.id==matchId); if(m) openMatchModal(m.monthIdx, matchId);
  };

  // ── Pending state ────────────────────────────────────────
  let _lastSavedS = null;
  let _hasBiaChanges = false;

  function setBiaPending(has) {
    _hasBiaChanges = !!has;
    const bar = document.getElementById('bia-save-bar');
    if (bar) bar.hidden = !_hasBiaChanges;
  }

  window.togglePaid = function(matchId, memberId) {
    if (!window._isLoggedIn?.() || !_S) return;
    const match = (_S.matches||[]).find(m=>m.id==matchId);
    if (!match) return;
    const loser = (match.losers||[]).find(l=>l.memberId==memberId);
    if (loser) loser.paid = !loser.paid;
    setBiaPending(true);
    renderPage(_S);
  };

  window.cancelBiaChanges = function() {
    if (!_lastSavedS) return;
    _S = JSON.parse(JSON.stringify(_lastSavedS));
    setBiaPending(false);
    renderPage(_S);
  };

  window.saveBiaChanges = async function() {
    if (!_hasBiaChanges || !_S) return;
    const btn = document.getElementById('bia-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu…'; }
    try {
      await window._saveS?.(_S);
      if (signal.aborted) return;
      _lastSavedS = JSON.parse(JSON.stringify(_S));
      setBiaPending(false);
    } catch(e) {
      console.error(e);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Lưu'; }
    }
  };

  document.getElementById('btn-save-match')?.addEventListener('click', async ()=>{
    if(!_S||!window._isLoggedIn?.()) return;
    const date=document.getElementById('match-date').value;
    if(!date){alert('Vui lòng chọn ngày');return;}
    const selected=[], winners=[];
    _team.forEach((v,id)=>{ if(v==='w') winners.push(id); else selected.push({memberId:id, paid:v==='lp'}); });

    const thuThem=window._moneyInput?.parse(document.getElementById('match-thu-them').value)||0;
    const ghiChu=document.getElementById('match-ghi-chu').value.trim();
    const mi=new Date(date).getMonth();
    const yr=parseInt(date.slice(0,4),10); // năm của trận theo ngày trận, không theo năm đang xem
    if(!_S.matches) _S.matches=[];
    if(_editMatchId!==null) {
      const match=_S.matches.find(m=>m.id==_editMatchId);
      if(match) {
        const oldPaid={};(match.losers||[]).forEach(l=>{oldPaid[l.memberId]=l.paid;});
        match.date=date;match.monthIdx=mi;match.year=yr;match.thuThem=thuThem;match.ghiChuThem=ghiChu;
        match.losers=selected.map(s=>({memberId:s.memberId,paid:s.paid}));
        match.winners=winners;
      }
    } else {
      const newId=(_S.nextMaid||1);
      _S.matches.push({id:newId,date,monthIdx:mi,year:yr,thuThem,ghiChuThem:ghiChu,
        losers:selected.map(s=>({memberId:s.memberId,paid:s.paid})),winners});
      _S.nextMaid=newId+1;
    }
    _openMonths.clear(); // chỉ một tháng mở
    _openMonths.add(mi); // mở tháng vừa thêm/sửa trận
    await window._saveS?.(_S);
    if (signal.aborted) return;
    _lastSavedS = JSON.parse(JSON.stringify(_S));
    setBiaPending(false);
    closeMatchModal();
    if(yr!==_year){ _year=yr; updateYearUI(); } // trận thuộc năm khác → chuyển sang xem năm đó
    renderPage(_S);
  });

  // ── Accordion ────────────────────────────────────────────
  function renderAccordion(S) {
    const members=(S.members||[]).filter(m=>m.status!=='left');
    const matches=getYearMatches(S);
    const isAdmin=window._isLoggedIn?.();
    const accordion=document.getElementById('month-accordion');
    accordion.innerHTML='';
    let hasAny=false;

    MONTHS.forEach((mn,mi)=>{
      // Sắp xếp toàn bộ trận trong năm theo ngày tăng dần → tính rank
      const allSorted = matches.slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
      const rankMap = {};
      allSorted.forEach((m, i) => { rankMap[m.id] = i + 1; });

      const monthMatches = matches.filter(m=>m.monthIdx===mi)
        .sort((a,b)=>(a.date||'').localeCompare(b.date||'')); // ASC
      if(!monthMatches.length&&!isAdmin) return;
      hasAny=true;
      const isOpen=_openMonths.has(mi);
      let thuBiaMo=0,thuThemMo=0,noBiaMo=0;
      monthMatches.forEach(m=>{(m.losers||[]).forEach(l=>{if(l.paid)thuBiaMo+=FINE;else noBiaMo+=FINE;});thuThemMo+=(m.thuThem||0);});
      const tongMo=thuBiaMo+thuThemMo;

      // Desktop: nút thêm trận nằm cùng dòng chip tóm tắt (bên phải); điện thoại vẫn ở cuối danh sách
      const addInline=isAdmin?`<button class="btn btn-outline btn-sm month-add-inline" type="button" onclick="openAddMatch(${mi})">
          <iconify-icon icon="solar:add-circle-linear" style="font-size:16px"></iconify-icon>Thêm trận</button>`:'';
      const summaryChips=(monthMatches.length||addInline)?`<div class="month-summary-chips${monthMatches.length?'':' is-empty'}">
        ${monthMatches.length?`<span class="month-chip">${monthMatches.length} trận</span>`:'<span style="font-size:13px;color:var(--text-muted)">Chưa có trận nào</span>'}
        ${monthMatches.length?`<span class="month-chip month-chip--total" title="Tổng thu tháng"><span class="chip-full">Σ: ${fmtK(tongMo)}</span><span class="chip-short">Σ ${chipK(tongMo)}</span></span>`:''}
        ${thuThemMo?`<span class="month-chip month-chip--extra" title="Thu thêm"><span class="chip-full">Thêm: +${fmtK(thuThemMo)}</span><span class="chip-short">Thêm ${chipK(thuThemMo)}</span></span>`:''}
        ${noBiaMo?`<span class="month-chip month-chip--debt" title="Còn nợ"><span class="chip-full">Nợ: ${fmtK(noBiaMo)}</span><span class="chip-short">Nợ ${chipK(noBiaMo)}</span></span>`:''}
        ${addInline}
      </div>`:'';

      const matchesHTML=monthMatches.map(match=>{
        const losersHTML=(match.losers||[]).map(l=>{
          const member=members.find(m=>m.id==l.memberId);
          const cls=l.paid?'loser-paid':'loser-unpaid';
          const icon=l.paid?'solar:check-circle-linear':'solar:close-circle-linear';
          const ca=isAdmin?`onclick="togglePaid(${match.id},${l.memberId})" style="cursor:pointer"`:'';
          return `<span class="loser-chip ${cls}" ${ca}><iconify-icon icon="${icon}" style="font-size:13px"></iconify-icon>${member?.name||'?'}</span>`;
        }).join('');
        const winnerIds=getWinnerIds(match);
        const winnersHTML=winnerIds.map(memberId=>{
          const member=members.find(m=>m.id==memberId);
          return member?`<span class="winner-chip"><iconify-icon icon="solar:cup-star-linear" style="font-size:13px"></iconify-icon>${member.name}</span>`:'';
        }).join('');
        // Không chọn ai thua và không ai thắng → trận hoà
        const isDraw=!(match.losers||[]).length&&!winnerIds.length;
        const paidCount=(match.losers||[]).filter(l=>l.paid).length;
        const biaMo=paidCount*FINE;
        const noBiaTran=(match.losers||[]).filter(l=>!l.paid).length*FINE;
        const extraHTML=match.thuThem?`<div class="match-item__extra">🎁 Thu thêm: +${fmtK(match.thuThem)}${match.ghiChuThem?` — ${match.ghiChuThem}`:''}</div>`:'';
        const adminBtns=isAdmin?`<div style="display:flex;gap:4px;margin-left:auto">
          <button class="btn btn-icon btn-ghost" onclick="openEditMatch(${match.id})" title="Sửa" style="color:var(--color-primary);width:36px;height:36px"><iconify-icon icon="solar:pen-2-linear" style="font-size:16px"></iconify-icon></button>
          <button class="btn btn-icon btn-ghost" onclick="deleteMatch(${match.id})" title="Xoá" style="color:var(--text-muted);width:36px;height:36px"><iconify-icon icon="solar:trash-bin-trash-linear" style="font-size:16px"></iconify-icon></button>
        </div>`:'';
        return `<div class="match-item fade-in">
          <div class="match-item__header">
            <div class="match-item__num">#${rankMap[match.id]||'?'}</div>
            <div class="match-item__date">${fmtDate(match.date)}</div>
            ${adminBtns}
          </div>
          ${isDraw?`<div class="match-item__team-row">
            <div class="match-item__team-label">Kết quả</div>
            <div class="match-item__losers"><span class="draw-chip">Hoà</span></div>
          </div>`:`<div class="match-item__team-row">
            <div class="match-item__team-label">Đội thua</div>
            <div class="match-item__losers">${losersHTML||'<span style="font-size:12px;color:var(--text-muted)">Chưa chọn</span>'}</div>
          </div>`}
          ${winnersHTML?`<div class="match-item__team-row">
            <div class="match-item__team-label">Đội thắng</div>
            <div class="match-item__losers">${winnersHTML}</div>
          </div>`:''}
          ${extraHTML}
          ${isDraw?(match.thuThem?`<div class="match-item__summary">Thu thêm: +${fmtK(match.thuThem)}</div>`:''):`<div class="match-item__summary">Quỹ bia: ${fmtK(biaMo)}${noBiaTran?` · <span style="color:var(--color-primary)">Nợ: ${fmtK(noBiaTran)}</span>`:''}${match.thuThem?` · Thu thêm: +${fmtK(match.thuThem)}`:''}</div>`}
        </div>`;
      }).join('');

      const addBtn=isAdmin?`<div class="month-add-wrap month-add-wrap--end">
        <button class="btn btn-outline w-full" onclick="openAddMatch(${mi})" style="justify-content:center;">
          <iconify-icon icon="solar:add-circle-linear" style="font-size:18px"></iconify-icon>Thêm trận ${MONTHS_FULL[mi]}
        </button>
      </div>`:'';

      const card=document.createElement('div');
      card.className=`month-accordion-card${isOpen?' is-open':''}`;
      card.dataset.mi=mi;
      card.innerHTML=`
        <div class="month-accordion-header" onclick="toggleAccordion(${mi})" role="tab" aria-selected="${isOpen}">
          <span class="month-accordion-title" aria-label="${MONTHS_FULL[mi]}"><span class="mg-long">Tháng</span><span class="mg-short">Th</span> ${mi+1}</span>
          <iconify-icon icon="solar:alt-arrow-down-linear" class="month-accordion-chevron"></iconify-icon>
        </div>
        <div class="month-accordion-body">
          ${summaryChips}
          <div style="display:flex;flex-direction:column;gap:10px">${matchesHTML}</div>
          ${addBtn}
        </div>`;
      accordion.appendChild(card);
    });

    if(!hasAny) {
      accordion.innerHTML=`<div class="month-empty" style="text-align:center;color:var(--text-muted);padding:48px 0">
        <iconify-icon icon="solar:cup-star-linear" style="font-size:48px;opacity:.3"></iconify-icon>
        <div style="margin-top:12px">Chưa có trận nào trong năm ${_year}</div>
      </div>`;
    }
    layoutMonthGrid();
  }

  // Xếp lưới tháng: ô tháng thứ i có order = 2i; khung trận của tháng đang mở
  // chèn ngay sau hàng chứa tháng đó (order = 2 × ô cuối hàng + 1), các hàng
  // sau bị đẩy xuống dưới khung.
  function layoutMonthGrid(){
    const grid=document.getElementById('month-accordion');
    if(!grid) return;
    // Thu cửa sổ từ desktop (mở nhiều tháng) về điện thoại (kiểu tab): giữ một tháng
    if(_openMonths.size>1){
      const keep=Math.max(..._openMonths); _openMonths.clear(); _openMonths.add(keep);
      grid.querySelectorAll('.month-accordion-card').forEach(c=>c.classList.toggle('is-open', Number(c.dataset.mi)===keep));
    }
    const cols=getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length||3;
    const headers=[...grid.querySelectorAll('.month-accordion-header')];
    headers.forEach((h,i)=>{ h.style.order=String(i*2); });
    grid.querySelectorAll('.month-accordion-card').forEach(card=>{
      const h=card.querySelector('.month-accordion-header'), body=card.querySelector('.month-accordion-body');
      const i=headers.indexOf(h); if(i<0||!body) return;
      const rowEnd=Math.min(Math.floor(i/cols)*cols+cols-1, headers.length-1);
      body.style.order=String(rowEnd*2+1);
      const col=i%cols;
      body.dataset.col = col===0 ? 'first' : col===cols-1 ? 'last' : 'mid';
      h.dataset.col = body.dataset.col;
    });
  }
  window.addEventListener('resize', layoutMonthGrid, { signal });

  // Mỗi lần chỉ mở một tháng (kiểu tab); bấm lại tháng đang mở thì đóng
  const isMonthTabs=()=>true; // lưới tháng kiểu tab trên mọi cỡ màn hình: mỗi lần một tháng
  window.toggleAccordion=function(mi){
    const wasOpen=_openMonths.has(mi);
    if(isMonthTabs()) _openMonths.clear(); else _openMonths.delete(mi);
    if(!wasOpen)_openMonths.add(mi);
    document.querySelectorAll('.month-accordion-card').forEach(card=>{
      const open=_openMonths.has(Number(card.dataset.mi));
      card.classList.toggle('is-open',open);
      card.querySelector('.month-accordion-header')?.setAttribute('aria-selected',String(open));
    });
    layoutMonthGrid();
  };

  function renderPage(S) {
    _S=S;
    const members=(S.members||[]).filter(m=>m.status!=='left');
    const matches=getYearMatches(S);
    let thuBia=0,noBia=0; const nguoiNoSet=new Set();
    matches.forEach(m=>{
      (m.losers||[]).forEach(l=>{if(l.paid)thuBia+=FINE;});
      thuBia+=(m.thuThem||0);
    });
    // Còn nợ / Người còn nợ: cộng dồn các trận thua chưa nộp từ năm gốc tới năm đang xem
    (S.matches||[]).filter(m=>window._fcFinance.matchYear(m)<=_year).forEach(m=>{
      (m.losers||[]).forEach(l=>{if(!l.paid){noBia+=FINE;nguoiNoSet.add(l.memberId);}});
    });
    document.getElementById('kpi-thu-bia').textContent=fmt(thuBia);
    document.getElementById('kpi-con-no').textContent=fmt(noBia);
    document.getElementById('kpi-so-tran').textContent=matches.length;
    document.getElementById('kpi-nguoi-no').textContent=nguoiNoSet.size;
    // Xếp hạng & chuỗi phong độ đã chuyển sang trang Thống kê (thong-ke.html)
    renderAccordion(S);
  }


  window.deleteMatch = function(matchId) {
    if(!window._isLoggedIn?.()||!_S) return;
    const match = (_S.matches||[]).find(m=>m.id==matchId);
    const dateLabel = match?.date ? match.date.split('-').reverse().join('/') : `#${matchId}`;

    // Hiện confirm modal
    const old = document.getElementById('delete-confirm-modal');
    if(old) old.remove();
    const backdrop = document.createElement('div');
    backdrop.id = 'delete-confirm-modal';
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal fade-in" style="max-width:380px">
        <div class="modal-handle"></div>
        <div style="text-align:center;margin-bottom:20px">
          <div style="width:56px;height:56px;border-radius:var(--radius-full);background:rgba(224,57,44,.12);
            border:1.5px solid rgba(224,57,44,.3);display:flex;align-items:center;justify-content:center;
            margin:0 auto 16px;font-size:24px">
            <iconify-icon icon="solar:trash-bin-trash-linear" style="color:var(--color-accent-light)"></iconify-icon>
          </div>
          <div style="font-size:17px;font-weight:700;margin-bottom:6px">Xoá trận đấu?</div>
          <div style="font-size:13px;color:var(--text-secondary)">
            Trận ngày <strong style="color:var(--text-primary)">${dateLabel}</strong> sẽ bị xoá vĩnh viễn và không thể khôi phục.
          </div>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-cancel btn-surface w-full" id="btn-delete-cancel" style="justify-content:center">Huỷ</button>
          <button class="btn btn-primary w-full" id="btn-delete-confirm" style="justify-content:center;background:var(--color-accent);color:#fff">
            <iconify-icon icon="solar:trash-bin-trash-linear" style="font-size:16px;color:#fff"></iconify-icon>
            Xoá
          </button>
        </div>
      </div>`;

    document.body.appendChild(backdrop);
    window._lockScroll?.();

    const close = () => { backdrop.remove(); window._unlockScroll?.(); };
    backdrop.addEventListener('click', e => { if(e.target===backdrop) close(); });
    document.getElementById('btn-delete-cancel').addEventListener('click', close);
    document.getElementById('btn-delete-confirm').addEventListener('click', async () => {
      _S.matches = (_S.matches||[]).filter(m=>m.id!=matchId);
      await window._saveS?.(_S);
      if (signal.aborted) return;
      close();
      renderPage(_S);
    });
  };

  function updateYearUI(){
    const sel=document.getElementById('year-select');
    if(sel){
      const curY=new Date().getFullYear(),minY=BASE_YEAR,maxY=Math.max(curY,BASE_YEAR); // tới năm hiện tại, không +1
      sel.innerHTML='';
      for(let y=maxY;y>=minY;y--){const opt=document.createElement('option');opt.value=y;opt.textContent=y;if(y===_year)opt.selected=true;sel.appendChild(opt);}
      sel.disabled = sel.options.length <= 1; // chỉ một năm thì không mở danh sách
    }
    window._currentYear=_year;
  }

  window.onComponentsReady=function(){
    updateYearUI();
    document.getElementById('year-select')?.addEventListener('change',e=>{
      _year=parseInt(e.target.value)||BASE_YEAR; updateYearUI(); if(_S) renderPage(_S);
    });
  };
  window._onDataReady=function(S){
    _lastSavedS = JSON.parse(JSON.stringify(S));
    renderPage(JSON.parse(JSON.stringify(S)));
  };
  window._onAuthChange=function(){if(_S)renderPage(_S);};
};
