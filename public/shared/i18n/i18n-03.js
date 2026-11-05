      // De keuze mag nooit de pagina gijzelen: klik ernaast = huidige taal houden.
      scrim.addEventListener('click', e => { if (e.target === scrim) { self.set(self.lang); self.closeModal(); } });
      scrim.addEventListener('cancel', e => { e.preventDefault(); self.set(self.lang); self.closeModal(); });
      if (stondOpen) { scrim.classList.add('open'); scrim.showModal(); }
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
      const bestaand = document.getElementById('rtg-lang-modal');
      if (!bestaand || !bestaand.classList.contains('open')) this._taalTerug = document.activeElement;
      if (bestaand) bestaand.remove();
      this.buildModal(this.chosen ? this.lang : (this._aanbevolen || detectDevice()));
      const m = document.getElementById('rtg-lang-modal');
      if (m) { m.classList.add('open'); if (m.tagName === 'DIALOG') m.showModal(); }
      const z = document.getElementById('rtg-lang-zoek');
      if (z) {
        const focusZoek = () => { if (m.isConnected && m.classList.contains('open')) { try { z.focus({ preventScroll: true }); } catch (e) {} } };
        if (m.tagName === 'DIALOG') focusZoek(); else setTimeout(focusZoek, 80);
      }
    },
    closeModal() {
      const m = document.getElementById('rtg-lang-modal');
      if (m) { m.classList.remove('open'); if (m.tagName === 'DIALOG' && m.open) m.close(); }
      const terug = this._taalTerug;
      if (terug && typeof terug.focus === 'function') setTimeout(() => { if (terug.isConnected) { try { terug.focus({ preventScroll: true }); } catch (e) {} } }, 0);
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
      laadI18nLegacyStijl('/ds/taalkeuze-standalone.css');
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
            // Dezelfde 55 producttalen als op www staan vooraan; de overige
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
