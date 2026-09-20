      // De keuze mag nooit de pagina gijzelen: klik ernaast = huidige taal houden.
      scrim.addEventListener('click', e => { if (e.target === scrim) { self.set(self.lang); self.closeModal(); } });
      if (!this._escBound) { // een keer, niet per herbouw
        this._escBound = true;
        document.addEventListener('keydown', e => {
          const m = document.getElementById('rtg-lang-modal');
          if (e.key === 'Escape' && m && m.classList.contains('open')) { this.set(this.lang); this.closeModal(); }
        });
      }
      if (stondOpen) scrim.classList.add('open');
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
    openModal() {
      this._taalTerug = document.activeElement;
      const bestaand = document.getElementById('rtg-lang-modal');
      if (bestaand) bestaand.remove();
      this.buildModal(this.chosen ? this.lang : (this._aanbevolen || detectDevice()));
      const m = document.getElementById('rtg-lang-modal'); if (m) m.classList.add('open');
      const z = document.getElementById('rtg-lang-zoek');
      if (z) setTimeout(() => { try { z.focus(); } catch (e) {} }, 80);
    },
    closeModal() {
      const m = document.getElementById('rtg-lang-modal');
      if (m) m.classList.remove('open');
      const terug = this._taalTerug;
      if (terug && typeof terug.focus === 'function') setTimeout(() => { try { terug.focus(); } catch (e) {} }, 0);
    },

    /* ---------- de taalkeuze heropenen ----------
       De taalknop zweefde linksonder op elk scherm, boven op de themakiezer en
       het vraagteken. Taal is een instelling, dus hij staat nu waar de andere
       instellingen staan: in het bedieningspaneel (shared/bediening.js), dat
       openModal() aanroept. Het leden-OS deed dit al met de tegel "Taal". */
    buildSwitch() {
      const self = this;
      document.querySelectorAll('[data-language-picker]').forEach(function (button) {
        if (button.hasAttribute('data-language-picker-ready')) return;
        button.setAttribute('data-language-picker-ready', 'true');
        button.addEventListener('click', function () { self.openModal(); });
      });
    },
    /* updateSwitch bijgewerkt de knop die er niet meer is. Hij zocht nog naar
       #rtg-lang-switch, en dat element staat sinds de verhuizing naar het
       bedieningspaneel op geen enkele pagina meer -- de blindevlek-toets ving
       het. Het paneel leest de taal vers uit bij elke opening (vulTaal in
       shared/bediening.js), dus er valt hier niets bij te werken. De methode
       blijft bestaan omdat applyTranslations() hem aanroept en losse pagina's
       hem kunnen overschrijven; hij doet alleen niets meer. */
    updateSwitch() { /* geen zwevende knop meer; het paneel leest zelf uit */ },

    injectStyles() {
      if (document.getElementById('rtg-i18n-styles')) return;
      const s = document.createElement('style');
      s.id = 'rtg-i18n-styles';
      s.textContent = `
      .rtg-lang-scrim{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;overflow:auto;
        background:rgba(7,7,6,0.76);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
        padding:max(1rem,env(safe-area-inset-top,0px)) max(1rem,env(safe-area-inset-right,0px))
          max(1rem,env(safe-area-inset-bottom,0px)) max(1rem,env(safe-area-inset-left,0px));-webkit-font-smoothing:antialiased;}
      .rtg-lang-scrim.open{display:flex;}
      .rtg-lang-card,.rtg-lang-card *{box-sizing:border-box;}
      .rtg-lang-card{position:relative;isolation:isolate;width:100%;max-width:560px;max-height:min(92vh,760px);overflow:auto;
        display:flex;flex-direction:column;background:linear-gradient(155deg,#191712 0%,#0C0B09 68%);color:#F5F0E7;
        border:1px solid rgba(225,192,122,0.48);border-radius:var(--rtg-radius-system,22px);padding:1.4rem 1.45rem 1.5rem;text-align:left;
        box-shadow:0 32px 90px rgba(0,0,0,0.58),inset 0 1px 0 rgba(255,255,255,0.05);
        font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;animation:rtgLangIn .4s cubic-bezier(.2,.8,.2,1);}
      @keyframes rtgLangIn{from{opacity:0;transform:translateY(16px) scale(.98);}to{opacity:1;transform:none;}}
      .rtg-lang-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:0.85rem;}
      .rtg-lang-eyebrow{font-size:0.64rem;font-weight:650;line-height:1;letter-spacing:0.19em;text-transform:uppercase;color:#D8B873;}
      .rtg-lang-close{display:grid;place-items:center;width:2.45rem;height:2.45rem;flex:0 0 auto;padding:0;color:#F5F0E7;
        background:rgba(255,255,255,0.035);border:1px solid rgba(245,240,231,0.2);border-radius:50%;cursor:pointer;}
      .rtg-lang-close:hover{border-color:#D8B873;background:rgba(216,184,115,0.09);}
      .rtg-lang-close:focus-visible,.rtg-lang-search button:focus-visible,.rtg-lang-hint:focus-visible,.rtg-lang-quick:focus-visible{outline:2px solid #F2D99E;outline-offset:3px;}
      .rtg-lang-card h2{font-family:'Bodoni Moda',Georgia,serif;font-weight:500;font-size:clamp(2rem,6vw,3rem);line-height:0.98;
        margin:0;letter-spacing:-0.025em;color:#FAF6EF;}
      .rtg-lang-card>p{max-width:29rem;color:#B9B2A6;font-size:0.86rem;line-height:1.55;margin:0.65rem 0 1.25rem;}
      .rtg-lang-label{display:block;margin-bottom:0.42rem;color:#D8B873;font-size:0.62rem;font-weight:650;letter-spacing:0.14em;text-transform:uppercase;}
      .rtg-lang-search{display:flex;align-items:center;gap:0.4rem;width:100%;min-height:3.55rem;background:rgba(255,255,255,0.035);
        border:1px solid rgba(245,240,231,0.22);border-radius:var(--rtg-radius-content,2px);padding:0.3rem 0.32rem 0.3rem 0.75rem;margin:0 0 0.7rem;
        transition:border-color .18s,background .18s;}
      .rtg-lang-search:focus-within{border-color:#D8B873;background:rgba(216,184,115,0.055);}
      .rtg-lang-search input{flex:1;min-width:0;background:none;border:none;outline:none;color:#F5F3EF;font-family:inherit;font-size:0.88rem;padding:0.7rem 0;}
      .rtg-lang-search input::placeholder{color:#817C74;}
      .rtg-lang-search button{flex:none;min-height:2.8rem;background:#D8B873;color:#17140F;border:1px solid #D8B873;cursor:pointer;
        border-radius:var(--rtg-radius-content,2px);padding:0.65rem 0.9rem;font-family:inherit;font-size:0.73rem;font-weight:700;line-height:1;letter-spacing:0.05em;
        transition:filter .18s,transform .12s,background .18s;}
      .rtg-lang-search button:hover{background:#E8CE95;filter:none;}
      .rtg-lang-search button:active{transform:scale(0.95);}
      #rtg-lang-mic{display:grid;place-items:center;min-width:2.8rem;padding:0;background:rgba(255,255,255,0.045);color:#E9DFCC;
        border-color:rgba(245,240,231,0.17);}
      #rtg-lang-mic.luistert{background:#D8B873;color:#17140F;animation:rtgMic 1.1s ease-in-out infinite;}
      @keyframes rtgMic{0%,100%{box-shadow:0 0 0 0 rgba(216,184,115,0.46);}50%{box-shadow:0 0 0 6px rgba(216,184,115,0);}}
      .rtg-lang-hint{display:flex;align-items:center;gap:0.75rem;width:100%;margin:0 0 0.9rem;background:rgba(216,184,115,0.08);
        border:1px solid rgba(216,184,115,0.62);border-radius:var(--rtg-radius-content,2px);padding:0.75rem 0.85rem;cursor:pointer;text-align:left;
        font-family:inherit;color:#EDE9E2;transition:border-color .16s,background .16s,transform .12s;}
      .rtg-lang-hint:hover{border-color:#F2D99E;background:rgba(216,184,115,0.14);}
      .rtg-lang-hint:active{transform:scale(0.99);}
      .rtg-lang-hint[hidden]{display:none;}
      .rtg-lang-hint:disabled{cursor:default;border-color:rgba(245,240,231,0.16);background:rgba(255,255,255,0.025);}
      .rtg-lang-sug{display:flex;flex-direction:column;line-height:1.2;}
      .rtg-lang-sug b{color:#FAF6EF;font-weight:600;font-size:0.95rem;}
      .rtg-lang-go{margin-top:0.16rem;font-size:0.62rem;letter-spacing:0.09em;text-transform:uppercase;color:#D8B873;}
      .rtg-lang-mis{color:#A8A198;font-size:0.8rem;line-height:1.4;}
      .rtg-lang-quick-wrap{margin-top:0.15rem;padding-top:0.95rem;border-top:1px solid rgba(245,240,231,0.12);}
      .rtg-lang-quick-wrap>span{display:block;margin-bottom:0.55rem;color:#918B82;font-size:0.61rem;font-weight:650;letter-spacing:0.14em;text-transform:uppercase;}
      .rtg-lang-quick-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.55rem;}
      .rtg-lang-quick{display:flex;align-items:center;gap:0.65rem;min-width:0;min-height:3.55rem;padding:0.65rem 0.75rem;color:#EDE8DF;
        background:rgba(255,255,255,0.025);border:1px solid rgba(245,240,231,0.16);border-radius:var(--rtg-radius-content,2px);font-family:inherit;text-align:left;
        cursor:pointer;transition:border-color .16s,background .16s,transform .12s;}
      .rtg-lang-quick:hover,.rtg-lang-quick.is-active{border-color:#D8B873;background:rgba(216,184,115,0.09);}
      .rtg-lang-quick:active{transform:scale(0.985);}
      .rtg-lang-quick>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:0.82rem;font-weight:560;white-space:nowrap;}
      .rtg-lang-code{display:inline-grid;place-items:center;min-width:2rem;height:2rem;flex:0 0 auto;font-size:0.58rem;font-weight:750;
        letter-spacing:0.08em;color:#D8B873;border:1px solid rgba(216,184,115,0.46);border-radius:var(--rtg-radius-content,2px);padding:0 0.3rem;text-align:center;}
      [dir="rtl"] .rtg-lang-card,[dir="rtl"] .rtg-lang-hint,[dir="rtl"] .rtg-lang-quick{text-align:right;}
      @media(max-width:600px){
        .rtg-lang-scrim{align-items:flex-end;padding:0.75rem max(0.75rem,env(safe-area-inset-right,0px)) max(0.75rem,env(safe-area-inset-bottom,0px)) max(0.75rem,env(safe-area-inset-left,0px));}
        .rtg-lang-card{max-height:calc(100dvh - 1.5rem);border-radius:var(--rtg-radius-system,22px);padding:1.15rem 1rem 1.05rem;}
        .rtg-lang-card h2{font-size:2.1rem;}
        .rtg-lang-card>p{font-size:0.8rem;margin-bottom:1rem;}
        .rtg-lang-search{min-height:3.3rem;padding-left:0.55rem;}
        .rtg-lang-search input{font-size:0.82rem;}
        .rtg-lang-search button{min-height:2.55rem;padding:0.55rem 0.65rem;}
        #rtg-lang-mic{min-width:2.55rem;}
        .rtg-lang-quick{min-height:3.25rem;padding:0.55rem 0.6rem;}
      }
      .rtg-lang-switch{position:fixed;left:14px;bottom:14px;z-index:9990;display:inline-flex;align-items:center;gap:0.35rem;
        background:rgba(12,12,11,0.82);color:#fff;border:1px solid rgba(255,255,255,0.16);border-radius:0;
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
      return fetch(apiPad('/api/talen'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d.talen) && d.talen.length >= 2) {
            WERELD = d.talen; // de actieve set (voor de vertaling)
            // de matcher kent meteen de HELE wereld (alle 114) voor typen/spreken
            this._alleTalen = (Array.isArray(d.alle) && d.alle.length) ? d.alle : d.talen;
            // Dezelfde 24 kerntalen als op www staan vooraan; de overige
            // wereldtalen blijven vindbaar via land- of taalnaam.
            this._alleTalen = this._alleTalen.slice().sort((a, b) =>
              Number(!!b.kern) - Number(!!a.kern));
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

  window.addEventListener('storage',event=>{
    if(event.key===STORE && /^[a-z]{2}$/.test(event.newValue || '')) { RTGi18n.chosen=true; RTGi18n.set(event.newValue,false); }
  });
  window.RTGi18n = RTGi18n;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RTGi18n.init());
  } else {
    RTGi18n.init();
  }
})();
