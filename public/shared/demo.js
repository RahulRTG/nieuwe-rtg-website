/* ============================================================================
   RTG demo — maakt van de site één zichtbare, veilige demo.

   - Toont een vaste "DEMO"-strip zodat een bezoeker altijd ziet dat dit een
     demonstratie is: geen echte betaling, geen echte bestelling.
   - Biedt RTGDemo.badge(tekst) en RTGDemo.toast(tekst) voor apps om bij een
     gesimuleerde betaling/bestelling kort te bevestigen dat er niets echt is
     gebeurd.
   - Leest ?demo(=tier) uit de URL zodat een app zichzelf automatisch kan
     inloggen vanuit de demo-hub (de app luistert naar RTGDemo.autologin).
   Deze module verandert niets aan de data; ze labelt en informeert alleen.
   ========================================================================== */
(function () {
  const q = new URLSearchParams(location.search);
  const RTGDemo = {
    on: true,                               // de hele site draait als demo
    // ?demo, ?demo=1 of ?demo=business|rtg|lifestyle|guest
    autologin: q.has('demo') ? (['rtg', 'lifestyle', 'business', 'guest'].includes(q.get('demo')) ? q.get('demo') : true) : null,

    injectStyles() {
      if (document.getElementById('rtg-demo-styles')) return;
      const s = document.createElement('style');
      s.id = 'rtg-demo-styles';
      s.textContent = `
      .rtg-demo-bar{
        position:fixed; top:0; left:0; right:0; z-index:100000;
        display:flex; align-items:center; justify-content:center; gap:0.6rem;
        height:26px; padding:0 0.8rem;
        background:repeating-linear-gradient(135deg,#7F1634 0 14px,#9E1C40 14px 28px);
        color:#fff; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        font-size:0.66rem; font-weight:600; letter-spacing:0.14em; text-transform:uppercase;
        box-shadow:0 2px 10px rgba(0,0,0,0.25);
      }
      .rtg-demo-bar b{ letter-spacing:0.22em; }
      .rtg-demo-bar .sep{ opacity:0.55; }
      .rtg-demo-bar .thin{ font-weight:500; letter-spacing:0.04em; text-transform:none; opacity:0.92; }
      /* de vaste balk mag niets overlappen: duw de pagina 26px omlaag */
      html.rtg-demo-pushed{ scroll-padding-top:26px; }
      html.rtg-demo-pushed body{ padding-top:26px; }
      /* zwevende knoppen (taal/thema) een tikje omhoog zodat ze vrij blijven */
      html.rtg-demo-pushed .rtg-lang-switch{ bottom:14px; }
      @media print{ .rtg-demo-bar{ display:none; } html.rtg-demo-pushed body{ padding-top:0; } }

      /* klein "gesimuleerd" label dat apps naast een bedrag/knop kunnen zetten */
      .rtg-demo-badge{
        display:inline-flex; align-items:center; gap:0.35rem;
        background:rgba(127,22,52,0.12); color:#7F1634;
        border:1px solid rgba(127,22,52,0.30); border-radius:999px;
        padding:0.12rem 0.55rem; font-size:0.64rem; font-weight:600;
        letter-spacing:0.08em; text-transform:uppercase; vertical-align:middle;
      }
      :root[data-thema="donker"] .rtg-demo-badge{ color:#E88AA2; background:rgba(194,58,94,0.16); border-color:rgba(194,58,94,0.4); }

      .rtg-demo-toast{
        position:fixed; left:50%; bottom:64px; transform:translateX(-50%) translateY(12px);
        z-index:100001; max-width:min(92vw,420px);
        background:#0C0C0B; color:#fff; border:1px solid rgba(255,255,255,0.14);
        border-radius:12px; padding:0.75rem 1rem; font-family:'Inter',sans-serif;
        font-size:0.86rem; line-height:1.4; text-align:center;
        box-shadow:0 18px 50px rgba(0,0,0,0.45);
        opacity:0; pointer-events:none; transition:opacity .25s, transform .25s;
      }
      .rtg-demo-toast .k{ display:block; font-size:0.64rem; font-weight:700; letter-spacing:0.16em;
        text-transform:uppercase; color:#C23A5E; margin-bottom:0.2rem; }
      .rtg-demo-toast.show{ opacity:1; transform:translateX(-50%) translateY(0); }
      `;
      (document.head || document.documentElement).appendChild(s);
    },

    buildBar() {
      if (!this.on || document.getElementById('rtg-demo-bar')) return;
      document.documentElement.classList.add('rtg-demo-pushed');
      const bar = document.createElement('div');
      bar.id = 'rtg-demo-bar';
      bar.className = 'rtg-demo-bar';
      bar.innerHTML = '<b>Demo</b><span class="sep">·</span>' +
        '<span class="thin">Rahul Travel Group — geen echte betaling of bestelling</span>';
      document.body.appendChild(bar);
    },

    /* Een klein "Gesimuleerd"-label dat een app inline kan tonen. */
    badge(text) {
      return '<span class="rtg-demo-badge">◆ ' + (text || 'Demo') + '</span>';
    },

    _toastTimer: null,
    toast(msg, kicker) {
      let el = document.getElementById('rtg-demo-toast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'rtg-demo-toast';
        el.className = 'rtg-demo-toast';
        document.body.appendChild(el);
      }
      el.innerHTML = '<span class="k">' + (kicker || 'Demo — niets is echt gebeurd') + '</span>' + msg;
      requestAnimationFrame(() => el.classList.add('show'));
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => el.classList.remove('show'), 3600);
    },

    init() {
      this.injectStyles();
      if (document.body) this.buildBar();
      else document.addEventListener('DOMContentLoaded', () => this.buildBar());
    }
  };

  window.RTGDemo = RTGDemo;
  RTGDemo.init();
})();
