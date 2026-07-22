/* ============================================================================
   RTG i18n, taalkeuze + automatische detectie voor de website en alle apps.

   Werking:
   - Nederlands is de basistaal: de tekst staat gewoon in de HTML.
   - Andere talen komen uit een woordenboek dat elke pagina zelf meegeeft via
     window.I18N = { en: { 'sleutel': 'vertaling', ... }, ... }.
   - Elementen krijgen data-i18n="sleutel" (tekst), data-i18n-html="sleutel"
     (met opmaak) of data-i18n-ph="sleutel" (placeholder).
   - Bij het eerste bezoek verschijnt een taalkeuze; de taal van het toestel
     (navigator.language) staat voorgeselecteerd. De keuze wordt onthouden.
   - JS-gerenderde schermen kunnen luisteren naar het 'rtglang'-event en
     RTGi18n.t('sleutel', 'standaard') gebruiken.
   ========================================================================== */
(function () {
  const STORE = 'rtg_lang';
  const LANGS = {
    nl: { label: 'Nederlands', native: 'Nederlands', flag: '🇳🇱' },
    en: { label: 'Engels', native: 'English', flag: '🇬🇧' }
  };
  /* Wereldtalen: de Boardroom bepaalt welke talen aanstaan; de kiezer toont ze
     allemaal. UI-teksten vallen voor andere talen terug op Engels; chats en
     berichten worden door de server echt per taal vertaald. */
  let WERELD = null; // [{code, naam, en}] uit /api/talen
  function supported() { return WERELD ? WERELD.map(t => t.code) : Object.keys(LANGS); }
  const orig = new WeakMap(); // element -> { text, html, ph }

  /* ---------- vlaggen: elke taal krijgt een representatief land ----------
     De 114 talen tonen we als landvlaggen. Een taal is geen land, dus we kiezen
     per taal het land waar hij het meest thuis is; puur als beeld, geen politiek
     statement. Uit de ISO-landcode bouwen we het vlag-emoji (regionale-indicator
     -tekens), dus we bewaren nergens plaatjes. */
  const LAND = {
    nl: 'NL', en: 'GB', de: 'DE', fr: 'FR', es: 'ES', pt: 'PT', it: 'IT', ca: 'ES', gl: 'ES', eu: 'ES',
    ro: 'RO', el: 'GR', tr: 'TR', ru: 'RU', uk: 'UA', be: 'BY', pl: 'PL', cs: 'CZ', sk: 'SK', hu: 'HU',
    bg: 'BG', sr: 'RS', hr: 'HR', bs: 'BA', sl: 'SI', mk: 'MK', sq: 'AL', lt: 'LT', lv: 'LV', et: 'EE',
    fi: 'FI', sv: 'SE', no: 'NO', da: 'DK', is: 'IS', ga: 'IE', cy: 'GB', mt: 'MT', lb: 'LU', fy: 'NL',
    yi: 'IL', ar: 'SA', he: 'IL', fa: 'IR', ku: 'IQ', az: 'AZ', hy: 'AM', ka: 'GE', kk: 'KZ', uz: 'UZ',
    ky: 'KG', tg: 'TJ', tk: 'TM', mn: 'MN', tt: 'RU', hi: 'IN', ur: 'PK', bn: 'BD', pa: 'IN', gu: 'IN',
    mr: 'IN', ta: 'IN', te: 'IN', kn: 'IN', ml: 'IN', si: 'LK', ne: 'NP', ps: 'AF', sd: 'PK', or: 'IN',
    as: 'IN', dv: 'MV', bo: 'CN', zh: 'CN', ja: 'JP', ko: 'KR', th: 'TH', vi: 'VN', id: 'ID', jv: 'ID',
    su: 'ID', ms: 'MY', tl: 'PH', km: 'KH', lo: 'LA', my: 'MM', ug: 'CN', sw: 'KE', am: 'ET', ti: 'ER',
    om: 'ET', so: 'SO', ha: 'NG', yo: 'NG', ig: 'NG', zu: 'ZA', xh: 'ZA', af: 'ZA', st: 'ZA', sn: 'ZW',
    rw: 'RW', mg: 'MG', wo: 'SN', ln: 'CD', ny: 'MW', lg: 'UG', ht: 'HT', qu: 'PE', gn: 'PY', ay: 'BO',
    mi: 'NZ', sm: 'WS', to: 'TO', fj: 'FJ'
  };
  function vlag(code) {
    const iso = LAND[code];
    if (!iso) return '<span class="rtg-lang-code">' + code.toUpperCase() + '</span>';
    return String.fromCodePoint(...[...iso].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
  }
  // veelgebruikte land-/taalnamen die Rahul moet herkennen (genormaliseerd:
  // kleine letters, accenten eraf). De rest matcht op de eigen naam + Engelse naam.
  const ALIAS = {
    nederland: 'nl', holland: 'nl', netherlands: 'nl', vlaanderen: 'nl', belgie: 'nl', belgium: 'nl', suriname: 'nl',
    engeland: 'en', england: 'en', britain: 'en', uk: 'en', amerika: 'en', america: 'en', usa: 'en', australie: 'en', australia: 'en', canada: 'en', ierland: 'en', ireland: 'en',
    duitsland: 'de', germany: 'de', deutschland: 'de', oostenrijk: 'de', austria: 'de', zwitserland: 'de', switzerland: 'de',
    frankrijk: 'fr', france: 'fr',
    spanje: 'es', spain: 'es', espana: 'es', mexico: 'es', argentinie: 'es', argentina: 'es', colombia: 'es', chili: 'es', peru: 'es',
    portugal: 'pt', brazilie: 'pt', brazil: 'pt', brasil: 'pt',
    italie: 'it', italy: 'it', italia: 'it',
    griekenland: 'el', greece: 'el',
    turkije: 'tr', turkey: 'tr', turkiye: 'tr',
    rusland: 'ru', russia: 'ru', oekraine: 'uk', ukraine: 'uk', polen: 'pl', poland: 'pl',
    japan: 'ja', nippon: 'ja', china: 'zh', chinees: 'zh', chinese: 'zh', mandarijn: 'zh', mandarin: 'zh', taiwan: 'zh',
    korea: 'ko', india: 'hi', bharat: 'hi', pakistan: 'ur',
    marokko: 'ar', morocco: 'ar', egypte: 'ar', egypt: 'ar', dubai: 'ar', arabisch: 'ar', arabic: 'ar', saoedi: 'ar',
    iran: 'fa', perzie: 'fa', persia: 'fa', israel: 'he', hebreeuws: 'he', hebrew: 'he',
    indonesie: 'id', indonesia: 'id', bali: 'id', thailand: 'th', vietnam: 'vi', filipijnen: 'tl', philippines: 'tl', maleisie: 'ms', malaysia: 'ms',
    zweden: 'sv', sweden: 'sv', noorwegen: 'no', norway: 'no', denemarken: 'da', denmark: 'da', finland: 'fi', ijsland: 'is', iceland: 'is',
    zuidafrika: 'af', kenia: 'sw', kenya: 'sw', tanzania: 'sw', ethiopie: 'am', ethiopia: 'am', nigeria: 'yo'
  };

  function detectDevice() {
    const list = (navigator.languages && navigator.languages.length)
      ? navigator.languages : [navigator.language || 'nl'];
    for (const raw of list) {
      const code = String(raw || '').toLowerCase().slice(0, 2);
      if (supported().includes(code)) return code;
    }
    return 'en'; // geen match: standaard Engels
  }

  const RTGi18n = {
    lang: 'nl',
    chosen: false,
    // UI-woordenboek: eigen taal als die er is, anders Engels (internationale
    // terugval); Nederlands staat gewoon in de HTML zelf.
    dict(lang) {
      const all = window.I18N || {};
      return all[lang] || (lang !== 'nl' ? all.en : null) || {};
    },
    t(key, fallback) {
      if (this.lang === 'nl') return fallback != null ? fallback : key;
      const v = this.dict(this.lang)[key];
      return v != null ? v : (fallback != null ? fallback : key);
    },

    apply(lang) {
      lang = /^[a-z]{2}$/.test(String(lang || '')) ? lang : 'nl';
      this.lang = lang;
      document.documentElement.setAttribute('lang', lang);
      if (lang !== 'nl' && lang !== 'en') this.laadWereldDict(lang);
      const d = this.dict(lang);

      document.querySelectorAll('[data-i18n]').forEach(el => {
        if (!orig.has(el)) orig.set(el, {});
        const o = orig.get(el);
        if (o.text == null) o.text = el.textContent;
        const val = d[el.getAttribute('data-i18n')];
        el.textContent = (val != null && lang !== 'nl') ? val : o.text;
      });

      document.querySelectorAll('[data-i18n-html]').forEach(el => {
        if (!orig.has(el)) orig.set(el, {});
        const o = orig.get(el);
        if (o.html == null) o.html = el.innerHTML;
        const val = d[el.getAttribute('data-i18n-html')];
        el.innerHTML = (val != null && lang !== 'nl') ? val : o.html;
      });

      document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        if (!orig.has(el)) orig.set(el, {});
        const o = orig.get(el);
        if (o.ph == null) o.ph = el.getAttribute('placeholder') || '';
        const val = d[el.getAttribute('data-i18n-ph')];
        el.setAttribute('placeholder', (val != null && lang !== 'nl') ? val : o.ph);
      });

      this.updateSwitch();
      window.dispatchEvent(new CustomEvent('rtglang', { detail: { lang } }));
    },

    set(lang, remember) {
      if (remember !== false) { try { localStorage.setItem(STORE, lang); } catch (e) {} this.chosen = true; }
      this.apply(lang);
    },

    /* Wereldtaal-woordenboeken: voor elke taal buiten nl/en halen we het
       UI-woordenboek van DEZE pagina live vertaald op (/api/vertaal/ui) en
       bewaren het op het toestel. Zo draait elke pagina volledig in elke
       actieve wereldtaal; zonder AI-sleutel valt de server terug op het
       woordenboek en blijft de Engelse tekst staan waar hij het niet weet
       (nooit een kapot scherm). */
    _wereldDict: {},
    laadWereldDict(lang) {
      if (lang === 'nl' || lang === 'en' || this._wereldDict[lang]) return;
      const all = window.I18N || {};
      if (all[lang]) return; // de pagina bracht dit woordenboek zelf mee
      const en = all.en || {};
      const keys = Object.keys(en).slice(0, 400);
      if (!keys.length) return;
      this._wereldDict[lang] = true;
      const ck = 'rtg_ui_' + lang + '_' + location.pathname.replace(/\W+/g, '') + '_' + keys.length;
      const zet = (d) => {
        window.I18N = window.I18N || {};
        window.I18N[lang] = d;
        if (this.lang === lang) this.apply(lang); // opnieuw toepassen zodra hij er is
      };
      let dict = null;
      try { dict = JSON.parse(localStorage.getItem(ck) || 'null'); } catch (e) {}
      if (dict) return zet(dict);
      fetch('/api/vertaal/ui', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ naar: lang, teksten: keys.map(k => en[k]) }) })
        .then(r => r.json())
        .then(d => {
          if (!d || d.naar !== lang || !Array.isArray(d.teksten)) return;
          const uit = {};
          keys.forEach((k, i) => { uit[k] = d.teksten[i] || en[k]; });
          try { localStorage.setItem(ck, JSON.stringify(uit)); } catch (e) {}
          zet(uit);
        })
        .catch(() => { this._wereldDict[lang] = false; });
    },

    /* ---------- taalkeuze: de wereld in RTG-stijl ----------
       Rahuls signatuurlippen in het midden, alle landvlaggen eromheen, en een
       AI-zoekje: zeg waar je vandaan komt of welke taal je spreekt, en Rahul
       kiest mee. Dezelfde donkere, ingetogen huisstijl als de app-poort. */
    zoekTaal(q) {
      const lijst = this._lijst || [];
      const n = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      const qq = n(q);
      if (!qq) return { code: null, set: new Set(lijst.map(t => t.code)) };
      const set = new Set(); let best = null, bestScore = 0;
      const weeg = (code, sc) => { set.add(code); if (sc > bestScore) { bestScore = sc; best = code; } };
      for (const t of lijst) {
        const naam = n(t.naam), en = n(t.en || ''), code = t.code, iso = (LAND[code] || '').toLowerCase();
        let sc = 0;
        if (code === qq) sc = 100;
        else if (naam === qq || en === qq) sc = 92;
        else if (naam.startsWith(qq)) sc = 82;
        else if (en.startsWith(qq)) sc = 74;
        else if (naam.includes(qq)) sc = 60;
        else if (en.includes(qq)) sc = 52;
        else if (iso === qq) sc = 40;
        if (sc > 0) weeg(code, sc);
      }
      // land-/bijnamen: "holland", "japan", "brazilie" -> de juiste taal
      for (const k in ALIAS) {
        if (k === qq || k.includes(qq) || qq.includes(k)) {
          const c = ALIAS[k];
          if (lijst.some(t => t.code === c)) weeg(c, k === qq ? 96 : 66);
        }
      }
      return { code: best, set };
    },
    buildModal(recommended) {
      const oud = document.getElementById('rtg-lang-modal');
      const stondOpen = oud && oud.classList.contains('open');
      if (oud) oud.remove(); // opnieuw opbouwen zodra de wereldtalen binnen zijn
      this._mond = null; // het oude canvas is weg
      const scrim = document.createElement('div');
      scrim.id = 'rtg-lang-modal';
      scrim.className = 'rtg-lang-scrim';
      // de matcher kent de HELE wereld (alle 114) als die binnen is; anders de
      // actieve set. Er staan geen vlagknoppen meer: je kiest door te typen of
      // te spreken, Rahul herkent je land of taal en stelt hem voor.
      this._lijst = this._alleTalen || WERELD || Object.keys(LANGS).map(c => ({ code: c, naam: LANGS[c].native, en: LANGS[c].label }));
      this._aanbevolen = recommended || 'en';
      const kanSpreken = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
      scrim.innerHTML =
        '<div class="rtg-lang-card" role="dialog" aria-modal="true" aria-label="Choose your language / Kies je taal">' +
          '<canvas class="rtg-lang-mond" id="rtg-lang-mond" width="440" height="200" aria-hidden="true"></canvas>' +
          '<h2>Where in the world are you?</h2>' +
          '<p>Type or say your language &middot; Rahul switches for you</p>' +
          '<div class="rtg-lang-ai">' +
            (kanSpreken ? '<button type="button" id="rtg-lang-mic" aria-label="Speak your language / Spreek je taal">&#127908;</button>' : '') +
            '<input id="rtg-lang-zoek" autocomplete="off" enterkeyhint="go" ' +
              'aria-label="Type your country or language / Typ je land of taal" ' +
              'placeholder="Say or type where you&rsquo;re from&hellip;">' +
            '<button type="button" id="rtg-lang-rahul" aria-label="Let Rahul choose / Laat Rahul kiezen">&#10024;</button>' +
          '</div>' +
          '<button type="button" class="rtg-lang-hint" id="rtg-lang-hint" hidden></button>' +
        '</div>';
      document.body.appendChild(scrim);

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
        hint.innerHTML = '<span class="rtg-lang-flag">' + vlag(res.code) + '</span>' +
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
      if (window.RTGMond) return go();
      if (this._mondLaadt) return;
      this._mondLaadt = true;
      const s = document.createElement('script'); s.src = '/shared/mond.js'; s.async = true;
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
      if (btn) btn.innerHTML = '<span class="rtg-sw-globe">🌐</span>' + this.lang.toUpperCase();
    },

    injectStyles() {
      if (document.getElementById('rtg-i18n-styles')) return;
