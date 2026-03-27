'use strict';

/* ═══════════════════════════════════════════════════
   ANIMATION ENGINE — performance-first
   • Scroll reveal (IntersectionObserver, unobserves after)
   • Button press ripple
   • Bottom nav spring tap
   • Page slide transition
   • FAB entrance
   • Header shadow on scroll
═══════════════════════════════════════════════════ */

/* ─── 1. SCROLL REVEAL ─── */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const siblings = el.parentElement ? Array.from(el.parentElement.children) : [];
    const idx = Math.min(siblings.indexOf(el), 7);
    const delay = idx * 55;
    setTimeout(() => el.classList.add('visible'), delay);
    revealObserver.unobserve(el);
  });
}, { threshold: 0.07, rootMargin: '0px 0px -20px 0px' });

function revealAll() {
  document.querySelectorAll(
    '.list-item:not(.visible), .job-card:not(.visible), .gizmo-card:not(.visible), .stats .card:not(.visible)'
  ).forEach(el => revealObserver.observe(el));
}

// Watch only the containers that get new children from Firebase
const CONTAINERS = ['stockList', 'jobcontainer', 'gizmos-list'];
CONTAINERS.forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  new MutationObserver(revealAll).observe(el, { childList: true });
});

revealAll();


/* ─── 2. BUTTON RIPPLE ─── */
const rippleCSS = document.createElement('style');
rippleCSS.textContent = `
  @keyframes _ripple { to { transform: scale(3); opacity: 0; } }
  ._rpl {
    position: absolute; border-radius: 50%; pointer-events: none;
    background: rgba(255,255,255,0.15);
    animation: _ripple 0.5s cubic-bezier(0.16,1,0.3,1) forwards;
  }
`;
document.head.appendChild(rippleCSS);

function addRipple(e) {
  const btn = e.currentTarget;
  const r = btn.getBoundingClientRect();
  const size = Math.max(btn.offsetWidth, btn.offsetHeight);
  const span = document.createElement('span');
  span.className = '_rpl';
  span.style.cssText = `width:${size}px;height:${size}px;top:${e.clientY - r.top - size/2}px;left:${e.clientX - r.left - size/2}px`;
  btn.appendChild(span);
  span.addEventListener('animationend', () => span.remove(), { once: true });
}

function attachRipples(root) {
  (root || document).querySelectorAll('button:not([data-rpl])').forEach(btn => {
    btn.dataset.rpl = '1';
    btn.addEventListener('pointerdown', addRipple);
  });
}
attachRipples();

// Observe body for new buttons added dynamically (e.g. "Add Product" in empty state)
new MutationObserver(() => attachRipples()).observe(document.body, { childList: true, subtree: true });


/* ─── 3. BOTTOM NAV SPRING TAP ─── */
document.querySelectorAll('#bottomNav span').forEach(span => {
  span.addEventListener('pointerdown', () => {
    span.style.cssText = 'transform:scale(0.84);transition:transform 0.08s ease';
  });
  span.addEventListener('pointerup', () => {
    span.style.cssText = 'transform:scale(1.1);transition:transform 0.32s cubic-bezier(0.34,1.56,0.64,1)';
    setTimeout(() => { span.style.cssText = ''; }, 340);
  });
  span.addEventListener('pointercancel', () => { span.style.cssText = ''; });
});


/* ─── 4. HEADER SHADOW ON SCROLL ─── */
const header = document.querySelector('header');
let ticking = false;
window.addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(() => {
      if (header) {
        header.style.boxShadow = window.scrollY > 8
          ? '0 1px 0 rgba(255,255,255,0.08), 0 8px 30px rgba(0,0,0,0.55)'
          : '';
      }
      ticking = false;
    });
    ticking = true;
  }
}, { passive: true });


/* ─── 5. PAGE SLIDE TRANSITION ─── */
let lastPage = document.querySelector('.page:not(.hidden)');
window.addEventListener('hashchange', () => {
  const id   = location.hash.replace('#', '') || 'home';
  const next = document.getElementById(id);
  if (!next || next === lastPage) { lastPage = next; return; }

  next.style.cssText = 'opacity:0;transform:translateX(22px);transition:none';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    next.style.cssText = 'opacity:1;transform:none;transition:opacity 0.35s cubic-bezier(0.16,1,0.3,1),transform 0.35s cubic-bezier(0.16,1,0.3,1)';
  }));
  lastPage = next;
  setTimeout(revealAll, 60);
});


/* ─── 6. FAB SPIN-IN ─── */
const fab = document.getElementById('fab');
if (fab) {
  new MutationObserver(() => {
    if (fab.classList.contains('hidden')) return;
    fab.style.cssText = 'transform:scale(0) rotate(-180deg);opacity:0;transition:none';
    requestAnimationFrame(() => {
      fab.style.cssText = 'transform:scale(1) rotate(0deg);opacity:1;transition:transform 0.48s cubic-bezier(0.34,1.56,0.64,1),opacity 0.3s ease';
    });
  }).observe(fab, { attributes: true, attributeFilter: ['class'] });
}
