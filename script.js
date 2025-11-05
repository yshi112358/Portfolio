const themeToggle = document.getElementById("theme-toggle");
const root = document.documentElement;

// Persist theme
const storedTheme = localStorage.getItem("theme");
if (storedTheme === "light" || storedTheme === "dark") {
  root.setAttribute("data-theme", storedTheme);
}

function applyLogoForTheme() {
  const img = document.getElementById('logo-img');
  if (!img) return;
  // Determine current theme: attribute > system preference
  const attr = root.getAttribute('data-theme');
  let theme = attr;
  if (!theme) {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  img.src = theme === 'dark' ? 'assets/favicon-black.svg' : 'assets/favicon-white.svg';
}

applyLogoForTheme();

const mediaDark = window.matchMedia('(prefers-color-scheme: dark)');
mediaDark.addEventListener?.('change', applyLogoForTheme);

// toggle

themeToggle?.addEventListener("click", () => {
  const current = root.getAttribute("data-theme");
  const next = current === "light" ? "dark" : "light";
  root.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  applyLogoForTheme();
});

// Intersection Observer for appear animations
const appearNodes = document.querySelectorAll("[data-appear], .card, .section-title");
const io = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      io.unobserve(entry.target);
    }
  }
}, { threshold: 0.2 });

appearNodes.forEach((el) => {
  el.setAttribute("data-appear", "");
  io.observe(el);
});

// Current year
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

// Tag colors: use default SCSS-defined capsule style (no random colors)

// Work modals
(function setupWorkModals() {
  const map = new Map([
    ["intelino", "modal-intelino"],
    ["reimagigate", "modal-reimagigate"],
    ["meowater", "modal-meowater"],
    ["simobe-gtts", "modal-simobe-gtts"],
  ]);

  function open(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function close(modal) {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    // カードまたは祖先に data-open があればモーダルを開く
    const opener = target.closest('[data-open]');
    if (opener && opener instanceof HTMLElement) {
      const openKey = opener.getAttribute('data-open');
      if (openKey && map.has(openKey)) {
        e.preventDefault();
        open(map.get(openKey));
        return;
      }
    }

    // モーダルのクローズ
    if (target.matches('[data-close]')) {
      const modal = target.closest('.modal');
      if (modal) close(modal);
      return;
    }
  });

  // カードにキーボード操作（Enter/Space）でアクセス可能に
  document.addEventListener('keydown', (e) => {
    if (!(e.target instanceof HTMLElement)) return;
    const opener = e.target.closest('[data-open]');
    if (!opener) return;
    if (e.key === 'Enter' || e.key === ' ') {
      const openKey = opener.getAttribute('data-open');
      if (openKey && map.has(openKey)) {
        e.preventDefault();
        open(map.get(openKey));
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal:not([hidden])').forEach((m) => {
        close(m);
      });
    }
  });
})();

// Hero gallery: speed based on image size (Web Animations API)
(function setupHeroGalleryMarquee() {
  const gallery = document.querySelector('.hero-gallery');
  if (!gallery) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  const tracks = Array.from(gallery.querySelectorAll('.track'));

  async function whenImagesReady() {
    const imgs = Array.from(gallery.querySelectorAll('img'));
    await Promise.all(imgs.map(async (img) => {
      if (img.complete && img.naturalWidth > 0) return;
      try { if (img.decode) { await img.decode(); return; } } catch (_) { }
      await new Promise((res) => img.addEventListener('load', res, { once: true }));
    }));
  }

  function pxPerSecondForTrack(track) {
    const imgs = Array.from(track.querySelectorAll('img'));
    if (imgs.length === 0) return 100; // fallback
    const avgHeight = imgs.reduce((s, img) => s + img.getBoundingClientRect().height, 0) / imgs.length;
    // Bigger cards move slightly slower → lower px/s; clamp to practical range
    const pxps = Math.max(60, Math.min(220, avgHeight * 3));
    return pxps / 3; // slow down to half speed
  }

  function ensureSeam(track) {
    // Store ORIGINAL children snapshot once (for deterministic rebuild)
    if (!track.__original) {
      track.__original = Array.from(track.children).map((n) => n.cloneNode(true));
    }
    const originals = track.__original;
    if (originals.length === 0) return { unitWidth: 0 };

    // Build exactly ONE unit to measure its width (includes gaps)
    track.replaceChildren(...originals.map((n) => n.cloneNode(true)));
    const first = track.firstElementChild.getBoundingClientRect();
    const last = track.lastElementChild.getBoundingClientRect();
    const unitWidth = last.right - first.left;

    // Then build exactly TWO units for a perfect 50% loop distance
    const secondUnit = originals.map((n) => n.cloneNode(true));
    track.append(...secondUnit);

    return { unitWidth };
  }

  const runningAnimations = [];

  function start() {
    // Cancel previous
    runningAnimations.forEach((a) => a.cancel());
    runningAnimations.length = 0;

    tracks.forEach((track) => {
      // disable CSS animation if any
      track.style.animation = 'none';

      const { unitWidth } = ensureSeam(track);
      const distance = track.scrollWidth / 2; // move exactly one unit (after cloning we have 2 units)
      const dir = track.classList.contains('reverse') ? 1 : -1; // reverse→right、通常→左
      const pxps = pxPerSecondForTrack(track);
      const duration = Math.max(1000, (distance / pxps) * 1000);

      // Position reset to avoid drift and set initial offset by direction
      const fromX = dir === 1 ? -distance : 0; // rightward starts from -distance to 0
      const toX = dir === 1 ? 0 : -distance;   // leftward starts from 0 to -distance
      track.style.transform = `translateX(${fromX}px)`;
      const anim = track.animate([
        { transform: `translateX(${fromX}px)` },
        { transform: `translateX(${toX}px)` },
      ], {
        duration,
        iterations: Infinity,
        easing: 'linear',
      });
      runningAnimations.push(anim);
    });
  }

  // Kickoff after images are ready, then bind to resize for responsive recalculation
  whenImagesReady().then(() => {
    start();
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(start, 150);
  });

  // Also observe gallery size or content changes (e.g., fonts, image decode)
  const ro = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(start, 50);
  });
  ro.observe(gallery);
})();


