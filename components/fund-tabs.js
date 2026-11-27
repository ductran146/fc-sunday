// Hai quỹ dùng chung một tài liệu khi đổi tab. Chỉ thay nội dung và controller.
(() => {
  const links = [...document.querySelectorAll('.fund-tab')];
  const routes = new Map(links.map(link => [link.pathname, link.pathname.split('/').pop().replace('.html', '')]));
  let active = document.body.dataset.active;
  let controller;
  let navigation = 0;
  const templates = new Map();

  function mountPanel(key) {
    controller = new AbortController();
    window._fundPanels[key](controller.signal);
  }

  function loadPanel(url) {
    const key = url.pathname;
    if (!templates.has(key)) {
      const request = fetch(url).then(async response => {
        if (!response.ok) throw new Error('Không tải được tab thu quỹ');
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const page = doc.getElementById('page-content');
        const style = doc.querySelector('[data-fund-style]');
        if (!page || !style || doc.body.dataset.active !== routes.get(key)) {
          throw new Error('Nội dung tab thu quỹ không hợp lệ');
        }
        return { page, style, modal: doc.getElementById('match-modal'), title: doc.title };
      }).catch(error => {
        templates.delete(key);
        throw error;
      });
      templates.set(key, request);
    }
    return templates.get(key);
  }

  const initialPage = document.getElementById('page-content');
  const initialStyle = document.querySelector('[data-fund-style]');
  templates.set(location.pathname, Promise.resolve({
    page: initialPage.cloneNode(true),
    style: initialStyle.cloneNode(true),
    modal: document.getElementById('match-modal')?.cloneNode(true),
    title: document.title,
  }));
  mountPanel(active);

  async function switchTab(url, push) {
    const key = routes.get(url.pathname);
    const request = ++navigation;
    if (!key || key === active) return;
    const template = await loadPanel(url).catch(() => null);
    if (request !== navigation) return;
    if (!template) {
      if (push) location.assign(url);
      else location.reload();
      return;
    }

    if (push) history.pushState(null, '', url);
    const direction = key === 'thu-phat' ? 'right' : 'left';
    controller.abort();
    window.DatePicker?.close();
    const deleteModal = document.getElementById('delete-confirm-modal');
    if (deleteModal) {
      deleteModal.remove();
      window._unlockScroll?.();
    }
    document.getElementById('match-modal')?.remove();
    document.querySelector('.thu-thang-toast')?.remove();
    document.querySelector('[data-fund-style]').replaceWith(template.style.cloneNode(true));

    const page = template.page.cloneNode(true);
    document.getElementById('page-content').replaceWith(page);
    if (template.modal) document.body.append(template.modal.cloneNode(true));
    active = key;
    document.body.dataset.active = key;
    document.title = template.title;
    links.forEach(link => {
      const selected = routes.get(link.pathname) === key;
      link.classList.toggle('active', selected);
      if (selected) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    mountPanel(key);
    if (document.body.classList.contains('components-ready')) window.onComponentsReady?.();
    const data = window._getS?.();
    if (data) window._onDataReady?.(data);

    window.scrollTo({ top: 0, behavior: 'instant' });
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      page.animate(
        [{ translate: direction === 'right' ? '100vw' : '-100vw' }, { translate: '0' }],
        { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' }
      );
    }
  }

  links.forEach(link => {
    link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      switchTab(new URL(link.href), true);
    });
  });
  window._switchFundTab = href => switchTab(new URL(href), true);
  window.addEventListener('popstate', () => switchTab(new URL(location.href), false));

  const adjacent = links.find(link => routes.get(link.pathname) !== active);
  if (adjacent) loadPanel(new URL(adjacent.href)).catch(() => {});
})();
