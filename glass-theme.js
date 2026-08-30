/* ============================================================
 * Glass Ambient Theme - HighFish API DB
 * Self-contained: injiziert CSS, Ambient-Blobs und den
 * Theme-Button "Glass Ambient" zur Laufzeit und erweitert
 * window.setTheme um das Theme "glass".
 *
 * Einbindung in index.html (eine Zeile vor </body>):
 *   <script src="glass-theme.js"></script>
 * ============================================================ */
(function () {
    'use strict';

    var GLASS_VARS = {
        '--bg-color': '#0b0e17',
        '--text-color': '#e6e9f2',
        '--card-bg': 'rgba(18,23,41,0.85)',
        '--card-border': 'rgba(124,92,255,0.25)',
        '--accent': '#7c5cff',
        '--accent-2': '#ff5c8a',
        '--input-bg': 'rgba(11,14,23,0.6)',
        '--muted': '#8b93b0',
        '--muted-2': '#b8bdd6',
        '--drawer-bg': 'rgba(18,23,41,0.92)',
        '--surface-2': 'rgba(124,92,255,0.12)',
        '--surface-2-hover': 'rgba(124,92,255,0.22)',
        '--surface-glow': 'rgba(124,92,255,0.15)',
        '--glow-strong': 'rgba(124,92,255,0.35)'
    };

    var GLASS_CSS = `
/* ===== Glass Ambient ===== */
.ambient-blobs { display: none; }
body.glass-ambient .ambient-blobs { display: block; }
.ambient-blobs .blob { position: fixed; border-radius: 50%; filter: blur(60px); pointer-events: none; z-index: 0; opacity: .55; will-change: transform; }
.ambient-blobs .b1 { width: 45vmax; height: 45vmax; top: -12vmax; left: -10vmax; background: radial-gradient(circle at 30% 30%, #7c5cff, transparent 65%); animation: blobFloat1 18s ease-in-out infinite; }
.ambient-blobs .b2 { width: 40vmax; height: 40vmax; bottom: -14vmax; right: -8vmax; background: radial-gradient(circle at 60% 40%, #ff5c8a, transparent 65%); animation: blobFloat2 22s ease-in-out -6s infinite; }
.ambient-blobs .b3 { width: 34vmax; height: 34vmax; top: 30%; left: 55%; background: radial-gradient(circle at 50% 50%, #24d1c4, transparent 60%); animation: blobFloat3 26s ease-in-out -12s infinite; }
@keyframes blobFloat1 { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(6vmax, 4vmax) scale(1.12); } }
@keyframes blobFloat2 { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-5vmax,-6vmax) scale(1.08); } }
@keyframes blobFloat3 { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-4vmax, 5vmax) scale(1.15); } }
@media (prefers-reduced-motion: reduce) { .ambient-blobs .blob { animation: none; } }

body.glass-ambient { --accent-3: #24d1c4; --accent-4: #ffb84c; }
body.glass-ambient #mainContent, body.glass-ambient #loginScreen { position: relative; z-index: 1; }
body.glass-ambient header,
body.glass-ambient .modal-content,
body.glass-ambient .api-card,
body.glass-ambient .drawer {
    background: rgba(18,23,41,0.85);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    border: 1px solid rgba(255,255,255,0.08);
}
body.glass-ambient .modal-content { border-radius: 22px; box-shadow: 0 24px 60px rgba(0,0,0,0.45); }
body.glass-ambient .api-card { border-radius: 14px; }
body.glass-ambient button, body.glass-ambient .btn-primary { border-radius: 999px; transition: transform .18s ease, box-shadow .18s ease; }
body.glass-ambient button:hover, body.glass-ambient .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 22px var(--glow-strong); }
body.glass-ambient input, body.glass-ambient select, body.glass-ambient textarea { border-radius: 10px; }
body.glass-ambient input:focus, body.glass-ambient select:focus, body.glass-ambient textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--surface-glow), 0 0 18px var(--glow-strong); outline: none; }
body.glass-ambient h1 { background: linear-gradient(135deg, var(--accent), var(--accent-2), var(--accent-3)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
body.glass-ambient a { color: var(--accent-3); }

@media (max-width: 900px) { body.glass-ambient .api-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) {
    body.glass-ambient .api-grid { grid-template-columns: 1fr; }
    body.glass-ambient .drawer { transform: translateX(-100%); transition: transform .3s ease; }
    body.glass-ambient .drawer.active { transform: translateX(0); }
}
`;

    function injectCSS() {
        if (document.getElementById('glass-ambient-css')) return;
        var style = document.createElement('style');
        style.id = 'glass-ambient-css';
        style.textContent = GLASS_CSS;
        document.head.appendChild(style);
    }

    function injectBlobs() {
        if (document.querySelector('.ambient-blobs') || !document.body) return;
        var wrap = document.createElement('div');
        wrap.className = 'ambient-blobs';
        wrap.setAttribute('aria-hidden', 'true');
        wrap.innerHTML = '<span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span>';
        document.body.prepend(wrap);
    }

    function applyGlassVars() {
        for (var k in GLASS_VARS) {
            if (GLASS_VARS.hasOwnProperty(k)) {
                document.documentElement.style.setProperty(k, GLASS_VARS[k]);
            }
        }
    }

    var origSetTheme = null;
    var wrapped = false;

    function wrapSetTheme() {
        if (wrapped || typeof window.setTheme !== 'function') return;
        origSetTheme = window.setTheme;
        window.setTheme = function (name) {
            if (name === 'glass') {
                document.body.classList.remove('saas-market');
                document.body.classList.add('glass-ambient');
                applyGlassVars();
                try { localStorage.setItem('hf_theme', 'glass'); } catch (e) {}
                if (typeof allAPIs !== 'undefined' && allAPIs.length > 0 && typeof renderAPIs === 'function') {
                    renderAPIs(allAPIs);
                }
                return;
            }
            document.body.classList.remove('glass-ambient');
            origSetTheme(name);
        };
        wrapped = true;
    }

    function restoreIfGlass() {
        try {
            if (wrapped && localStorage.getItem('hf_theme') === 'glass') {
                window.setTheme('glass');
            }
        } catch (e) {}
    }

    function ensureGlassButton() {
        var lists = document.querySelectorAll('.theme-options');
        lists.forEach(function (opts) {
            if (opts.querySelector('[data-glass-btn]')) return;
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn-primary';
            b.setAttribute('data-glass-btn', '1');
            b.textContent = 'Glass Ambient';
            b.addEventListener('click', function () { window.setTheme('glass'); });
            opts.appendChild(b);
        });
    }

    function boot() {
        injectCSS();
        injectBlobs();
        wrapSetTheme();
        ensureGlassButton();
        restoreIfGlass();
    }

    var observer = new MutationObserver(function () { ensureGlassButton(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    // Fallback, falls window.setTheme erst nach diesem Skript definiert wird
    var wrapRetry = setInterval(function () {
        if (wrapped) { clearInterval(wrapRetry); return; }
        wrapSetTheme();
        if (wrapped) {
            clearInterval(wrapRetry);
            restoreIfGlass();
        }
    }, 100);
    setTimeout(function () { clearInterval(wrapRetry); }, 10000);
})();
