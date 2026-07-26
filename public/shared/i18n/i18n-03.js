      // De keuze mag nooit de pagina gijzelen: klik ernaast = huidige taal houden.
      scrim.addEventListener('click', e => { if (e.target === scrim) { self.set(self.lang); self.closeModal(); } });
      if (!this._escBound) { // een keer, niet per herbouw
        this._escBound = true;
        document.addEventListener('keydown', e => {
          const m = document.getElementById('rtg-lang-modal');
          if (e.key === 'Escape' && m && m.classList.contains('open')) { this.set(this.lang); this.closeModal(); }
        });
      }
      if (stondOpen) { scrim.classList.add('open'); this._startMond(); }
    },
    // spreken -> tekst (Web Speech API, geen afhankelijkheden). Lukt het niet,
    // dan gebeurt er gewoon niets bijzonders; typen blijft altijd werken.
    _luister(zoek, stelVoor, kies, mic) {
      const R = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!R) return;
      try {
        const rec = new R();
        rec.lang = (navigator.language || 'en'); rec.interimResults = false; rec.maxAlternatives = 1;
        mic.classList.add('luistert');
        rec.onresult = (ev) => {
          const tekst = (ev.results && ev.results[0] && ev.results[0][0] && ev.results[0][0].transcript) || '';
          if (tekst) { zoek.value = tekst; stelVoor(); const code = this.zoekTaal(tekst).code; if (code) kies(code); }
        };
        rec.onend = () => mic.classList.remove('luistert');
        rec.onerror = () => mic.classList.remove('luistert');
        rec.start();
      } catch (e) { mic.classList.remove('luistert'); }
    },
    // de signatuurlippen: pas laden/tekenen zodra de kiezer echt getoond wordt
    _startMond() {
      const c = document.getElementById('rtg-lang-mond');
      if (!c || this._mond) return;
      const go = () => { if (window.RTGMond && !this._mond) this._mond = window.RTGMond.maak(c); };
      if (window.RTGMond) go();
      else if (!this._mondLaadt) {
        this._mondLaadt = true;
        const s = document.createElement('script'); s.src = '/shared/mond.js'; s.async = true;
        s.onload = go; document.head.appendChild(s);
      }
      this._startSterren();
    },
    // een heel subtiele 3D-sterrenhemel achter de kaart, in RTG-stijl
    _startSterren() {
      const scrim = document.getElementById('rtg-lang-modal');
      if (!scrim || this._sterren) return;
      const go = () => { if (window.RTGSterren && !this._sterren) this._sterren = window.RTGSterren.hang(scrim, { helderheid: 0.85 }); };
      if (window.RTGSterren) return go();
      if (this._sterLaadt) return;
      this._sterLaadt = true;
      const s = document.createElement('script'); s.src = '/shared/sterren.js'; s.async = true;
      s.onload = go; document.head.appendChild(s);
    },
    openModal() {
      if (!document.getElementById('rtg-lang-modal')) this.buildModal(this.chosen ? this.lang : (this._aanbevolen || detectDevice()));
      const m = document.getElementById('rtg-lang-modal'); if (m) m.classList.add('open');
      this._startMond();
      const z = document.getElementById('rtg-lang-zoek');
      if (z) setTimeout(() => { try { z.focus(); } catch (e) {} }, 80);
    },
    closeModal() { const m = document.getElementById('rtg-lang-modal'); if (m) m.classList.remove('open'); },

    /* ---------- kleine taalschakelaar (heropent de keuze) ---------- */
    buildSwitch() {
      if (document.getElementById('rtg-lang-switch')) return;
      // op het leden-OS (app.html) hoort de taal in Instellingen, niet als een
      // los knopje op het scherm; daar zet de tegel "Taal" de keuze open.
      if (/\/apps\/app\.html$/.test(location.pathname)) return;
      const btn = document.createElement('button');
      btn.id = 'rtg-lang-switch';
      btn.className = 'rtg-lang-switch';
      btn.setAttribute('aria-label', 'Taal wijzigen / Change language');
      btn.addEventListener('click', () => this.openModal());
      document.body.appendChild(btn);
      this.updateSwitch();
    },
    updateSwitch() {
      const btn = document.getElementById('rtg-lang-switch');
      if (btn) btn.innerHTML = '<span class="rtg-sw-globe">' + ICOON.globe + '</span>' + this.lang.toUpperCase();
    },

    injectStyles() {
      if (document.getElementById('rtg-i18n-styles')) return;
      const s = document.createElement('style');
      s.id = 'rtg-i18n-styles';
      s.textContent = `
      .rtg-lang-scrim{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;
        background:radial-gradient(120% 90% at 50% 0%,rgba(62,20,32,0.6),rgba(12,12,11,0.92) 60%);
        backdrop-filter:blur(10px);padding:1.1rem;-webkit-font-smoothing:antialiased;}
      .rtg-lang-scrim.open{display:flex;}
      .rtg-lang-card{width:100%;max-width:720px;max-height:92vh;display:flex;flex-direction:column;
        background:linear-gradient(180deg,#141110,#0C0C0B);color:#F5F3EF;border:1px solid rgba(201,162,75,0.22);
        border-radius:22px;padding:1.2rem 1.3rem 1rem;text-align:center;box-shadow:0 40px 120px rgba(0,0,0,0.6);
        font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        animation:rtgLangIn .4s cubic-bezier(.2,.8,.2,1);}
      @keyframes rtgLangIn{from{opacity:0;transform:translateY(16px) scale(.98);}to{opacity:1;transform:none;}}
      .rtg-lang-mond{display:block;width:200px;height:90px;margin:0.1rem auto -0.15rem;}
      .rtg-lang-card h2{font-family:'Bodoni Moda',Georgia,serif;font-weight:500;font-size:1.55rem;margin:0.1rem 0 0.1rem;letter-spacing:-0.01em;color:#F7F3EC;}
      .rtg-lang-card p{color:#B8B2A8;font-size:0.8rem;margin:0 0 0.85rem;}
      .rtg-lang-ai{display:flex;align-items:center;gap:0.45rem;background:rgba(255,255,255,0.05);
        border:1px solid rgba(222,219,213,0.16);border-radius:13px;padding:0.1rem 0.1rem 0.1rem 0.9rem;
        margin:0 auto 0.5rem;max-width:520px;width:100%;transition:border-color .18s;}
      .rtg-lang-ai:focus-within{border-color:#C9A24B;}
      .rtg-lang-ai input{flex:1;min-width:0;background:none;border:none;outline:none;color:#F5F3EF;
        font-family:inherit;font-size:0.92rem;padding:0.7rem 0;}
      .rtg-lang-ai input::placeholder{color:#8A8680;}
      .rtg-lang-ai button{flex:none;background:linear-gradient(180deg,#9E1C40,#7F1634);color:#fff;border:none;cursor:pointer;
        border-radius:10px;padding:0.55rem 0.72rem;font-size:1rem;line-height:1;transition:filter .18s,transform .12s;}
      .rtg-lang-ai button:hover{filter:brightness(1.14);}
      .rtg-lang-ai button:active{transform:scale(0.95);}
      #rtg-lang-mic{background:rgba(255,255,255,0.08);}
      #rtg-lang-mic.luistert{background:linear-gradient(180deg,#C23A5E,#9E1C40);animation:rtgMic 1.1s ease-in-out infinite;}
      @keyframes rtgMic{0%,100%{box-shadow:0 0 0 0 rgba(194,58,94,0.5);}50%{box-shadow:0 0 0 6px rgba(194,58,94,0);}}
      /* Rahuls voorstel: geen knoppenlijst, maar een enkele aantikbare regel */
      .rtg-lang-hint{display:flex;align-items:center;gap:0.7rem;width:100%;max-width:520px;margin:0.1rem auto 0.2rem;
        background:rgba(201,162,75,0.08);border:1px solid rgba(201,162,75,0.3);border-radius:13px;
        padding:0.55rem 0.9rem;cursor:pointer;text-align:left;font-family:inherit;color:#EDE9E2;
        transition:border-color .16s,background .16s,transform .12s;}
      .rtg-lang-hint:hover{border-color:#F5E6B8;background:rgba(201,162,75,0.14);}
      .rtg-lang-hint:active{transform:scale(0.99);}
      .rtg-lang-hint[hidden]{display:none;}
      .rtg-lang-flag{font-size:1.7rem;line-height:1;}
      .rtg-lang-sug{display:flex;flex-direction:column;line-height:1.2;}
      .rtg-lang-sug b{color:#F7F3EC;font-weight:600;font-size:0.98rem;}
      .rtg-lang-go{font-size:0.66rem;letter-spacing:0.04em;color:#C9A24B;}
      .rtg-lang-mis{color:#8A8680;font-size:0.82rem;}
      .rtg-lang-code{display:inline-block;min-width:1.7rem;font-size:0.6rem;font-weight:700;letter-spacing:0.05em;
        color:#C9A24B;border:1px solid rgba(201,162,75,0.4);border-radius:6px;padding:0.3rem 0.2rem;text-align:center;}
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
            WERELD = d.talen; // de actieve set (voor de vertaling)
            // de matcher kent meteen de HELE wereld (alle 114) voor typen/spreken
            this._alleTalen = (Array.isArray(d.alle) && d.alle.length) ? d.alle : d.talen;
            this._lijst = this._alleTalen;
            // De site volgt de telefooninstelling: nu de hele wereld bekend is,
            // kiezen we alsnog de toesteltaal (bijv. Duits of Japans), tenzij het
            // lid zelf al een taal heeft gekozen. Engels blijft de terugval.
            if (!this.chosen) {
              const codes = this._alleTalen.map(t => t.code);
              const dev = detectDevice(codes);
              if (dev && dev !== this.lang) this.apply(dev);
              this._aanbevolen = dev;
            }
            const m = document.getElementById('rtg-lang-modal');
            if (!m || !m.classList.contains('open')) this.buildModal(this._aanbevolen || this.lang);
          }
        })
        .catch(() => {});
    },

    init() {
      this.injectStyles();
      let saved = null;
      try { saved = localStorage.getItem(STORE); } catch (e) {}
      // De site volgt standaard de TELEFOON-/toestelinstelling (navigator.language);
      // kan hij die taal (nog) niet, dan Engels als terugval. Er is geen gedwongen
      // taalkeuze: wie wil wisselen opent de kiezer (de wereldbol linksonder) en
      // typt of spreekt zijn taal. Een eerder gemaakte keuze blijft bewaard.
      if (saved && /^[a-z]{2}$/.test(saved)) {
        this.chosen = true;
        this.apply(saved);
      } else {
        this.apply(detectDevice()); // toesteltaal onder nl/en; laadTalen verruimt straks naar alle 114
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
