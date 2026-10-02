(() => {
  const splash = document.getElementById('splash');
  const video = document.getElementById('site-video');
  const menuToggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('main-nav');
  const backToTop = document.getElementById('back-to-top');
  const lightbox = document.getElementById('lightbox');
  const lightboxImage = lightbox.querySelector('img');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Let the short brand animation finish before revealing the page.
  splash.addEventListener('animationend', (event) => {
    if (event.animationName === 'splash-away') splash.remove();
  });
  if (reducedMotion) window.setTimeout(() => splash.remove(), 220);

  // Muted inline playback works on current mobile browsers when autoplay is allowed.
  // Keep the poster visible if the browser or device blocks background playback.
  const tryVideoPlayback = () => {
    if (!video || document.hidden) return;
    video.muted = true;
    video.playsInline = true;
    const attempt = video.play();
    if (attempt && typeof attempt.then === 'function') {
      attempt.then(() => video.classList.add('is-playing')).catch(() => video.classList.remove('is-playing'));
    }
  };
  video.addEventListener('playing', () => video.classList.add('is-playing'));
  video.addEventListener('pause', () => {
    if (!document.hidden && !video.ended) video.classList.remove('is-playing');
  });
  video.addEventListener('error', () => video.classList.remove('is-playing'));
  video.addEventListener('loadeddata', tryVideoPlayback, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && video.paused) tryVideoPlayback();
  });
  window.setTimeout(tryVideoPlayback, 100);

  // Mobile navigation.
  const closeNav = () => {
    nav.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Abrir menu');
  };
  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
    menuToggle.setAttribute('aria-label', expanded ? 'Abrir menu' : 'Fechar menu');
    nav.classList.toggle('is-open', !expanded);
  });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeNav));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeNav();
      closeLightbox();
    }
  });

  // Smooth in-page links and active section state.
  const navLinks = [...document.querySelectorAll('.nav-link')];
  const sections = navLinks.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  const sectionObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navLinks.forEach((link) => {
      const isActive = link.getAttribute('href') === `#${visible.target.id}`;
      link.classList.toggle('active', isActive);
      if (isActive) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }, { rootMargin: '-28% 0px -58% 0px', threshold: [0, .15, .4] });
  sections.forEach((section) => sectionObserver.observe(section));

  // Reveal content as it enters the viewport.
  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reducedMotion) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -24px 0px' });
    revealItems.forEach((item) => revealObserver.observe(item));
  } else revealItems.forEach((item) => item.classList.add('is-visible'));

  // Menu category tabs.
  const filterButtons = document.querySelectorAll('.menu-tab');
  const menuCards = document.querySelectorAll('.menu-card');
  filterButtons.forEach((button) => button.addEventListener('click', () => {
    filterButtons.forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    const filter = button.dataset.filter;
    menuCards.forEach((card) => card.classList.toggle('is-filtered', filter !== 'todos' && card.dataset.category !== filter));
  }));

  // Gallery lightbox, including keyboard dismissal and focus return.
  let lastGalleryTrigger = null;
  function closeLightbox() {
    if (!lightbox.classList.contains('is-open')) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    if (lastGalleryTrigger) lastGalleryTrigger.focus();
  }
  document.querySelectorAll('.gallery-item').forEach((item) => item.addEventListener('click', () => {
    lastGalleryTrigger = item;
    const image = item.querySelector('img');
    lightboxImage.src = item.dataset.full;
    lightboxImage.alt = image.alt;
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    lightbox.querySelector('.lightbox-close').focus();
  }));
  lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (event) => { if (event.target === lightbox) closeLightbox(); });

  // Use São Paulo local time for today's opening status and reservation hours.
  const getSaoPauloNow = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  };
  const dayNumber = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const openIntervals = (day) => {
    const intervals = [];
    if (day >= 2 && day <= 6 || day === 0) intervals.push([12 * 60, 15 * 60]);
    if (day >= 2 && day <= 4) intervals.push([19 * 60, 23 * 60]);
    if (day === 5 || day === 6) intervals.push([19 * 60, 24 * 60]);
    return intervals;
  };
  const formatHour = (minutes) => minutes === 24 * 60 ? 'meia-noite' : `${String(Math.floor(minutes / 60)).padStart(2, '0')}h`;
  function updateOpenStatus() {
    const parts = getSaoPauloNow();
    const day = dayNumber[parts.weekday];
    const nowMinutes = Number(parts.hour) * 60 + Number(parts.minute);
    const intervals = openIntervals(day);
    const active = intervals.find(([start, end]) => nowMinutes >= start && nowMinutes < end);
    const label = document.getElementById('open-status');
    const dot = document.getElementById('status-dot');
    if (active) {
      label.textContent = `Aberto agora · fecha às ${formatHour(active[1])}`;
      dot.classList.add('is-open');
      dot.classList.remove('is-closed');
      return;
    }
    let next = null;
    for (let offset = 0; offset < 8; offset += 1) {
      const nextDay = (day + offset) % 7;
      const dayIntervals = openIntervals(nextDay);
      const firstOpening = dayIntervals[0]?.[0];
      if (firstOpening !== undefined && (offset > 0 || firstOpening > nowMinutes)) {
        next = { offset, opening: firstOpening };
        break;
      }
    }
    const when = !next ? 'consulte a equipe' : next.offset === 0 ? `hoje às ${formatHour(next.opening)}` : next.offset === 1 ? `amanhã às ${formatHour(next.opening)}` : `em ${next.offset} dias às ${formatHour(next.opening)}`;
    label.textContent = `Fechado · abre ${when}`;
    dot.classList.add('is-closed');
    dot.classList.remove('is-open');
  }
  updateOpenStatus();
  window.setInterval(updateOpenStatus, 60_000);

  // Keep the reservation form aligned with the selected day and opening times.
  const reservationForm = document.getElementById('reservation-form');
  const dateInput = reservationForm.elements.data;
  const timeSelect = reservationForm.elements.horario;
  const partsNow = getSaoPauloNow();
  dateInput.min = `${partsNow.year}-${partsNow.month}-${partsNow.day}`;
  const populateTimes = () => {
    const previous = timeSelect.value;
    const selected = dateInput.value;
    if (!selected) return;
    const [year, month, date] = selected.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, date, 12)).getUTCDay();
    const intervals = openIntervals(weekday);
    const candidates = intervals.flatMap(([start, end]) => {
      const times = [];
      for (let minute = start; minute < end; minute += 30) times.push(minute);
      return times;
    });
    timeSelect.innerHTML = '<option value="">Selecione</option>';
    candidates.forEach((minute) => {
      const value = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      timeSelect.append(option);
    });
    if (candidates.some((minute) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}` === previous)) timeSelect.value = previous;
  };
  dateInput.addEventListener('change', populateTimes);
  reservationForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!reservationForm.reportValidity()) return;
    const values = new FormData(reservationForm);
    const [year, month, date] = String(values.get('data')).split('-').map(Number);
    const dateLabel = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(Date.UTC(year, month - 1, date, 12)));
    const message = [
      'Ol%C3%A1%2C%20Porto%2060!%20Gostaria%20de%20solicitar%20uma%20reserva%3A',
      `Nome%3A%20${encodeURIComponent(values.get('nome'))}`,
      `Telefone%3A%20${encodeURIComponent(values.get('telefone'))}`,
      `Data%3A%20${encodeURIComponent(dateLabel)}`,
      `Hor%C3%A1rio%3A%20${encodeURIComponent(values.get('horario'))}`,
      `Pessoas%3A%20${encodeURIComponent(values.get('pessoas'))}`
    ].join('%0A');
    window.open(`https://wa.me/5583991235956?text=${message}`, '_blank', 'noopener,noreferrer');
  });

  // Back-to-top button and footer year.
  window.addEventListener('scroll', () => backToTop.classList.toggle('is-visible', window.scrollY > 550), { passive: true });
  backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' }));
  document.getElementById('year').textContent = new Intl.DateTimeFormat('en', { timeZone: 'America/Sao_Paulo', year: 'numeric' }).format(new Date());
})();
