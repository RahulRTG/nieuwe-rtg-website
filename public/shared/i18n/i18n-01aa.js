      const zoek = scrim.querySelector('#rtg-lang-zoek');
      const hint = scrim.querySelector('#rtg-lang-hint');
      const self = this;
      // toon Rahuls voorstel (geen knoppenlijst): een vlag + de naam, aantikbaar
      const stelVoor = () => {
        const res = self.zoekTaal(zoek.value.trim());
        if (!zoek.value.trim() || !res.code) {
          hint.hidden = true; hint.removeAttribute('data-lang');
          if (zoek.value.trim()) { hint.hidden = false; hint.removeAttribute('data-lang'); hint.innerHTML = '<span class="rtg-lang-mis">Hmm, not sure yet &mdash; try a country or language.</span>'; }
          return;
        }
        const t = self._lijst.find(x => x.code === res.code) || {};
        hint.hidden = false;
        hint.setAttribute('data-lang', res.code);
        hint.innerHTML = vlag(res.code) +
          '<span class="rtg-lang-sug"><b>' + String(t.naam || res.code).replace(/[<>]/g, '') + '</b>' +
          '<span class="rtg-lang-go">tap to continue &middot; tik om verder te gaan</span></span>';
      };
      const kies = (code) => {
        code = code || self.zoekTaal(zoek.value.trim()).code || self._aanbevolen;
        if (code) { self.set(code); self.closeModal(); }
      };
      zoek.addEventListener('input', stelVoor);
      zoek.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); kies(); } });
      scrim.querySelector('#rtg-lang-rahul').addEventListener('click', () => kies());
      hint.addEventListener('click', () => kies(hint.getAttribute('data-lang')));

      // spreken: de eigen stem invullen en meteen laten herkennen
      const mic = scrim.querySelector('#rtg-lang-mic');
      if (mic) mic.addEventListener('click', () => self._luister(zoek, stelVoor, kies, mic));

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
