(() => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Mobile nav toggle
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('landingNav');
  if (toggle && nav) toggle.addEventListener('click', () => nav.classList.toggle('open'));

  // Theme toggle (persist to localStorage)
  const THEME_KEY = 'rcs-theme';
  const themeBtn = document.getElementById('themeToggle');
  const root = document.documentElement;
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === 'dark') root.setAttribute('data-theme', 'dark');
  if (themeBtn) {
    const syncIcon = () => {
      const isDark = root.getAttribute('data-theme') === 'dark';
      themeBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    };
    syncIcon();
    themeBtn.addEventListener('click', () => {
      const isDark = root.getAttribute('data-theme') === 'dark';
      if (isDark) {
        root.removeAttribute('data-theme');
        localStorage.setItem(THEME_KEY, 'light');
      } else {
        root.setAttribute('data-theme', 'dark');
        localStorage.setItem(THEME_KEY, 'dark');
      }
      syncIcon();
    });
  }

  // Configure YouTube URL here (can be overridden by ?video= URL param)
  const params = new URLSearchParams(location.search);
  const PARAM_VIDEO = params.get('video');
  const PARAM_LOGIN = params.get('login');
  let YT_URL = 'https://youtu.be/dQw4w9WgXcQ'; // Sample; override via ?video= or edit here

  const ytBtn = document.getElementById('btnYoutube');
  const ytFrame = document.getElementById('ytFrame');
  if (PARAM_VIDEO) YT_URL = PARAM_VIDEO;
  if (ytBtn) ytBtn.href = YT_URL;

  // If provide a youtube watch URL, extract id for embed
  function toEmbedUrl(url) {
    try {
      if (!url || url === '#') return '';
      const u = new URL(url);
      let id = '';
      if (u.hostname.includes('youtu.be')) {
        id = u.pathname.replace('/', '');
      } else if (u.searchParams.get('v')) {
        id = u.searchParams.get('v');
      }
      return id ? `https://www.youtube.com/embed/${id}` : '';
    } catch (_) {
      return '';
    }
  }

  const embed = toEmbedUrl(YT_URL);
  if (ytFrame && embed) ytFrame.src = embed;

  // Allow overriding login destination via ?login= URL param
  if (PARAM_LOGIN) {
    document.querySelectorAll('a[href="../index.html"]').forEach((a) => {
      a.href = PARAM_LOGIN;
    });
  }

  // Members data (edit this list or supply via JSON)
  const TEAM_MEMBERS = [
    {
      name: 'Đoàn Thanh Nghĩa',
      role: 'Lead Developer',
      avatar: '../assets/team/a.jpg',
      github: 'https://github.com/nghidt3a',
      facebook: 'https://www.facebook.com/dtnghia2006',
      email: 'dtnghia20062006@gmail.com'
    },
    {
      name: 'Mai Hoàng Nhật',
      role: 'Backend Developer',
      avatar: '../assets/team/b.jpg',
      github: 'https://github.com/hoazgnhatt1307',
      facebook: 'https://www.facebook.com/hoang.nhat.224303',
      email: 'mhn130706@gmail.com'
    }
  ];

  const fallbackAvatar = (name) => {
    const n = (name || 'User').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
    const svg = encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'>` +
      `<rect width='100%' height='100%' fill='%23e2e8f0'/>` +
      `<text x='50%' y='50%' dy='.35em' text-anchor='middle' font-family='Inter, Arial' font-size='96' fill='%2364748b'>${n}</text>` +
      `</svg>`
    );
    return `data:image/svg+xml;charset=UTF-8,${svg}`;
  };

  function renderMembers(list) {
    const grid = document.getElementById('membersGrid');
    if (!grid) return;
    grid.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'text-center text-secondary';
      empty.textContent = 'Chưa có dữ liệu thành viên. Cập nhật TEAM_MEMBERS trong main.js';
      grid.appendChild(empty);
      return;
    }
    list.forEach((m) => {
      const card = document.createElement('article');
      card.className = 'member-card card';

      const img = document.createElement('img');
      img.className = 'member-avatar';
      img.alt = m.name || 'Thành viên';
      img.loading = 'lazy';
      img.src = m.avatar || fallbackAvatar(m.name);
      img.onerror = () => { img.onerror = null; img.src = fallbackAvatar(m.name); };
      card.appendChild(img);

      const body = document.createElement('div');
      body.className = 'card-body text-center';

      const h3 = document.createElement('h3');
      h3.className = 'h6 fw-bold mb-1';
      h3.textContent = m.name || 'Thành viên';
      body.appendChild(h3);

      const p = document.createElement('p');
      p.className = 'text-secondary small mb-3';
      p.textContent = m.role || '';
      body.appendChild(p);

      const actions = document.createElement('div');
      actions.className = 'd-flex justify-content-center gap-2';
      if (m.github) {
        const a = document.createElement('a');
        a.className = 'btn btn-outline-primary btn-sm';
        a.href = m.github; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'GitHub';
        actions.appendChild(a);
      }
      if (m.facebook) {
        const a = document.createElement('a');
        a.className = 'btn btn-outline-secondary btn-sm';
        a.href = m.facebook; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Facebook';
        actions.appendChild(a);
      }
      if (m.email) {
        const a = document.createElement('a');
        a.className = 'btn btn-outline-secondary btn-sm';
        a.href = `mailto:${m.email}`;
        a.textContent = 'Email';
        actions.appendChild(a);
      }

      body.appendChild(actions);
      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  // Attempt to load from JSON first (override with ?data=<url_or_path>)
  const PARAM_DATA = params.get('data');
  const dataSrc = PARAM_DATA || '../js/data/team.json';
  const tryLoadJson = async () => {
    try {
      const res = await fetch(dataSrc, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        renderMembers(data);
        return;
      }
      renderMembers(TEAM_MEMBERS);
    } catch (e) {
      renderMembers(TEAM_MEMBERS);
    }
  };

  tryLoadJson();

  // Simple reveal on scroll (respect reduced motion)
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReduced) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
  }
})();
