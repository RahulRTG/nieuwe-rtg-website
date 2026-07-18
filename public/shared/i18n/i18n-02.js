      const s = document.createElement('style');
      s.id = 'rtg-i18n-styles';
      s.textContent = `
      .rtg-lang-scrim{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;
        background:rgba(12,12,11,0.72);backdrop-filter:blur(6px);padding:1.5rem;-webkit-font-smoothing:antialiased;}
      .rtg-lang-scrim.open{display:flex;}
      .rtg-lang-card{width:100%;max-width:400px;background:#F7F5F1;color:#0C0C0B;border-radius:20px;
        padding:2.5rem 2rem;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,0.5);
        font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        animation:rtgLangIn .35s cubic-bezier(.2,.8,.2,1);}
      @keyframes rtgLangIn{from{opacity:0;transform:translateY(14px) scale(.97);}to{opacity:1;transform:none;}}
      .rtg-lang-globe{font-size:2.4rem;line-height:1;}
      .rtg-lang-card h2{font-family:'Bodoni Moda',Georgia,serif;font-weight:500;font-size:1.7rem;margin:1rem 0 0.15rem;letter-spacing:-0.01em;color:#0C0C0B;}
      .rtg-lang-card p{color:#66625B;font-size:0.9rem;margin:0 0 1.6rem;}
      .rtg-lang-opts{display:flex;flex-direction:column;gap:0.7rem;max-height:52vh;overflow:auto;padding:2px;}
      .rtg-lang-code{display:inline-block;min-width:2rem;font-size:0.62rem;font-weight:700;letter-spacing:0.06em;
        color:#7F1634;border:1px solid rgba(127,22,52,0.35);border-radius:6px;padding:0.15rem 0.25rem;text-align:center;}
      .rtg-lang-opt{display:flex;align-items:center;gap:0.9rem;width:100%;text-align:left;cursor:pointer;
        background:#fff;border:1px solid #DEDBD5;border-radius:13px;padding:0.95rem 1.1rem;
        font-family:inherit;font-size:1rem;color:#0C0C0B;transition:border-color .18s,background .18s,transform .12s;}
      .rtg-lang-opt:hover{border-color:#7F1634;background:#fff;}
      .rtg-lang-opt:active{transform:scale(0.99);}
      .rtg-lang-opt.rec{border-color:#7F1634;box-shadow:0 0 0 3px rgba(127,22,52,0.08);}
      .rtg-lang-flag{font-size:1.4rem;line-height:1;}
      .rtg-lang-name{font-weight:600;flex:1;}
      .rtg-lang-rec{font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;color:#7F1634;font-weight:600;}
      .rtg-lang-switch{position:fixed;left:14px;bottom:14px;z-index:9990;display:inline-flex;align-items:center;gap:0.35rem;
        background:rgba(12,12,11,0.82);color:#fff;border:1px solid rgba(255,255,255,0.16);border-radius:999px;
        padding:0.42rem 0.8rem;font-family:'Inter',-apple-system,sans-serif;font-size:0.72rem;font-weight:600;
        letter-spacing:0.04em;cursor:pointer;backdrop-filter:blur(8px);box-shadow:0 6px 20px rgba(0,0,0,0.25);
        transition:background .18s;padding-bottom:calc(0.42rem + env(safe-area-inset-bottom,0));}
      .rtg-lang-switch:hover{background:#7F1634;border-color:#7F1634;}
      .rtg-sw-globe{font-size:0.9rem;}
      @media print{.rtg-lang-switch{display:none;}}
      /* Toegankelijkheid: wie in het systeem "beperk beweging" aan heeft, krijgt
         geen animaties of lange overgangen. 0.01ms i.p.v. 0 zodat code die op
         transitionend/animationend wacht gewoon blijft doorlopen. */
      @media (prefers-reduced-motion: reduce){
        *,*::before,*::after{
          animation-duration:.01ms!important;animation-iteration-count:1!important;
          transition-duration:.01ms!important;scroll-behavior:auto!important;
        }
      }
      `;
      document.head.appendChild(s);
    },

    /* De actieve wereldtalen ophalen (Boardroom-schakelaars). Faalt dit (bijv.
       op de noodserver), dan blijven Nederlands en Engels gewoon werken. */
    laadTalen() {
      return fetch('/api/talen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d.talen) && d.talen.length >= 2) {
            WERELD = d.talen;
            this.buildModal(this.chosen ? this.lang : detectDevice()); // kiezer verversen met alle actieve talen
          }
        })
        .catch(() => {});
    },

    init() {
      this.injectStyles();
      let saved = null;
      try { saved = localStorage.getItem(STORE); } catch (e) {}
      const device = detectDevice();
      if (saved && /^[a-z]{2}$/.test(saved)) {
        this.chosen = true;
        this.apply(saved);
      } else {
        this.apply(device);          // meteen in de toesteltaal tonen
        this.buildModal(device);     // en de keuze aanbieden
        this.openModal();
      }
      this.buildSwitch();
      this.laadTalen();
    }
  };

  window.RTGi18n = RTGi18n;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RTGi18n.init());
  } else {
    RTGi18n.init();
  }
})();
